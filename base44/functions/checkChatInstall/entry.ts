import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Preveri, ali je koda klepeta res nameščena na spletni strani stranke (prebere HTML strani).
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Prijavite se.' });
    const body = await req.json().catch(() => ({}));
    const business = (await base44.asServiceRole.entities.Business.filter({ id: body.business_id }))[0];
    if (!business || !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa.' });

    let url = String(body.url || business.website || '').trim();
    if (!url) return Response.json({ error: 'Vpišite naslov spletne strani.' });
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    let html = '', status = 0;
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (AI Aristotle install check)', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
      status = res.status;
      html = await res.text();
    } catch (e) {
      return Response.json({ success: true, url, reachable: false, installed: false, message: `Strani ${url} ni bilo mogoče odpreti (${e?.message || 'napaka'}). Preverite naslov.` });
    }

    const hasScript = /chatbotWidget/i.test(html);
    const hasConfig = /ARISTOTLE_CONFIG/.test(html);
    const hasId = html.includes(business.id);
    const installed = hasScript && hasConfig && hasId;
    let message;
    if (installed) message = 'Klepet je nameščen. Na strani bi moral biti viden gumb spodaj ' + ((business.widget_position || 'bottom-right') === 'bottom-left' ? 'levo.' : 'desno.') + ' Če ga ne vidite, počistite predpomnilnik (cache) strani.';
    else if (hasScript && !hasId) message = 'Na strani je koda klepeta, a za drugo podjetje. Kopirajte kodo znova iz te strani.';
    else if (hasScript && !hasConfig) message = 'Na strani je samo del kode (manjka prvi del z nastavitvami). Prilepite celotno kodo.';
    else message = 'Kode klepeta na tej strani ni. Prilepite jo po navodilih spodaj; če uporabljate vtičnik za predpomnjenje (cache), ga po namestitvi počistite.';

    return Response.json({ success: true, url, reachable: status > 0 && status < 400, http_status: status, installed, hasScript, hasConfig, hasId, message });
  } catch (error) {
    return Response.json({ error: 'Preverjanje ni uspelo: ' + (error?.message || String(error)) });
  }
});
