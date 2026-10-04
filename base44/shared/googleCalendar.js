// Skupni helper za Google Calendar API.
// Uporablja se v: googleCalendarAuth, bookingProposeSlots, bookingConfirm.
// Šifriranje tokenov (AES-256-GCM), samodejno osveževanje access žetona, freeBusy, listEvents, createEvent.

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const EVENTS_URL = (cal) => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events`;
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

async function getKey() {
  const b64 = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!b64) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY ni nastavljen');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encryptToken(plaintext) {
  const keyBytes = await getKey();
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return btoa(JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(enc))),
  }));
}

export async function decryptToken(encrypted) {
  const keyBytes = await getKey();
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const parsed = JSON.parse(atob(encrypted));
  const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(dec);
}

async function signState(payload) {
  const keyBytes = await getKey();
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createState(businessId) {
  const payload = { bid: businessId, nonce: crypto.randomUUID(), ts: Date.now() };
  const sig = await signState(payload);
  return btoa(JSON.stringify(payload)) + '.' + sig;
}

export async function verifyState(state) {
  const [payloadB64, sig] = (state || '').split('.');
  if (!payloadB64 || !sig) return null;
  let payload;
  try { payload = JSON.parse(atob(payloadB64)); } catch { return null; }
  const expectedSig = await signState(payload);
  if (sig !== expectedSig) return null;
  if (Date.now() - (payload.ts || 0) > 10 * 60 * 1000) return null;
  return payload.bid;
}

async function refreshAccessToken(refreshToken) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID/SECRET manjkata');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Napaka pri osveževanju žetona');
  return data;
}

// Vrne { accessToken } ali { error, needsReconnect }. Če žeton ni veljaven in ga ni mogoče osvežiti,
// označi podjetje kot nepovezano (google_calendar_connected=false).
export async function getValidAccessToken(base44, business) {
  if (!business?.google_calendar_connected || !business?.google_calendar_access_token) {
    return { error: 'Google Koledar ni povezan.', needsReconnect: true };
  }
  try {
    let accessToken = await decryptToken(business.google_calendar_access_token);
    const expiresAt = business.google_calendar_token_expires_at
      ? new Date(business.google_calendar_token_expires_at).getTime()
      : 0;
    // Osveži, če poteče v 60 s
    if (Date.now() > expiresAt - 60 * 1000) {
      if (!business.google_calendar_refresh_token) {
        await markDisconnected(base44, business);
        return { error: 'Manjka refresh žeton. Povežite Google Koledar ponovno.', needsReconnect: true };
      }
      const refreshToken = await decryptToken(business.google_calendar_refresh_token);
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      const newExpires = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
      const encAccess = await encryptToken(accessToken);
      await base44.asServiceRole.entities.Business.update(business.id, {
        google_calendar_access_token: encAccess,
        google_calendar_token_expires_at: newExpires,
      });
    }
    return { accessToken };
  } catch (err) {
    await markDisconnected(base44, business);
    return { error: 'Žeton ni veljaven. Povežite Google Koledar ponovno.', needsReconnect: true };
  }
}

export async function markDisconnected(base44, business) {
  try {
    await base44.asServiceRole.entities.Business.update(business.id, {
      google_calendar_connected: false,
      google_calendar_access_token: null,
      google_calendar_refresh_token: null,
      google_calendar_token_expires_at: null,
      google_calendar_email: null,
    });
  } catch { /* ignore */ }
}

// Vrne { busy: [{start, end}] } ali { error, needsReconnect }.
export async function freeBusy(base44, business, timeMin, timeMax) {
  const token = await getValidAccessToken(base44, business);
  if (token.error) return { error: token.error, needsReconnect: token.needsReconnect };
  const calId = business.booking_calendar_id || 'primary';
  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calId }] }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      await markDisconnected(base44, business);
      return { error: 'Dostop do koledarja zavrnjen. Povežite Google Koledar ponovno.', needsReconnect: true };
    }
    return { error: data.error?.message || 'Napaka pri branju koledarja' };
  }
  const cal = data.calendars?.[calId];
  return { busy: (cal?.busy || []).map((b) => ({ start: b.start, end: b.end })) };
}

// Vrne seznam dogodkov v časovnem okviru (za preverjanje excluded_keywords v naslovih).
export async function listEvents(base44, business, timeMin, timeMax) {
  const token = await getValidAccessToken(base44, business);
  if (token.error) return { error: token.error, needsReconnect: token.needsReconnect };
  const calId = business.booking_calendar_id || 'primary';
  const url = `${EVENTS_URL(calId)}?${new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      await markDisconnected(base44, business);
      return { error: 'Dostop do koledarja zavrnjen. Povežite Google Koledar ponovno.', needsReconnect: true };
    }
    return { error: data.error?.message || 'Napaka pri branju dogodkov' };
  }
  return { events: data.items || [] };
}

// Ustvari dogodek v koledarju. Vrne { id, htmlLink } ali { error, needsReconnect }.
export async function createCalendarEvent(base44, business, event) {
  const token = await getValidAccessToken(base44, business);
  if (token.error) return { error: token.error, needsReconnect: token.needsReconnect };
  const calId = business.booking_calendar_id || 'primary';
  const res = await fetch(EVENTS_URL(calId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      await markDisconnected(base44, business);
      return { error: 'Dostop do koledarja zavrnjen. Povežite Google Koledar ponovno.', needsReconnect: true };
    }
    return { error: data.error?.message || 'Napaka pri ustvarjanju dogodka' };
  }
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function revokeToken(accessToken) {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch { /* ignore */ }
}