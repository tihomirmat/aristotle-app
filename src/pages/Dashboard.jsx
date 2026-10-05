import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Star, MessageSquare, FileSignature, ArrowRight, Users, UserPlus, Calendar, CheckCircle2, Circle, Inbox, Send, RotateCcw } from "lucide-react";
import ReactivationPanel from "@/components/dashboard/ReactivationPanel";
import TrialBanner from "@/components/dashboard/TrialBanner";
import StatusBanner from "@/components/ui/StatusBanner";


const greeting = () => { const h = new Date().getHours(); return h < 10 ? "Dobro jutro" : h < 18 ? "Dober dan" : "Dober večer"; };

export default function Dashboard() {
  const { business, user } = useBusiness();

  const { data: drafts = [] } = useQuery({
    queryKey: ["drafts", business?.id],
    queryFn: async () => (await base44.entities.DraftMessage.filter({ business_id: business.id })).filter((d) => d.status === "pending" || d.status === "flagged_for_review"),
    enabled: !!business?.id,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads_all", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: confirmedBookings = [] } = useQuery({
    queryKey: ["confirmed_bookings", business?.id],
    queryFn: () => base44.entities.ConfirmedBooking.filter({ business_id: business.id, status: "confirmed" }),
    enabled: !!business?.id,
  });

  const { data: convs = [] } = useQuery({
    queryKey: ["convs_dash", business?.id],
    queryFn: () => base44.entities.ChatbotConversation.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: kb = [] } = useQuery({
    queryKey: ["kb_dash", business?.id],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: offers = [] } = useQuery({
    queryKey: ["offers_dash", business?.id],
    queryFn: () => base44.entities.OfferGeneration.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: allDrafts = [] } = useQuery({
    queryKey: ["drafts-all", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
  const weekFromNow = new Date(); weekFromNow.setDate(now.getDate() + 7);
  const leadsThisMonth = leads.filter((l) => new Date(l.created_date) >= startOfMonth).length;
  const leadsThisWeek = leads.filter((l) => new Date(l.created_date) >= weekAgo).length;
  const bookingsThisWeek = confirmedBookings.filter((b) => b.booked_at && new Date(b.booked_at) >= now && new Date(b.booked_at) <= weekFromNow).length;

  const emailReady = (business?.email_provider === "smtp" && business?.smtp_host && business?.smtp_user) || !!business?.gmail_email || !!business?.outlook_email;
  const setup = [
    { done: !!business?.website && !!business?.services, label: "Profil podjetja", hint: "Ime, storitve, spletna stran — iz tega AI piše sporočila.", href: "/nastavitve?tab=profil" },
    { done: !!business?.brand_voice, label: "Glas znamke", hint: "Kako naj zvenijo vaša sporočila.", href: "/nastavitve?tab=glas" },
    { done: !!business?.imap_enabled, label: "E-poštni predal", hint: "AI najde povpraševanja v vaši pošti in odgovarja z vašega naslova.", href: "/nastavitve?tab=integracije" },
    { done: leads.some((l) => l.source === "form" || l.source === "chatbot"), label: "Obrazec ali klepet na strani", hint: "Da tudi obiskovalci spletne strani postanejo stranke.", href: "/stranke?tab=viri" },
    { done: !!business?.google_calendar_connected, label: "Google Koledar", hint: "Asistent predlaga proste termine.", href: "/nastavitve?tab=termini" },
  ];
  const setupDone = setup.filter((s) => s.done).length;
  const showSetup = setupDone < setup.length;

  const trialSendsOut = business?.subscription_status === "trialing" && (business?.trial_sends_remaining ?? 20) <= 0;
  const trialCostOut = business?.subscription_status === "trialing" && (business?.trial_cost_used_eur ?? 0) >= (business?.trial_cost_cap_eur ?? 0.45);

  const kpis = [
    { label: "Stranke", value: leads.length, sub: leadsThisWeek > 0 ? `+${leadsThisWeek} ta teden` : "brez novih ta teden", icon: Users },
    { label: "Nova povpraševanja ta mesec", value: leadsThisMonth, sub: "iz obrazca in klepeta", icon: UserPlus },
    { label: "Čaka na vaš odgovor", value: drafts.length, sub: drafts.length > 0 ? "čakajo na vaš klik" : "nič ne čaka", icon: Inbox, href: "/stranke?tab=odgovori", highlight: drafts.length > 0 },
    { label: "Termini ta teden", value: bookingsThisWeek, sub: business?.google_calendar_connected ? "iz Google Koledarja" : "koledar ni povezan", icon: Calendar },
  ];

  const monthAgo = new Date(); monthAgo.setDate(now.getDate() - 30);
  const sentThisWeek = allDrafts.filter((d) => d.status === "sent" && d.sent_at && new Date(d.sent_at) >= weekAgo);
  const convsThisWeek = convs.filter((c) => new Date(c.started_at || c.created_date) >= weekAgo).length;
  const dormant = leads.filter((l) => l.email && l.consent_email && !["unsubscribed", "converted", "lost"].includes(l.status) && (!l.last_contacted_at || new Date(l.last_contacted_at) <= monthAgo)).length;
  const reviewsSent = allDrafts.filter((d) => d.pillar === "review_request" && d.status === "sent").length;
  const statusCards = [
    { title: "Povpraševanja iz e-pošte", icon: Mail, tone: "from-primary to-[hsl(41,100%,53%)]", href: business?.imap_enabled ? "/stranke" : "/nastavitve?tab=integracije",
      ok: !!business?.imap_enabled, state: business?.imap_enabled ? (business?.imap_last_error ? "Napaka pri branju pošte" : "Predal povezan, berem vsakih 10 min") : "Predal ni povezan",
      metric: leads.filter((l) => l.source === "email" && new Date(l.created_date) >= weekAgo).length, metricLabel: "novih iz pošte ta teden", cta: business?.imap_enabled ? "Odpri stranke" : "Poveži predal" },
    { title: "Spletni klepet", icon: MessageSquare, tone: "from-violet-600 to-indigo-500", href: "/klepet",
      ok: kb.length > 0 && convs.length > 0, state: kb.length === 0 ? "Klepet še ne pozna vašega podjetja" : convs.length === 0 ? "Še ni vstavljen na spletno stran" : "Deluje",
      metric: convsThisWeek, metricLabel: "pogovorov ta teden", cta: kb.length === 0 ? "Naučite ga iz spletne strani" : "Odpri klepet" },
    { title: "Odgovori strankam", icon: Send, tone: "from-emerald-500 to-teal-400", href: "/stranke?tab=odgovori",
      ok: drafts.length === 0, state: drafts.length > 0 ? `${drafts.length} čaka na vašo odobritev` : "Nič ne čaka",
      metric: sentThisWeek.length, metricLabel: "poslanih ta teden", cta: drafts.length > 0 ? "Preglej in pošlji" : "Odpri" },
    { title: "Vrnite stare stranke", icon: RotateCcw, tone: "from-blue-700 to-blue-500", href: "/stranke",
      ok: dormant === 0, state: dormant > 0 ? "Gumb »Vrnite stare stranke« zgoraj" : "Ni strank za vabilo",
      metric: dormant, metricLabel: "strank brez stika 30+ dni", cta: "Poglej stranke" },
    { title: "Google ocene", icon: Star, tone: "from-amber-500 to-orange-400", href: "/ocene",
      ok: !!business?.google_review_link, state: business?.google_review_link ? "Prošnje gredo po vsaki zaključeni storitvi" : "Dodajte povezavo za ocene",
      metric: reviewsSent, metricLabel: "poslanih prošenj za oceno", cta: business?.google_review_link ? "Odpri ocene" : "Dodaj povezavo" },
    { title: "Ponudbe", icon: FileSignature, tone: "from-slate-700 to-slate-500", href: "/ponudbe",
      ok: offers.length > 0, state: offers.length > 0 ? "V uporabi" : "Pripravite prvo ponudbo",
      metric: offers.length, metricLabel: "pripravljenih ponudb", cta: "Nova ponudba" },
  ];

  const firstName = (user?.full_name || "").split(" ")[0];

  return (
    <div className="space-y-6">
      <TrialBanner business={business} />
      {trialSendsOut && <StatusBanner variant="warning" message="Porabili ste vse brezplačne pošiljke preizkusa (20). Aktivirajte naročnino za nadaljevanje pošiljanja." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />}
      {trialCostOut && !trialSendsOut && <StatusBanner variant="warning" message="AI kredit za preizkus je porabljen. Aktivirajte naročnino za nova sporočila." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-space bg-space-stars text-white p-7 md:p-9">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-sm text-white/70">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
            <h1 className="text-white mt-1 text-3xl md:text-4xl">
              {drafts.length > 0
                ? <>{drafts.length} {drafts.length === 1 ? "sporočilo čaka" : drafts.length < 5 ? "sporočila čakajo" : "sporočil čaka"} na vaš <span className="text-gradient-brand">klik</span>.</>
                : <>Vse je <span className="text-gradient-brand">urejeno</span>. AI dela v ozadju.</>}
            </h1>
            <p className="text-white/70 mt-2 max-w-xl text-sm md:text-[15px]">
              AI Aristotle odgovarja novim strankam, vabi stare nazaj in prosi za ocene. Vi odobrite, kar gre ven.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {drafts.length > 0 && (
              <Button asChild className="btn-brand h-11 px-5 rounded-xl text-[15px]">
                <Link to="/stranke?tab=odgovori">Preglej sporočila <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
            )}
            <div className="[&>button]:h-11 [&>button]:rounded-xl [&>button]:bg-white/10 [&>button]:border-white/20 [&>button]:text-white [&>button:hover]:bg-white/20">
              <ReactivationPanel />
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const inner = (
            <div className={`card-elevated p-5 h-full ${k.href ? "card-hover" : ""} ${k.highlight ? "ring-2 ring-primary/40" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">{k.label}</p>
                <Icon className={`w-4 h-4 ${k.highlight ? "text-primary" : "text-muted-foreground/60"}`} />
              </div>
              <p className="font-display text-3xl font-bold mt-2 leading-none">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-2">{k.sub}</p>
            </div>
          );
          return k.href ? <Link key={k.label} to={k.href}>{inner}</Link> : <div key={k.label}>{inner}</div>;
        })}
      </div>

      {/* Setup checklist */}
      {showSetup && (
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg">Nastavite AI Aristotla v 5 korakih</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Opravljeno {setupDone} od {setup.length}. Vsak korak vzame nekaj minut.</p>
            </div>
            <div className="w-40 h-2 rounded-full bg-muted overflow-hidden hidden sm:block">
              <div className="h-full bg-gradient-to-r from-primary to-[hsl(41,100%,53%)] transition-all" style={{ width: `${(setupDone / setup.length) * 100}%` }} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {setup.map((s) => (
              <Link key={s.label} to={s.href} className={`rounded-xl border p-4 transition-colors ${s.done ? "border-emerald-200 bg-emerald-50/50" : "border-border hover:border-primary/40 hover:bg-accent/40"}`}>
                {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5 text-muted-foreground/50" />}
                <p className="text-sm font-semibold mt-2">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Kaj se dogaja — stanje vsakega dela aplikacije */}
      <div>
        <h2 className="text-lg mb-3">Kaj se dogaja</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {statusCards.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.title} to={c.href} className="card-elevated card-hover p-5 flex flex-col">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.tone} flex items-center justify-center shrink-0`}><Icon className="w-[18px] h-[18px] text-white" /></div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold">{c.title}</h3>
                    <p className={`text-xs mt-0.5 ${c.ok ? "text-emerald-700" : "text-amber-700"}`}>{c.state}</p>
                  </div>
                </div>
                <p className="font-display text-2xl font-bold mt-4">{c.metric}</p>
                <p className="text-xs text-muted-foreground">{c.metricLabel}</p>
                <p className="text-sm font-medium mt-4 text-primary inline-flex items-center gap-1">{c.cta} <ArrowRight className="w-3.5 h-3.5" /></p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
