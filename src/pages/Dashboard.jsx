import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Star, Globe, MessageSquare, Bot, FileSignature, ArrowRight, Users, UserPlus, Calendar, CheckCircle2, Circle, Inbox } from "lucide-react";
import ReactivationPanel from "@/components/dashboard/ReactivationPanel";
import { hasModule } from "@/lib/entitlements";
import TrialBanner from "@/components/dashboard/TrialBanner";
import StatusBanner from "@/components/ui/StatusBanner";

const MODULES = [
  { key: "pillar_leads", label: "Nova povpraševanja", desc: "Obrazec za vašo spletno stran. Vsaka nova stranka v nekaj minutah dobi oseben odgovor, ki ga vi samo odobrite.", icon: Globe, tone: "from-emerald-500 to-teal-400", href: "/pridobivanje" },
  { key: "pillar_chatbot", label: "Spletni klepet", desc: "AI odgovarja obiskovalcem vaše spletne strani 24/7 in vam preda tiste, ki pustijo kontakt.", icon: MessageSquare, tone: "from-violet-600 to-indigo-500", href: "/klepet" },
  { key: "pillar_reactivation", label: "Vrnite stare stranke", desc: "Strankam, ki jih dolgo ni bilo, AI napiše osebno vabilo. Vi pregledate in pošljete z enim klikom.", icon: Mail, tone: "from-blue-700 to-blue-500", href: "/prejeto" },
  { key: "pillar_reviews", label: "Google ocene", desc: "Po opravljeni storitvi AI prosi stranko za Google oceno in za priporočilo prijateljem.", icon: Star, tone: "from-amber-500 to-orange-400", href: "/ocene" },
  { key: "pillar_assistant", label: "Asistent", desc: "Dnevni pregled: kaj vas čaka, kateri termini so odprti, komu morate odgovoriti.", icon: Bot, tone: "from-rose-600 to-orange-500", href: "/asistent" },
  { key: "pillar_offers", label: "Ponudbe", desc: "Iz vaše obstoječe ponudbe naredi predlogo; nova ponudba v PDF je pripravljena v nekaj minutah.", icon: FileSignature, tone: "from-slate-700 to-slate-500", href: "/ponudbe" },
];

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
    { done: !!emailReady, label: "Pošiljanje z vašega naslova", hint: "Da sporočila pridejo z vašega e-naslova, ne od nas.", href: "/nastavitve?tab=integracije" },
    { done: leads.length > 0, label: "Obrazec na spletni strani", hint: "Vstavite obrazec ali klepet; prvo povpraševanje to označi.", href: "/pridobivanje" },
    { done: !!business?.google_calendar_connected, label: "Google Koledar", hint: "Asistent predlaga proste termine.", href: "/nastavitve?tab=termini" },
  ];
  const setupDone = setup.filter((s) => s.done).length;
  const showSetup = setupDone < setup.length;

  const trialSendsOut = business?.subscription_status === "trialing" && (business?.trial_sends_remaining ?? 20) <= 0;
  const trialCostOut = business?.subscription_status === "trialing" && (business?.trial_cost_used_eur ?? 0) >= (business?.trial_cost_cap_eur ?? 0.45);

  const kpis = [
    { label: "Stranke", value: leads.length, sub: leadsThisWeek > 0 ? `+${leadsThisWeek} ta teden` : "brez novih ta teden", icon: Users },
    { label: "Nova povpraševanja ta mesec", value: leadsThisMonth, sub: "iz obrazca in klepeta", icon: UserPlus },
    { label: "Za odobritev", value: drafts.length, sub: drafts.length > 0 ? "čakajo na vaš klik" : "nič ne čaka", icon: Inbox, href: "/prejeto", highlight: drafts.length > 0 },
    { label: "Termini ta teden", value: bookingsThisWeek, sub: business?.google_calendar_connected ? "iz Google Koledarja" : "koledar ni povezan", icon: Calendar },
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
                <Link to="/prejeto">Preglej sporočila <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
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

      {/* Moduli */}
      <div>
        <h2 className="text-lg mb-3">Kaj AI Aristotle dela za vas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MODULES.map((m) => {
            const enabled = hasModule(business, m.key);
            const Icon = m.icon;
            return (
              <Link key={m.key} to={enabled ? m.href : "/nastavitve?tab=billing"} className={`card-elevated card-hover p-5 flex flex-col ${!enabled ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.tone} flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon className="w-[18px] h-[18px] text-white" />
                  </div>
                  <h3 className="text-[15px] font-semibold">{m.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-3 flex-1">{m.desc}</p>
                <p className={`text-sm font-medium mt-4 inline-flex items-center gap-1 ${enabled ? "text-primary" : "text-amber-700"}`}>
                  {enabled ? "Odpri" : "Ni v naročnini"} <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
