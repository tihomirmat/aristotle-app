import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import * as unpdf from 'npm:unpdf@1.9.1';
import { extractSpans, buildDesign, buildLetterhead, renderOffer, fetchGoogleFont, designBrief } from '../../shared/offerDesign.js';

// ZAČASNO: samopreizkus ohranitve dizajna v Deno (sintetičen PDF). Izbriši po uporabi.
Deno.serve(async (req) => {
  const t0 = Date.now(); const steps = [];
  try {
    const base44 = createClientFromRequest(req);
    const light = await fetchGoogleFont('Poppins-Light'); const bold = await fetchGoogleFont('Poppins-Bold');
    steps.push(`fonts ${light.used} ${light.bytes.length} / ${bold.used} ${bold.bytes.length} @${Date.now() - t0}`);
    const d = await PDFLib.PDFDocument.create(); d.registerFontkit(fontkit);
    const fl = await d.embedFont(light.bytes, { subset: true }); const fb = await d.embedFont(bold.bytes, { subset: true });
    for (let i = 0; i < 3; i++) {
      const p = d.addPage([595, 842]);
      p.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: PDFLib.rgb(0.04, 0.08, 0.55) });
      p.drawText('Mizarstvo Čuk – ponudba', { x: 50, y: 770, size: 22, font: fl, color: PDFLib.rgb(0.3, 0.3, 0.3) });
      p.drawText('Opis del in storitev, ki jih ponujamo za vaš projekt.', { x: 50, y: 730, size: 11, font: fl });
      p.drawText('CENA: 1.200 €', { x: 50, y: 700, size: 12, font: fb });
      p.drawText(String(i + 1), { x: 540, y: 30, size: 10, font: fl });
    }
    const src = await d.save(); steps.push(`src ${src.length} @${Date.now() - t0}`);
    const pages = await extractSpans(src, unpdf); steps.push(`spans ${pages.map((p) => p.spans.length).join(',')} font=${pages[0].spans[0]?.font} @${Date.now() - t0}`);
    const design = buildDesign(pages); steps.push(`styles ${Object.values(design.styles).map((s) => `${s.font} ${s.size} ${s.color}`).join(' | ')} pn=${JSON.stringify(design.pageNumber)}`);
    const lh = await buildLetterhead(src, PDFLib); steps.push(`letterhead ${lh.bytes.length} @${Date.now() - t0}`);
    const cache = {};
    const out = await renderOffer({ letterhead: lh.bytes, design, content: { pages: design.example }, loadFont: async (n) => (cache[n] = cache[n] || (await fetchGoogleFont(n)).bytes) }, PDFLib, fontkit);
    steps.push(`render ${out.length} @${Date.now() - t0}`);
    const up = await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([out], 'design-test.pdf', { type: 'application/pdf' }) });
    return Response.json({ ok: true, url: up?.file_url, brief: designBrief(design).styles, steps });
  } catch (e) { return Response.json({ ok: false, error: e?.message, stack: String(e?.stack || '').slice(0, 600), steps }); }
});
