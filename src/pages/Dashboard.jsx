import { featureOn } from "@/lib/features";
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Star, MessageSquare, FileSignature, ArrowRight, Users, UserPlus, Calendar, CheckCircle2, Circle, Inbox, Megaphone, ListChecks, ChevronRight, FileText } from "lucide-react";
import ReactivationPanel from "@/components/dashboard/ReactivationPanel";
import TrialBanner from "@/components/dashboard/TrialBanner";
import StatusBanner from "@/components/ui/StatusBanner";
import { STAGES, ago, dueLabel, cnt, W, eur } from "@/lib/crm";
import { reasonFor } from "@/components/crm/ReplyReview";
import { DraftIcon } from "@/components/crm/DraftMark";
import { format } from "date-fns";
import { sl } from "date-fns/locale";

// Pregled (namizje): levo »Danes« — kaj čaka na lastnika (odgovori, opravila, termini), desno številke, faze in nastavitev.
const greeting = () => { const h = new Date().getHours(); return h < 10 ? "Dobro jutro" : h < 18 ? "Dober dan" : "Dober večer"; };

function Panel({ icon: Icon, title, count, to, cta, children, tone = "text-primary" }) {
  return (
    <section className="card-elevated overflow-hidden flex flex-col">
      <header className="flex items-center gap-2.5 px-5 py-3.5 border-b">
        <Icon className={`w-4 h-4 ${tone}`} />
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {count > 0 && <span className="text-[11px] font-semibold text-accent-foreground bg-primary/15 rounded-full min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center">{count}</span>}
        {to && <Link to={to} className="ml-auto text-sm text-primary font-medium inline-flex items-center gap-1 hover:underline">{cta}<ArrowRight className="w-3.5 h-3.5" /></Link>}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}
const Empty = ({ children }) => <p className="px-5 py-6 text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />{children}</p>;

export default function Dashboard() {
  const { business, user } = useBusiness();
  const bid = business?.id;
  const q = (key, fn) => ({ queryKey: [key, bid], queryFn: fn, enabled: !!bid });

  const { data: leads = [] } = useQuery(q("leads", () => base44.entities.Lead.filter({ business_id: bid }, "-created_date", 5000)));
  const { data: allDrafts = [] } = useQuery(q("drafts-all", () => base44.entities.DraftMessage.filter({ business_id: bid })));
  const { data: tasks = [] } = useQuery(q("tasks", () => base44.entities.Task.filter({ business_id: bid, status: "open" })));
  const { data: confirmedBookings = [] } = useQuery(q("confirmed_bookings", () => base44.entities.ConfirmedBooking.filter({ business_id: bid, status: "confirmed" })));
  const { data: convs = [] } = useQuery(q("convs_dash", () => base44.entities.ChatbotConversation.filter({ business_id: bid })));
  const { data: kb = [] } = useQuery(q("kb_dash", () => base44.entities.KnowledgeBase.filter({ business_id: bid })));
  const { data: offers = [] } = useQuery(q("offers_dash", () => base44.entities.OfferGeneration.filter({ business_id: bid })));
  const { data: campaigns = [] } = useQuery(q("campaigns", () => base44.entities.Campaign.filter({ business_id: bid })));
  const { data: invoices = [] } = useQuery(q("invoices", () => base44.entities.Invoice.filter({ business_id: bid })));

  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const drafts = allDrafts.filter((d) => d.status === "pending" || d.status === "flagged_for_review").sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at) <= endOfToday).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const upcoming = confirmedBookings.filter((b) => b.booked_at && new Date(b.booked_at) >= now && new Date(b.booked_at) <= weekFromNow).sort((a, b) => new Date(a.booked_at) - new Date(b.booked_at));
  const leadsThisWeek = leads.filter((l) => new Date(l.created_date) >= weekAgo).length;
  const leadsThisMonth = leads.filter((l) => new Date(l.created_date) >= startOfMonth).length;
  const sentThisWeek = allDrafts.filter((d) => d.status === "sent" && d.sent_at && new Date(d.sent_at) >= weekAgo).length;
  const openValue = leads.filter((l) => !["converted", "lost", "unsubscribed"].includes(l.status)).reduce((s, l) => s + (Number(l.value) || 0), 0);
  const waiting = drafts.length + dueTasks.length;

  const setup = [
    { done: !!business?.website && !!business?.services, label: "Profil podjetja", hint: "Iz tega AI piše sporočila.", href: "/nastavitve?tab=profil" },
    { done: !!business?.brand_voice, label: "Glas znamke", hint: "Kako naj zvenijo vaša sporočila.", href: "/nastavitve?tab=glas" },
    { done: !!business?.imap_enabled, label: "E-poštni predal", hint: "AI najde povpraševanja v vaši pošti.", href: "/nastavitve?tab=integracije" },
    { feature: "chat", done: leads.some((l) => l.source === "form" || l.source === "chatbot"), label: "Obrazec ali klepet na strani", hint: "Da obiskovalci postanejo stranke.", href: "/nastavitve?tab=viri" },
    { done: !!business?.google_calendar_connected, label: "Google Koledar", hint: "Asistent predlaga proste termine.", href: "/nastavitve?tab=termini" },
  ].filter((s) => !s.feature || featureOn(business, s.feature));
  const setupDone = setup.filter((s) => s.done).length;
  const nextSetup = setup.find((s) => !s.done);

  const trialSendsOut = business?.subscription_status === "trialing" && (business?.trial_sends_remaining ?? 20) <= 0;
  const trialCostOut = business?.subscription_status === "trialing" && (business?.trial_cost_used_eur ?? 0) >= (business?.trial_cost_cap_eur ?? 0.45);

  const kpis = [
    { label: "Stranke", value: leads.length, sub: leadsThisWeek > 0 ? `+${leadsThisWeek} ta teden` : "brez novih ta teden", icon: Users, href: "/stranke?tab=stranke" },
    { label: "Nova povpraševanja", value: leadsThisMonth, sub: "ta mesec", icon: UserPlus, href: "/stranke?tab=stranke" },
    { label: "Poslana sporočila", value: sentThisWeek, sub: "ta teden", icon: Mail },
    { label: "Odprti posli", value: openValue ? eur(openValue) : "—", sub: "ocenjena vrednost", icon: FileSignature },
  ];

  const convsThisWeek = convs.filter((c) => new Date(c.started_at || c.created_date) >= weekAgo).length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const stoppedCampaigns = campaigns.filter((c) => c.status === "paused" && c.paused_reason === "bounces").length;
  const reviewsSent = allDrafts.filter((d) => d.pillar === "review_request" && d.status === "sent").length;
  const invoicesWaiting = invoices.filter((i) => i.status === "captured").length;
  const helpers = [
    { title: "Povpraševanja iz e-pošte", icon: Mail, href: business?.imap_enabled ? "/stranke" : "/nastavitve?tab=integracije", ok: !!business?.imap_enabled && !business?.imap_last_error,
      state: business?.imap_enabled ? (business?.imap_last_error ? "Napaka pri branju pošte" : "Berem vsakih 10 minut") : "Predal ni povezan", metric: `${leads.filter((l) => l.source === "email" && new Date(l.created_date) >= weekAgo).length} novih ta teden` },
    { feature: "chat", title: "Spletni klepet", icon: MessageSquare, href: "/klepet", ok: kb.length > 0 && !!business?.chat_installed_url,
      state: kb.length === 0 ? "Še ne pozna vašega podjetja" : !business?.chat_installed_url ? "Še ni na vaši spletni strani" : "Deluje", metric: `${cnt(convsThisWeek, W.pogovor)} ta teden` },
    { feature: "campaigns", title: "E-poštne kampanje", icon: Megaphone, href: "/kampanje", ok: stoppedCampaigns === 0 && activeCampaigns > 0, warn: stoppedCampaigns > 0,
      state: stoppedCampaigns > 0 ? "Kampanja ustavljena: vrnjena pošta" : activeCampaigns > 0 ? "Teče" : "Nobena kampanja ne teče", metric: `${activeCampaigns} aktivnih` },
    { feature: "reviews", title: "Google ocene", icon: Star, href: "/ocene", ok: !!business?.google_review_link,
      state: business?.google_review_link ? "Prošnje gredo po zaključeni storitvi" : "Dodajte povezavo za ocene", metric: `${reviewsSent} poslanih prošenj` },
    { feature: "offers", title: "Ponudbe", icon: FileSignature, href: "/ponudbe", ok: offers.length > 0, state: offers.length > 0 ? "V uporabi" : "Pripravite prvo ponudbo", metric: `${offers.length} pripravljenih` },
    { feature: "invoices", title: "Računi", icon: FileText, href: "/racuni", ok: !!business?.accountant_email && !!business?.invoice_enabled,
      state: business?.accountant_email ? "Računovodja jih dobi 1. v mesecu" : "Vpišite računovodjo", metric: `${cnt(invoicesWaiting, W.racun)} čaka` },
  ].filter((c) => !c.feature || featureOn(business, c.feature));

  const stageCount = (k) => leads.filter((l) => (l.status || "new") === k).length;
  const maxStage = Math.max(1, ...STAGES.map((s) => stageCount(s.key)));
  const firstName = (user?.full_name || "").split(" ")[0];

  return (
    <div className="space-y-5">
      <TrialBanner business={business} />
      {trialSendsOut && <StatusBanner variant="warning" message="Porabili ste vse brezplačne pošiljke preizkusa (20). Aktivirajte naročnino za nadaljevanje pošiljanja." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />}
      {trialCostOut && !trialSendsOut && <StatusBanner variant="warning" message="AI kredit za preizkus je porabljen. Aktivirajte naročnino za nova sporočila." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />}

      {/* Glava: ena vrstica — kaj čaka danes */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-[hsl(24_70%_97%)] via-card to-[hsl(222_60%_97%)] px-6 py-5">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting()}{firstName ? `, ${firstName}` : ""} · {format(now, "EEEE, d. MMMM", { locale: sl })}</p>
            <h1 className="mt-0.5 text-2xl md:text-[28px]">
              {waiting > 0 ? <>Danes vas čaka: <span className="text-accent-foreground">{[drafts.length > 0 && cnt(drafts.length, ["odgovor", "odgovora", "odgovori", "odgovorov"]), dueTasks.length > 0 && cnt(dueTasks.length, ["opravilo", "opravili", "opravila", "opravil"])].filter(Boolean).join(" in ")}</span></> : <>Vse je <span className="text-accent-foreground">urejeno</span>. AI dela v ozadju.</>}
            </h1>
          </div>
          <div className="flex gap-2 shrink-0">
            {drafts.length > 0 && <Button asChild className="btn-brand h-10 px-5 rounded-xl"><Link to="/stranke?tab=odgovori">Preglej odgovore <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>}
            {featureOn(business, "campaigns") && drafts.length === 0 && (
              <div className="[&>button]:h-10 [&>button]:rounded-xl"><ReactivationPanel /></div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
        {/* LEVO: Danes */}
        <div className="space-y-5 min-w-0">
          <Panel icon={Inbox} title="Čaka na vaš odgovor" count={drafts.length} to="/stranke?tab=odgovori" cta={drafts.length > 6 ? `Vseh ${drafts.length}` : "Odpri"}>
            {drafts.length === 0 ? <Empty>Vsem ste odgovorili. Ko vam kdo piše, AI tu pripravi odgovor.</Empty> : (
              <ul className="divide-y">
                {drafts.slice(0, 6).map((d) => { const l = leadsById[d.lead_id]; const r = reasonFor(d.pillar); return (
                  <li key={d.id}><Link to={l ? `/stranke/${l.id}` : "/stranke?tab=odgovori"} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40">
                    <DraftIcon />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{l?.name || "Stranka"} <span className="font-normal text-muted-foreground">· {r.label}</span></span><span className="block text-xs text-muted-foreground truncate">{d.subject || String(d.body || "").slice(0, 90)}</span></span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{ago(d.created_date)}</span><ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  </Link></li>
                ); })}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel icon={ListChecks} title="Opravila za danes" count={dueTasks.length} to="/opravila" cta="Vsa opravila">
              {dueTasks.length === 0 ? <Empty>Za danes ni opravil.</Empty> : (
                <ul className="divide-y">
                  {dueTasks.slice(0, 6).map((t) => { const due = dueLabel(t.due_at); const l = leadsById[t.lead_id]; return (
                    <li key={t.id}><Link to={l ? `/stranke/${l.id}` : "/opravila"} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
                      <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      <span className="min-w-0 flex-1"><span className="block text-sm truncate">{t.title}</span>{l && <span className="block text-xs text-muted-foreground truncate">{l.name}</span>}</span>
                      <span className={`text-xs whitespace-nowrap ${due.cls}`}>{due.text}</span>
                    </Link></li>
                  ); })}
                  {dueTasks.length > 6 && <li className="px-5 py-2 text-xs text-muted-foreground">… in še {dueTasks.length - 6}</li>}
                </ul>
              )}
            </Panel>
            <Panel icon={Calendar} title="Termini v 7 dneh" count={upcoming.length} to="/termini" cta="Koledar">
              {upcoming.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">{business?.google_calendar_connected ? "V naslednjih 7 dneh ni dogovorjenih terminov." : "Koledar ni povezan, zato terminov ne vidimo."}</p> : (
                <ul className="divide-y">
                  {upcoming.slice(0, 6).map((b) => { const l = leadsById[b.lead_id]; return (
                    <li key={b.id}><Link to={l ? `/stranke/${l.id}` : "/asistent"} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
                      <span className="w-11 text-center shrink-0"><span className="block text-[10px] uppercase text-muted-foreground">{format(new Date(b.booked_at), "EEE", { locale: sl })}</span><span className="block text-base font-display font-bold leading-none">{format(new Date(b.booked_at), "d")}</span></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm truncate">{l?.name || b.notes || "Termin"}</span><span className="block text-xs text-muted-foreground">{format(new Date(b.booked_at), "HH:mm")}{b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}</span></span>
                    </Link></li>
                  ); })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel icon={CheckCircle2} title="Pomočniki" to="/pomocniki" cta="Vsi pomočniki" tone="text-muted-foreground">
            <ul className="divide-y">
              {helpers.map((h) => (
                <li key={h.title}><Link to={h.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
                  <h.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium w-56 shrink-0 truncate">{h.title}</span>
                  <span className={`text-xs flex-1 min-w-0 truncate inline-flex items-center gap-1.5 ${h.warn ? "text-red-600 font-medium" : h.ok ? "text-emerald-700" : "text-amber-700"}`}><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.warn ? "bg-red-500" : h.ok ? "bg-emerald-500" : "bg-amber-500"}`} />{h.state}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">{h.metric}</span><ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </Link></li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* DESNO: številke, faze, nastavitev */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((k) => { const inner = (
              <div className={`card-elevated p-4 h-full ${k.href ? "card-hover" : ""}`}>
                <p className="text-xs text-muted-foreground flex items-center justify-between">{k.label}<k.icon className="w-3.5 h-3.5 text-muted-foreground/60" /></p>
                <p className="font-display text-2xl font-bold mt-1.5 leading-none">{k.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5">{k.sub}</p>
              </div>
            ); return k.href ? <Link key={k.label} to={k.href}>{inner}</Link> : <div key={k.label}>{inner}</div>; })}
          </div>

          <Panel icon={Users} title="Stranke po fazah" to="/stranke?tab=stranke" cta="Odpri" tone="text-muted-foreground">
            <div className="px-5 py-4 space-y-2.5">
              {STAGES.map((s) => { const n = stageCount(s.key); return (
                <div key={s.key} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 flex items-center gap-2 text-xs"><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}</span>
                  <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><span className={`block h-full rounded-full ${s.dot}`} style={{ width: `${(n / maxStage) * 100}%` }} /></span>
                  <span className="w-8 text-right text-xs font-semibold">{n}</span>
                </div>
              ); })}
            </div>
          </Panel>

          {nextSetup && (
            <section className="card-elevated p-5">
              <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold">Nastavitev</h2><span className="text-xs text-muted-foreground">{setupDone} od {setup.length}</span></div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2"><div className="h-full bg-gradient-to-r from-primary to-[hsl(41,100%,53%)]" style={{ width: `${(setupDone / setup.length) * 100}%` }} /></div>
              <ul className="mt-3 space-y-1">
                {setup.map((s) => (
                  <li key={s.label}><Link to={s.href} className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 ${s === nextSetup ? "bg-accent/60" : ""}`}>
                    {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />}
                    <span className="min-w-0"><span className={`block text-sm ${s.done ? "text-muted-foreground line-through" : "font-medium"}`}>{s.label}</span>{s === nextSetup && <span className="block text-xs text-muted-foreground">{s.hint}</span>}</span>
                    {s === nextSetup && <span className="ml-auto text-xs text-primary font-medium whitespace-nowrap">Naslednji korak</span>}
                  </Link></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
