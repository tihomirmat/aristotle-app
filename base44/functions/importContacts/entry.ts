import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { lower, checkSyntax, domainAcceptsMail, allRecords } from '../../shared/campaignMail.js';
import * as XLSX from 'npm:xlsx@0.18.5';

const EMAIL_ANY = /[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const COLS = {
  email: /^(e-?mail|e-?pošta|e-?posta|email naslov|e-naslov|elektronska pošta|mail|naslov e-pošte)$/i,
  name: /^(ime|ime in priimek|name|full name|kontakt|kontaktna oseba|oseba|priimek in ime)$/i,
  first: /^(first name|ime \(?osebno\)?)$/i,
  last: /^(last name|priimek)$/i,
  company: /^(podjetje|company|firma|naziv|naziv podjetja|organizacija|ime podjetja|company name)$/i,
  phone: /^(telefon|phone|tel\.?|gsm|mobitel|mobile|telefonska številka)$/i,
  website: /^(spletna stran|splet|web|website|url|www|spletni naslov)$/i,
};

// Excel/CSV → vrstice { email, name, company, phone, website }. Glavo prepozna sam; brez glave vzame stolpec z e-naslovi.
function rowsFromSheet(buf) {
  const u8 = new Uint8Array(buf);
  const binary = (u8[0] === 0x50 && u8[1] === 0x4b) || (u8[0] === 0xd0 && u8[1] === 0xcf); // xlsx (zip) ali star xls
  let wb;
  if (binary) wb = XLSX.read(u8, { type: 'array', raw: false });
  else {
    // CSV/TXT: UTF-8 ali Windows-1250 (slovenski Excel), ločilo ; ali , ali tab
    let s;
    try { s = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch { s = new TextDecoder('windows-1250').decode(u8); }
    s = s.replace(/^﻿/, '');
    const first = s.split(/\r?\n/)[0] || '';
    const cnt = (ch) => first.split(ch).length - 1;
    const FS = cnt(';') > cnt(',') && cnt(';') >= cnt('\t') ? ';' : cnt('\t') > cnt(',') ? '\t' : ',';
    wb = XLSX.read(s, { type: 'string', FS, raw: true });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }).map((r) => r.map((c) => String(c ?? '').trim()));
  if (!grid.length) return [];
  const head = grid[0].map((h) => h.replace(/\s+/g, ' ').trim());
  const idx = {};
  for (const [k, re] of Object.entries(COLS)) { const i = head.findIndex((h) => re.test(h)); if (i >= 0) idx[k] = i; }
  let body = grid;
  if (idx.email !== undefined) body = grid.slice(1);
  else {
    // brez glave ali neznana glava: stolpec z največ e-naslovi
    const counts = {};
    grid.slice(0, 50).forEach((r) => r.forEach((c, i) => { if (EMAIL_ANY.test(c)) counts[i] = (counts[i] || 0) + 1; }));
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!best) return [];
    idx.email = Number(best[0]);
    if (!EMAIL_ANY.test(grid[0][idx.email] || '')) body = grid.slice(1);
  }
  return body.map((r) => ({
    email: (String(r[idx.email] || '').match(EMAIL_ANY) || [''])[0],
    name: idx.name !== undefined ? r[idx.name] : [idx.first !== undefined ? r[idx.first] : '', idx.last !== undefined ? r[idx.last] : ''].join(' ').trim(),
    company: idx.company !== undefined ? r[idx.company] : '',
    phone: idx.phone !== undefined ? r[idx.phone] : '',
    website: idx.website !== undefined ? r[idx.website] : '',
  })).filter((r) => r.email);
}

