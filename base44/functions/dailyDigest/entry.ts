import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Jutranji povzetek: vsak delovni dan ob uri, ki jo izbere lastnik (privzeto 7:00 po slovenskem času),
// pošlje KRATKO sporočilo: kaj najprej, kaj čaka na odobritev, opravila danes/zamujena, novi kontakti, današnji termini.
// Če ni ničesar, ne pošlje ničesar.

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ljParts = (d = new Date()) => {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: p.weekday };
};
const ljDate = (iso) => ljParts(new Date(iso)).date;
const time = (iso) => new Date(iso).toLocaleTimeString('sl-SI', { timeZone: 'Europe/Ljubljana', hour: '2-digit', minute: '2-digit' });

async function buildDigest(sr, business) {
  const today = ljParts().date;
  const since = business.last_digest_at || new Date(Date.now() - 24 * 3600e3).toISOString();
  const [drafts, tasks, leads, bookings] = await Promise.all([
    sr.DraftMessage.filter({ business_id: business.id }),
    sr.Task.filter({ business_id: business.id, status: 'open' }),
    sr.Lead.filter({ business_id: business.id }),
    sr.ConfirmedBooking.filter({ business_id: business.id }),
  ]);
  const leadsById = Object.fromEntries(leads.map((l) => [l.id, l]));
  const pending = drafts.filter((d) => ['pending', 'flagged_for_review'].includes(d.status));
  const overdue = tasks.filter((t) => t.due_at && ljDate(t.due_at) < today);
  const dueToday = tasks.filter((t) => t.due_at && ljDate(t.due_at) === today);
  const fresh = leads.filter((l) => l.created_date > since && l.status === 'new');
  const todayBookings = bookings.filter((b) => b.status !== 'cancelled' && b.booked_at && ljDate(b.booked_at) === today).sort((a, b) => a.booked_at.localeCompare(b.booked_at));

  // Kaj najprej: zamujeno nujno opravilo > najstarejši odgovor, ki čaka > prvi termin
  let first = null;
  const urgent = [...overdue, ...dueToday].sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1) || a.due_at.localeCompare(b.due_at))[0];
  const oldestPending = [...pending].sort((a, b) => a.created_date.localeCompare(b.created_date))[0];
  if (urgent) first = { text: urgent.title, url: `${APP_URL}/opravila` };
  else if (oldestPending) first = { text: `Odgovorite ${leadsById[oldestPending.lead_id]?.name || 'stranki'} (odgovor je pripravljen)`, url: `${APP_URL}/stranke?tab=odgovori` };
  else if (todayBookings[0]) first = { text: `Termin ob ${time(todayBookings[0].booked_at)} — ${leadsById[todayBookings[0].lead_id]?.name || ''}`, url: `${APP_URL}/` };

  const lines = [];
  if (pending.length) lines.push({ n: pending.length, label: pending.length === 1 ? 'pripravljen odgovor čaka na vas' : 'pripravljenih odgovorov čaka na vas', url: `${APP_URL}/stranke?tab=odgovori`, items: pending.slice(0, 3).map((d) => `${leadsById[d.lead_id]?.name || 'Stranka'}: ${d.subject || ''}`) });
  if (overdue.length) lines.push({ n: overdue.length, label: overdue.length === 1 ? 'opravilo zamuja' : 'opravil zamuja', url: `${APP_URL}/opravila`, items: overdue.slice(0, 3).map((t) => t.title) });
  if (dueToday.length) lines.push({ n: dueToday.length, label: dueToday.length === 1 ? 'opravilo za danes' : 'opravil za danes', url: `${APP_URL}/opravila`, items: dueToday.slice(0, 3).map((t) => t.title) });
  if (fresh.length) lines.push({ n: fresh.length, label: fresh.length === 1 ? 'nov kontakt' : 'novih kontaktov', url: `${APP_URL}/stranke`, items: fresh.slice(0, 3).map((l) => `${l.name}${l.service_requested ? ' — ' + l.service_requested : ''}`) });
  if (todayBookings.length) lines.push({ n: todayBookings.length, label: todayBookings.length === 1 ? 'termin danes' : 'terminov danes', url: `${APP_URL}/`, items: todayBookings.slice(0, 4).map((b) => `${time(b.booked_at)} ${leadsById[b.lead_id]?.name || ''}`) });
  return { first, lines };
}

