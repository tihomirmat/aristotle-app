// Ohranitev dizajna ponudbe: iz izvirnega PDF prebere slog (pisave, velikosti, barve, razmiki, položaji),
// naredi »list« brez besedila (glava, noga, ozadje ostanejo) in novo vsebino izriše v istem slogu.
// Knjižnice so podane od zunaj (deps), da ista koda teče v Node (preizkus) in Deno (Base44).
// Preizkušeno 11. 11. 2026 na Ponudba_ZANS.pdf: ponovni izris izvirnika je slikovno enak izvirniku.

const r1 = (n) => Math.round(n * 10) / 10;
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const cleanFont = (n) => String(n || '').replace(/^[A-Z]{6}\+/, '').replace(/,/g, '-').replace(/-\d{2,6}$/, '');

// ───────────────────────── 1. BRANJE: besedilo s položajem, pisavo, velikostjo in barvo ─────────────────────────
export async function extractSpans(bytes, { getDocumentProxy, getResolvedPDFJS }) {
  const { OPS } = await getResolvedPDFJS();
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { fontExtraProperties: true });
  const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();
    const fontName = {};
    const nameOf = (id) => { if (!(id in fontName)) { let n = id; try { const f = page.commonObjs.get(id); n = f?.name || f?.psName || (f?.missingFile ? f?.loadedName : null) || id; } catch { /* */ } fontName[id] = cleanFont(n); } return fontName[id]; };
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
    let tm = [1, 0, 0, 1, 0, 0]; let tlm = [1, 0, 0, 1, 0, 0];
    let font = ''; let size = 0; let leading = 0; let cs = 0; let ws = 0; let hs = 1;
    let fill = '#000000'; let stroke = '#000000'; let lw = 1;
    const spans = []; const rules = [];
    const toHex = (a) => (typeof a[0] === 'string' ? a[0].toLowerCase() : hex(a[0], a[1], a[2]));
    const show = (glyphs) => {
      const m = mul(tm, ctm);
      const scale = Math.hypot(m[2], m[3]);
      let adv = 0; let str = '';
      for (const g of glyphs || []) {
        if (typeof g === 'number') { adv += (-g / 1000) * size * hs; if (g < -220 && !str.endsWith(' ')) str += ' '; continue; }
        if (!g) continue;
        str += g.unicode || '';
        adv += ((g.width || 0) / 1000 * size + cs + (g.isSpace ? ws : 0)) * hs;
      }
      if (str.trim() && scale * Math.abs(size) > 1) spans.push({ x: r1(m[4]), y: r1(vp.height - m[5]), w: r1(adv * Math.hypot(m[0], m[1])), size: r1(Math.abs(size) * scale), font: nameOf(font), color: fill, str });
      tm = mul([1, 0, 0, 1, adv, 0], tm);
    };
    const nextLine = () => { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); };
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]; const a = ops.argsArray[i] || [];
      switch (fn) {
        case OPS.save: stack.push(ctm.slice()); break;
        case OPS.restore: if (stack.length) ctm = stack.pop(); break;
        case OPS.transform: ctm = mul(a.length === 6 ? a : a[0], ctm); break;
        case OPS.beginText: tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); break;
        case OPS.setFont: font = a[0]; size = a[1]; break;
        case OPS.setLeading: leading = a[0]; break;
        case OPS.setCharSpacing: cs = a[0]; break;
        case OPS.setWordSpacing: ws = a[0]; break;
        case OPS.setHScale: hs = a[0] / 100; break;
        case OPS.setTextMatrix: { const t = Array.isArray(a[0]) || a[0]?.length === 6 ? Array.from(a[0]) : a; tm = t.slice(0, 6); tlm = tm.slice(); break; }
        case OPS.moveText: tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm); tm = tlm.slice(); break;
        case OPS.setLeadingMoveText: leading = -a[1]; tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm); tm = tlm.slice(); break;
        case OPS.nextLine: nextLine(); break;
        case OPS.showText: case OPS.showSpacedText: show(a[0]); break;
        case OPS.nextLineShowText: nextLine(); show(a[0]); break;
        case OPS.nextLineSetSpacingShowText: ws = a[0]; cs = a[1]; nextLine(); show(a[2]); break;
        case OPS.setFillRGBColor: fill = toHex(a); break;
        case OPS.setStrokeRGBColor: stroke = toHex(a); break;
        case OPS.setLineWidth: lw = a[0]; break;
        case OPS.constructPath: {
          const mm = a[2]; if (!mm || mm.length < 4) break;
          const p0 = [mm[0] * ctm[0] + mm[1] * ctm[2] + ctm[4], mm[0] * ctm[1] + mm[1] * ctm[3] + ctm[5]];
          const p1 = [mm[2] * ctm[0] + mm[3] * ctm[2] + ctm[4], mm[2] * ctm[1] + mm[3] * ctm[3] + ctm[5]];
          const x0 = Math.min(p0[0], p1[0]); const x1 = Math.max(p0[0], p1[0]); const y0 = Math.min(p0[1], p1[1]); const y1 = Math.max(p0[1], p1[1]);
          const stroked = a[0] === OPS.stroke || a[0] === OPS.closeStroke;
          const filled = a[0] === OPS.fill || a[0] === OPS.eoFill;
          const th = stroked ? lw * Math.hypot(ctm[2], ctm[3]) : y1 - y0;
          if ((stroked || filled) && y1 - y0 < (stroked ? 0.5 : 2.5) && x1 - x0 > 6 && th < 3) rules.push({ x0: r1(x0), x1: r1(x1), y: r1(vp.height - (y0 + y1) / 2), width: r1(Math.max(0.3, th)), color: stroked ? stroke : fill });
          break;
        }
        default:
      }
    }
    pages.push({ w: r1(vp.width), h: r1(vp.height), spans, rules });
  }
  return pages;
}

