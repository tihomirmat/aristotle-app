import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

// Prebere spletno stran podjetja (do 8 podstrani) in iz nje izlušči profil + bazo znanja.

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MAX_PAGES = 8;
const MAX_CHARS_PER_PAGE = 7000;
const INTERESTING = /(storit|cenik|cene|ponudb|kontakt|o-nas|o_nas|onas|about|faq|vprašanj|vprasanj|delovni|urnik|paket|rezerv|termin|services|pricing|contact|oglas|marketing|izdelav|izobra)/i;
const BORING = /\/(project|projekt|portfolio|blog|novice|news|category|tag|author|page|wp-|feed|reference)\b/i;

const normalizeUrl = (u) => {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const url = new URL(s); url.hash = ''; return url.toString(); } catch { return ''; }
};

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAristotleBot/1.0)', 'Accept-Language': 'sl,en;q=0.8' } });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(t); }
}

function htmlToText(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const title = (s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const metaDesc = (s.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || '').trim();
  s = s.replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { title, metaDesc, text: s.slice(0, MAX_CHARS_PER_PAGE) };
}

function extractLinks(html, base) {
  const out = new Set();
  const re = /<a[^>]+href=["']([^"'#?]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base);
      if (u.origin !== new URL(base).origin) continue;
      if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp)$/i.test(u.pathname)) continue;
      u.hash = ''; u.search = '';
      out.add(u.toString());
    } catch { /* ignore */ }
  }
  return [...out];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const url = normalizeUrl(body.url);
    if (!url) return Response.json({ error: 'Vnesite veljaven naslov spletne strani (npr. www.vase-podjetje.si).' }, { status: 400 });

    const homeHtml = await fetchText(url);
    if (!homeHtml) return Response.json({ error: 'Spletne strani ni bilo mogoče prebrati. Preverite naslov ali vnesite podatke ročno.' }, { status: 400 });

    const links = extractLinks(homeHtml, url);
    const ranked = links
      .filter((l) => l !== url && l !== url.replace(/\/$/, ''))
      .filter((l) => !BORING.test(l))
      .sort((a, b) => (INTERESTING.test(b) ? 1 : 0) - (INTERESTING.test(a) ? 1 : 0) || a.length - b.length)
      .slice(0, MAX_PAGES - 1);

    const pages = [{ url, ...htmlToText(homeHtml) }];
    const others = await Promise.all(ranked.map(async (l) => { const h = await fetchText(l); return h ? { url: l, ...htmlToText(h) } : null; }));
    for (const p of others) if (p && p.text.length > 200) pages.push(p);

    const corpus = pages.map((p) => `### ${p.url}\nNaslov: ${p.title}\n${p.metaDesc ? 'Opis: ' + p.metaDesc + '\n' : ''}${p.text}`).join('\n\n').slice(0, 45000);

    const schema = `{
  "name": "uradno ime podjetja ali blagovne znamke",
  "industry_template": "ena od: gym | dental_medspa | home_services | restaurant | salon_barber | auto | other",
  "short_description": "1 stavek, kaj podjetje dela in za koga",
  "phone": "telefon ali prazno",
  "email": "javni e-naslov ali prazno",
  "address": "naslov ali prazno",
  "hours": "delovni čas ali prazno",
  "services": "seznam glavnih storitev, vsaka v svoji vrstici (največ 12)",
  "current_offer": "trenutna akcija/ponudba, če je omenjena, sicer prazno",
  "brand_voice": "2–3 stavki: kako podjetje nagovarja stranke (vikanje/tikanje, ton, poudarki), izpeljano iz besedil na strani",
  "knowledge": [ { "title": "kratek naslov", "category": "Storitve | Cene | Kontakt | Termini | FAQ | O podjetju", "content": "3–8 stavkov točnih informacij iz strani, brez izmišljanja" } ]
}`;

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
      system: `Si natančen analitik spletnih strani slovenskih podjetij. Iz besedila strani izlušči podatke. NIKOLI ne izmišljuj: če podatka ni, pusti prazno. Vrni ZGOLJ čist JSON brez ograj po tej shemi:\n${schema}\nknowledge naj ima 4–8 vnosov, ki pokrijejo storitve, cene (če so), kontakt, delovni čas, pogosta vprašanja in opis podjetja. Besedila v slovenščini.`,
      messages: [{ role: 'user', content: corpus }],
    });
    const raw = res.content?.[0]?.text?.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '') || '{}';
    let data = {};
    try { data = JSON.parse(raw); } catch { return Response.json({ error: 'Strani nismo uspeli razumeti. Vnesite podatke ročno.' }, { status: 500 }); }

    const allowed = ['gym', 'dental_medspa', 'home_services', 'restaurant', 'salon_barber', 'auto', 'other'];
    if (!allowed.includes(data.industry_template)) data.industry_template = 'other';
    data.website = url;
    data.pages_read = pages.length;
    data.knowledge = Array.isArray(data.knowledge) ? data.knowledge.filter((k) => k?.title && k?.content).slice(0, 8) : [];

    base44.asServiceRole.entities.UsageLog.create({
      business_id: body.business_id || null, date: new Date().toISOString().split('T')[0], pillar: 'onboarding', feature: 'scan_website', model: 'claude-haiku-4-5',
      input_tokens: res.usage?.input_tokens || 0, output_tokens: res.usage?.output_tokens || 0,
      cost_eur: ((res.usage?.input_tokens || 0) * 0.92 + (res.usage?.output_tokens || 0) * 4.6) / 1_000_000, is_demo: false,
    }).catch(() => {});

    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json({ error: 'Napaka pri branju strani: ' + (error?.message || String(error)) }, { status: 500 });
  }
});
