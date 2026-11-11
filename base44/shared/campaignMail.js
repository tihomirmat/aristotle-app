// Skupna logika za e-poštne kampanje: dnevne meje predalov, čas pošiljanja, prepoznava odbitih sporočil
// (hard/soft bounce), samodejnih odgovorov in odjav. Brez zunanjih odvisnosti (teče v Deno in Node).

export const DAY = 86400000;
export const WARMUP_DAYS = 14;
export const LIMIT_START = 20;
export const LIMIT_FULL = 50;
export const SEND_HOURS = [8, 17]; // pošiljamo pon–pet od 8:00 do 17:00 (Ljubljana)
export const PAUSE_BOUNCES = 3; // ustavi kampanjo pri 3 odbitih (od zadnjega nadaljevanja)
export const PAUSE_RATE = 0.03; // ali če je delež odbitih > 3 % (ko je poslano vsaj MIN_FOR_RATE osebam)
export const MIN_FOR_RATE = 20;

export const lower = (s) => String(s || '').toLowerCase().trim();

// Datum, ura in dan v tednu po ljubljanskem času.
export function ljNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday };
}
export const inSendWindow = (d = new Date()) => { const n = ljNow(d); return !['Sat', 'Sun'].includes(n.weekday) && n.hour >= SEND_HOURS[0] && n.hour < SEND_HOURS[1]; };

// Priporočena meja: prva 2 tedna od prvega pošiljanja 20 na dan, nato 50.
export function autoLimit(mb, now = Date.now()) {
  if (!mb?.first_send_at) return LIMIT_START;
  return now - new Date(mb.first_send_at).getTime() < WARMUP_DAYS * DAY ? LIMIT_START : LIMIT_FULL;
}
export const dailyLimit = (mb, now) => (Number(mb?.daily_limit_manual) > 0 ? Number(mb.daily_limit_manual) : autoLimit(mb, now));
export const sentToday = (mb, d = new Date()) => (mb?.sent_date === ljNow(d).date ? Number(mb.sent_today) || 0 : 0);
export const remainingToday = (mb, d = new Date()) => Math.max(0, dailyLimit(mb, d.getTime()) - sentToday(mb, d));
// Razporedi čez delovni dan: na en urni zagon največ 1/9 dnevne meje.
export const perRunCap = (mb, d = new Date()) => Math.ceil(dailyLimit(mb, d.getTime()) / (SEND_HOURS[1] - SEND_HOURS[0]));

export const firstName = (name) => {
  const n = String(name || '').trim().split(/\s+/)[0] || '';
  return /^[A-ZČŠŽĆĐ][a-zčšžćđ]+$/.test(n) ? n : '';
};

// Polja v besedilu: {ime} {podjetje} {spletna_stran}
export function mergeFields(text, c = {}) {
  const fn = firstName(c.name);
  let t = String(text || '')
    .replace(/\{ime\}/gi, fn)
    .replace(/\{podjetje\}/gi, String(c.company || '').trim())
    .replace(/\{spletna[_ ]stran\}/gi, String(c.website || '').trim());
  if (fn) t = t.replace(/(^|<p[^>]*>)Spoštovani,/m, `$1Pozdravljeni, ${fn},`);
  return t.replace(/ +([,.!?])/g, '$1').replace(/, ,/g, ',');
}

// ---------- oblikovano besedilo (urejevalnik v aplikaciji) ----------
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
// HTML → navadno besedilo (za text/plain del e-pošte in za AI).
export function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n\n').replace(/<\/(li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (m, href, txt) => (txt.replace(/<[^>]+>/g, '') === href ? href : `${txt.replace(/<[^>]+>/g, '')} (${href})`))
    .replace(/<img [^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m] || m)
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Izhod urejevalnika (Quill) → HTML, ki ga e-poštni programi prikažejo pravilno (razredi → slogi v vrstici).
export function emailifyHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .replace(/class="ql-align-(center|right|justify)"/g, 'style="text-align:$1"')
    .replace(/class="ql-size-large"/g, 'style="font-size:18px"').replace(/class="ql-size-huge"/g, 'style="font-size:24px"').replace(/class="ql-size-small"/g, 'style="font-size:12px"')
    .replace(/class="ql-[^"]*"/g, '')
    .replace(/<p>/g, '<p style="margin:0 0 12px">')
    .replace(/<img /g, '<img style="max-width:100%;height:auto" ')
    .replace(/<p style="margin:0 0 12px"><br><\/p>/g, '<p style="margin:0 0 12px">&nbsp;</p>');
}
export const hasHtml = (s) => /<(p|br|strong|em|a|img|ul|ol|div|span|h\d)\b/i.test(String(s || ''));

