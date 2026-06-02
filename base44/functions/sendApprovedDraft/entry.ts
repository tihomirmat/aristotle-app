import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

// Sends an approved DraftMessage to the lead via the business's configured email provider.
// Triggered by entity automation on DraftMessage update → status = "approved"
// Can also be called directly with { draft_id }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Support both direct call ({ draft_id }) and entity automation payload ({ data: { id, ... } })
    const draftId = body.draft_id || body.data?.id;
    if (!draftId) {
      return Response.json({ error: 'draft_id is required' }, { status: 400 });
    }

    // Fetch draft
    const drafts = await base44.asServiceRole.entities.DraftMessage.filter({ id: draftId });
    const draft = drafts[0];
    if (!draft) return Response.json({ error: 'Draft not found' }, { status: 404 });

    // Only send approved drafts
    if (draft.status !== 'approved') {
      return Response.json({ skipped: true, reason: `status is ${draft.status}` });
    }

    // Fetch lead + business in parallel
    const [leads, businesses] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ id: draft.lead_id }),
      base44.asServiceRole.entities.Business.filter({ id: draft.business_id }),
    ]);
    const lead = leads[0];
    const business = businesses[0];

    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

    // ─── Guardrails ───────────────────────────────────────────────────────────
    if (!lead.email) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Lead has no email address.' });
      return Response.json({ skipped: true, reason: 'no lead email' });
    }
    if (!lead.consent_email) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'skipped', reviewer_notes: 'Lead did not consent to email.' });
      return Response.json({ skipped: true, reason: 'no consent_email' });
    }
    if (lead.status === 'unsubscribed') {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'skipped', reviewer_notes: 'Lead is unsubscribed.' });
      return Response.json({ skipped: true, reason: 'unsubscribed' });
    }

    // ─── Trial send limit ─────────────────────────────────────────────────────
    if (business.subscription_status === 'trialing') {
      const remaining = business.trial_sends_remaining ?? 20;
      if (remaining <= 0) {
        await base44.asServiceRole.entities.DraftMessage.update(draftId, { status: 'failed', reviewer_notes: 'Trial send limit reached (0 sends remaining).' });
        return Response.json({ skipped: true, reason: 'trial_sends_exhausted' });
      }
      // Decrement
      await base44.asServiceRole.entities.Business.update(business.id, {
        trial_sends_remaining: remaining - 1,
      });
    }

    // ─── Build email body (add signature + unsubscribe footer) ────────────────
    const signature = business.email_signature ? `\n\n${business.email_signature}` : `\n\nLep pozdrav,\n${business.name}`;
    const footer = `\n\n---\nIf you no longer wish to receive these emails, please reply with "Odjava" or contact us directly.`;
    const fullBody = (draft.body || '') + signature + footer;

    // ─── Send via configured provider ────────────────────────────────────────
    let sendError = null;

    if (business.email_provider === 'smtp' && business.smtp_host && business.smtp_user && business.smtp_pass) {
      // SMTP
      const transporter = nodemailer.createTransport({
        host: business.smtp_host,
        port: business.smtp_port || 587,
        secure: business.smtp_encryption === 'ssl_tls',
        requireTLS: business.smtp_encryption === 'starttls',
        auth: { user: business.smtp_user, pass: business.smtp_pass },
      });
      const mailResult = await transporter.sendMail({
        from: `"${business.smtp_from_name || business.name}" <${business.smtp_from_email || business.smtp_user}>`,
        to: lead.email,
        subject: draft.subject || '(brez zadeve)',
        text: fullBody,
      }).catch(e => { sendError = e.message; return null; });
    } else if ((business.email_provider === 'gmail' && business.gmail_access_token) ||
               (business.email_provider === 'outlook' && business.outlook_access_token)) {
      // Gmail / Outlook via platform SendEmail integration (OAuth token refresh is complex; fall through to platform)
      // For now fall through to platform SendEmail — OAuth refresh flows are handled separately
      sendError = 'oauth_fallback';
    }

    if (!business.email_provider || sendError === 'oauth_fallback' || (!business.smtp_host && !business.gmail_access_token && !business.outlook_access_token)) {
      // Fall back to platform SendEmail integration
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: lead.email,
        subject: draft.subject || '(brez zadeve)',
        body: fullBody,
        from_name: business.name,
      });
      sendError = null;
    }

    if (sendError) {
      await base44.asServiceRole.entities.DraftMessage.update(draftId, {
        status: 'failed',
        reviewer_notes: `Send error: ${sendError}`,
      });
      await base44.asServiceRole.entities.UsageLog.create({
        business_id: business.id,
        date: new Date().toISOString().split('T')[0],
        pillar: draft.pillar,
        feature: 'email_send',
        subfeature: 'failed',
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        cost_eur: 0,
        is_demo: draft.is_demo || false,
      });
      return Response.json({ success: false, error: sendError }, { status: 500 });
    }

    // ─── Mark sent ────────────────────────────────────────────────────────────
    const now = new Date().toISOString();
    await Promise.all([
      base44.asServiceRole.entities.DraftMessage.update(draftId, {
        status: 'sent',
        sent_at: now,
      }),
      base44.asServiceRole.entities.Lead.update(lead.id, {
        last_contacted_at: now,
        status: lead.status === 'new' ? 'contacted' : lead.status,
      }),
      base44.asServiceRole.entities.UsageLog.create({
        business_id: business.id,
        date: now.split('T')[0],
        pillar: draft.pillar,
        feature: 'email_send',
        subfeature: 'sent',
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        cost_eur: 0,
        is_demo: draft.is_demo || false,
      }),
    ]);

    return Response.json({ success: true, draft_id: draftId, sent_to: lead.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});