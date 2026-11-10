// Majhen IMAP odjemalec prek node:tls.
// Zakaj: knjižnica imapflow v Base44 (Deno) obvisi po ukazu ID (preverjeno 10. 11. 2026 z mail.spletnost.si,
// verziji 1.0.164 in 1.7.8) — povezava se nikoli ne prijavi. Ta odjemalec podpira samo, kar rabimo:
// LOGIN, SELECT, UID SEARCH, UID FETCH (velikost + celotno sporočilo), LIST, APPEND, LOGOUT.
import tls from 'node:tls';
import net from 'node:net';
import { Buffer } from 'node:buffer';

export class ImapError extends Error {
  constructor(message, extra = {}) { super(message); Object.assign(this, extra); }
}

const quote = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
// Niz kot IMAP argument: navaden ASCII v narekovajih, sicer kot literal (Buffer).
const arg = (s) => (/^[\x20-\x7e]*$/.test(String(s)) ? quote(s) : Buffer.from(String(s), 'utf8'));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const imapDate = (d) => `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

class MiniImap {
  constructor({ host, port, secure, timeoutMs = 15000, socketTimeoutMs = 60000 }) {
    Object.assign(this, { host, port, secure, timeoutMs, socketTimeoutMs });
    this.buf = Buffer.alloc(0); this.units = []; this.waiters = []; this.tagN = 0;
    this.cur = null; this.pendingLiteral = null; this.closed = false; this.err = null;
  }

  attach(sock) {
    this.sock = sock;
    sock.on('data', (d) => { this.buf = Buffer.concat([this.buf, d]); this.parse(); });
    sock.on('error', (e) => this.fail(e));
    sock.on('close', () => this.fail(new ImapError('Povezava s poštnim strežnikom je bila prekinjena.')));
  }

  detach() { for (const ev of ['data', 'error', 'close']) this.sock.removeAllListeners(ev); }

  fail(e) {
    if (this.closed) return;
    this.closed = true; this.err = e;
    const w = this.waiters; this.waiters = [];
    w.forEach((x) => x.reject(e));
  }

  // Razreže tok v »enote« odgovora: vrstica + morebitni literali {n}.
  parse() {
    for (;;) {
      if (this.pendingLiteral !== null) {
        if (this.buf.length < this.pendingLiteral) return;
        this.cur.literals.push(Buffer.from(this.buf.subarray(0, this.pendingLiteral)));
        this.buf = this.buf.subarray(this.pendingLiteral); this.pendingLiteral = null;
        continue;
      }
      const i = this.buf.indexOf('\r\n');
      if (i < 0) return;
      const line = this.buf.subarray(0, i).toString('utf8');
      this.buf = this.buf.subarray(i + 2);
      if (!this.cur) this.cur = { text: '', literals: [] };
      const m = line.match(/\{(\d+)\+?\}$/);
      if (m) {
        this.cur.text += line.slice(0, -m[0].length) + `\u0000L${this.cur.literals.length}\u0000`;
        this.pendingLiteral = Number(m[1]);
        continue;
      }
      this.cur.text += line;
      const u = this.cur; this.cur = null;
      const w = this.waiters.shift();
      if (w) w.resolve(u); else this.units.push(u);
    }
  }

  next(ms) {
    if (this.units.length) return Promise.resolve(this.units.shift());
    if (this.closed) return Promise.reject(this.err);
    return new Promise((resolve, reject) => {
      const o = {};
      const t = setTimeout(() => { const ix = this.waiters.indexOf(o); if (ix >= 0) this.waiters.splice(ix, 1); reject(new ImapError('Poštni strežnik se ni odzval pravočasno.', { timeout: true })); }, ms);
      o.resolve = (u) => { clearTimeout(t); resolve(u); };
      o.reject = (e) => { clearTimeout(t); reject(e); };
      this.waiters.push(o);
    });
  }

  async open() {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new ImapError('Poštni strežnik se ni odzval.', { timeout: true })), this.timeoutMs);
      const s = this.secure ? tls.connect({ host: this.host, port: this.port, servername: this.host }) : net.connect({ host: this.host, port: this.port });
      s.once(this.secure ? 'secureConnect' : 'connect', () => { clearTimeout(t); resolve(); });
      s.once('error', (e) => { clearTimeout(t); reject(e); });
      this.attach(s);
    });
    const greet = await this.next(this.timeoutMs);
    if (!/^\* (OK|PREAUTH)/i.test(greet.text)) throw new ImapError(`Strežnik ni pripravljen: ${greet.text.slice(0, 120)}`);
    if (!this.secure) {
      await this.cmd(['STARTTLS']);
      const raw = this.sock; this.detach();
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new ImapError('Šifriranje povezave (STARTTLS) ni uspelo.')), this.timeoutMs);
        const s = tls.connect({ socket: raw, servername: this.host });
        s.once('secureConnect', () => { clearTimeout(t); resolve(); });
        s.once('error', (e) => { clearTimeout(t); reject(e); });
        this.attach(s);
      });
    }
  }

  // segs: nizi se pošljejo dobesedno, Buffer kot literal {n}.
  async cmd(segs, { ms } = {}) {
    if (this.closed) throw this.err || new ImapError('Povezava je zaprta.');
    const tag = `A${++this.tagN}`;
    let line = `${tag} `;
    for (const s of segs) {
      if (typeof s === 'string') { line += s; continue; }
      this.sock.write(`${line}{${s.length}}\r\n`); line = '';
      const cont = await this.next(this.timeoutMs);
      if (!cont.text.startsWith('+')) throw new ImapError(cont.text.replace(/^\S+ /, '').slice(0, 200));
      this.sock.write(s);
    }
    this.sock.write(`${line}\r\n`);
    const untagged = [];
    for (;;) {
      const u = await this.next(ms || this.socketTimeoutMs);
      if (u.text.startsWith(`${tag} `)) {
        const status = u.text.slice(tag.length + 1);
        if (!/^OK/i.test(status)) throw new ImapError(status.slice(0, 200), { status });
        return { untagged, status };
      }
      if (u.text.startsWith('+')) continue;
      untagged.push(u);
    }
  }

  async login(user, pass) {
    try { await this.cmd(['LOGIN ', arg(user), ' ', arg(pass)], { ms: this.timeoutMs }); }
    catch (e) { if (e.status) e.auth = true; throw e; }
  }

  async select(box = 'INBOX') { await this.cmd([`SELECT ${quote(box)}`]); }

  // criteria npr. 'UID 120:*' ali `SINCE 3-Nov-2026`
  async uidSearch(criteria) {
    const { untagged } = await this.cmd([`UID SEARCH ${criteria}`]);
    const out = [];
    for (const u of untagged) { const m = u.text.match(/^\* SEARCH(.*)$/i); if (m) m[1].trim().split(/\s+/).filter(Boolean).forEach((n) => out.push(Number(n))); }
    return out.filter((n) => Number.isFinite(n));
  }

  async uidSizes(uids) {
    if (!uids.length) return new Map();
    const { untagged } = await this.cmd([`UID FETCH ${uids.join(',')} (UID RFC822.SIZE)`]);
    const map = new Map();
    for (const u of untagged) { const uid = u.text.match(/UID (\d+)/i); const size = u.text.match(/RFC822\.SIZE (\d+)/i); if (uid) map.set(Number(uid[1]), size ? Number(size[1]) : 0); }
    return map;
  }

  // Vrne [{ uid, source: Buffer }]
  async uidFetchSource(uids) {
    if (!uids.length) return [];
    const { untagged } = await this.cmd([`UID FETCH ${uids.join(',')} (UID BODY.PEEK[])`], { ms: 120000 });
    const out = [];
    for (const u of untagged) {
      const uid = u.text.match(/UID (\d+)/i);
      if (uid && u.literals.length) out.push({ uid: Number(uid[1]), source: u.literals[u.literals.length - 1] });
    }
    return out;
  }

  // Vrne [{ path, flags: ['\\Sent', …] }]
  async list() {
    const { untagged } = await this.cmd(['LIST "" "*"']);
    const out = [];
    for (const u of untagged) {
      const m = u.text.match(/^\* LIST \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (.+)$/i);
      if (!m) continue;
      let name = m[2].trim();
      const lit = name.match(/^\u0000L(\d+)\u0000$/);
      if (lit) name = u.literals[Number(lit[1])].toString('utf8');
      else if (name.startsWith('"')) name = name.slice(1, -1).replace(/\\(.)/g, '$1');
      out.push({ path: name, flags: m[1].split(/\s+/).filter(Boolean) });
    }
    return out;
  }

  async append(box, raw, flags = []) {
    await this.cmd([`APPEND ${quote(box)} (${flags.join(' ')}) `, Buffer.isBuffer(raw) ? raw : Buffer.from(raw)], { ms: 60000 });
  }

  async logout() {
    try { if (!this.closed) await this.cmd(['LOGOUT'], { ms: 5000 }); } catch { /* ignore */ }
    this.close();
  }

  close() { this.closed = true; try { this.sock?.destroy(); } catch { /* ignore */ } }
}

// Odpre povezavo in se prijavi. Napaka ima .auth = true, če je strežnik zavrnil geslo.
export async function imapConnect({ host, port = 993, secure, user, pass, timeoutMs = 15000, socketTimeoutMs = 60000 }) {
  const c = new MiniImap({ host, port: Number(port) || 993, secure: secure ?? Number(port) === 993, timeoutMs, socketTimeoutMs });
  try { await c.open(); await c.login(user, pass); return c; }
  catch (e) { c.close(); throw e; }
}

// Najde mapo »Poslano«.
export function findSentBox(boxes) {
  return boxes.find((b) => b.flags.some((f) => /^\\Sent$/i.test(f)))
    || boxes.find((b) => /^(inbox[./])?(sent|sent items|sent messages|poslano|poslana pošta)$/i.test(b.path));
}
