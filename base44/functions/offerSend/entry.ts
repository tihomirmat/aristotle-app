import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

// Pošlje generirano ponudbo (PDF/DOCX) stranki po e-pošti.
// SMTP (če je v celoti nastavljen) → PDF kot priponka; sicer platformski pošiljatelj s povezavami za prenos.

// ─── Skupna avtorizacija / entitlements (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const ownsBusiness = (user, business) => {
  if (!user || !business) return false;
  if (user.role === 'admin') return true;
  return business.created_by_id === user.id
    || (!!user.email && business.created_by === user.email)
    || (!!user.email && !!business.owner_email && business.owner_email === user.email);
};
const isTrialActive = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) > new Date();
const isTrialExpired = (b) => b?.subscription_status === 'trialing' && !!b.trial_ends_at && new Date(b.trial_ends_at) <= new Date();
// Enako kot src/lib/entitlements.js: aktiven trial odpre vse module, sicer mora biti pillar_* = true
const hasModule = (b, pillarKey) => !!b && (isTrialActive(b) || b[pillarKey] === true);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { business_id, generation_id } = body;
    const to = String(body.to_email || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 4000);
    if (!business_id || !generation_id || !to) return Response.json({ error: 'Manjkajoči parametri: business_id, generation_id, to_email' }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return Response.json({ error: 'Neveljaven e-poštni naslov prejemnika.' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Podjetje ni najdeno' }, { status: 404 });
    if (!ownsBusiness(user, business)) return Response.json({ error: 'Nimate dostopa do tega podjetja.', code: 'FORBIDDEN' }, { status: 403 });
    if (isTrialExpired(business) || !hasModule(business, 'pillar_offers')) {
      return Response.json({ error: 'Modul Generator ponudb ni aktiven. Aktivirajte ga v Nastavitve → Naročnina.', code: 'MODULE_LOCKED' }, { status: 402 });
    }

    const gens = await base44.asServiceRole.entities.OfferGeneration.filter({ id: generation_id });
    const gen = gens[0];
    if (!gen || gen.business_id !== business.id) return Response.json({ error: 'Ponudba ni najdena.' }, { status: 404 });
    if (!gen.output_pdf_url && !gen.output_docx_url) return Response.json({ error: 'Ponudba nima izvoženih datotek (PDF/DOCX).' }, { status: 400 });

    // Trial: pošiljanje šteje v kvoto 20 pošiljanj (Faza 5)
    if (business.subscription_status === 'trialing' && (business.trial_sends_remaining ?? 20) <= 0) {
      return Response.json({ error: 'Dosegli ste mejo poslanih sporočil v preizkusu (20). Aktivirajte naročnino za nadaljevanje.', code: 'TRIAL_SENDS_EXHAUSTED' }, { status: 402 });
    }

    const finalSubject = subject || `Ponudba — ${business.name}`;
    const signature = business.email_signature ? `\n\n${business.email_signature}` : `\n\nLep pozdrav,\n${business.name}${business.phone ? `\n${business.phone}` : ''}`;
    const links = [gen.output_pdf_url ? `PDF: ${gen.output_pdf_url}` : '', gen.output_docx_url ? `DOCX: ${gen.output_docx_url}` : ''].filter(Boolean).join('\n');
    const intro = message || `Spoštovani,\n\nv prilogi vam pošiljamo našo ponudbo. Za vsa vprašanja smo vam z veseljem na voljo.`;

    const smtpComplete = business.email_provider === 'smtp' && business.smtp_host && business.smtp_user && business.smtp_pass;
    let sentVia = 'platform';
    if (smtpComplete) {
      const transporter = nodemailer.createTransport({
        host: business.smtp_host,
        port: Number(business.smtp_port) || 587,
        secure: business.smtp_encryption === 'ssl_tls',
        requireTLS: business.smtp_encryption === 'starttls',
        auth: { user: business.smtp_user, pass: business.smtp_pass },
      });
      const attachments = [];
      if (gen.output_pdf_url) {
        try { const r = await fetch(gen.output_pdf_url); if (r.ok) attachments.push({ filename: 'ponudba.pdf', content: new Uint8Array(await r.arrayBuffer()), contentType: 'application/pdf' }); } catch (_) {}
      }
      await transporter.sendMail({
        from: `"${(business.smtp_from_name || business.name).replace(/"/g, '')}" <${business.smtp_from_email || business.smtp_user}>`,
        to,
        subject: finalSubject,
        text: `${intro}${signature}${attachments.length ? '' : `\n\nPrenos ponudbe:\n${links}`}`,
        attachments,
      });
      sentVia = 'smtp';
    } else {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject: finalSubject,
        body: `${intro}${signature}\n\nPrenos ponudbe:\n${links}`,
        from_name: business.name,
      });
    }

    const now = new Date().toISOString();
    const updates = {};
    if (business.subscription_status === 'trialing') updates.trial_sends_remaining = Math.max(0, (business.trial_sends_remaining ?? 20) - 1);
    if (Object.keys(updates).length) await base44.asServiceRole.entities.Business.update(business.id, updates);
    await base44.asServiceRole.entities.UsageLog.create({
      business_id: business.id, date: now.split('T')[0], pillar: 'offers', feature: 'offers', subfeature: 'email_send',
      model: 'none', input_tokens: 0, output_tokens: 0, cost_eur: 0, is_demo: false,
    }).catch(() => {});

    return Response.json({ success: true, sent_to: to, via: sentVia });
  } catch (error) {
    return Response.json({ error: error.message || 'Pošiljanje ni uspelo.' }, { status: 500 });
  }
});
