import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { featureOn } from "@/lib/features";
import { cnt, W } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Inbox, MessageSquare, Star, FileSignature, FileText, ArrowRight, Plus, Check } from "lucide-react";
import { TONES, StatusPill } from "@/components/pomocniki/HelperKit";

// Vsi pomočniki na eni strani: kateri deluje, kaj čaka na vas, en gumb za naslednji korak.
function HelperCard({ icon: Icon, tone, title, desc, ok, statusLabel, now, attention, steps = [], cta, to, wide, first }) {
  const done = steps.filter(Boolean).length;
  return (
    <Link to={to} className={`card-elevated card-hover p-6 flex flex-col group relative ${wide ? "xl:col-span-2" : ""} ${first ? "ring-2 ring-primary/60" : ""}`}>
      {first && <span className="absolute -top-3 left-6 rounded-full bg-primary text-white text-xs font-bold px-3 py-1 shadow">Začnite tukaj</span>}
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-7 h-7" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap"><h2 className="!text-xl">{title}</h2><StatusPill ok={ok}>{statusLabel}</StatusPill></div>
          <p className="text-muted-foreground mt-1">{desc}</p>
        </div>
      </div>
      <div className="flex items-end gap-4 mt-5 flex-wrap flex-1">
        <div className="flex-1 min-w-[220px]">
          {!ok && steps.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              {steps.map((s, i) => <span key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${s ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>{s ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}</span>)}
              <span className="text-xs text-muted-foreground">Narejeno {done} od {steps.length}</span>
            </div>
          )}
          <p className={`text-sm font-medium ${attention ? "text-primary" : "text-foreground/80"}`}>{now}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${attention || first ? "btn-brand" : "border bg-card group-hover:border-foreground/30"}`}>{cta}<ArrowRight className="w-4 h-4" /></span>
      </div>
    </Link>
  );
}

export default function Pomocniki() {
  const { business } = useBusiness();
  const bid = business?.id;
  const on = (k) => featureOn(business, k);
  const q = (key, fn, enabled = true) => ({ queryKey: [key, bid], queryFn: fn, enabled: !!bid && enabled });
  const { data: docs = [] } = useQuery(q("kb", () => base44.entities.KnowledgeBase.filter({ business_id: bid }), on("chat")));
  const { data: convs = [] } = useQuery(q("convs", () => base44.entities.ChatbotConversation.filter({ business_id: bid }, "-started_at", 100), on("chat")));
  const { data: drafts = [] } = useQuery(q("ocene-drafts", () => base44.entities.DraftMessage.filter({ business_id: bid })));
  const { data: templates = [] } = useQuery(q("offer-templates", () => base44.entities.OfferTemplate.filter({ business_id: bid }), on("offers")));
  const { data: offers = [] } = useQuery(q("offer-generations", () => base44.entities.OfferGeneration.filter({ business_id: bid }, "-created_date", 50), on("offers")));
  const { data: invoices = [] } = useQuery(q("invoices", () => base44.entities.Invoice.filter({ business_id: bid }), on("invoices")));

  const waitingReplies = drafts.filter((d) => d.status === "pending").length;
  const mailOn = !!business?.imap_enabled;
  const real = convs.filter((c) => c.visitor_id !== "lastnik_preizkus");
  const chatWaiting = real.filter((c) => c.escalated && c.status !== "resolved").length;
  const learned = docs.length > 0; const installed = !!business?.chat_installed_url || real.length > 0;
  const reviewSent = drafts.filter((d) => d.pillar === "review_request" && d.status === "sent").length;
  const hasLink = !!business?.google_review_link;
  const goodOffers = offers.filter((o) => o.status !== "failed" && (o.output_markdown || o.output_pdf_url));
  const invWaiting = invoices.filter((i) => i.status === "captured").length;
  const accOn = !!business?.accountant_email && !!business?.invoice_enabled;

  const cards = [
    { show: true, wide: true, icon: Inbox, tone: "blue", title: "Odgovori na povpraševanja", desc: "V vaši pošti najde povpraševanja in pripravi odgovor. Vi ga preberete in pošljete.",
      ok: mailOn, statusLabel: mailOn ? "Deluje" : "Povežite e-pošto", steps: [mailOn], attention: waitingReplies > 0,
      now: !mailOn ? "Povežite svoj e-poštni predal — samo e-naslov in geslo." : waitingReplies ? `Na vašo potrditev čaka: ${cnt(waitingReplies, ["odgovor", "odgovora", "odgovori", "odgovorov"])}.` : `Bere predal ${business?.imap_user || ""}. Trenutno nič ne čaka.`,
      cta: !mailOn ? "Poveži e-pošto" : waitingReplies ? "Preglej odgovore" : "Odpri stranke", to: !mailOn ? "/nastavitve?tab=integracije" : "/stranke?tab=odgovori" },
    { show: on("chat") && hasModule(business, "pillar_chatbot"), icon: MessageSquare, tone: "orange", title: "Spletni klepet", desc: "Na vaši spletni strani odgovarja obiskovalcem, tudi ponoči.",
      ok: learned && installed, statusLabel: learned && installed ? "Deluje" : "Nastavite v 5 minutah", steps: [learned, installed], attention: chatWaiting > 0,
      now: !learned ? "Najprej naj prebere vašo spletno stran." : !installed ? "Preizkusite ga in ga dajte na svojo stran." : chatWaiting ? `Na vas čaka: ${cnt(chatWaiting, W.pogovor)}.` : real.length ? `Doslej: ${cnt(real.length, W.pogovor)}.` : "Čaka na prvega obiskovalca.",
      cta: learned && installed ? "Odpri pogovore" : learned ? "Nadaljuj nastavitev" : "Nastavi klepet", to: "/klepet" },
    { show: on("reviews") && hasModule(business, "pillar_reviews"), icon: Star, tone: "amber", title: "Google ocene", desc: "Po opravljenem delu stranko vljudno prosi za oceno.",
      ok: hasLink, statusLabel: hasLink ? "Deluje" : "Nastavite v 2 minutah", steps: [hasLink],
      now: !hasLink ? "Prilepite povezavo do svojih Google ocen." : `Poslane prošnje: ${reviewSent}.`, cta: hasLink ? "Odpri ocene" : "Nastavi ocene", to: "/ocene" },
    { show: on("offers") && hasModule(business, "pillar_offers"), icon: FileSignature, tone: "violet", title: "Ponudbe", desc: "Ponudbo pripravi po vašem vzorcu v nekaj minutah.",
      ok: templates.length > 0 || goodOffers.length > 0, statusLabel: templates.length > 0 || goodOffers.length > 0 ? "Pripravljeno" : "Dodajte prvo ponudbo", steps: [templates.length > 0, goodOffers.length > 0],
      now: !templates.length && !goodOffers.length ? "Dodajte ponudbo, ki jo že pošiljate — postane vaš vzorec." : `Pripravljene ponudbe: ${goodOffers.length}.`, cta: templates.length ? "Odpri ponudbe" : "Dodaj ponudbo", to: "/ponudbe" },
    { show: on("invoices"), icon: FileText, tone: "green", title: "Računi za računovodjo", desc: "Prejete račune zbere in jih enkrat na mesec pošlje računovodji.",
      ok: accOn, statusLabel: accOn ? "Deluje" : "Vpišite računovodjo", steps: [mailOn || invoices.length > 0, accOn],
      now: !accOn ? "Vpišite e-naslov računovodje, da gredo računi k njemu sami." : invWaiting ? `Na pošiljanje čaka: ${cnt(invWaiting, W.racun)}.` : "Trenutno nič ne čaka.", cta: accOn ? "Odpri račune" : "Nastavi račune", to: "/racuni" },
  ].filter((c) => c.show);
  const working = cards.filter((c) => c.ok).length;
  const firstTodo = cards.some((c) => c.attention) ? null : cards.find((c) => !c.ok);
  const hidden = Array.isArray(business?.enabled_features) && ["chat", "reviews", "offers", "invoices"].some((k) => !business.enabled_features.includes(k));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1>Pomočniki</h1>
          <p className="text-muted-foreground mt-1">Vsak opravi eno delo namesto vas. {working === cards.length ? "Vsi delujejo." : `Deluje ${working} od ${cards.length} — pri ostalih piše, kaj še manjka.`}</p>
        </div>
        <Link to="/nastavitve?tab=pomocniki"><Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />{hidden ? "Dodaj pomočnika" : "Izberi pomočnike"}</Button></Link>
      </div>
      <div className="grid xl:grid-cols-2 gap-4">{cards.map((c) => <HelperCard key={c.title} {...c} first={c.title === firstTodo?.title} />)}</div>
    </div>
  );
}