// Prilepljeno besedilo: vsak e-naslov postane vrstica; besedilo pred njim v isti vrstici je ime.
function rowsFromText(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    for (const m of line.matchAll(new RegExp(EMAIL_ANY.source, 'gi'))) {
      const name = line.slice(0, m.index).replace(/[<>"',;:\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      out.push({ email: m[0], name: /@/.test(name) ? '' : name.slice(0, 120) });
    }
  }
  return out;
}

// Seznami naslovov za e-poštne kampanje.
// action import { business_id, name, file_name, rows:[{email,name,company,phone,website}], list_id? }
//   → osnovno preverjanje (zapis, podvojeni, začasni naslovi, ali domena sprejema pošto) in shranjevanje.
// action delete { business_id, list_id } → izbriše seznam in njegove naslove (aktivne kampanje jih nehajo uporabljati).

const VERSION = 'import-contacts-2026-11-11e';
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const MAX_ROWS = 5000;
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));
const clean = (s, n = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const internal = !!INTERNAL_SECRET && body?.internal_secret === INTERNAL_SECRET;
    const user = internal ? null : await base44.auth.me().catch(() => null);
    if (!user && !internal) return Response.json({ error: 'Unauthorized', version: VERSION }, { status: 401 });
    const sr = base44.asServiceRole.entities;
    const business = body.business_id ? (await sr.Business.filter({ id: body.business_id }))[0] : null;
    if (!business || (!internal && !ownsBusiness(user, business))) return Response.json({ error: 'Nimate dostopa do tega podjetja.' });
    const owner = business.owner_email || business.created_by;

    if (body.action === 'delete') {
      const list = (await sr.ContactList.filter({ id: body.list_id }))[0];
      if (!list || list.business_id !== business.id) return Response.json({ error: 'Seznam ni najden.' });
      const cs = await allRecords(sr.ListContact, { business_id: business.id, list_id: list.id });
      const ids = new Set(cs.map((c) => c.id));
      const enr = await allRecords(sr.CampaignEnrollment, { business_id: business.id, status: 'active' });
      for (const e of enr) if (e.contact_id && ids.has(e.contact_id)) await sr.CampaignEnrollment.update(e.id, { status: 'stopped_manual' });
      await pool(cs, 10, (c) => sr.ListContact.delete(c.id).catch(() => null));
      await sr.ContactList.delete(list.id);
      const camps = await sr.Campaign.filter({ business_id: business.id });
      for (const c of camps) if ((c.list_ids || []).includes(list.id)) await sr.Campaign.update(c.id, { list_ids: c.list_ids.filter((x) => x !== list.id) });
      return Response.json({ success: true, deleted: cs.length });
    }

    // ---- uvoz ----
    let source = Array.isArray(body.rows) ? body.rows : [];
    if (body.file_url) {
      const r = await fetch(body.file_url);
      if (!r.ok) return Response.json({ error: 'Datoteke nismo mogli prebrati. Poskusite znova.' });
      try { source = rowsFromSheet(await r.arrayBuffer()); } catch (e) { return Response.json({ error: 'Datoteke nismo razumeli. Shranite jo kot Excel (.xlsx) ali CSV in poskusite znova.' }); }
    } else if (body.text) source = rowsFromText(body.text);
    const rows = source.slice(0, MAX_ROWS);
    if (!rows.length) return Response.json({ error: 'V datoteki ni nobenega e-naslova.' });
    let list = body.list_id ? (await sr.ContactList.filter({ id: body.list_id }))[0] : null;
    if (list && list.business_id !== business.id) return Response.json({ error: 'Seznam ni najden.' });
    const existing = list ? await allRecords(sr.ListContact, { business_id: business.id, list_id: list.id }) : [];
    const have = new Set(existing.map((c) => lower(c.email)));

    const seen = new Set();
    const prepared = [];
    let duplicate = 0;
    for (const r of rows) {
      const email = lower(r.email).replace(/^mailto:/, '').replace(/[<>,;]/g, '');
      if (!email) continue;
      if (seen.has(email) || have.has(email)) { duplicate++; continue; }
      seen.add(email);
      const syn = checkSyntax(email);
      prepared.push({ email, name: clean(r.name), company: clean(r.company), phone: clean(r.phone, 40), website: clean(r.website, 200), status: syn.ok ? 'ok' : 'invalid', check_note: syn.ok ? '' : syn.note, domain: syn.domain });
    }
    // Ali domene sprejemajo pošto (enkrat na domeno)
    const domains = [...new Set(prepared.filter((p) => p.status === 'ok').map((p) => p.domain))];
    const dres = {};
    await pool(domains, 15, async (d) => { dres[d] = await domainAcceptsMail(d); });
    for (const p of prepared) {
      const d = p.domain && dres[p.domain];
      if (p.status === 'ok' && d && !d.ok) { p.status = 'invalid'; p.check_note = d.note; }
      else if (p.status === 'ok' && d?.note) { p.status = 'risky'; p.check_note = d.note; }
    }

    if (!list) list = await sr.ContactList.create({ business_id: business.id, owner_email: owner, created_by: owner, name: clean(body.name, 120) || 'Seznam naslovov', file_name: clean(body.file_name, 200) });
    const recs = prepared.map(({ domain, ...p }) => ({ ...p, business_id: business.id, list_id: list.id, owner_email: owner, created_by: owner }));
    for (let i = 0; i < recs.length; i += 200) await sr.ListContact.bulkCreate(recs.slice(i, i + 200));

    const all = [...existing, ...recs];
    const counts = { total: all.length, ok: all.filter((c) => c.status === 'ok').length, risky: all.filter((c) => c.status === 'risky').length, invalid: all.filter((c) => c.status === 'invalid').length, duplicate };
    await sr.ContactList.update(list.id, { counts });
    const invalidSample = prepared.filter((p) => p.status !== 'ok').slice(0, 15).map((p) => ({ email: p.email, note: p.check_note }));
    return Response.json({ success: true, version: VERSION, list_id: list.id, added: recs.length, counts, invalid_sample: invalidSample, truncated: source.length > MAX_ROWS });
  } catch (error) {
    return Response.json({ error: 'Uvoz ni uspel: ' + (error?.message || String(error)), version: VERSION });
  }
});
