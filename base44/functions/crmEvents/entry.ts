import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Osrednji CRM poslušalec (workflowi na entitetah). Iz dogodkov zgradi časovnico stranke (Activity),
// ustavi kampanje, ko stranka odgovori, in izvede samodejno pošiljanje po vrsti (Business.auto_send).

const iso = (d) => (d ? new Date(d).toISOString() : new Date().toISOString());
const short = (s, n = 600) => String(s || '').replace(/\s+\n/g, '\n').trim().slice(0, n);

const autoKey = (draft, lead) => {
  if (draft.campaign_id) return 'campaign';
  if (draft.pillar === 'web_form_lead') return lead?.source === 'email' ? 'email_inquiry' : 'web_form_lead';
  return draft.pillar;
};

function detect(body) {
  const e = body?.args?.entity || body?.entity || body?.event?.entity_name;
  if (e) return e;
  const d = body?.data || {};
  if ('pillar' in d && 'body' in d) return 'DraftMessage';
  if ('booked_at' in d) return 'ConfirmedBooking';
  if ('output_markdown' in d || 'output_pdf_url' in d) return 'OfferGeneration';
  if ('source' in d && 'name' in d) return 'Lead';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const data = body?.data;
    const old = body?.old_data || null;
    const evType = body?.event?.type || (old ? 'update' : 'create');
    if (!data?.id || !data?.business_id) return Response.json({ skipped: true, reason: 'no data' });
    const entity = detect(body);
    if (data.is_demo && evType === 'create' && ['ConfirmedBooking', 'OfferGeneration'].includes(entity)) return Response.json({ skipped: true, reason: 'demo seed' });
    const sr = base44.asServiceRole.entities;
    const business = (await sr.Business.filter({ id: data.business_id }))[0];
    if (!business) return Response.json({ skipped: true, reason: 'no business' });
    const owner = business.owner_email || business.created_by;
    const log = (a) => sr.Activity.create({ business_id: business.id, owner_email: owner, created_by: owner, is_demo: !!data.is_demo, ...a });

    if (entity === 'Lead') {
      if (evType === 'create') {
        if (data.is_demo) return Response.json({ skipped: true, reason: 'demo seed' });
        const map = { email: ['email_in', 'Povpraševanje po e-pošti'], form: ['form', 'Povpraševanje prek obrazca na spletni strani'], chatbot: ['chat', 'Kontakt iz spletnega klepeta'], import: ['system', 'Uvožena stranka'], manual: ['note', 'Stranka dodana ročno'] };
        const [type, title] = map[data.source] || ['system', 'Nova stranka'];
        await log({ lead_id: data.id, company_id: data.company_id || null, type, direction: ['email', 'form', 'chatbot'].includes(data.source) ? 'inbound' : 'internal', subject: data.email_subject || title, content: short(data.notes), occurred_at: iso(data.last_inbound_at || data.created_date), is_automated: data.source !== 'manual' });
        return Response.json({ success: true, logged: 'lead_created' });
      }
      if (old && data.last_inbound_at && data.last_inbound_at !== old.last_inbound_at) {
        const firstNote = String(data.notes || '').split('\n')[0];
        await log({ lead_id: data.id, company_id: data.company_id || null, type: 'email_in', direction: 'inbound', subject: data.email_subject || 'Odgovor stranke', content: short(firstNote), occurred_at: iso(data.last_inbound_at), is_automated: true });
        const enr = await sr.CampaignEnrollment.filter({ business_id: business.id, lead_id: data.id, status: 'active' });
        await Promise.all(enr.map((e) => sr.CampaignEnrollment.update(e.id, { status: 'stopped_replied' })));
        const open = await sr.Task.filter({ business_id: business.id, lead_id: data.id, status: 'open' });
        if (!open.some((t) => t.type === 'email' || t.type === 'followup')) {
          await sr.Task.create({ business_id: business.id, owner_email: owner, created_by: owner, lead_id: data.id, company_id: data.company_id || null, title: `Odgovorite: ${data.name}`, description: data.email_subject || '', type: 'email', priority: 'high', due_at: new Date(Date.now() + 24 * 3600e3).toISOString(), source: 'system', is_demo: !!data.is_demo });
        }
      }
      if (old && data.status !== old.status) {
        const L = { new: 'Novo', contacted: 'Kontaktirano', replied: 'Odgovorili so', booked: 'Termin', converted: 'Stranka', lost: 'Izgubljeno', unsubscribed: 'Odjavljen' };
        await log({ lead_id: data.id, company_id: data.company_id || null, type: 'system', direction: 'internal', subject: `Faza: ${L[old.status] || old.status} → ${L[data.status] || data.status}`, occurred_at: iso() });
        if (data.status === 'unsubscribed') {
          const enr = await sr.CampaignEnrollment.filter({ business_id: business.id, lead_id: data.id, status: 'active' });
          await Promise.all(enr.map((e) => sr.CampaignEnrollment.update(e.id, { status: 'stopped_unsubscribed' })));
        }
      }
      return Response.json({ success: true });
    }

    if (entity === 'DraftMessage') {
      const lead = data.lead_id ? (await sr.Lead.filter({ id: data.lead_id }))[0] : null;
      if (evType === 'create' && data.status === 'pending') {
        const key = autoKey(data, lead);
        const auto = business.auto_send || {};
        let allowed = auto[key] === true;
        if (data.campaign_id) {
          const camp = (await sr.Campaign.filter({ id: data.campaign_id }))[0];
          allowed = !!camp?.auto_send;
        }
        if (business.subscription_status === 'trialing') allowed = false;
        if (allowed && (data.quality_score ?? 7) >= 7) {
          await sr.DraftMessage.update(data.id, { status: 'approved', reviewer_notes: `${data.reviewer_notes ? data.reviewer_notes + ' ' : ''}Samodejno poslano (nastavitev za to vrsto sporočil).` });
          return Response.json({ success: true, auto_approved: key });
        }
        return Response.json({ skipped: true, reason: 'manual approval' });
      }
      if (old && data.status === 'sent' && old.status !== 'sent') {
        await log({ lead_id: data.lead_id, company_id: lead?.company_id || null, type: 'email_out', direction: 'outbound', subject: data.subject, content: short(data.body, 1500), occurred_at: iso(data.sent_at), is_automated: /Samodejno/.test(data.reviewer_notes || ''), draft_id: data.id });
      }
      return Response.json({ success: true });
    }

    if (entity === 'ConfirmedBooking' && evType === 'create') {
      const lead = data.lead_id ? (await sr.Lead.filter({ id: data.lead_id }))[0] : null;
      await log({ lead_id: data.lead_id, company_id: lead?.company_id || null, type: 'booking', direction: 'internal', subject: `Termin ${new Date(data.booked_at).toLocaleString('sl-SI', { timeZone: 'Europe/Ljubljana', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`, content: short(data.notes), occurred_at: iso(), booking_id: data.id });
      if (lead && ['new', 'contacted', 'replied'].includes(lead.status)) await sr.Lead.update(lead.id, { status: 'booked' });
      return Response.json({ success: true });
    }

    if (entity === 'OfferGeneration' && data.status === 'completed' && (!old || old.status !== 'completed') && (data.lead_id || data.company_id)) {
      await log({ lead_id: data.lead_id || null, company_id: data.company_id || null, type: 'offer', direction: 'internal', subject: `Pripravljena ponudba${data.amount ? ` (${Math.round(data.amount)} €)` : ''}`, content: short(data.output_markdown, 300), occurred_at: iso(), offer_id: data.id });
      return Response.json({ success: true });
    }

    return Response.json({ skipped: true, reason: `unhandled ${entity}/${evType}` });
  } catch (error) {
    return Response.json({ error: 'crmEvents: ' + (error?.message || String(error)) });
  }
});