// ───────────────────────── 2. SLOG: slogi, vrstice, odstavki, številka strani ─────────────────────────
const MARK = /^\s*(?:[–—\-•·▪■●○✓✔]|\d{1,2}[.)]\d{0,2}\.?)\s+/;

export function buildDesign(pages) {
  const styleKey = (s) => `${s.font}|${Math.round(s.size * 2) / 2}|${s.color}`;
  const count = {};
  pages.forEach((pg) => pg.spans.forEach((s) => { count[styleKey(s)] = (count[styleKey(s)] || 0) + s.str.length; }));
  const keys = Object.keys(count).sort((a, b) => count[b] - count[a]);
  if (!keys.length) throw new Error('V dokumentu ni besedila, ki bi ga lahko prebrali (verjetno je skeniran kot slika).');
  const idOf = Object.fromEntries(keys.map((k, i) => [k, 's' + (i + 1)]));
  const styles = Object.fromEntries(keys.map((k) => { const [font, size, color] = k.split('|'); return [idOf[k], { font, size: Number(size), color }]; }));
  const W = pages[0].w; const H = pages[0].h;

  // vrstice
  const pageLines = pages.map((pg) => {
    const rows = [];
    [...pg.spans].sort((a, b) => a.y - b.y || a.x - b.x).forEach((s) => {
      const row = rows.find((r) => Math.abs(r.y - s.y) < Math.max(2, s.size * 0.25));
      if (row) row.spans.push(s); else rows.push({ y: s.y, spans: [s] });
    });
    return rows.map((r) => { r.spans.sort((a, b) => a.x - b.x); return r; }).sort((a, b) => a.y - b.y);
  });
  let rightEdge = 0; let left = W;
  pageLines.forEach((rows, pi) => rows.forEach((r) => r.spans.forEach((s) => {
    if (r.y < H * 0.12 || r.y > H * 0.9) return;
    if (styleKey(s) === keys[0]) left = Math.min(left, s.x);
    if (!(pi === 0 && pages.length > 2)) rightEdge = Math.max(rightEdge, s.x + s.w);
  })));
  if (!rightEdge) rightEdge = W - 60;
  if (left >= W) left = 60;
  rightEdge = Math.min(W - 20, r1(rightEdge));

  // prečrtano besedilo: tanka črta čez sredino dela vrstice
  const hrules = pages.map(() => []);
  pages.forEach((pg, pi) => (pg.rules || []).forEach((ln) => {
    let hit = false;
    pg.spans.forEach((s) => {
      if (ln.y < s.y - s.size * 0.62 || ln.y > s.y - s.size * 0.12) return;
      if (ln.x1 < s.x + 1 || ln.x0 > s.x + s.w - 1) return;
      hit = true;
      // razdeli na besede in označi tiste, ki jih črta pokriva
      const parts = s.str.split(/(\s+)/); const total = s.str.length || 1; let pos = 0; const out = [];
      parts.forEach((part) => {
        if (!part) return;
        const cx = s.x + ((pos + part.length / 2) / total) * s.w; pos += part.length;
        const st = part.trim() && cx > ln.x0 - 1 && cx < ln.x1 + 1;
        const last = out[out.length - 1];
        if (last && (!!last.strike === !!st || !part.trim())) last.t += part; else out.push({ t: part, strike: st });
      });
      s.parts = out;
    });
    if (!hit && ln.x1 - ln.x0 > (rightEdge - left) * 0.5) hrules[pi].push(ln);
  }));

  // številka strani + »pohištvo« strani (glava/noga): ostane v listu v izvirni obliki, ne izrisujemo ga znova
  const coverLike = pages.length > 2;
  let pageNumber = null; const repeatMap = {};
  pageLines.forEach((rows, pi) => rows.forEach((r) => {
    const text = r.spans.map((s) => s.str).join(' ').trim();
    const zone = r.y < H * 0.12 || r.y > H * 0.88;
    if (!zone) return;
    if (/^\d{1,3}$/.test(text) && r.y > H * 0.85) {
      const s = r.spans[0];
      if (!pageNumber) pageNumber = { y: r.y, style: idOf[styleKey(s)], firstPage: pi, firstNumber: Number(text), xs: [], rights: [] };
      pageNumber.xs.push(s.x); pageNumber.rights.push(s.x + s.w); r.isPageNo = true; return;
    }
    const k = `${Math.round(r.y)}|${text}`;
    (repeatMap[k] = repeatMap[k] || { rows: [], text }).rows.push({ pi, r });
  }));
  Object.values(repeatMap).forEach((g) => {
    if (pages.length >= 2 && g.rows.length >= Math.max(2, Math.ceil(pages.length * 0.6))) g.rows.forEach(({ r }) => { r.isRepeat = true; });
  });
  const hasCover = coverLike && !!pageNumber && !pageLines[0].some((r) => r.isPageNo);
  // glava: vrstice v zgornjih 12 % strani, ločene od vsebine; noga: vrstice v spodnjih 10 %, ločene od vsebine
  pageLines.forEach((rows, pi) => {
    if (pi === 0 && hasCover) return;
    const live = rows.filter((r) => !r.isPageNo);
    let h = 0; while (h < live.length && live[h].y < H * 0.12) h++;
    if (h > 0 && (h === live.length || live[h].y - live[h - 1].y >= 20)) live.slice(0, h).forEach((r) => { r.isRepeat = true; });
    let f = live.length; while (f > 0 && live[f - 1].y > H * 0.9) f--;
    if (f < live.length && (f === 0 || live[f].y - live[f - 1].y >= 24)) live.slice(f).forEach((r) => { r.isRepeat = true; });
  });
  let keepAbove = 0; let keepBelow = H; let firstBody = H; let lastBody = 0; let anyFooter = false; let anyHeader = false;
  pageLines.forEach((rows, pi) => {
    if (pi === 0 && hasCover) return;
    rows.forEach((r) => {
      const size = Math.max(...r.spans.map((s) => s.size));
      if (r.isRepeat && r.y < H * 0.5) { keepAbove = Math.max(keepAbove, r.y + 3); anyHeader = true; }
      else if (r.isRepeat) { keepBelow = Math.min(keepBelow, r.y - size - 1); anyFooter = true; }
      else if (!r.isPageNo) { firstBody = Math.min(firstBody, r.y - size); lastBody = Math.max(lastBody, r.y); }
    });
    (pages[pi].rules || []).forEach((ln) => { if (ln.y < H * 0.12) { keepAbove = Math.max(keepAbove, ln.y + 3); anyHeader = true; } if (ln.y > H * 0.9) { keepBelow = Math.min(keepBelow, ln.y - 3); anyFooter = true; } });
  });
  if (pageNumber) keepBelow = Math.min(keepBelow, pageNumber.y - styles[pageNumber.style].size - 4);
  if (!anyFooter && !pageNumber) keepBelow = Math.max(lastBody + 6, H * 0.88);
  if (!anyHeader) keepAbove = Math.max(0, Math.min(firstBody - 4, H * 0.3));
  keepBelow = Math.max(keepBelow, lastBody + 4 > H * 0.97 ? H : Math.min(lastBody + 4, H));
  // vodoravne črte v glavi/nogi so del lista, ne vsebine
  hrules.forEach((list, pi) => { hrules[pi] = list.filter((ln) => ln.y > keepAbove && ln.y < keepBelow); });
  if (pageNumber) {
    const spread = (a) => Math.max(...a) - Math.min(...a);
    pageNumber.align = spread(pageNumber.rights) <= spread(pageNumber.xs) ? 'right' : 'left';
    pageNumber.x = pageNumber.align === 'right' ? r1(Math.max(...pageNumber.rights)) : r1(Math.min(...pageNumber.xs));
    delete pageNumber.xs; delete pageNumber.rights;
  }

  // razmik med vrsticami za vsak slog
  const deltas = {};
  pageLines.forEach((rows) => { for (let i = 1; i < rows.length; i++) { const a = rows[i - 1]; const b = rows[i]; const ka = styleKey(a.spans[0]); if (ka === styleKey(b.spans[0]) && b.y - a.y < a.spans[0].size * 2.2) (deltas[ka] = deltas[ka] || []).push(Math.round((b.y - a.y) * 2) / 2); } });
  keys.forEach((k) => {
    const d = deltas[k]; const st = styles[idOf[k]];
    if (d?.length) { const f = {}; d.forEach((v) => { f[v] = (f[v] || 0) + 1; }); const multi = Object.keys(f).map(Number).filter((v) => f[v] >= 2 && v >= st.size * 1.05); st.leading = multi.length ? Math.min(...multi) : Math.min(...d.filter((v) => v >= st.size)) || r1(st.size * 1.4); }
    else st.leading = r1(st.size * 1.4);
    if (!Number.isFinite(st.leading)) st.leading = r1(st.size * 1.4);
  });

  // odstavki (primer vsebine v »jeziku« slogov)
  const example = pageLines.map((rows0, pi) => {
    const blocks = []; let prev = null;
    const rows = [...rows0.filter((r) => !r.isPageNo && !r.isRepeat), ...hrules[pi].map((ln) => ({ y: ln.y, rule: ln, spans: [] }))].sort((a, b) => a.y - b.y);
    rows.forEach((r) => {
      if (r.rule) {
        const b = { x: r1(r.rule.x0), rule: { color: r.rule.color, width: r.rule.width, x1: r1(r.rule.x1) }, runs: [], lastY: r.y, lastEnd: 0 };
        if (prev) b.gap = r1(r.y - prev.lastY); else b.top = r1(r.y);
        blocks.push(b); prev = b; return;
      }
      const segs = []; // [levo, desno]
      let cur = { runs: [], x: r.spans[0].x, end: 0 };
      r.spans.forEach((s, i) => {
        const id = idOf[styleKey(s)];
        const prevS = r.spans[i - 1];
        const gap = prevS ? s.x - (prevS.x + prevS.w) : 0;
        if (prevS && gap > 36 && Math.abs(r.spans[r.spans.length - 1].x + r.spans[r.spans.length - 1].w - rightEdge) < 4) { segs.push(cur); cur = { runs: [], x: s.x, end: 0 }; }
        const pieces = s.parts || [{ t: s.str }];
        pieces.forEach((pc, k) => {
          let t = pc.t;
          const last = cur.runs[cur.runs.length - 1];
          let dx = 0;
          if (k === 0 && last && gap > s.size * 0.12 && !last.t.endsWith(' ') && !t.startsWith(' ')) {
            if (gap >= s.size * 0.2 && gap <= s.size * 0.42 && last.s === id) t = ' ' + t; else dx = r1(gap);
          }
          if (last && last.s === id && !!last.strike === !!pc.strike && !dx) last.t += t;
          else { const run = { s: id, t }; if (pc.strike) run.strike = true; if (dx) run.dx = dx; cur.runs.push(run); }
        });
        cur.end = s.x + s.w;
      });
      segs.push(cur);
      const main = segs[0]; const right = segs[1] || null;
      const first = main.runs[0]; const st = styles[first.s];
      const text = main.runs.map((x) => x.t).join('');
      const sameStyle = prev && prev.runs[0] && prev.runs[0].s === first.s && Math.abs(prev.x - main.x) < 1.5;
      const delta = prev ? r.y - prev.lastY : null;
      const full = prev && prev.lastEnd > left + (rightEdge - left) * 0.8;
      if (sameStyle && !right && !prev.right && full && Math.abs(delta - st.leading) <= 1.5 && !MARK.test(text)) {
        // nadaljevanje odstavka
        const lastRun = prev.runs[prev.runs.length - 1];
        if (!lastRun.t.endsWith(' ')) lastRun.t += ' ';
        main.runs.forEach((x) => { const lr = prev.runs[prev.runs.length - 1]; if (lr.s === x.s) lr.t += x.t; else prev.runs.push(x); });
        prev.lastY = r.y; prev.lastEnd = main.end; return;
      }
      const b = { x: r1(main.x), runs: main.runs, lastY: r.y, lastEnd: main.end };
      if (prev) b.gap = r1(delta); else b.top = r1(r.y);
      if (right) b.right = right.runs;
      blocks.push(b); prev = b;
    });
    return blocks.map(({ lastY, lastEnd, ...b }) => b);
  });

  const bottom = Math.round(Math.min(keepBelow - 8, pageNumber ? pageNumber.y - 20 : H));
  return { page: { w: W, h: H }, left: r1(left), rightEdge, bottom, keepAbove: r1(keepAbove), keepBelow: r1(keepBelow), styles, pageNumber, example, hasCover };
}

