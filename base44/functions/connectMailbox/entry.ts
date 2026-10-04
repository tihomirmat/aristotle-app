import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ImapFlow } from 'npm:imapflow@1.0.164';
import nodemailer from 'npm:nodemailer@6.9.9';

// Poveže poštni predal podjetja z enim e-naslovom in geslom.
// Strežnike poišče sam (mail.<domena>, imap./smtp.<domena>, <domena>), preveri IMAP (branje) in SMTP (pošiljanje),
// shrani nastavitve in zažene prvo branje pošte. Akcije: connect | disconnect.

const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
const ownsBusiness = (user, b) => !!user && !!b && (user.role === 'admin' || b.created_by_id === user.id
  || (!!user.email && (b.created_by === user.email || b.owner_email === user.email)));

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function tryImap(host, port, user, pass) {
  const c = new ImapFlow({ host, port, secure: port === 993, auth: { user, pass }, logger: false, connectionTimeout: 9000, greetingTimeout: 9000 });
  try { await withTimeout(c.connect(), 12000); await c.logout().catch(() => {}); return { ok: true }; }
  catch (e) { try { c.close(); } catch { /* */ } return { ok: false, auth: /auth|login|credential|password/i.test(`${e?.message} ${e?.responseText || ''}`), msg: e?.responseText || e?.message }; }
}

async function trySmtp(host, port, user, pass) {
  const t = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port === 587, auth: { user, pass }, connectionTimeout: 9000, greetingTimeout: 9000, socketTimeout: 12000 });
  try { await withTimeout(t.verify(), 14000); return { ok: true }; }
  catch (e) { return { ok: false, auth: /auth|535|credential|password/i.test(String(e?.message)), msg: e?.message }; }
  finally { try { t.close(); } catch { /* */ } }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { business_id, action = 'connect' } = body;
    const business = business_id ? (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0] : null;
    if (!business || !ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.' });

    if (action === 'disconnect') {
      await base44.asServiceRole.entities.Business.update(business.id, {
        imap_enabled: false, imap_pass: '', smtp_pass: '', email_provider: 'platform', imap_last_error: '',
        email_last_health_check_status: null, email_last_health_check_error: '',
      });
      return Response.json({ success: true });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: 'Vnesite veljaven e-poštni naslov.' });
    if (!password) return Response.json({ error: 'Vnesite geslo e-poštnega predala.' });
    const domain = email.split('@')[1];
    if (/^(gmail|googlemail|outlook|hotmail|live|yahoo)\./.test(domain)) {
      return Response.json({ error: 'Brezplačni naslovi (Gmail, Outlook, Yahoo) za zdaj niso podprti. Uporabite e-naslov na domeni vašega podjetja (npr. info@vase-podjetje.si).' });
    }

    const imapHosts = body.imap_host ? [String(body.imap_host).trim()] : [`mail.${domain}`, `imap.${domain}`, domain];
    const smtpHosts = body.smtp_host ? [String(body.smtp_host).trim()] : [`mail.${domain}`, `smtp.${domain}`, domain];

    let imap = null; let imapErr = null;
    for (const h of imapHosts) {
      for (const p of body.imap_port ? [Number(body.imap_port)] : [993, 143]) {
        const r = await tryImap(h, p, email, password);
        if (r.ok) { imap = { host: h, port: p }; break; }
        if (r.auth) { imapErr = 'auth'; break; }
        imapErr = imapErr || r.msg;
      }
      if (imap || imapErr === 'auth') break;
    }
    if (imapErr === 'auth' && !imap) return Response.json({ error: 'Strežnik je zavrnil prijavo. Preverite geslo e-poštnega predala.', code: 'AUTH' });

    let smtp = null; let smtpErr = null;
    for (const h of smtpHosts) {
      for (const p of body.smtp_port ? [Number(body.smtp_port)] : [587, 465]) {
        const r = await trySmtp(h, p, email, password);
        if (r.ok) { smtp = { host: h, port: p }; break; }
        if (r.auth) { smtpErr = 'auth'; break; }
        smtpErr = smtpErr || r.msg;
      }
      if (smtp || smtpErr === 'auth') break;
    }

    if (!imap && !smtp) {
      return Response.json({ error: 'Poštnega strežnika nismo našli samodejno. Vpišite strežnik ročno (najdete ga v nastavitvah e-pošte pri vašem ponudniku).', code: 'NOT_FOUND' });
    }

    const updates = {
      smtp_from_email: email,
      smtp_user: email,
      imap_user: email,
      email_last_health_check_at: new Date().toISOString(),
    };
    if (smtp) Object.assign(updates, { email_provider: 'smtp', smtp_host: smtp.host, smtp_port: smtp.port, smtp_pass: password, smtp_encryption: smtp.port === 465 ? 'ssl_tls' : 'starttls', email_last_health_check_status: 'ok', email_last_health_check_error: '' });
    else Object.assign(updates, { email_last_health_check_status: 'error', email_last_health_check_error: smtpErr === 'auth' ? 'Pošiljanje: prijava zavrnjena.' : 'Pošiljanje: strežnika nismo našli.' });
    if (imap) Object.assign(updates, { imap_enabled: true, imap_host: imap.host, imap_port: imap.port, imap_secure: imap.port === 993, imap_pass: password, imap_last_error: '' });
    if (!business.smtp_from_name) updates.smtp_from_name = business.name;

    await base44.asServiceRole.entities.Business.update(business.id, updates);

    if (imap) base44.asServiceRole.functions.invoke('syncInbox', { business_id: business.id, internal_secret: INTERNAL_SECRET }).catch(() => {});

    return Response.json({ success: true, imap, smtp, warning: !smtp ? 'Branje pošte deluje, pošiljanja pa nismo mogli nastaviti. Sporočila bo do takrat pošiljal AI Aristotle v vašem imenu.' : (!imap ? 'Pošiljanje deluje, branja pošte pa nismo mogli nastaviti.' : null) });
  } catch (error) {
    return Response.json({ error: 'Napaka pri povezovanju: ' + (error?.message || String(error)) });
  }
});
