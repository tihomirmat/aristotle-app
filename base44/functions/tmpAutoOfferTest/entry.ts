import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { fetchGoogleFont } from '../../shared/offerDesign.js';

// ZAČASNO: preizkus samodejne ponudbe na podjetju Testsave (brez pošiljanja). step: setup | run | cleanup. Izbriši po uporabi.
const BID = '69fddf1d2a215b02da8d942c';
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req); const sr = base44.asServiceRole.entities;
  const secret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const body = await req.json().catch(() => ({}));
  const inv = async (fn, args) => { const r = await base44.asServiceRole.functions.invoke(fn, { ...args, internal_secret: secret }); return r?.data ?? r; };
  try {
    if (body.step === 'cleanup') {
      for (const e of ['DraftMessage', 'OfferGeneration', 'Activity', 'Task']) for (const r of await sr[e].filter({ business_id: BID })) await sr[e].delete(r.id);
      for (const t of await sr.OfferTemplate.filter({ business_id: BID, source: 'design' })) await sr.OfferTemplate.delete(t.id);
      for (const l of await sr.Lead.filter({ business_id: BID })) if (/autooffer-test/.test(l.email || '')) await sr.Lead.delete(l.id);
      await sr.Business.update(BID, { pillar_offers: false, pillar_reactivation: false, pillar_leads: false, services: '', offers_price_rules: '', offers_free_generations_used: 0 });
      return Response.json({ cleaned: true });
    }
    if (body.step === 'setup') {
      await sr.Business.update(BID, { pillar_offers: true, pillar_reactivation: true, pillar_leads: true, services: 'Talno gretje\nToplotne črpalke', offers_price_rules: 'Talno gretje (plošča + cevi): 35 €/m2 v notranjosti Slovenije; na obali (do 15 km od morja) 29 €/m2; nad 700 m nadmorske višine 42 €/m2.\nRazdelilnik z regulacijo: 640 € (do 8 krogov), 890 € (9–14 krogov). En krog na približno 12 m2.\nMontaža in zagon: 1.100 € do 100 m2, 1.500 € nad 100 m2.' });
      const fl = (await fetchGoogleFont('Lato-Regular', fontkit)).bytes; const fb = (await fetchGoogleFont('Lato-Bold', fontkit)).bytes;
      const d = await PDFLib.PDFDocument.create(); d.registerFontkit(fontkit);
      const L = await d.embedFont(fl, { subset: true }); const B = await d.embedFont(fb, { subset: true });
      const blue = PDFLib.rgb(0.05, 0.3, 0.55); const gray = PDFLib.rgb(0.25, 0.25, 0.25);
      const p = d.addPage([595, 842]);
      p.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: blue });
      p.drawText('TOPLI DOM d.o.o.', { x: 50, y: 805, size: 20, font: B, color: PDFLib.rgb(1, 1, 1) });
      p.drawText('PONUDBA št. 2026-041', { x: 50, y: 730, size: 18, font: B, color: blue });
      p.drawText('Stranka: Janez Novak, Kranj', { x: 50, y: 705, size: 11, font: L, color: gray });
      p.drawText('Spoštovani, na podlagi ogleda vam pošiljamo ponudbo za talno gretje (85 m2).', { x: 50, y: 675, size: 11, font: L, color: gray });
      let y = 640; [['Talno gretje (85 m2)', '2.975 €'], ['Razdelilnik z regulacijo', '640 €'], ['Montaža in zagon', '1.100 €']].forEach(([a, b]) => { p.drawText(a, { x: 50, y, size: 11, font: L, color: gray }); p.drawText(b, { x: 545 - B.widthOfTextAtSize(b, 11), y, size: 11, font: B, color: gray }); y -= 22; });
      p.drawLine({ start: { x: 50, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 1, color: blue });
      p.drawText('SKUPAJ brez DDV', { x: 50, y: y - 12, size: 12, font: B, color: gray }); p.drawText('4.715 €', { x: 545 - B.widthOfTextAtSize('4.715 €', 12), y: y - 12, size: 12, font: B, color: gray });
      p.drawText('Ponudba velja 30 dni. Garancija na izvedbo 5 let.', { x: 50, y: y - 50, size: 9, font: L, color: gray });
      p.drawText('Topli dom d.o.o. · Obrtna cesta 4, 4000 Kranj · 04 555 12 34', { x: 50, y: 36, size: 8, font: L, color: gray });
      const url = (await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([await d.save()], 'vzorec.pdf', { type: 'application/pdf' }) }))?.file_url;
      const scan = await inv('offerDesign', { action: 'scan', business_id: BID, file_url: url, name: 'TEST vzorec' });
      const mk = (name, email) => sr.Lead.create({ business_id: BID, name, email, source: 'email', status: 'new', consent_email: true, notes: '', owner_email: 'ingenius.tihomir@gmail.com', created_by: 'ingenius.tihomir@gmail.com' });
      const a = await mk('Maja Kovač', 'maja.autooffer-test@example.com'); const b = await mk('Peter Zupan', 'peter.autooffer-test@example.com');
      return Response.json({ scan, leads: [a.id, b.id] });
    }
    if (body.step === 'run') {
      const [a, b] = body.leads;
      const r1 = await inv('autoOffer', { business_id: BID, lead_id: a, subject: 'Povpraševanje talno gretje', text: 'Pozdravljeni, gradimo hišo v Kranjski Gori (810 m nadmorske višine). Zanima me talno gretje za pritličje in nadstropje, skupaj 140 m2. Prosim za ponudbo. Maja Kovač' });
      const r2 = await inv('autoOffer', { business_id: BID, lead_id: b, subject: 'Talno gretje', text: 'Dober dan, zanima me cena za talno gretje v hiši. Lep pozdrav, Peter' });
      const drafts = await sr.DraftMessage.filter({ business_id: BID });
      return Response.json({ r1, r2, drafts: drafts.map((d) => ({ lead: d.lead_id, pillar: d.pillar, status: d.status, subject: d.subject, body: d.body, attachments: d.attachments, missing: d.missing_info })) });
    }
    return Response.json({ error: 'step?' });
  } catch (e) { return Response.json({ error: e?.message, data: e?.response?.data }); }
});
