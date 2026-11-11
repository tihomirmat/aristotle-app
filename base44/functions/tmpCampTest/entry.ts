import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
// ZAČASNO: preizkus e-poštnih kampanj iz seznama (pošiljanje, takojšnja zavrnitev, odbita sporočila, ustavitev). Izbriši po testu.
const S = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const BID = '69fdc32dd7a14b17ffa223d1';
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  if (body.key !== 'tc-7731') return Response.json({ error: 'no' });
  const sr = base44.asServiceRole.entities;
  const inv = async (fn, args) => { const r = await base44.asServiceRole.functions.invoke(fn, { internal_secret: S, ...args }); return r?.data ?? r; };
  try {
    if (body.action === 'setup') {
      const b = (await sr.Business.filter({ id: BID }))[0];
      const owner = b.owner_email;
      const mb = await sr.SendingMailbox.create({ business_id: BID, owner_email: owner, created_by: owner, email: b.smtp_user, from_name: 'Spletnost (TEST kampanje)', smtp_host: b.smtp_host, smtp_port: b.smtp_port, smtp_encryption: b.smtp_encryption, smtp_pass: b.smtp_pass, imap_enabled: true, imap_host: b.imap_host, imap_port: b.imap_port || 993, imap_pass: b.imap_pass, status: 'ok', sent_today: 0, total_sent: 0, bounces_total: 0 });
      const baseline = await inv('syncCampaignMailboxes', { mailbox_id: mb.id });
      const imp = await inv('importContacts', { business_id: BID, name: 'TEST seznam (izbriši)', file_name: 'test.csv', rows: body.rows });
      const camp = await sr.Campaign.create({ business_id: BID, owner_email: owner, created_by: owner, name: 'TEST: kampanja iz seznama (izbriši)', goal: 'acquisition', source: 'list', list_ids: [imp.list_id], mailbox_ids: [mb.id], status: 'active', auto_send: true, stats: {},
        steps: [{ order: 1, delay_days: 0, subject: 'Preizkus e-poštne kampanje', body: 'Spoštovani,\n\nto je preizkusno sporočilo e-poštne kampanje iz aplikacije AI Aristotle (podjetje: {podjetje}).\n\nNa to sporočilo ni treba odgovoriti.', ai_personalize: false }, { order: 2, delay_days: 3, subject: 'Preizkus: opomnik', body: 'Spoštovani,\n\nto je drugo preizkusno sporočilo.', ai_personalize: false }] });
      return Response.json({ mailbox_id: mb.id, baseline, imp, campaign_id: camp.id });
    }
    if (body.action === 'run') return Response.json(await inv('runCampaigns', { business_id: BID }));
    if (body.action === 'sync') return Response.json(await inv('syncCampaignMailboxes', { business_id: BID }));
    if (body.action === 'state') {
      const camp = (await sr.Campaign.filter({ id: body.campaign_id }))[0];
      const enr = await sr.CampaignEnrollment.filter({ campaign_id: body.campaign_id });
      const cs = await sr.ListContact.filter({ list_id: camp?.list_ids?.[0] });
      const mb = (await sr.SendingMailbox.filter({ id: body.mailbox_id }))[0];
      return Response.json({ camp: { status: camp?.status, paused_reason: camp?.paused_reason, bounce_alert: camp?.bounce_alert, stats: camp?.stats }, enr: enr.map((e) => ({ email: e.email, status: e.status, step: e.current_step, next: e.next_send_at, reason: e.bounce_reason, mid: e.last_message_id })), contacts: cs.map((c) => ({ email: c.email, status: c.status, note: c.check_note, reason: c.bounce_reason })), mb: { sent_today: mb?.sent_today, sent_date: mb?.sent_date, total: mb?.total_sent, first: mb?.first_send_at, uid: mb?.imap_last_uid, err: mb?.last_error, bounces: mb?.bounces_total } });
    }
    if (body.action === 'cleanup') {
      const camp = (await sr.Campaign.filter({ id: body.campaign_id }))[0];
      for (const e of await sr.CampaignEnrollment.filter({ campaign_id: body.campaign_id })) await sr.CampaignEnrollment.delete(e.id);
      if (camp) { const del = await inv('importContacts', { business_id: BID, action: 'delete', list_id: camp.list_ids[0] }); await sr.Campaign.delete(camp.id); if (body.mailbox_id) await sr.SendingMailbox.delete(body.mailbox_id); return Response.json({ ok: true, del }); }
      if (body.mailbox_id) await sr.SendingMailbox.delete(body.mailbox_id);
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'action?' });
  } catch (e) { return Response.json({ error: e?.message || String(e), stack: String(e?.stack || '').slice(0, 600) }); }
});