// ───────────────────────── 3. LIST: izvirne strani brez besedila ─────────────────────────
// Pregleda vsebinski tok strani: sledi matrikam (cm, Tm, Td …) in izreže (a) izpise besedila, ki jih keepText ne potrdi,
// (b) risane poti (črte, okvirji, podlage), ki jih dropPath potrdi. Slike in vstavljeni objekti (Do) ostanejo.
export function processContent(src, H, keepText, dropPath) {
  const n = src.length; let i = 0; const cuts = [];
  const isWs = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';
  const DELIM = '()<>[]{}/%';
  const mul = (m, k) => [m[0] * k[0] + m[1] * k[2], m[0] * k[1] + m[1] * k[3], m[2] * k[0] + m[3] * k[2], m[2] * k[1] + m[3] * k[3], m[4] * k[0] + m[5] * k[2] + k[4], m[4] * k[1] + m[5] * k[3] + k[5]];
  let ctm = [1, 0, 0, 1, 0, 0]; const gs = [];
  let tm = [1, 0, 0, 1, 0, 0]; let tlm = tm.slice(); let leading = 0;
  let path = null; let stack = [];
  const nums = (k) => stack.slice(-k).map((o) => o.v || 0);
  const skipString = () => { let depth = 1; i++; while (i < n && depth > 0) { const c = src[i]; if (c === '\\') i += 2; else { if (c === '(') depth++; else if (c === ')') depth--; i++; } } };
  const addPt = (x, y) => { path.pts.push([ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]); };
  while (i < n) {
    const c = src[i];
    if (isWs(c)) { i++; continue; }
    if (c === '%') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    const start = i;
    if (c === '(') { skipString(); stack.push({ s: start }); continue; }
    if (c === '<' && src[i + 1] === '<') { let d = 1; i += 2; while (i < n && d > 0) { if (src[i] === '<' && src[i + 1] === '<') { d++; i += 2; } else if (src[i] === '>' && src[i + 1] === '>') { d--; i += 2; } else if (src[i] === '(') skipString(); else i++; } stack.push({ s: start }); continue; }
    if (c === '<') { while (i < n && src[i] !== '>') i++; i++; stack.push({ s: start }); continue; }
    if (c === '[') { let d = 1; i++; while (i < n && d > 0) { const ch = src[i]; if (ch === '(') skipString(); else { if (ch === '[') d++; else if (ch === ']') d--; i++; } } stack.push({ s: start }); continue; }
    if (c === '/') { i++; while (i < n && !isWs(src[i]) && !DELIM.includes(src[i])) i++; stack.push({ s: start }); continue; }
    let j = i; while (j < n && !isWs(src[j]) && !DELIM.includes(src[j])) j++;
    if (j === i) { i++; continue; }
    const tok = src.slice(i, j); i = j;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(tok)) { stack.push({ s: start, v: parseFloat(tok) }); continue; }
    const opStart = stack.length ? stack[0].s : start;
    const showAt = () => { const m = mul(tm, ctm); return [m[4], H - m[5]]; };
    switch (tok) {
      case 'q': gs.push(ctm.slice()); break;
      case 'Q': if (gs.length) ctm = gs.pop(); break;
      case 'cm': ctm = mul(nums(6), ctm); break;
      case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); break;
      case 'Tm': tm = nums(6); tlm = tm.slice(); break;
      case 'Td': { const [x, y] = nums(2); tlm = mul([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); break; }
      case 'TD': { const [x, y] = nums(2); leading = -y; tlm = mul([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); break; }
      case 'TL': leading = nums(1)[0]; break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); break;
      case 'Tj': case 'TJ': { const [x, y] = showAt(); if (!keepText(x, y)) cuts.push([opStart, i, ' ']); break; }
      case "'": case '"': { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); const [x, y] = showAt(); if (!keepText(x, y)) cuts.push([opStart, i, ' T* ']); break; }
      case 'BI': { const k = src.indexOf('ID', i); const m = /\sEI(?=\s|$)/.exec(src.slice(k < 0 ? i : k)); i = m ? (k < 0 ? i : k) + m.index + 3 : n; break; }
      case 'm': case 'l': { if (!path) path = { start: opStart, pts: [], clip: false }; const [x, y] = nums(2); addPt(x, y); break; }
      case 're': { if (!path) path = { start: opStart, pts: [], clip: false }; const [x, y, w, h] = nums(4); addPt(x, y); addPt(x + w, y + h); addPt(x + w, y); addPt(x, y + h); break; }
      case 'c': { if (!path) path = { start: opStart, pts: [], clip: false }; const v = nums(6); addPt(v[0], v[1]); addPt(v[2], v[3]); addPt(v[4], v[5]); break; }
      case 'v': case 'y': { if (!path) path = { start: opStart, pts: [], clip: false }; const v = nums(4); addPt(v[0], v[1]); addPt(v[2], v[3]); break; }
      case 'h': break;
      case 'W': case 'W*': if (path) path.clip = true; break;
      case 'S': case 's': case 'f': case 'F': case 'f*': case 'B': case 'B*': case 'b': case 'b*': case 'n': {
        if (path && path.pts.length && tok !== 'n' && !path.clip) {
          const xs = path.pts.map((p) => p[0]); const ys = path.pts.map((p) => H - p[1]);
          if (dropPath({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) })) cuts.push([path.start, i, ' ']);
        }
        path = null; break;
      }
      default:
    }
    stack = [];
  }
  if (!cuts.length) return src;
  cuts.sort((a, b) => a[0] - b[0]);
  let out = ''; let pos = 0;
  for (const [a, b, r] of cuts) { if (a < pos) continue; out += src.slice(pos, a) + r; pos = b; }
  return out + src.slice(pos);
}

