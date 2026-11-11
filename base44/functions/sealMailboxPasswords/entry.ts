import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sealSecret, openSecret, isSealed } from '../../shared/secretBox.js';

// Vzdrževanje (samo admin ali urnik): zašifrira stara, nešifrirana gesla predalov v Business in SendingMailbox.
// action 'check' (privzeto) = samo prešteje in preveri šifriranje/odšifriranje, nič ne zapiše.
// action 'seal' = zašifrira. Varno večkrat (že šifrirana preskoči).
// POZOR: 'seal' poženi šele, ko so objavljene (Publish) funkcije, ki znajo odšifrirati
// (sendApprovedDraft, connectMailbox, testSmtp, offerSend — VERSION *-2026-11-12-enc).

const VERSION = 'seal-mailbox-2026-11-12';
const FIELDS = ['smtp_pass', 'imap_pass'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    if (user?.role !== 'admin' && body?.internal_secret !== Deno.env.get('INTERNAL_FUNCTION_SECRET')) {
      return Response.json({ error: 'Samo skrbnik.', version: VERSION }, { status: 401 });
    }
    const action = body.action === 'seal' ? 'seal' : 'check';

    // Preizkus ključa: šifriraj in odšifriraj vzorec.
    const sample = 'preizkus-čšž-' + Date.now();
    const sealed = await sealSecret(sample);
    const roundtrip = (await openSecret(sealed)) === sample && isSealed(sealed) && !sealed.includes(sample);
    if (!roundtrip) return Response.json({ error: 'Preizkus šifriranja ni uspel — nič ni spremenjeno.', version: VERSION });

    const sr = base44.asServiceRole.entities;
    const report = {};
    for (const [name, ent] of [['Business', sr.Business], ['SendingMailbox', sr.SendingMailbox]]) {
      const rows = await ent.list('-created_date', 5000);
      const r = { total: rows.length, plain: 0, sealed: 0, updated: 0 };
      for (const row of rows) {
        const patch = {};
        for (const f of FIELDS) {
          const v = row[f];
          if (!v) continue;
          if (isSealed(v)) { r.sealed++; continue; }
          r.plain++;
          if (action === 'seal') patch[f] = await sealSecret(v);
        }
        if (Object.keys(patch).length) {
          // preveri, da se novo vrednost da odšifrirati v isto geslo, preden zapišeš
          for (const f of Object.keys(patch)) if ((await openSecret(patch[f])) !== row[f]) throw new Error(`Preverjanje ni uspelo za ${name} ${row.id}`);
          await ent.update(row.id, patch);
          r.updated++;
        }
      }
      report[name] = r;
    }
    console.log('sealMailboxPasswords', VERSION, action, 'roundtrip', roundtrip, JSON.stringify(report));
    return Response.json({ success: true, action, roundtrip, report, version: VERSION });
  } catch (error) {
    console.log('sealMailboxPasswords napaka', error?.message || String(error));
    return Response.json({ error: error?.message || String(error), version: VERSION });
  }
});
