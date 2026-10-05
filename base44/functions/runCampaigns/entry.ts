import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Kampanje: vsako uro pripravi naslednje sporočilo za vsako aktivno vključitev, ki je na vrsti.
// Sporočilo gre v "Za odobritev" ali pa ga crmEvents samodejno odobri (Campaign.auto_send).
// Ko stranka odgovori, crmEvents vključitev ustavi (stopped_replied).

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const MAX_AI_PER_RUN = 15;
const DAY = 86400000;

const lastTouch = (l) => Math.max(...[l.last_inbound_at, l.last_contacted_at, l.created_date].filter(Boolean).map((d) => new Date(d).getTime()));
const matchAudience = (lead, a = {}) => {
  if (!lead.email || lead.consent_email === false || lead.status === 'unsubscribed') return false;
  if (a.stages?.length && !a.stages.includes(lead.status || 'new')) return false;
  if (a.sources?.length && !a.sources.includes(lead.source)) return false;
  if (a.has_company === 'yes' && !lead.company_id) return false;
  if (a.has_company === 'no' && lead.company_id) return false;
  if (a.inactive_days > 0 && Date.now() - lastTouch(lead) < a.inactive_days * DAY) return false;
  return true;
};
const firstName = (name) => {
  const n = String(name || '').trim().split(/\s+/)[0] || '';
  return /^[A-ZČŠŽĆĐ][a-zčšžćđ]+$/.test(n) ? n : '';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const sr = base44.asServiceRole.entities;

    let campaigns;
    if (body.business_id) {
      const biz = (await sr.Business.filter({ id: body.business_id }))[0];
      if (!biz) return Response.json({ error: 'Podjetje ni najdeno.' });
      const owns = internal || user?.role === 'admin' || (user && (biz.created_by_id === user.id || biz.created_by === user.email || biz.owner_email === user.email));
      if (!owns) return Response.json({ error: 'Nimate dostopa.' });
      campaigns = await sr.Campaign.filter({ business_id: biz.id, status: 'active' });
    } else {
      if (!internal && user?.role !== 'admin') return Response.json({ error: 'Unauthorized' });
      campaigns = await sr.Campaign.filter({ status: 'active' });
    }

    const now = Date.now();
    const summary = { campaigns: campaigns.length, enrolled: 0, drafts: 0, completed: 0, stopped: 0, errors: [] };
    let aiUsed = 0;
    const bizCache = {};

    for (const camp of campaigns) {
      if (camp.is_demo) continue;
      const steps = Array.isArray(camp.steps) ? camp.steps : [];
      if (!steps.length) continue;
      const business = bizCache[camp.business_id] || (bizCache[camp.business_id] = (await sr.Business.filter({ id: camp.business_id }))[0]);
      if (!business) continue;
      const owner = business.owner_email || business.created_by;

      const [leads, enrollments] = await Promise.all([
        sr.Lead.filter({ business_id: camp.business_id }),
        sr.CampaignEnrollment.filter({ business_id: camp.business_id, campaign_id: camp.id }),
      ]);
      const leadsById = Object.fromEntries(leads.map((l) => [l.id, l]));

      // Samodejno vključi nove ustrezne stranke
      if (camp.audience?.auto_enroll) {
        const enrolled = new Set(enrollments.map((e) => e.lead_id));
        for (const l of leads) {
          if (l.is_demo || enrolled.has(l.id) || !matchAudience(l, camp.audience)) continue;
          const e = await sr.CampaignEnrollment.create({ business_id: camp.business_id, owner_email: owner, created_by: owner, campaign_id: camp.id, lead_id: l.id, current_step: 0, status: 'active', next_send_at: new Date(now + (Number(steps[0].delay_days) || 0) * DAY).toISOString() });
          enrollments.push(e); summary.enrolled++;
        }
      }

      const due = enrollments.filter((e) => e.status === 'active' && (!e.next_send_at || new Date(e.next_send_at).getTime() <= now));
      for (const e of due) {
        const lead = leadsById[e.lead_id];
        if (!lead || lead.status === 'unsubscribed' || !lead.email || lead.consent_email === false) {
          await sr.CampaignEnrollment.update(e.id, { status: lead?.status === 'unsubscribed' ? 'stopped_unsubscribed' : 'stopped_manual' });
          summary.stopped++; continue;
        }
        if (lead.last_inbound_at && new Date(lead.last_inbound_at) > new Date(e.created_date)) {
          await sr.CampaignEnrollment.update(e.id, { status: 'stopped_replied' });
          summary.stopped++; continue;
        }
        const idx = Number(e.current_step) || 0;
        const step = steps[idx];
        if (!step) { await sr.CampaignEnrollment.update(e.id, { status: 'completed' }); summary.completed++; continue; }

        let ok = false;
        if (step.ai_personalize && aiUsed < MAX_AI_PER_RUN) {
          aiUsed++;
          try {
            const res = await base44.asServiceRole.functions.invoke('generateDraft', {
              internal_secret: INTERNAL_SECRET, business_id: camp.business_id, lead_id: lead.id, pillar: 'campaign',
              template: { subject: step.subject, body: step.body }, campaign_id: camp.id, campaign_step: idx + 1, sequence_step: idx + 1,
            });
            const d = res?.data ?? res;
            if (d?.error) throw new Error(d.error);
            ok = !!d?.draft;
          } catch (err) {
            summary.errors.push(`${camp.name}/${lead.name}: ${err?.response?.data?.error || err?.message || err}`);
          }
        } else if (step.ai_personalize) {
          continue; // limit AI za ta zagon dosežen — naslednjič
        }
        if (!ok && !step.ai_personalize) {
          const fn = firstName(lead.name);
          const bodyText = String(step.body || '').replace(/^Spoštovani,/m, fn ? `Pozdravljeni, ${fn},` : 'Pozdravljeni,');
          await sr.DraftMessage.create({
            business_id: camp.business_id, lead_id: lead.id, pillar: 'campaign', channel: 'email', subject: step.subject, body: bodyText,
            status: 'pending', quality_score: 8, campaign_id: camp.id, campaign_step: idx + 1, scheduled_at: new Date().toISOString(),
            ai_reasoning: `Kampanja »${camp.name}«, sporočilo ${idx + 1} od ${steps.length}.`, created_by: business.created_by, owner_email: owner,
          });
          ok = true;
        }
        if (!ok) continue;
        summary.drafts++;
        const next = steps[idx + 1];
        await sr.CampaignEnrollment.update(e.id, next
          ? { current_step: idx + 1, last_sent_at: new Date().toISOString(), next_send_at: new Date(now + (Number(next.delay_days) || 0) * DAY).toISOString() }
          : { current_step: idx + 1, last_sent_at: new Date().toISOString(), status: 'completed' });
        if (!next) summary.completed++;
      }

      const fresh = await sr.CampaignEnrollment.filter({ business_id: camp.business_id, campaign_id: camp.id });
      await sr.Campaign.update(camp.id, {
        last_run_at: new Date().toISOString(),
        stats: { enrolled: fresh.length, active: fresh.filter((x) => x.status === 'active').length, replied: fresh.filter((x) => x.status === 'stopped_replied').length, completed: fresh.filter((x) => x.status === 'completed').length },
      });
    }

    return Response.json({ success: true, ...summary });
  } catch (error) {
    return Response.json({ error: 'runCampaigns: ' + (error?.message || String(error)) });
  }
});
