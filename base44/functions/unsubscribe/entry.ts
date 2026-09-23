import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Javna odjavna povezava iz nog e-poštnih sporočil (GET ?lead=<id>&t=<token>).
// Token = HMAC-SHA256(INTERNAL_FUNCTION_SECRET, lead.id)[0:32] — ustvari ga sendApprovedDraft.
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';

async function expectedToken(leadId) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(INTERNAL_SECRET || 'no-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(leadId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const page = (title, text) => new Response(
  `<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:440px;text-align:center;box-shadow:0 4px 24px rgba(15,23,42,.06)}h1{font-size:20px;margin:0 0 8px}p{color:#475569;margin:0;line-height:1.5}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${text}</p></div></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get('lead') || '';
    const token = url.searchParams.get('t') || '';
    if (!leadId || !token || !/^[a-zA-Z0-9]+$/.test(leadId)) return page('Neveljavna povezava', 'Odjavna povezava ni popolna.');

    const expected = await expectedToken(leadId);
    if (expected !== token) return page('Neveljavna povezava', 'Odjavna povezava ni veljavna ali je potekla.');

    const base44 = createClientFromRequest(req);
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: leadId });
    const lead = leads[0];
    if (!lead) return page('Neveljavna povezava', 'Zapisa ni mogoče najti.');

    if (lead.status !== 'unsubscribed' || lead.consent_email) {
      await base44.asServiceRole.entities.Lead.update(leadId, { status: 'unsubscribed', consent_email: false });
    }
    return page('Uspešno ste se odjavili', 'Sporočil tega podjetja ne boste več prejemali. Če ste se odjavili pomotoma, se obrnite neposredno na podjetje.');
  } catch (error) {
    return page('Napaka', 'Odjava trenutno ni mogoča. Poskusite znova kasneje ali odgovorite na sporočilo z besedo »Odjava«.');
  }
});