export async function buildLetterhead(bytes, PDFLib, design) {
  const { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } = PDFLib;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const n = src.getPageCount();
  const H = design.page.h; const pn = design.pageNumber;
  const keepText = (x, y) => (y <= design.keepAbove || y >= design.keepBelow) && !(pn && Math.abs(y - pn.y) < 3);
  const dropPath = (b) => b.y0 > design.keepAbove && b.y1 < design.keepBelow;
  const read = (i) => {
    const contents = src.getPage(i).node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => src.context.lookup(ref)) : [contents];
    let text = '';
    for (const s of streams) {
      if (!s) continue;
      const raw = s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getContents();
      let chunk = '';
      for (let k = 0; k < raw.length; k += 8192) chunk += String.fromCharCode.apply(null, raw.subarray(k, k + 8192));
      text += chunk + '\n';
    }
    return text;
  };
  const cover = design.hasCover ? processContent(read(0), H, () => false, () => false) : null;
  const cleaned = []; for (let i = 0; i < n; i++) cleaned.push(i === 0 && cover ? cover : processContent(read(i), H, keepText, dropPath));
  const inner = n > 1 ? cleaned.map((s, i) => [s.length, i]).filter(([, i]) => i > 0).sort((a, b) => a[0] - b[0])[0][1] : 0;
  const use = n > 1 ? [0, inner] : [0];
  use.forEach((i) => {
    const bytesOut = Uint8Array.from(cleaned[i], (c) => c.charCodeAt(0) & 0xff);
    src.getPage(i).node.set(PDFName.of('Contents'), src.context.register(src.context.flateStream(bytesOut)));
  });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, use);
  copied.forEach((p) => out.addPage(p));
  return { bytes: await out.save(), innerIndex: inner };
}

