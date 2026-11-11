// Šifriranje gesel e-poštnih predalov (AES-256-GCM).
// Ključ je izpeljan iz obstoječega secreta GOOGLE_TOKEN_ENCRYPTION_KEY (SHA-256 z ločeno oznako namena),
// zato ni treba nastavljati novega secreta. POZOR: če se ta secret zamenja ali izgubi, je treba vse predale
// povezati znova (enako velja za Google Koledar).
// Zapis: "enc1:<iv base64>.<šifra base64>". Vrednost brez predpone je staro, nešifrirano geslo —
// openSecret ga vrne nespremenjenega (združljivost), sealSecret pa ga zašifrira.

const PREFIX = 'enc1:';
const PASS_FIELDS = ['smtp_pass', 'imap_pass'];

const env = (k) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : globalThis.process?.env?.[k]) || '';
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let keyPromise = null;
function getKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const raw = env('GOOGLE_TOKEN_ENCRYPTION_KEY').trim().replace(/\s+/g, '');
      if (!raw) throw new Error('Ključ za šifriranje ni nastavljen (GOOGLE_TOKEN_ENCRYPTION_KEY).');
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('aristotle-mailbox-pass-v1|' + raw));
      return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
    })();
    keyPromise.catch(() => { keyPromise = null; });
  }
  return keyPromise;
}

export const isSealed = (v) => typeof v === 'string' && v.startsWith(PREFIX);

export async function sealSecret(plain) {
  if (!plain) return '';
  if (isSealed(plain)) return plain;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain))));
  return `${PREFIX}${toB64(iv)}.${toB64(ct)}`;
}

export async function openSecret(value) {
  if (!value) return '';
  if (!isSealed(value)) return value; // staro, še nešifrirano geslo
  const [ivB, ctB] = value.slice(PREFIX.length).split('.');
  const key = await getKey();
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB) }, key, fromB64(ctB));
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('Gesla predala ni mogoče odšifrirati. Povežite predal znova.');
  }
}

// Vrne KOPIJO zapisa (Business ali SendingMailbox) z odšifriranimi gesli — samo za uporabo v pomnilniku.
// Nikoli ne shranjuj vrnjenega objekta nazaj v bazo.
export async function openMailbox(rec) {
  if (!rec) return rec;
  const out = { ...rec };
  for (const f of PASS_FIELDS) if (out[f]) out[f] = await openSecret(out[f]);
  return out;
}

// Polja z gesli v objektu za shranjevanje zašifrira (ostala pusti).
export async function sealMailboxFields(data) {
  const out = { ...data };
  for (const f of PASS_FIELDS) if (out[f]) out[f] = await sealSecret(out[f]);
  return out;
}
