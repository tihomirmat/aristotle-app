import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  encryptToken, decryptToken, createState, verifyState, revokeToken, SCOPES,
} from '../../shared/googleCalendar.js';

// Lasten Google OAuth 2.0 (authorization code flow) za Google Koledar.
// NE uporablja Base44 konektorja — aplikacija je za množico uporabnikov brez Base44 računa.
// Akcije:
//   GET  ?code=...&state=...  → OAuth callback (Google preusmeri sem)
//   POST { action: "start", business_id } → vrne auth_url + redirect_uri
//   POST { action: "disconnect", business_id } → prekliče žeton, počisti polja

const APP_URL = 'https://aristotle-smart-growth.base44.app';
const REDIRECT_URI = `${APP_URL}/functions/googleCalendarAuth`;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};

function redirect(path: string) {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}${path}` } });
}

Deno.serve(async (req) => {
  try {
    // ─── GET: OAuth callback od Google ───
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const gcalError = url.searchParams.get('error');
      if (gcalError) return redirect('/nastavitve?tab=termini&gcal=error');
      if (!code || !state) return redirect('/nastavitve?tab=termini&gcal=error');

      const businessId = await verifyState(state);
      if (!businessId) return redirect('/nastavitve?tab=termini&gcal=error');

      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (!user) return redirect('/nastavitve?tab=termini&gcal=error');
      const business = (await base44.asServiceRole.entities.Business.filter({ id: businessId }))[0];
      if (!business || !ownsBusiness(user, business)) return redirect('/nastavitve?tab=termini&gcal=error');

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      if (!clientId || !clientSecret) return redirect('/nastavitve?tab=termini&gcal=error');

      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) return redirect('/nastavitve?tab=termini&gcal=error');

      const encAccess = await encryptToken(tokens.access_token);
      // refresh_token pride samo ob prompt=consent; obdrži starega, če ga ni
      const encRefresh = tokens.refresh_token
        ? await encryptToken(tokens.refresh_token)
        : business.google_calendar_refresh_token || null;
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

      // Pridobi Google e-naslov uporabnika
      let gcalEmail = business.google_calendar_email || null;
      try {
        const ui = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
        if (ui.ok) { const u = await ui.json(); gcalEmail = u.email; }
      } catch { /* ignore */ }

      await base44.asServiceRole.entities.Business.update(businessId, {
        google_calendar_connected: true,
        google_calendar_access_token: encAccess,
        google_calendar_refresh_token: encRefresh,
        google_calendar_token_expires_at: expiresAt,
        google_calendar_email: gcalEmail,
      });
      return redirect('/nastavitve?tab=termini&gcal=connected');
    }

    // ─── POST: start / disconnect ───
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json({
        error: 'Google OAuth skrivnosti niso nastavljene. Lastnik naj v Dashboard → Secrets doda GOOGLE_CLIENT_ID in GOOGLE_CLIENT_SECRET.',
        code: 'MISSING_SECRETS',
      }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, business_id } = body;
    if (!business_id) return Response.json({ error: 'business_id manjka' }, { status: 400 });

    const business = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });

    if (action === 'start') {
      const state = await createState(business_id);
      const authUrl = `${AUTH_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: [...SCOPES, 'https://www.googleapis.com/auth/userinfo.email'].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
      })}`;
      return Response.json({ auth_url: authUrl, redirect_uri: REDIRECT_URI });
    }

    if (action === 'disconnect') {
      if (business.google_calendar_access_token) {
        try { const at = await decryptToken(business.google_calendar_access_token); await revokeToken(at); } catch { /* ignore */ }
      }
      await base44.asServiceRole.entities.Business.update(business_id, {
        google_calendar_connected: false,
        google_calendar_access_token: null,
        google_calendar_refresh_token: null,
        google_calendar_token_expires_at: null,
        google_calendar_email: null,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Neznana akcija' }, { status: 400 });
  } catch (error) {
    // Status 200 z napako v telesu, da UI prikaže pravi vzrok namesto splošnega 500.
    return Response.json({ error: 'Napaka na strežniku: ' + (error?.message || String(error)) }, { status: 200 });
  }
});