// ───────────────────────── 4. PISAVE ─────────────────────────
const WEIGHTS = [['thin', 100], ['hairline', 100], ['extralight', 200], ['ultralight', 200], ['semilight', 300], ['light', 300], ['medium', 500], ['semibold', 600], ['demibold', 600], ['demi', 600], ['extrabold', 800], ['ultrabold', 800], ['heavy', 900], ['black', 900], ['bold', 700], ['regular', 400], ['book', 400], ['roman', 400]];
const SUBSTITUTE = { calibri: 'Carlito', arial: 'Arimo', arialmt: 'Arimo', helvetica: 'Arimo', helveticaneue: 'Arimo', timesnewroman: 'Tinos', timesnewromanpsmt: 'Tinos', times: 'Tinos', cambria: 'Caladea', couriernew: 'Cousine', courier: 'Cousine', verdana: 'Open Sans', tahoma: 'Open Sans', segoeui: 'Open Sans', georgia: 'Gelasio', aptos: 'Inter', symbol: 'Arimo', zapfdingbats: 'Arimo' };
export function parseFontName(name) {
  const n = cleanFont(name).replace(/(PSMT|MT|PS)$/, '');
  const italic = /italic|oblique/i.test(n);
  let weight = 400; let fam = n.replace(/[-_ ]?(italic|oblique)/ig, '');
  for (const [w, v] of WEIGHTS) { const re = new RegExp(`[-_ ]?${w}$`, 'i'); if (re.test(fam)) { weight = v; fam = fam.replace(re, ''); break; } }
  fam = fam.replace(/[-_]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || 'Arimo';
  const sub = SUBSTITUTE[fam.replace(/\s+/g, '').toLowerCase()];
  return { family: sub || fam, weight, italic, substituted: !!sub };
}
// Pisava kot TTF. Vira: Google Fonts CSS (User-Agent »Mozilla/4.0« vrne TTF) in GitHub google/fonts.
// Datoteko sprejmemo samo, če ima č, š, ž in € (Googlova Lato npr. nima č) — sicer naslednji vir ali nadomestna pisava.
const STYLE_NAME = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
const NEED = [0x10d, 0x161, 0x17e, 0x10c, 0x160, 0x17d, 0x20ac];
export async function fetchGoogleFont(name, fontkit) {
  const { family, weight, italic } = parseFontName(name);
  const covers = (bytes) => { if (!fontkit) return true; try { const f = fontkit.create(bytes); return NEED.every((cp) => f.hasGlyphForCodePoint(cp)); } catch { return false; } };
  const get = async (url, headers) => { try { const r = await fetch(url, headers ? { headers } : undefined); return r.ok ? r : null; } catch { return null; } };
  const viaCss = async (fam, w, it) => {
    const r = await get(`https://fonts.googleapis.com/css?family=${encodeURIComponent(fam)}:${w}${it ? 'i' : ''}&subset=latin-ext`, { 'User-Agent': 'Mozilla/4.0' });
    const m = r && (await r.text()).match(/url\((https:[^)]+\.(?:ttf|otf))\)/);
    const f = m && (await get(m[1]));
    return f ? new Uint8Array(await f.arrayBuffer()) : null;
  };
  const viaRepo = async (fam, w, it) => {
    const dir = fam.replace(/\s+/g, '').toLowerCase(); const style = (w === 400 && it ? '' : STYLE_NAME[w] || 'Regular') + (it ? 'Italic' : '');
    for (const lic of ['ofl', 'apache', 'ufl']) { const r = await get(`https://raw.githubusercontent.com/google/fonts/main/${lic}/${dir}/${fam.replace(/\s+/g, '')}-${style}.ttf`); if (r) return new Uint8Array(await r.arrayBuffer()); }
    return null;
  };
  const near = weight >= 600 ? 700 : 400;
  for (const [fam, w, it, exact] of [[family, weight, italic, true], [family, near, false, false]]) {
    for (const src of [viaCss, viaRepo]) { const b = await src(fam, w, it); if (b && covers(b)) return { bytes: b, used: `${fam} ${w}${it ? ' italic' : ''}`, exact }; }
  }
  for (const fam of ['Arimo', 'Noto Sans', 'Roboto']) {
    for (const src of [viaCss, viaRepo]) { const b = await src(fam, near, false); if (b && covers(b)) return { bytes: b, used: `${fam} ${near}`, exact: false }; }
  }
  throw new Error(`Pisave ${family} ni bilo mogoče naložiti.`);
}

