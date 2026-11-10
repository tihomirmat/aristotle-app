import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { fetchGoogleFont } from '../../shared/offerDesign.js';

// ZAČASNO: preizkus offerDesign (scan + generate) na sintetični ponudbi. Izbriši po uporabi (tudi testni vzorec in ponudbo).
Deno.serve(async (req) => {
  const t0 = Date.now(); const out = {};
  try {
    const base44 = createClientFromRequest(req);
    const secret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    const BID = '69fddf1d2a215b02da8d942c'; // Testsave
    const body = await req.json().catch(() => ({}));
    if (body.step === 'cleanup') {
      const sr = base44.asServiceRole.entities;
      for (const t of await sr.OfferTemplate.filter({ business_id: BID, source: 'design' })) await sr.OfferTemplate.delete(t.id);
      for (const g of await sr.OfferGeneration.filter({ business_id: BID })) if (g.content_json) await sr.OfferGeneration.delete(g.id);
      await sr.Business.update(BID, { pillar_offers: body.restore === true, offers_price_rules: '' });
      return Response.json({ cleaned: true });
    }
    const light = (await fetchGoogleFont('Lato-Regular')).bytes; const bold = (await fetchGoogleFont('Lato-Bold')).bytes;
    const d = await PDFLib.PDFDocument.create(); d.registerFontkit(fontkit);
    const fl = await d.embedFont(light, { subset: true }); const fb = await d.embedFont(bold, { subset: true });
    const blue = PDFLib.rgb(0.05, 0.3, 0.55); const gray = PDFLib.rgb(0.25, 0.25, 0.25);
    const p = d.addPage([595, 842]);
    p.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: blue });
    p.drawText('TOPLI DOM d.o.o.', { x: 50, y: 805, size: 20, font: fb, color: PDFLib.rgb(1, 1, 1) });
    p.drawText('Talno gretje in toplotne črpalke', { x: 50, y: 790, size: 9, font: fl, color: PDFLib.rgb(1, 1, 1) });
    p.drawText('PONUDBA št. 2026-041', { x: 50, y: 730, size: 18, font: fb, color: blue });
    p.drawText('Stranka: Janez Novak, Cesta na Brdo 12, Kranj', { x: 50, y: 705, size: 11, font: fl, color: gray });
    p.drawText('Datum: 3. 10. 2026', { x: 50, y: 689, size: 11, font: fl, color: gray });
    p.drawText('Spoštovani, na podlagi ogleda vam pošiljamo ponudbo za talno gretje v pritličju hiše (85 m2).', { x: 50, y: 655, size: 11, font: fl, color: gray });
    const rows = [['Talno gretje – sistemska plošča in cevi (85 m2)', '2.975 €'], ['Razdelilnik z regulacijo po prostorih', '640 €'], ['Montaža in zagon', '1.100 €']];
    let y = 620; p.drawText('Postavka', { x: 50, y, size: 10, font: fb, color: blue }); p.drawText('Cena', { x: 545 - fb.widthOfTextAtSize('Cena', 10), y, size: 10, font: fb, color: blue });
    rows.forEach(([a, b]) => { y -= 22; p.drawText(a, { x: 50, y, size: 11, font: fl, color: gray }); p.drawText(b, { x: 545 - fb.widthOfTextAtSize(b, 11), y, size: 11, font: fb, color: gray }); });
    y -= 14; p.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: blue });
    y -= 22; p.drawText('SKUPAJ brez DDV', { x: 50, y, size: 12, font: fb, color: gray }); p.drawText('4.715 €', { x: 545 - fb.widthOfTextAtSize('4.715 €', 12), y, size: 12, font: fb, color: gray });
    p.drawText('Ponudba velja 30 dni. Plačilo: 40 % avans, preostanek ob zaključku del. Garancija na izvedbo 5 let.', { x: 50, y: y - 40, size: 9, font: fl, color: gray });
    p.drawText('Lep pozdrav,', { x: 50, y: y - 80, size: 11, font: fl, color: gray }); p.drawText('Marko Toplak, direktor', { x: 50, y: y - 96, size: 11, font: fb, color: gray });
    p.drawLine({ start: { x: 50, y: 50 }, end: { x: 545, y: 50 }, thickness: 0.5, color: blue });
    p.drawText('Topli dom d.o.o. · Obrtna cesta 4, 4000 Kranj · 04 555 12 34 · info@topli-dom.si · ID za DDV: SI12345678', { x: 50, y: 36, size: 8, font: fl, color: gray });
    const src = await d.save();
    const srcUrl = (await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([src], 'izvirnik-test.pdf', { type: 'application/pdf' }) }))?.file_url;
    out.source = srcUrl;
    await base44.asServiceRole.entities.Business.update(BID, { pillar_offers: true, offers_price_rules: 'Talno gretje (plošča + cevi): 35 €/m2 v notranjosti Slovenije; na Primorskem (obala, do 15 km od morja) zadostuje redkejši razmak cevi: 29 €/m2; nad 700 m nadmorske višine ali kjer pozimi pade pod -10 °C gostejši razmak in debelejša izolacija: 42 €/m2.\nRazdelilnik z regulacijo: 640 € (do 8 krogov), 890 € (9–14 krogov). En krog na približno 12 m2.\nMontaža in zagon: 1.100 € do 100 m2, 1.500 € nad 100 m2.\nToplotna črpalka: po dogovoru po ogledu.' });
    const scan = await base44.asServiceRole.functions.invoke('offerDesign', { action: 'scan', business_id: BID, file_url: srcUrl, name: 'TEST talno gretje', internal_secret: secret });
    out.scan = scan?.data ?? scan; out.t_scan = Date.now() - t0;
    if (!out.scan?.template_id) return Response.json(out);
    const gen = await base44.asServiceRole.functions.invoke('offerDesign', { action: 'generate', business_id: BID, template_id: out.scan.template_id, client_name: 'Maja Kovač', request_text: 'Pozdravljeni, gradimo novo hišo v Kranjski Gori (810 m nadmorske višine). Zanima me talno gretje za pritličje in nadstropje, skupaj 140 m2. Lep pozdrav, Maja Kovač, Borovška cesta 20, Kranjska Gora', internal_secret: secret });
    out.gen = gen?.data ?? gen; out.t_total = Date.now() - t0;
    if (out.gen?.output_markdown) out.gen.output_markdown = out.gen.output_markdown.slice(0, 1500);
    return Response.json(out);
  } catch (e) { return Response.json({ ...out, error: e?.message, data: e?.response?.data, stack: String(e?.stack || '').slice(0, 400) }); }
});
