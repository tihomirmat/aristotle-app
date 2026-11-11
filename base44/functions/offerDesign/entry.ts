import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import * as unpdf from 'npm:unpdf@1.9.1';
import { extractSpans, buildDesign, buildLetterhead, renderOffer, fetchGoogleFont, parseFontName, designBrief, validateContent, contentToMarkdown } from '../../shared/offerDesign.js';

// Ponudbe v dizajnu stranke.
//  action: "scan"     { business_id, file_url, name? }  → prebere dizajn izvirne ponudbe (PDF) in shrani vzorec
//  action: "generate" { business_id, template_id, client_name?, request_text?, extra?, lead_id?, company_id? } → nova ponudba v istem dizajnu
// Glava, noga in ozadje so izvirne strani PDF brez besedila; besedilo izrišemo v istih pisavah, velikostih, barvah in razmikih.

const VERSION = 'offer-design-2026-11-11b';

// Skupni znesek preberemo iz dokumenta (zadnja vrstica s »skupaj«), ne iz ločenega polja AI — da se znesek v seznamu ujema s ponudbo.
const eur = (t) => { const m = String(t).match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|EUR)/i); return m ? parseFloat(m[1].replace(/[.\s]/g, '').replace(',', '.')) : null; };
const totalFromContent = (content) => {
  let found = null;
  content.pages.forEach((pg) => pg.forEach((b) => {
    const left = (b.runs || []).map((r) => r.t).join(''); const right = (b.right || []).map((r) => r.t).join('');
    if (/skupaj|za plačilo|končni znesek|total/i.test(left) && !/točk[ae]\s+\d+\s*:/i.test(left)) { const v = eur(right) ?? eur(left); if (v) found = v; }
  }));
  return found;
};
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MODELS = ['claude-sonnet-4-5', 'claude-haiku-4-5'];
const PRICE = { 'claude-sonnet-4-5': [2.76, 13.8], 'claude-haiku-4-5': [0.92, 4.6] }; // EUR na milijon žetonov

