import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';
import { listEvents } from '../../shared/googleCalendar.js';

// Asistent, ki vidi prave podatke: stranke, sporočila za odobritev, koledar (7 dni), ponudbe.
// Akcije: briefing | chat.

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));
const fmt = (d) => d ? new Date(d).toLocaleString('sl-SI', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Ljubljana' }) : '';
const days = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;
const STAGE = { new: 'Novo', contacted: 'Kontaktirano', replied: 'Odgovorili so', booked: 'Termin', converted: 'Stranka', lost: 'Izgubljeno', unsubscribed: 'Odjavljen' };
const SRC = { email: 'e-pošta', form: 'obrazec', chatbot: 'klepet', import: 'uvoz', manual: 'ročno' };

async function gather(base44, business) {
  const [leads, drafts, offers, bookings] = await Promise.all([
    base44.asServiceRole.entities.Lead.filter({ business_id: business.id }),
    base44.asServiceRole.entities.DraftMessage.filter({ business_id: business.id }),
    base44.asServiceRole.entities.OfferGeneration.filter({ business_id: business.id }).catch(() => []),
    base44.asServiceRole.entities.ConfirmedBooking.filter({ business_id: business.id }).catch(() => []),
  ]);
  const leadName = Object.fromEntries(leads.map((l) => [l.id, l.name]));
  const pending = drafts.filter((d) => d.status === 'pending' || d.status === 'flagged_for_review');
  const lastSentByLead = {};
  drafts.filter((d) => d.status === 'sent').forEach((d) => { const t = d.sent_at || d.created_date; if (!lastSentByLead[d.lead_id] || t > lastSentByLead[d.lead_id]) lastSentByLead[d.lead_id] = t; });

  const active = leads.filter((l) => !['lost', 'unsubscribed'].includes(l.status));
  const leadLines = active
    .sort((a, b) => new Date(b.last_inbound_at || b.created_date) - new Date(a.last_inbound_at || a.created_date))
    .slice(0, 60)
    .map((l) => `- ${l.name} | ${STAGE[l.status] || l.status} | vir ${SRC[l.source] || l.source} | zadnje sporočilo stranke pred ${days(l.last_inbound_at || l.created_date)} dni | naš zadnji odgovor ${lastSentByLead[l.id] ? `pred ${days(lastSentByLead[l.id])} dni` : 'NIKOLI'}${l.service_requested ? ` | želi: ${l.service_requested}` : ''}${l.notes ? ` | ${String(l.notes).replace(/\s+/g, ' ').slice(0, 160)}` : ''}`);

  let calendar = 'Google Koledar ni povezan.';
  if (business.google_calendar_connected) {
    const from = new Date(); const to = new Date(Date.now() + 7 * 86400000);
    const ev = await listEvents(base44, business, from.toISOString(), to.toISOString()).catch((e) => ({ error: e?.message }));
    calendar = ev?.error ? `Koledarja ni bilo mogoče prebrati (${ev.error}).` : (ev.events || []).length === 0 ? 'V naslednjih 7 dneh ni dogodkov.'
      : ev.events.slice(0, 40).map((e) => `- ${fmt(e.start?.dateTime || e.start?.date)}: ${e.summary || '(brez naslova)'}`).join('\n');
  }

  const offerLines = offers.slice(0, 20).map((o) => `- ${o.client_name || o.title || 'Ponudba'} | ${o.status || 'pripravljena'} | pred ${days(o.created_date)} dni`);
  const bookingLines = bookings.filter((b) => b.booked_at && new Date(b.booked_at) >= new Date()).slice(0, 20).map((b) => `- ${fmt(b.booked_at)} ${leadName[b.lead_id] || ''}`);

  return `DANES: ${new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Ljubljana' })}
PODJETJE: ${business.name}. Storitve: ${(business.services || '').replace(/\n/g, ', ')}.

STRANKE (${active.length} aktivnih, najnovejše prve):
${leadLines.join('\n') || '(ni strank)'}

SPOROČILA, KI ČAKAJO NA ODOBRITEV (${pending.length}):
${pending.slice(0, 20).map((d) => `- za ${leadName[d.lead_id] || '?'}: »${d.subject}«`).join('\n') || '(nič)'}

KOLEDAR NASLEDNJIH 7 DNI:
${calendar}

POTRJENI TERMINI V APLIKACIJI:
${bookingLines.join('\n') || '(ni)'}

PONUDBE:
${offerLines.join('\n') || '(ni)'}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const business = body.business_id ? (await base44.asServiceRole.entities.Business.filter({ id: body.business_id }))[0] : null;
    if (!business || !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.' });

    const context = await gather(base44, business);
    const persona = `Si osebni asistent lastnika slovenskega mikro podjetja »${business.name}«. Govoriš slovensko, vikaš, si jedrnat in konkreten. Uporabljaš SAMO podatke spodaj; ničesar ne izmišljuješ. Kadar omenjaš stranko, jo navedi z imenom. Ko predlagaš dejanje, povej, kje v aplikaciji ga naredi (Za odobritev, Stranke, Ponudbe, Nastavitve).`;

    if (body.action === 'briefing') {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-4-5', max_tokens: 1400,
        system: `${persona}
Pripravi pregled v Markdown s točno temi razdelki:
## Najprej to (največ 5 nalog, razvrščenih po nujnosti; vsaka: kratek ukaz + zakaj, npr. »Odgovorite Ani Novak — piše že 3 dni, odgovora še ni«)
## Ta teden v koledarju (kratko, po dnevih; če koledar ni povezan, en stavek)
## Stranke (koliko novih, kdo čaka na odgovor, kdo je obstal)
## Predlog (ena konkretna ideja za več posla ta teden na podlagi podatkov)
Brez uvoda in brez zaključnih fraz.`,
        messages: [{ role: 'user', content: context }],
      });
      const content = res.content?.[0]?.text || '';
      const today = new Date().toISOString().split('T')[0];
      const existing = await base44.asServiceRole.entities.AssistantBriefing.filter({ business_id: business.id, date: today });
      const owner = business.owner_email || business.created_by;
      const briefing = existing[0]
        ? await base44.asServiceRole.entities.AssistantBriefing.update(existing[0].id, { content, generated_at: new Date().toISOString() })
        : await base44.asServiceRole.entities.AssistantBriefing.create({ business_id: business.id, date: today, content, generated_at: new Date().toISOString(), created_by: owner, owner_email: owner });
      return Response.json({ success: true, briefing: { ...briefing, content } });
    }

    const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const msgs = history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })).filter((m) => m.content);
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return Response.json({ error: 'Ni vprašanja.' });
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 1200,
      system: `${persona}\n\nPODATKI:\n${context}`,
      messages: msgs,
    });
    return Response.json({ success: true, reply: res.content?.[0]?.text || '' });
  } catch (error) {
    return Response.json({ error: 'Asistent trenutno ne more odgovoriti: ' + (error?.message || String(error)) });
  }
});
