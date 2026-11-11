import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

// Samodejna ponudba ob povpraševanju ali odgovoru stranke.
// 1) AI prebere sporočilo: ali stranka želi ponudbo/ceno in ali imamo vse podatke za natančno ponudbo.
// 2a) Manjkajo podatki → odgovor, ki stranko vljudno vpraša zanje (vedno v pregled lastniku).
// 2b) Podatki so → ponudba v dizajnu podjetja (offerDesign) + spremno sporočilo s PDF v prilogi.
//     Business.offer_auto: 'send' → pošlje samo (ne med preizkusom, ocena ≥ 7); sicer v »Čaka na vaš odgovor«.
// 3) Sporočilo brez želje po ponudbi → navaden odgovor (nova stranka) ali nič (obstoječa — opravilo že ustvari crmEvents).
// Klic: { business_id, lead_id, text, subject, is_reply, internal_secret }  (iz syncInbox) ali kot lastnik { business_id, lead_id }.

const VERSION = 'auto-offer-2026-11-11b';
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const eurFmt = (n) => new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 2 }).format(n) + ' €';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    if (!internal && !user) return Response.json({ error: 'Unauthorized', version: VERSION }, { status: 401 });
    const sr = base44.asServiceRole.entities;
    const business = (await sr.Business.filter({ id: body.business_id }))[0];
    if (!business || (!internal && !ownsBusiness(user, business))) return Response.json({ error: 'Nimate dostopa do tega podjetja.', version: VERSION });
    const lead = (await sr.Lead.filter({ id: body.lead_id }))[0];
    if (!lead || lead.business_id !== business.id) return Response.json({ error: 'Stranka ni najdena.', version: VERSION });
    const owner = business.owner_email || business.created_by;
    const invoke = async (fn, args) => { const r = await base44.asServiceRole.functions.invoke(fn, { ...args, internal_secret: INTERNAL_SECRET }); const d = r?.data ?? r; if (d?.error) throw new Error(d.error); return d; };
    const plainReply = async () => {
      if (body.is_reply) return Response.json({ success: true, version: VERSION, action: 'none' });
      const d = await invoke('generateDraft', { business_id: business.id, lead_id: lead.id, pillar: 'web_form_lead', sequence_step: 1 });
      return Response.json({ success: true, version: VERSION, action: 'reply', draft_id: d?.draft?.id });
    };

    const mode = business.offer_auto || 'review';
    const templates = (await sr.OfferTemplate.filter({ business_id: business.id })).filter((t) => t.letterhead_url && t.design).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    if (mode === 'off' || !templates.length) return plainReply();

    const text = String(body.text || lead.notes || '').slice(0, 6000);
    const subject = String(body.subject || lead.email_subject || '');

    // 1) Ali želi ponudbo in kaj manjka
    const sys = `Si asistent slovenskega podjetja »${business.name}«. Prebereš sporočilo stranke in odločiš:
- wants_offer: ali stranka želi ponudbo, ceno, predračun ali izvedbo konkretne storitve (true), ali pa piše o čem drugem (vprašanje, termin, zahvala, zavrnitev, odjava, splošna informacija → false).
- missing: samo podatki, BREZ katerih po spodnjem ceniku sploh ni mogoče izbrati cene ali obsega (npr. površina, kadar je cena na m²; lokacija, kadar je cena odvisna od lokacije). NE sprašuj za podatke, ki jih cenik sam izračuna ali jih lahko razumno oceniš (npr. število krogov iz površine, standardna izvedba), niti za podrobnosti, ki ne spremenijo cene. Največ 3, kratko, VEDNO v vikanju (vi, vaš). Če je mogoče narediti ponudbo, prazen seznam.
- service: katera storitev podjetja (kratko).
Vrni ZGOLJ JSON: {"wants_offer": true, "missing": ["…"], "service": "…"}`;
    const usr = `STORITVE PODJETJA:\n${business.services || '(ni vpisano)'}\n\nCENIK IN PRAVILA:\n${business.offers_price_rules || '(ni vpisan)'}\n\nPODATKI O STRANKI: ${lead.name || ''}${lead.company_id ? ' (podjetje)' : ''}${lead.phone ? ', tel. ' + lead.phone : ''}\nPREJŠNJE OPOMBE: ${String(lead.notes || '').slice(0, 1500)}\n\nZADEVA: ${subject}\nSPOROČILO STRANKE:\n${text}`;
    const res = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 600, system: sys, messages: [{ role: 'user', content: usr }] });
    const raw = (res.content?.[0]?.text || '').trim();
    let a = {};
    try { a = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { a = {}; }
    if (!a.wants_offer) return plainReply();
    const missing = (Array.isArray(a.missing) ? a.missing : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);

    // 2a) Manjkajo podatki → vprašamo stranko
    if (missing.length) {
      const d = await invoke('generateDraft', {
        business_id: business.id, lead_id: lead.id, pillar: 'manual', sequence_step: 1,
        instruction: `Odgovor na povpraševanje stranke za »${a.service || 'storitev'}«. Zahvali se in na kratko povej, da ji z veseljem pripravimo natančno ponudbo. Za to vljudno vprašaj za naslednje podatke (kot kratek oštevilčen seznam):\n${missing.map((m, i) => `${i + 1}. ${m}`).join('\n')}\nNe navajaj cen. Brez podpisa (podpis se doda sam).`,
      });
      const id = d?.draft?.id;
      if (id) await sr.DraftMessage.update(id, { pillar: 'offer_questions', missing_info: missing, ai_reasoning: `Za natančno ponudbo manjka: ${missing.join('; ')}` });
      return Response.json({ success: true, version: VERSION, action: 'questions', missing, draft_id: id });
    }

    // 2b) Ponudba v dizajnu podjetja
    const offer = await invoke('offerDesign', { action: 'generate', business_id: business.id, template_id: templates[0].id, client_name: lead.name || '', request_text: `${subject}\n${text}`, lead_id: lead.id });
    const amountTxt = offer.amount ? `Skupni znesek v ponudbi: ${eurFmt(offer.amount)} (brez DDV, če ponudba tako navaja).` : '';
    const d = await invoke('generateDraft', {
      business_id: business.id, lead_id: lead.id, pillar: 'manual', sequence_step: 1,
      instruction: `Kratko spremno sporočilo (4–6 stavkov) k ponudbi, ki je v PRILOGI kot PDF, za »${a.service || 'storitev'}«. ${amountTxt} Zahvali se za povpraševanje, povej, da je ponudba v prilogi, in povabi k vprašanjem ali kratkemu klicu. Naravna, pravilna slovenščina. Ne ponavljaj postavk in ne izmišljuj podatkov. Brez podpisa (podpis se doda sam).`,
    });
    const draftId = d?.draft?.id;
    if (!draftId) throw new Error('Spremnega sporočila ni bilo mogoče pripraviti.');
    // ime priloge s šumniki (platforma jih iz imena shranjene datoteke odstrani)
    const fileName = `Ponudba ${String(offer.client_name || lead.name || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\.+$/, '') || business.name}.pdf`.replace(/\s+/g, ' ');
    const noPrices = !String(business.offers_price_rules || '').trim();
    await sr.DraftMessage.update(draftId, {
      pillar: 'offer', attachments: [{ name: fileName, url: offer.output_pdf_url }], offer_generation_id: offer.generation_id,
      ai_reasoning: noPrices ? 'Cenik še ni vpisan, zato so cene v ponudbi »po dogovoru«. Vpišite ga v Ponudbe → Nova ponudba → Cenik in pravila.' : `Ponudba po vašem ceniku in dizajnu${offer.amount ? `, skupaj ${eurFmt(offer.amount)}` : ''}.`,
    });
    let sent = false;
    const fresh = (await sr.DraftMessage.filter({ id: draftId }))[0];
    if (mode === 'send' && !noPrices && !isTrialActive(business) && business.subscription_status !== 'trialing' && fresh?.status === 'pending' && (fresh.quality_score ?? 7) >= 7) {
      await sr.DraftMessage.update(draftId, { status: 'approved', reviewer_notes: `${fresh.reviewer_notes ? fresh.reviewer_notes + ' ' : ''}Samodejno poslano (samodejne ponudbe).` });
      sent = true;
    }
    await sr.Activity.create({ business_id: business.id, lead_id: lead.id, type: 'offer', direction: 'internal', subject: `Samodejno pripravljena ponudba${offer.amount ? ` (${eurFmt(offer.amount)})` : ''}`, content: sent ? 'Poslana samodejno.' : 'Čaka na vaš pregled.', occurred_at: new Date().toISOString(), is_automated: true, owner_email: owner, created_by: owner }).catch(() => {});
    return Response.json({ success: true, version: VERSION, action: sent ? 'offer_sent' : 'offer_review', draft_id: draftId, generation_id: offer.generation_id, pdf: offer.output_pdf_url, amount: offer.amount || null });
  } catch (error) {
    return Response.json({ error: 'Samodejna ponudba: ' + (error?.message || String(error)), version: VERSION });
  }
});