// ───────────────────────── 5. IZRIS nove ponudbe ─────────────────────────
// content.pages = [[{ x?, top?, gap?, runs:[{s,t,strike?,dx?}], right?:[{s,t}], rule?:{color,width,x1?} }]]
export async function renderOffer({ letterhead, design, content, loadFont }, PDFLib, fontkit) {
  const { PDFDocument, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const lh = await PDFDocument.load(letterhead);
  const embedded = await doc.embedPages(lh.getPages());
  const coverTpl = embedded[0]; const innerTpl = embedded[1] || embedded[0];
  const { w: W, h: H } = design.page;
  const fonts = {}; const charsets = {};
  for (const st of Object.values(design.styles)) {
    if (!fonts[st.font]) { fonts[st.font] = await doc.embedFont(await loadFont(st.font), { subset: true }); charsets[st.font] = new Set(fonts[st.font].getCharacterSet()); }
  }
  const col = (c) => { const v = parseInt(String(c || '#000000').slice(1), 16); return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255); };
  const S = (id) => design.styles[id] || design.styles.s1;
  const F = (id) => fonts[S(id).font];
  const width = (id, t) => F(id).widthOfTextAtSize(t, S(id).size);
  // odstrani znake, ki jih pisava nima (sicer izris pade)
  const safe = (id, t) => { const set = charsets[S(id).font]; let o = ''; for (const ch of String(t ?? '')) { if (ch === '\n' || set.has(ch.codePointAt(0))) o += ch; else if (ch === '–' || ch === '—') o += '-'; else if (ch === ' ' || ch === '\t') o += ' '; } return o; };
  const draw = (page, id, t, x, y, strike) => {
    const st = S(id); if (!t) return;
    page.drawText(t, { x, y: H - y, size: st.size, font: F(id), color: col(st.color) });
    if (strike) { const w = width(id, t.trim()); page.drawLine({ start: { x, y: H - y + st.size * 0.3 }, end: { x: x + w, y: H - y + st.size * 0.3 }, thickness: Math.max(0.6, st.size / 14), color: col(st.color) }); }
  };

  let pageNo = 0; let page = null; let y = 0; let first = true;
  const newPage = () => {
    page = doc.addPage([W, H]);
    const isCover = pageNo === 0 && design.hasCover;
    page.drawPage(pageNo === 0 ? coverTpl : innerTpl);
    if (!isCover) {
      if (design.pageNumber) {
        const pn = design.pageNumber; const num = String(pn.firstNumber + (pageNo - pn.firstPage));
        if (pageNo >= pn.firstPage) draw(page, pn.style, num, pn.align === 'right' ? pn.x - width(pn.style, num) : pn.x, pn.y);
      }
    }
    pageNo++; first = true;
  };

  const tops = design.example.slice(design.hasCover ? 1 : 0).map((b) => b[0]?.top).filter(Boolean);
  const defaultTop = tops.length ? Math.min(...tops) : 80;
  for (const blocks of content.pages) {
    newPage();
    for (const b of blocks) {
      const x0 = b.x ?? design.left;
      const lead = b.rule ? 12 : S(b.runs?.[0]?.s).leading || S(b.runs?.[0]?.s).size * 1.4;
      const rightW = b.right ? b.right.reduce((a, r) => a + width(r.s, safe(r.s, r.t)), 0) : 0;
      const maxW = design.rightEdge - x0 - (b.right ? rightW + 12 : 0);
      // prelom v vrstice
      const lines = [[]]; let lw = 0;
      (b.runs || []).forEach((run) => {
        let dxLeft = run.dx || 0;
        safe(run.s, run.t).split(/(\n)/).forEach((part) => {
          if (part === '\n') { lines.push([]); lw = 0; return; }
          part.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            const tw = width(run.s, tok);
            if (lw + tw > maxW + 2 && lw > 0 && tok.trim()) { lines.push([]); lw = 0; }
            if (!tok.trim() && lw === 0) return;
            const L = lines[lines.length - 1]; const lastTok = L[L.length - 1];
            if (lastTok && lastTok.s === run.s && !!lastTok.strike === !!run.strike && !dxLeft) lastTok.t += tok;
            else { L.push({ s: run.s, t: tok, strike: run.strike, dx: dxLeft }); lw += dxLeft; dxLeft = 0; }
            lw += tw;
          });
        });
      });
      const need = (first ? 0 : (b.gap ?? lead)) + (lines.length - 1) * lead;
      if (!first && y + need > design.bottom) newPage();
      if (first) { y = b.top ?? defaultTop; first = false; } else y += b.gap ?? lead;
      if (b.rule) { page.drawLine({ start: { x: x0, y: H - y }, end: { x: b.rule.x1 || design.rightEdge, y: H - y }, thickness: b.rule.width || 0.75, color: col(b.rule.color || '#d0d4da') }); continue; }
      lines.forEach((L, li) => {
        if (li > 0) { y += lead; if (y > design.bottom + lead) { newPage(); y = defaultTop; first = false; } }
        let x = x0; L.forEach((tok) => { x += tok.dx || 0; draw(page, tok.s, tok.t, x, y, tok.strike); x += width(tok.s, tok.t); });
        if (li === 0 && b.right) { let rx = design.rightEdge - rightW; b.right.forEach((r) => { const t = safe(r.s, r.t); draw(page, r.s, t, rx, y, r.strike); rx += width(r.s, t); }); }
      });
    }
  }
  return doc.save();
}