const renderHtml = (business, { first, lines }) => `<!doctype html><html lang="sl"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#f5f5f7;font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:14px">
<tr><td style="padding:22px 24px 6px"><p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${esc(business.name)} · danes</p></td></tr>
${first ? `<tr><td style="padding:6px 24px 12px"><p style="margin:0 0 4px;font-size:13px;color:#6b7280">Najprej:</p><a href="${first.url}" style="display:block;font-size:17px;font-weight:700;color:#f84214;text-decoration:none">${esc(first.text)} →</a></td></tr>` : ''}
${lines.map((l) => `<tr><td style="padding:10px 24px;border-top:1px solid #f0f0f2"><a href="${l.url}" style="text-decoration:none;color:#111827"><span style="font-size:20px;font-weight:700;color:#091f93">${l.n}</span> <span style="font-size:14px">${esc(l.label)}</span></a>${l.items.length ? `<div style="font-size:13px;color:#6b7280;margin-top:3px">${l.items.map(esc).join('<br>')}</div>` : ''}</td></tr>`).join('')}
<tr><td style="padding:16px 24px 22px;border-top:1px solid #f0f0f2"><a href="${APP_URL}" style="display:inline-block;background:#f84214;color:#fff;font-weight:600;font-size:14px;padding:10px 18px;border-radius:9px;text-decoration:none">Odpri aplikacijo</a></td></tr>
</table>
<p style="font-size:11px;color:#9ca3af;margin-top:12px">Povzetek lahko izklopite v Nastavitve → Integracije.</p>
</td></tr></table></body></html>`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    const sr = base44.asServiceRole.entities;

    // Ročni predogled/pošiljanje za eno podjetje (lastnik): { business_id, preview?: true }
    if (body.business_id) {
      const b = (await sr.Business.filter({ id: body.business_id }))[0];
      if (!b) return Response.json({ error: 'Podjetje ni najdeno.' });
      const owns = internal || user?.role === 'admin' || (user && (b.created_by_id === user.id || b.created_by === user.email || b.owner_email === user.email));
      if (!owns) return Response.json({ error: 'Nimate dostopa.' });
      const d = await buildDigest(sr, b);
      if (body.preview) return Response.json({ success: true, digest: d, html: renderHtml(b, d) });
      const to = b.owner_email || b.created_by;
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: d.first ? `Danes najprej: ${d.first.text}`.slice(0, 90) : `Pregled dneva — ${b.name}`, body: renderHtml(b, d), from_name: b.name });
      return Response.json({ success: true, sent_to: to, digest: d });
    }

    if (!internal && user?.role !== 'admin') return Response.json({ error: 'Ni dovoljenja.' });
    const now = ljParts();
    if (['Sat', 'Sun'].includes(now.weekday)) return Response.json({ skipped: true, reason: 'vikend' });
    const businesses = await sr.Business.filter({ onboarding_complete: true });
    const out = [];
    for (const b of businesses) {
      if (b.is_demo || b.daily_digest_enabled === false) continue;
      if ((b.daily_digest_hour ?? 7) !== now.hour) continue;
      if (b.last_digest_at && ljDate(b.last_digest_at) === now.date) continue;
      try {
        const d = await buildDigest(sr, b);
        await sr.Business.update(b.id, { last_digest_at: new Date().toISOString() });
        if (!d.lines.length) { out.push({ id: b.id, skipped: 'nič novega' }); continue; }
        const to = b.owner_email || b.created_by;
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: d.first ? `Danes najprej: ${d.first.text}`.slice(0, 90) : `Pregled dneva — ${b.name}`, body: renderHtml(b, d), from_name: b.name });
        out.push({ id: b.id, sent: to, lines: d.lines.length });
      } catch (e) { out.push({ id: b.id, error: e?.message || String(e) }); }
    }
    return Response.json({ success: true, hour: now.hour, results: out });
  } catch (error) {
    return Response.json({ error: 'dailyDigest: ' + (error?.message || String(error)) });
  }
});