// Priponke [{name,url}] → nodemailer attachments (največ 3, skupaj do 10 MB).
export async function fetchAttachments(list, fetchFn = fetch) {
  const out = [];
  let total = 0;
  for (const a of (Array.isArray(list) ? list : []).filter((x) => x && x.url).slice(0, 3)) {
    try {
      const r = await fetchFn(a.url);
      if (!r.ok) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      total += buf.length;
      if (total > 10_000_000) break;
      out.push({ filename: String(a.name || 'priponka'), content: buf, contentType: r.headers.get('content-type') || 'application/octet-stream' });
    } catch { /* preskoči */ }
  }
  return out;
}

// ---------- preverjanje naslovov ob uvozu ----------
export const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'yopmail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com']);
const TYPO = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.si': 'gmail.com', 'gamil.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'yahooo.com': 'yahoo.com', 'siol.si': 'siol.net', 'sio.net': 'siol.net', 'amis.si': 'amis.net', 'telemach.si': 'telemach.net' };

export function checkSyntax(email) {
  const e = lower(email);
  if (!EMAIL_RE.test(e) || e.includes('..')) return { ok: false, note: 'Naslov ni pravilno zapisan.' };
  const domain = e.split('@')[1];
  if (DISPOSABLE.has(domain)) return { ok: false, note: 'Začasen (enkratni) e-naslov.' };
  if (TYPO[domain]) return { ok: false, note: `Verjetno tipkarska napaka (mišljeno ${TYPO[domain]}?).` };
  return { ok: true, domain };
}