// ───────────────────────── 6. AI: opis sloga, preverjanje in pretvorba vsebine ─────────────────────────
// Kratek opis slogov + izvirna ponudba kot primer (strani → bloki). AI vrne novo vsebino v isti obliki.
export function designBrief(design) {
  const sample = {};
  design.example.forEach((pg) => pg.forEach((b) => [...(b.runs || []), ...(b.right || [])].forEach((r) => { if (!sample[r.s]) sample[r.s] = r.t.trim().slice(0, 50); })));
  const styles = Object.entries(design.styles).filter(([id]) => sample[id]).map(([id, s]) => `${id}: ${s.font} ${s.size}pt ${s.color} — npr. »${sample[id]}«`).join('\n');
  const slim = design.example.map((pg) => pg.map((b) => { const o = {}; if (b.top != null) o.top = b.top; if (b.gap != null) o.gap = b.gap; if (Math.abs((b.x ?? design.left) - design.left) > 1) o.x = b.x; if (b.rule) o.rule = b.rule; else o.runs = b.runs; if (b.right) o.right = b.right; return o; }));
  return { styles, example: JSON.stringify(slim) };
}

export function validateContent(content, design) {
  const ids = new Set(Object.keys(design.styles));
  const fixRuns = (runs) => (Array.isArray(runs) ? runs : []).filter((r) => r && typeof r.t === 'string').map((r) => ({ s: ids.has(r.s) ? r.s : 's1', t: r.t, ...(r.strike ? { strike: true } : {}), ...(Number(r.dx) > 0 ? { dx: Number(r.dx) } : {}) }));
  const pages = (Array.isArray(content?.pages) ? content.pages : []).map((pg) => (Array.isArray(pg) ? pg : []).map((b) => {
    const o = {};
    if (Number.isFinite(Number(b?.top))) o.top = Math.max(20, Math.min(design.page.h - 40, Number(b.top)));
    if (Number.isFinite(Number(b?.gap))) o.gap = Math.max(0, Math.min(400, Number(b.gap)));
    if (Number.isFinite(Number(b?.x))) o.x = Math.max(10, Math.min(design.page.w - 80, Number(b.x)));
    if (b?.rule) { o.rule = { color: /^#[0-9a-f]{6}$/i.test(b.rule.color || '') ? b.rule.color : '#d8dce3', width: Number(b.rule.width) || 1, ...(Number(b.rule.x1) ? { x1: Number(b.rule.x1) } : {}) }; o.runs = []; return o; }
    o.runs = fixRuns(b?.runs);
    if (b?.right) o.right = fixRuns(b.right);
    return o;
  }).filter((b) => b.rule || b.runs.length)).filter((pg) => pg.length);
  if (!pages.length) throw new Error('AI ni vrnil vsebine ponudbe.');
  return { pages };
}

// Besedilo za predogled na zaslonu (naslovi po velikosti pisave).
export function contentToMarkdown(content, design) {
  const body = design.styles.s1.size; const out = [];
  content.pages.forEach((pg, pi) => {
    if (pi > 0) out.push('');
    pg.forEach((b) => {
      if (b.rule) { out.push('', '---', ''); return; }
      const big = Math.max(...b.runs.map((r) => design.styles[r.s]?.size || body));
      const txt = (runs) => runs.map((r) => { const t = r.t.replace(/\s+/g, ' '); const st = design.styles[r.s] || {}; const bold = /bold|black|heavy|semibold/i.test(st.font || ''); let v = t.trim(); if (!v) return t; if (r.strike) v = `~~${v}~~`; else if (bold && big < body * 1.5) v = `**${v}**`; return (t.startsWith(' ') ? ' ' : '') + v + (t.endsWith(' ') ? ' ' : ''); }).join('');
      let line = txt(b.runs).trim();
      if (b.right) line += ` — ${txt(b.right).trim()}`;
      if (big >= body * 2) out.push('', `# ${line.replace(/\*\*/g, '')}`, '');
      else if (big >= body * 1.5) out.push('', `## ${line.replace(/\*\*/g, '')}`, '');
      else if (/^[–—\-•]\s+/.test(line)) out.push(`- ${line.replace(/^[–—\-•]\s+/, '')}`);
      else out.push('', line);
    });
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