const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
const hasModule = (b, k) => !!b && (isTrialActive(b) || b[k] === true);
const err = (error, code) => Response.json({ error, ...(code ? { code } : {}), version: VERSION });

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const fontCache = {};
const getFont = (name) => (fontCache[name] = fontCache[name] || fetchGoogleFont(name, fontkit).catch((e) => { delete fontCache[name]; throw e; }));
const loadFont = async (name) => (await getFont(name)).bytes;
const upload = async (base44, bytes, filename) => (await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([bytes], filename, { type: 'application/pdf' }) }))?.file_url;
const fetchBytes = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('Datoteke ni bilo mogoče prebrati.'); return new Uint8Array(await r.arrayBuffer()); };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    // notranji klic (npr. autoOffer) ima dostop, a kvota velja kot za lastnika (ni admin)
    const user = internal ? { role: 'internal', id: 'internal' } : await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized', version: VERSION }, { status: 401 });
    const { action, business_id } = body;
    const sr = base44.asServiceRole.entities;
    const business = business_id ? (await sr.Business.filter({ id: business_id }))[0] : null;
    if (!business || !(internal || ownsBusiness(user, business))) return err('Nimate dostopa do tega podjetja.', 'FORBIDDEN');
    if (isTrialExpired(business) || !hasModule(business, 'pillar_offers')) return err('Priprava ponudb ni vključena v vaš paket.', 'MODULE_LOCKED');
    const owner = business.owner_email || business.created_by;

    // ───────────── 1) Branje dizajna iz izvirne ponudbe ─────────────
    if (action === 'scan') {
      if (!body.file_url) return err('Manjka datoteka.');
      const src = await fetchBytes(body.file_url);
      if (src.length > 20_000_000) return err('Datoteka je prevelika (največ 20 MB).');
      if (String.fromCharCode(...src.subarray(0, 5)) !== '%PDF-') return err('Za ohranitev dizajna naložite ponudbo v obliki PDF (v Wordu: Shrani kot → PDF).', 'NOT_PDF');
      let pages;
      try { pages = await extractSpans(src, unpdf); } catch (e) { return err('PDF-ja ni bilo mogoče prebrati (' + (e?.message || e) + ').', 'PDF_READ'); }
      const chars = pages.reduce((a, p) => a + p.spans.reduce((x, s) => x + s.str.length, 0), 0);
      if (chars < 40) return err('V tem PDF-ju ni besedila — verjetno je skeniran kot slika. Naložite izvirni PDF (izvožen iz Worda ali drugega programa).', 'NO_TEXT');
      const design = buildDesign(pages);
      const lh = await buildLetterhead(src, PDFLib, design);
      const fontNames = [...new Set(Object.values(design.styles).map((s) => s.font))];
      const design_fonts = [];
      for (const n of fontNames) {
        try { const f = await getFont(n); const p = parseFontName(n); design_fonts.push({ name: n, used: f.used, exact: f.exact && !p.substituted }); }
        catch { design_fonts.push({ name: n, used: 'Arimo', exact: false }); }
      }
      // kontrola: izvirno vsebino izrišemo z našim izrisom — če to ne uspe, vzorca ne shranimo
      const check = await renderOffer({ letterhead: lh.bytes, design, content: { pages: design.example }, loadFont }, PDFLib, fontkit);
      const [letterhead_url, check_url] = await Promise.all([upload(base44, lh.bytes, 'predloga-ponudbe.pdf'), upload(base44, check, 'kontrola-dizajna.pdf')]);
      const firstBig = design.example.flat().filter((b) => b.runs?.length).sort((a, b) => (design.styles[b.runs[0].s]?.size || 0) - (design.styles[a.runs[0].s]?.size || 0))[0];
      const existing = await sr.OfferTemplate.filter({ business_id });
      const template = await sr.OfferTemplate.create({
        business_id, name: String(body.name || 'Vaša ponudba (izvirni dizajn)').slice(0, 120), kind: 'custom', source: 'design',
        body_markdown: contentToMarkdown({ pages: design.example }, design).slice(0, 60000), variables: [],
        design, letterhead_url, source_pdf_url: body.file_url, design_fonts,
        is_default: !existing.some((t) => t.is_default), created_by: business.created_by, owner_email: owner,
      });
      return Response.json({
        success: true, version: VERSION, template_id: template.id, check_url,
        summary: { pages: pages.length, has_cover: design.hasCover, styles: Object.keys(design.styles).length, fonts: design_fonts, page_number: !!design.pageNumber, sample_title: firstBig?.runs?.map((r) => r.t).join('').slice(0, 80) || '' },
      });
    }

    // ───────────── 2) Nova ponudba v istem dizajnu ─────────────
    if (action === 'generate') {
      const template = body.template_id ? (await sr.OfferTemplate.filter({ id: body.template_id }))[0] : null;
      if (!template || template.business_id !== business_id || !template.design || !template.letterhead_url) return err('Ta vzorec nima shranjenega dizajna. Dodajte ponudbo v obliki PDF.', 'NO_DESIGN');
      const trialing = isTrialActive(business);
      const hasByok = business.offers_byok_provider && business.offers_byok_verified_at;
      if (user.role !== 'admin' && !trialing && !hasByok && (business.offers_free_generations_used || 0) >= 5) return Response.json({ error: 'Brezplačna kvota 5 ponudb je porabljena.', code: 'OFFERS_FREE_QUOTA_REACHED', version: VERSION }, { status: 402 });
      const design = template.design;
      const lead = body.lead_id ? (await sr.Lead.filter({ id: String(body.lead_id) }))[0] : null;
      const company = (body.company_id || lead?.company_id) ? (await sr.Company.filter({ id: String(body.company_id || lead.company_id) }).catch(() => []))[0] : null;
      const brief = designBrief(design);
      const now = new Date();
      const monthSl = now.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric', timeZone: 'Europe/Ljubljana' });
      const todaySl = now.toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Ljubljana' });
      const seq = (await sr.OfferGeneration.filter({ business_id }).catch(() => [])).filter((g) => g.status === 'completed' && g.kind === 'full').length + 1;

      const system = `Si pisec ponudb za slovensko podjetje »${business.name}«. Dobiš NJIHOVO obstoječo ponudbo, zapisano kot seznam strani; vsaka stran je seznam blokov (vrstic ali odstavkov).
OBLIKA BLOKA: "top" = navpični položaj prve vrstice na strani (samo prvi blok strani); "gap" = razmik od prejšnje vrstice v točkah; "x" = levi odmik (samo kadar odstopa); "runs" = deli besedila [{"s": slog, "t": besedilo, "strike": true za prečrtano, "dx": dodaten vodoravni odmik}]; "right" = desno poravnan del iste vrstice (npr. znesek); "rule" = vodoravna črta.
SLOGI:
${brief.styles}

NALOGA: napiši NOVO ponudbo za novo stranko v POPOLNOMA ISTI obliki, da bo dokument videti enako kot izvirnik.
- Za isto vlogo uporabi isti slog (naslov, naziv postavke, opis, alineje, cena, povzetek, drobni tisk) in ISTE vrednosti top/gap/x/dx, kot jih ima istovrsten blok v izvirniku.
- Ohrani zgradbo dokumenta in vrstni red strani izvirnika (npr. naslovnica, stranka in projekt, uvod, točke, povzetek cen, pogoji). Število točk in strani prilagodi temu, kar stranka potrebuje — ne dodajaj točk samo zato, ker so v izvirniku.
- Stalna besedila podjetja (slogan na naslovnici, podatki o podjetju, plačilni pogoji, opombe o DDV) prepiši dobesedno. Spremeni samo, kar je vezano na stranko, projekt, postavke, cene in datum.
- Odstavek napiši kot EN blok (vrstice prelomi sistem). Naslov razdeli v dve vrstici samo, če je tako razdeljen v izvirniku in je dolg.
- CENE: uporabi izključno »CENIK IN PRAVILA« ter podatke iz povpraševanja. Upoštevaj pogojna pravila (npr. lokacija, velikost, količina) in v ponudbi z enim stavkom pojasni, zakaj je izbrana ta različica. Če za postavko ni cene, napiši »po dogovoru« — nikoli si ne izmišljuj zneskov. Zneski v obliki 1.200 €. Seštevki morajo biti računsko pravilni. Prečrtane »stare« cene uporabi samo, če jih cenik izrecno navaja.
- Ponujaj samo storitve s seznama storitev podjetja. Slovenščina, vikanje, brez praznih fraz.
- Ponudbo bere STRANKA: nikoli ne omenjaj cenika, pravil, navodil ali tega, da kak podatek manjka v sistemu. Pri cenah brez podatka napiši samo »po dogovoru«, brez pojasnila.
- Današnji datum je ${todaySl} (${monthSl}); uporabi ga v obliki, kot je datum zapisan v izvirniku. Ne izmišljuj drugih datumov.
- Če ima izvirnik številko ponudbe, ohrani njeno obliko in uporabi zaporedno številko ${seq} (razen če lastnik v navodilih navede drugo).
Vrni ZGOLJ JSON brez razlage: {"client_name": "naziv stranke", "total_eur": skupni znesek kot število ali null, "pages": [[blok, ...], ...]}`;

      const userMsg = `IZVIRNA PONUDBA (primer oblike):
${brief.example}

PODJETJE: ${business.name}${business.address ? ', ' + business.address : ''}${business.phone ? ', ' + business.phone : ''}
STORITVE PODJETJA:
${business.services || '(ni vpisano)'}

CENIK IN PRAVILA:
${String(business.offers_price_rules || '').trim() || '(cenik ni vpisan — vse cene »po dogovoru«, razen če jih lastnik navede spodaj)'}

NOVA STRANKA: ${String(body.client_name || lead?.name || '').trim() || '(naziv ni znan)'}${company ? ` — podjetje ${company.name}` : ''}${lead?.email ? ` <${lead.email}>` : ''}
KAJ STRANKA ŽELI (povpraševanje):
${String(body.request_text || lead?.notes || lead?.service_requested || '').slice(0, 6000) || '(ni opisa)'}

DODATNA NAVODILA LASTNIKA (imajo prednost, tudi glede cen):
${String(body.extra || '').slice(0, 3000) || '(ni)'}`;

      let res = null; let model = MODELS[0]; let lastErr = null;
      for (const m of MODELS) {
        try { res = await anthropic.messages.create({ model: m, max_tokens: 14000, system, messages: [{ role: 'user', content: userMsg }] }); model = m; break; }
        catch (e) { lastErr = e; if (!/model|not_found|invalid/i.test(e?.message || '')) throw e; }
      }
      if (!res) throw lastErr || new Error('AI klic ni uspel.');
      const raw = (res.content?.[0]?.text || '').trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      let parsed;
      try { parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); }
      catch { return err(res.stop_reason === 'max_tokens' ? 'Ponudba je predolga za en zagon. V navodilu zmanjšajte obseg (manj točk) in poskusite znova.' : 'AI je vrnil neveljaven zapis. Poskusite znova.', 'AI_FORMAT'); }
      const content = validateContent(parsed, design);
      const pdf = await renderOffer({ letterhead: await fetchBytes(template.letterhead_url), design, content, loadFont }, PDFLib, fontkit);
      const clientName = String(parsed.client_name || body.client_name || lead?.name || '').slice(0, 200);
      const ascii = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd');
      const fileName = `Ponudba-${ascii(clientName || 'stranka').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'stranka'}.pdf`;
      const output_pdf_url = await upload(base44, pdf, fileName);
      const output_markdown = contentToMarkdown(content, design);
      const tin = res.usage?.input_tokens || 0; const tout = res.usage?.output_tokens || 0;
      const cost = ((PRICE[model] || PRICE[MODELS[0]])[0] * tin + (PRICE[model] || PRICE[MODELS[0]])[1] * tout) / 1_000_000;
      const total = totalFromContent(content) ?? Number(parsed.total_eur);
      const generation = await sr.OfferGeneration.create({
        business_id, template_id: template.id, ...(lead ? { lead_id: lead.id } : {}), ...(company ? { company_id: company.id } : {}),
        client_name: clientName, ...(Number.isFinite(total) && total > 0 ? { amount: total } : {}), offer_status: 'draft', kind: 'full', input_method: 'form',
        inputs_json: { stranka_naziv: clientName, request_text: String(body.request_text || '').slice(0, 6000), extra: String(body.extra || '').slice(0, 3000) },
        resolved_vars_json: { stranka_naziv: clientName }, output_markdown, output_pdf_url, content_json: content, improvements_suggested: [],
        model_used: model, provider_used: 'platform_anthropic', cost_eur: cost, tokens_in: tin, tokens_out: tout, status: 'completed',
        created_by: business.created_by, owner_email: owner,
      });
      const upd = {};
      if (!hasByok && user.role !== 'admin') upd.offers_free_generations_used = (business.offers_free_generations_used || 0) + 1;
      if (trialing && cost > 0) upd.trial_cost_used_eur = (business.trial_cost_used_eur || 0) + cost;
      if (Object.keys(upd).length) await sr.Business.update(business_id, upd);
      sr.UsageLog.create({ business_id, date: now.toISOString().split('T')[0], pillar: 'offers', feature: 'offers', subfeature: 'design_generate', model, input_tokens: tin, output_tokens: tout, cost_eur: cost, is_demo: false, created_by: business.created_by }).catch(() => {});
      return Response.json({ success: true, version: VERSION, generation_id: generation.id, output_pdf_url, output_markdown, improvements_suggested: [], pages: content.pages.length, client_name: clientName, amount: Number.isFinite(total) ? total : null });
    }

    return err('Neznano dejanje.');
  } catch (error) {
    return Response.json({ error: 'Ponudbe: ' + (error?.message || String(error)), version: VERSION });
  }
});
