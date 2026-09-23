/**
 * Scheduled task: runs every hour.
 * Sends Day 10, Day 12, Day 14 reminder emails to trialing businesses.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── HTML predloga e-pošte (kopija v vsaki funkciji — Base44 funkcije nimajo skupnih modulov) ───
const EMAIL_APP_URL = (Deno.env.get('APP_URL') || 'https://aristotle-smart-growth.base44.app').replace(/\/$/, '');
const EMAIL_FOOTER_COMPANY = Deno.env.get('EMAIL_FOOTER_COMPANY') || 'AI Aristotle';
const EMAIL_FOOTER_ADDRESS = Deno.env.get('EMAIL_FOOTER_ADDRESS') || '';
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4f46e5;text-decoration:underline">$1</a>');
// Navadno besedilo → HTML odstavki (prazna vrstica = nov odstavek; vrstice, ki se začnejo z •, - ali –, = seznam)
const textToHtml = (text) => String(text ?? '').replace(/\r/g, '').trim().split(/\n{2,}/).map((block) => {
  const lines = block.split('\n');
  if (lines.length && lines.every((l) => /^\s*[•\-–]\s+/.test(l))) {
    return '<ul style="margin:0 0 16px;padding-left:20px">' + lines.map((l) => '<li style="margin:0 0 4px">' + linkify(escHtml(l.replace(/^\s*[•\-–]\s+/, ''))) + '</li>').join('') + '</ul>';
  }
  return '<p style="margin:0 0 16px">' + linkify(escHtml(block)).replace(/\n/g, '<br>') + '</p>';
}).join('');
const emailButton = (label, url) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 20px"><tr><td style="background:#4f46e5;border-radius:8px"><a href="${escHtml(url)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:600;text-decoration:none;font-size:15px">${escHtml(label)}</a></td></tr></table>`;
// Dvostolpčna tabela (oznaka → vrednost; vrednost je že HTML)
const emailRows = (rows) => '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate">' + rows.map(([k, v], i) => `<tr style="background:${i % 2 ? '#ffffff' : '#f9fafb'}"><td style="padding:9px 12px;font-size:13px;color:#6b7280;width:40%;vertical-align:top">${escHtml(k)}</td><td style="padding:9px 12px;font-size:14px;color:#111827;font-weight:500">${v}</td></tr>`).join('') + '</table>';
const emailHtml = ({ brand = 'AI Aristotle', brandSub = '', title = '', bodyHtml = '', cta = null, footerNote = '' }) => `<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title || brand)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 4px 14px"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="width:36px;height:36px;background:#4f46e5;border-radius:10px;text-align:center;vertical-align:middle;color:#ffffff;font-weight:700;font-size:18px;line-height:36px">${escHtml(String(brand).trim().charAt(0).toUpperCase() || 'A')}</td>
<td style="padding-left:10px;font-weight:700;font-size:17px;color:#111827">${escHtml(brand)}${brandSub ? `<div style="font-weight:400;font-size:12px;color:#6b7280">${escHtml(brandSub)}</div>` : ''}</td>
</tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 28px 16px;font-size:15px;line-height:1.55">
${title ? `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827">${escHtml(title)}</h1>` : ''}
${bodyHtml}
${cta ? emailButton(cta.label, cta.url) : ''}
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
${escHtml(EMAIL_FOOTER_COMPANY)}${EMAIL_FOOTER_ADDRESS ? ' · ' + escHtml(EMAIL_FOOTER_ADDRESS) : ''} · <a href="${EMAIL_APP_URL}" style="color:#6b7280">${escHtml(EMAIL_APP_URL.replace(/^https?:\/\//, ''))}</a>
${footerNote ? `<div style="margin-top:6px">${footerNote}</div>` : ''}
</td></tr>
</table></td></tr></table></body></html>`;


const APP_URL = (Deno.env.get("APP_URL") || "https://aristotle-smart-growth.base44.app").replace(/\/$/, "");
const ACTIVATION_LINK = `${APP_URL}/nastavitve?tab=billing`;

function hoursUntil(dateStr) {
  return (new Date(dateStr) - new Date()) / 3_600_000;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const trialing = await base44.asServiceRole.entities.Business.filter({ subscription_status: "trialing" });
    const sent = [];

    for (const biz of trialing) {
      try {
      if (!biz.trial_ends_at) continue;
      const hours = hoursUntil(biz.trial_ends_at);
      const alreadySent = biz.trial_emails_sent || [];

      // Fetch owner user — owner_email ima prednost (service-role zapisi imajo created_by = service+...)
      const ownerEmail = biz.owner_email || (String(biz.created_by || '').includes('@no-reply.base44.com') ? '' : biz.created_by);
      if (!ownerEmail) continue;
      const users = await base44.asServiceRole.entities.User.filter({ email: ownerEmail });
      const owner = users[0];
      const ownerName = owner?.full_name || "uporabnik";

      // Fetch stats
      const [drafts, leads, conversations] = await Promise.all([
        base44.asServiceRole.entities.DraftMessage.filter({ business_id: biz.id }),
        base44.asServiceRole.entities.Lead.filter({ business_id: biz.id }),
        base44.asServiceRole.entities.ChatbotConversation.filter({ business_id: biz.id }),
      ]);

      const nDrafts = drafts.length;
      const nSent = drafts.filter((d) => d.status === "sent").length;
      const nLeads = leads.length;
      const nPendingDrafts = drafts.filter((d) => d.status === "pending").length;
      const nConversations = conversations.length;

      // ── DAY 10 — between 4d0h and 3d23h remaining ──
      // Okna so kumulativna (<= 96 h), ne 1-urna — če se urni zagon zamakne, e-pošta ne izpade.
      if (!alreadySent.includes("day10") && hours <= 96 && hours > 48) {
        const body = `Pozdravljeni, ${ownerName},

vaš 14-dnevni preizkus AI Aristotle se konča čez 4 dni.

Doslej ste:
• Ustvarili ${nDrafts} AI osnutkov sporočil
• Poslali ${nSent} sporočil strankam
• Dodali ${nLeads} potencialnih strank

Da ne izgubite tega dela, izberite module in nadaljujte z avtomatizacijo:

• Posamezen modul: 99 €/mes (brez DDV)
• Vseh 6 modulov: 399 €/mes — prihranite 195 €/mes in brez stroška namestitve

Aktiviraj naročnino → ${ACTIVATION_LINK}

Vaši podatki ostanejo varni — tudi če se odločite kasneje. Po koncu preizkusa bodo moduli začasno onemogočeni, vse stranke, osnutki in nastavitve pa shranjene.

Če imate vprašanja, nam odpišite na to e-pošto.

Lep pozdrav,
Ekipa AI Aristotle`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          from_name: "Ekipa AI Aristotle",
          subject: "Še 4 dni vašega preizkusa AI Aristotle",
          body: emailHtml({ title: "Še 4 dni vašega preizkusa AI Aristotle", bodyHtml: textToHtml(body.replace(/\n+Aktiviraj naročnino → [^\n]+\n/, "\n")), cta: { label: "Aktiviraj naročnino", url: ACTIVATION_LINK } }),
        });

        await base44.asServiceRole.entities.Business.update(biz.id, {
          trial_emails_sent: [...alreadySent, "day10"],
        });
        sent.push({ business_id: biz.id, email: "day10" });
      }

      // ── DAY 12 — between 2d0h and 1d23h remaining ──
      const alreadySent12 = (await base44.asServiceRole.entities.Business.filter({ id: biz.id }))[0]?.trial_emails_sent || alreadySent;
      if (!alreadySent12.includes("day12") && hours <= 48 && hours > 24) {
        const body = `Pozdravljeni, ${ownerName},

vaš preizkus AI Aristotle se konča čez 2 dni.

Trenutno v sistemu čaka ${nPendingDrafts} osnutkov AI sporočil, pripravljenih za odobritev. Po koncu preizkusa novih ne bomo več samodejno generirali.

Aktivirajte naročnino zdaj in nadaljujte brez prekinitve:

• Posamezen modul: 99 €/mes (brez DDV)
• Vseh 6 modulov: 399 €/mes — brez stroška namestitve, prihranite 195 €/mes

Izberi module → ${ACTIVATION_LINK}

Če imate vprašanja o izbiri modulov ali ceniku, nam odpišite. Pomagamo vam izbrati to, kar bo najbolj koristilo vašemu podjetju.

Lep pozdrav,
Ekipa AI Aristotle`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          from_name: "Ekipa AI Aristotle",
          subject: "Še 2 dni — vaši AI osnutki čakajo na odločitev",
          body: emailHtml({ title: "Še 2 dni — vaši AI osnutki čakajo na odločitev", bodyHtml: textToHtml(body.replace(/\n+Izberi module → [^\n]+\n/, "\n")), cta: { label: "Izberi module", url: ACTIVATION_LINK } }),
        });

        await base44.asServiceRole.entities.Business.update(biz.id, {
          trial_emails_sent: [...alreadySent12, "day12"],
        });
        sent.push({ business_id: biz.id, email: "day12" });
      }

      // ── DAY 14 — same calendar day as trial_ends_at ──
      const alreadySent14 = (await base44.asServiceRole.entities.Business.filter({ id: biz.id }))[0]?.trial_emails_sent || alreadySent12;
      const trialDate = new Date(biz.trial_ends_at).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      if (!alreadySent14.includes("day14") && hours <= 24 && hours > 0) {
        const body = `Pozdravljeni, ${ownerName},

danes je zadnji dan vašega 14-dnevnega preizkusa.

Po polnoči bodo vsi moduli začasno onemogočeni. Vaši podatki — stranke, osnutki, baza znanja, nastavitve — ostanejo varno shranjeni in jih lahko obnovite kadarkoli z aktivacijo naročnine.

V zadnjih 14 dneh ste:
• Ustvarili ${nDrafts} AI osnutkov sporočil
• Poslali ${nSent} sporočil
• Pridobili ${nLeads} novih potencialnih strank
• Imeli ${nConversations} pogovorov klepetalnega pomočnika

Aktivirajte naročnino zdaj in nadaljujte brez prekinitve:

• Posamezen modul: 99 €/mes (brez DDV)
• Vseh 6 modulov: 399 €/mes — brez stroška namestitve

Aktiviraj naročnino → ${ACTIVATION_LINK}

Hvala, da ste preizkusili AI Aristotle.

Lep pozdrav,
Ekipa AI Aristotle`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          from_name: "Ekipa AI Aristotle",
          subject: "Danes se konča vaš preizkus AI Aristotle",
          body: emailHtml({ title: "Danes se konča vaš preizkus AI Aristotle", bodyHtml: textToHtml(body.replace(/\n+Aktiviraj naročnino → [^\n]+\n/, "\n")), cta: { label: "Aktiviraj naročnino", url: ACTIVATION_LINK } }),
        });

        await base44.asServiceRole.entities.Business.update(biz.id, {
          trial_emails_sent: [...alreadySent14, "day14"],
        });
        sent.push({ business_id: biz.id, email: "day14" });
      }
      } catch (e) {
        sent.push({ business_id: biz.id, error: e.message });
      }
    }

    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});