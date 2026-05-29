/**
 * Scheduled task: runs every hour.
 * Sends Day 10, Day 12, Day 14 reminder emails to trialing businesses.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APP_URL = Deno.env.get("APP_URL") || "https://app.aiaristotle.si";
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
      if (!biz.trial_ends_at) continue;
      const hours = hoursUntil(biz.trial_ends_at);
      const alreadySent = biz.trial_emails_sent || [];

      // Fetch owner user
      const users = await base44.asServiceRole.entities.User.filter({ email: biz.created_by });
      const owner = users[0];
      const ownerName = owner?.full_name || "uporabnik";
      const ownerEmail = biz.created_by;
      if (!ownerEmail) continue;

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
      if (!alreadySent.includes("day10") && hours <= 96 && hours > 95) {
        const body = `Pozdravljeni, ${ownerName},

vaš 14-dnevni preizkus AI Aristotle se konča čez 4 dni.

Doslej ste:
• Ustvarili ${nDrafts} AI osnutkov sporočil
• Poslali ${nSent} sporočil strankam
• Dodali ${nLeads} potencialnih strank

Da ne izgubite tega dela, izberite module in nadaljujte z avtomatizacijo:

• Posamezen modul: 99 €/mes (brez DDV)
• Vseh 5 modulov: 399 €/mes — prihranite 96 €/mes in brez stroška namestitve

Aktiviraj naročnino → ${ACTIVATION_LINK}

Vaši podatki ostanejo varni — tudi če se odločite kasneje. Po koncu preizkusa bodo moduli začasno onemogočeni, vse stranke, osnutki in nastavitve pa shranjene.

Če imate vprašanja, nam odpišite na to e-pošto.

Lep pozdrav,
Ekipa AI Aristotle`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          from_name: "Ekipa AI Aristotle",
          subject: "Še 4 dni vašega preizkusa AI Aristotle",
          body,
        });

        await base44.asServiceRole.entities.Business.update(biz.id, {
          trial_emails_sent: [...alreadySent, "day10"],
        });
        sent.push({ business_id: biz.id, email: "day10" });
      }

      // ── DAY 12 — between 2d0h and 1d23h remaining ──
      const alreadySent12 = (await base44.asServiceRole.entities.Business.filter({ id: biz.id }))[0]?.trial_emails_sent || alreadySent;
      if (!alreadySent12.includes("day12") && hours <= 48 && hours > 47) {
        const body = `Pozdravljeni, ${ownerName},

vaš preizkus AI Aristotle se konča čez 2 dni.

Trenutno v sistemu čaka ${nPendingDrafts} osnutkov AI sporočil, pripravljenih za odobritev. Po koncu preizkusa novih ne bomo več samodejno generirali.

Aktivirajte naročnino zdaj in nadaljujte brez prekinitve:

• Posamezen modul: 99 €/mes (brez DDV)
• Vseh 5 modulov: 399 €/mes — brez stroška namestitve, prihranite 96 €/mes

Izberi module → ${ACTIVATION_LINK}

Če imate vprašanja o izbiri modulov ali ceniku, nam odpišite. Pomagamo vam izbrati to, kar bo najbolj koristilo vašemu podjetju.

Lep pozdrav,
Ekipa AI Aristotle`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          from_name: "Ekipa AI Aristotle",
          subject: "Še 2 dni — vaši AI osnutki čakajo na odločitev",
          body,
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
      if (!alreadySent14.includes("day14") && trialDate === today && hours > 0) {
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
• Vseh 5 modulov: 399 €/mes — brez stroška namestitve

Aktiviraj naročnino → ${ACTIVATION_LINK}

Hvala, da ste preizkusili AI Aristotle.

Lep pozdrav,
Ekipa AI Aristotle`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: ownerEmail,
          from_name: "Ekipa AI Aristotle",
          subject: "Danes se konča vaš preizkus AI Aristotle",
          body,
        });

        await base44.asServiceRole.entities.Business.update(biz.id, {
          trial_emails_sent: [...alreadySent14, "day14"],
        });
        sent.push({ business_id: biz.id, email: "day14" });
      }
    }

    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});