// Ali domena sprejema e-pošto (MX zapis) — prek DNS-over-HTTPS (Deno.resolveDns MX v Base44 ne deluje).
export async function domainAcceptsMail(domain, fetchFn = fetch) {
  const q = async (type) => {
    const r = await fetchFn(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    if (!r.ok) throw new Error(`DNS ${r.status}`);
    return r.json();
  };
  try {
    const mx = await q('MX');
    if (mx.Status === 3) return { ok: false, note: 'Domena ne obstaja.' };
    const hosts = (mx.Answer || []).filter((a) => a.type === 15).map((a) => String(a.data).split(' ').pop());
    if (hosts.length && !hosts.every((h) => h === '.' || h === '')) return { ok: true };
    if (hosts.length) return { ok: false, note: 'Domena ne sprejema e-pošte.' };
    const a = await q('A');
    return (a.Answer || []).length ? { ok: true, note: 'Domena nima poštnega strežnika (MX), dostava je negotova.' } : { ok: false, note: 'Domena nima poštnega strežnika.' };
  } catch {
    return { ok: true, unknown: true }; // DNS trenutno ni dosegljiv — ne zavrnemo naslova
  }
}

// ---------- prepoznava prejetih sporočil v kampanjskem predalu ----------
// m = { fromEmail, fromName, subject, text, headers(Map), extraText (vsebina prilog delivery-status/rfc822) }
export function classifyBounce(m) {
  const subj = String(m.subject || '');
  const from = `${m.fromEmail} ${m.fromName || ''}`;
  const ctype = lower(m.headers?.get?.('content-type')?.value || m.headers?.get?.('content-type') || '');
  const all = `${m.text || ''}\n${m.extraText || ''}`;
  const looksDsn = /report-type=.?delivery-status/i.test(typeof ctype === 'string' ? ctype : JSON.stringify(ctype))
    || /mailer-daemon|postmaster|mail delivery (sub)?system|maildelivery/i.test(from)
    || /undeliver|delivery status notification|failure notice|returned mail|mail delivery failed|delivery has failed|could not be delivered|nedostavljen|ni bilo mogoče dostaviti|ni dostavljeno|zavrnjeno sporočilo|message not delivered|delivery failure/i.test(subj);
  if (!looksDsn) return null;

  const recipients = new Set();
  for (const mm of all.matchAll(/(?:Final|Original)-Recipient:\s*(?:rfc822;)?\s*<?([^\s<>;]+@[^\s<>;]+)>?/gi)) recipients.add(lower(mm[1]));
  const emailsInText = [...new Set((all.match(/[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi) || []).map(lower))];
  const refs = [...new Set([...all.matchAll(/cmp-([a-z0-9]+)-\d+-/gi)].map((x) => x[1]))];

  const status = (all.match(/Status:\s*([245])\.(\d{1,3})\.(\d{1,3})/i) || [])[0] || '';
  const diag = ((all.match(/Diagnostic-Code:\s*(?:smtp;)?\s*([^\n]+)/i) || [])[1] || '').trim();
  const action = lower((all.match(/Action:\s*(\w+)/i) || [])[1]);
  const softRe = /mailbox (is )?full|over ?quota|quota exceeded|insufficient storage|\b452\b|4\.2\.2|temporar|try again later|greylist|\bdelayed\b|zakasnjen/i;
  const blockRe = /5\.7\.\d|blocked|blacklist|block list|spam|reputation|policy|rejected due to|not allowed|denied/i;
  const noUserRe = /5\.1\.[01]|user unknown|unknown user|no such user|does not exist|doesn'?t exist|not exist|mailbox unavailable|mailbox not found|recipient address rejected|invalid recipient|unknown recipient|address rejected|no mailbox|account (is )?disabled|ne obstaja|neznan prejemnik/i;
  const noDomainRe = /5\.1\.2|5\.4\.4|host or domain name not found|domain not found|name or service not known|no mx|unrouteable|domena ne obstaja/i;

  let kind = 'other';
  let hard;
  if (action === 'delayed' || /delay|zakasn|warning/i.test(subj) && action !== 'failed') { hard = false; kind = 'delayed'; }
  else if (/^Status:\s*4/i.test(status)) { hard = false; kind = 'soft'; }
  else if (/^Status:\s*5/i.test(status) || action === 'failed') hard = true;
  else if (softRe.test(all)) { hard = false; kind = 'soft'; }
  else hard = true;
  const txt = `${status} ${diag} ${all.slice(0, 4000)}`;
  if (hard) {
    if (noDomainRe.test(txt)) kind = 'no_domain';
    else if (noUserRe.test(txt)) kind = 'no_user';
    else if (blockRe.test(`${status} ${diag}`)) kind = 'blocked';
    else if (softRe.test(diag)) { hard = false; kind = 'soft'; }
  }
  const REASON = { no_user: 'Naslov ne obstaja.', no_domain: 'Domena ne obstaja ali ne sprejema pošte.', blocked: 'Prejemnikov strežnik je sporočilo zavrnil (morda kot neželeno pošto).', other: 'Sporočila ni bilo mogoče dostaviti.', soft: 'Začasna težava (npr. poln predal).', delayed: 'Dostava zamuja.' };
  return { hard, kind, reason: REASON[kind] + (diag ? ` (${diag.slice(0, 140)})` : ''), recipients: [...recipients], emailsInText, refs };
}

export function isAutoReply(m) {
  const h = (k) => lower(m.headers?.get?.(k));
  const as = h('auto-submitted');
  if (as && as !== 'no') return true;
  if (h('x-autoreply') || h('x-autorespond') || /auto_reply|auto-reply/.test(h('precedence'))) return true;
  return /^(automatic reply|auto(matic)?[ -]?reply|autoreply|out of office|samodejni odgovor|odsoten|odsotnost|abwesend|automatische antwort)/i.test(String(m.subject || '').trim());
}

// Odstrani citirana prejšnja sporočila iz odgovora.
export function replyOnly(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (const l of lines) {
    if (/^\s*>/.test(l)) continue;
    if (/^(On .+wrote:|Dne .+(je )?(napisal|pisal)|-----\s*Original Message|From:\s|Od:\s|Sent from my|Poslano iz)/i.test(l.trim())) break;
    out.push(l);
  }
  return out.join('\n').trim();
}

export function isUnsubscribe(text) {
  const t = lower(replyOnly(text)).slice(0, 400);
  return /^(odjava|odjavi|odjavite|odjavljam|unsubscribe|stop|remove)\b/.test(t)
    || /ne (želim|zelim|želimo|zelimo) (več )?(prejemati|dobivati)|ne pošiljajte (mi |nam )?več|odstranite (me|nas|moj naslov)|remove me|unsubscribe me/.test(t);
}

// Ali kampanjo ustaviti zaradi odbitih sporočil?
export function shouldPause({ bouncesSinceResume, bouncedTotal, contacted, newThisRun }) {
  if (bouncesSinceResume >= PAUSE_BOUNCES) return true;
  return newThisRun > 0 && contacted >= MIN_FOR_RATE && bouncedTotal / contacted > PAUSE_RATE;
}

// Preveri kampanjo po novih odbitih; po potrebi jo ustavi in obvesti lastnika. Vrne true, če je ustavljena.
// enrollments = vse vključitve te kampanje (sveže stanje), emailOf(e) → naslov.
export async function pauseIfTooManyBounces({ sr, sendEmail, business, camp, enrollments, emailOf, newCount, appUrl }) {
  if (!camp || camp.status !== 'active' || !newCount) return false;
  const contacted = enrollments.filter((e) => e.last_sent_at || Number(e.current_step) > 0).length;
  const bounced = enrollments.filter((e) => e.status === 'stopped_bounced');
  const since = camp.resumed_at ? new Date(camp.resumed_at).getTime() : 0;
  const bouncesSinceResume = bounced.filter((e) => e.bounced_at && new Date(e.bounced_at).getTime() > since).length;
  if (!shouldPause({ bouncesSinceResume, bouncedTotal: bounced.length, contacted, newThisRun: newCount })) return false;
  const alert = {
    at: new Date().toISOString(), count: bounced.length, since_resume: bouncesSinceResume, sent: contacted, rate: contacted ? bounced.length / contacted : 0,
    addresses: bounced.slice(0, 30).map((e) => ({ email: emailOf(e), reason: e.bounce_reason || '' })),
  };
  await sr.Campaign.update(camp.id, { status: 'paused', paused_reason: 'bounces', paused_at: alert.at, bounce_alert: alert });
  camp.status = 'paused';
  const to = business.owner_email || business.created_by;
  if (to && sendEmail) {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const list = alert.addresses.slice(0, 10).map((a) => `• ${esc(a.email)} — ${esc(a.reason)}`).join('<br>');
    const body = `<p>Pozdravljeni,</p>
<p>kampanjo <b>»${esc(camp.name)}«</b> smo <b>začasno ustavili</b>, ker se sporočila vračajo — vrnjena sporočila: ${alert.count} od ${alert.sent} prejemnikov (${(alert.rate * 100).toFixed(1).replace('.', ',')} %). Ti naslovi verjetno ne obstajajo več:</p>
<p>${list}</p>
<p><b>Zakaj je to pomembno:</b> ponudniki e-pošte (Gmail, Outlook, Siol …) spremljajo, koliko vaših sporočil se vrne. Ko jih je več kot nekaj odstotkov, vašo pošto začnejo uvrščati med neželeno ali jo zavračati — lahko tudi običajna sporočila z iste domene. Popravljanje ugleda traja tedne.</p>
<p><b>Kaj priporočamo:</b> preden nadaljujete, preverite preostale naslove v spletni storitvi za preverjanje e-naslovov (npr. Bouncer, MillionVerifier, ZeroBounce ali NeverBounce) in uvozite očiščen seznam. Vrnjeni naslovi so že izločeni — nanje ne bomo več pisali.</p>
<p>Kampanjo lahko nadaljujete v aplikaciji: <a href="${appUrl}/kampanje">E-poštne kampanje</a>.</p>`;
    await sendEmail({ to, subject: `Kampanja »${camp.name}« je ustavljena: preveč vrnjenih sporočil`, body, from_name: 'AI Aristotle' }).catch(() => null);
  }
  return true;
}

// Vse zapise (paginacija), ker filter brez meje vrne le prvo stran.
export async function allRecords(entity, query, sort = '-created_date') {
  const out = [];
  for (let skip = 0; skip < 50000; skip += 500) {
    const page = await entity.filter(query, sort, 500, skip);
    out.push(...page);
    if (page.length < 500) break;
  }
  return out;
}
