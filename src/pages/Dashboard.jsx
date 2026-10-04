import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Star, Globe, MessageSquare, Bot, BarChart3, ArrowRight, Users, UserPlus, Calendar } from "lucide-react";
import ReactivationPanel from "@/components/dashboard/ReactivationPanel";
import { hasModule } from "@/lib/entitlements";
import TrialBanner from "@/components/dashboard/TrialBanner";
import StatusBanner from "@/components/ui/StatusBanner";

const PILLARS = [
  { key: "pillar_leads", label: "Nova povpraševanja", desc: "Obrazec za vašo spletno stran. Vsaka nova stranka v nekaj minutah dobi oseben odgovor, ki ga vi samo odobrite.", icon: Globe, color: "bg-emerald-500", href: "/pridobivanje" },
  { key: "pillar_chatbot", label: "Spletni klepet", desc: "AI odgovarja obiskovalcem vaše spletne strani 24/7 in vam preda tiste, ki pustijo kontakt.", icon: MessageSquare, color: "bg-violet-500", href: "/klepet" },
  { key: "pillar_reactivation", label: "Vrnite stare stranke", desc: "Strankam, ki jih dolgo ni bilo, AI napiše osebno vabilo. Vi pregledate in pošljete z enim klikom.", icon: Mail, color: "bg-blue-500", href: "/prejeto" },
  { key: "pillar_reviews", label: "Google ocene", desc: "Po opravljeni storitvi AI prosi stranko za Google oceno in za priporočilo prijateljem.", icon: Star, color: "bg-amber-500", href: "/ocene" },
  { key: "pillar_assistant", label: "Asistent", desc: "Dnevni pregled: kaj vas čaka, kateri termini so odprti, komu morate odgovoriti.", icon: Bot, color: "bg-rose-500", href: "/asistent" },
  { key: "pillar_offers", label: "Ponudbe", desc: "Iz vaše obstoječe ponudbe naredi predlogo; nova ponudba v PDF je pripravljena v nekaj minutah.", icon: BarChart3, color: "bg-indigo-500", href: "/ponudbe" },
];



export default function Dashboard() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const { data: drafts = [] } = useQuery({
    queryKey: ["drafts", business?.id],
    // Čakajoči = pending + flagged_for_review (enako kot Prejeto)
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

  const toggleMutation = useMutation({
    mutationFn: ({ key, val }) => base44.entities.Business.update(business.id, { [key]: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business"] }),
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
  const weekFromNow = new Date(); weekFromNow.setDate(now.getDate() + 7);

  const leadsThisMonth = leads.filter((l) => new Date(l.created_date) >= startOfMonth).length;
  const bookingsThisWeek = confirmedBookings.filter((b) => {
    if (!b.booked_at) return false;
    const d = new Date(b.booked_at);
    return d >= now && d <= weekFromNow;
  }).length;

  const kpis = [
    { label: "Stranke skupaj", value: leads.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50", delta: leads.filter((l) => new Date(l.created_date) >= weekAgo).length > 0 ? `+${leads.filter((l) => new Date(l.created_date) >= weekAgo).length} ta teden` : null },
    { label: "Nova povpraševanja ta mesec", value: leadsThisMonth, icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-50", delta: null },
    { label: "Sporočila za odobritev", value: drafts.length, icon: Mail, color: "text-amber-600", bg: "bg-amber-50", delta: drafts.length > 0 ? "čakajo na vaš klik" : "nič ne čaka" },
    { label: "Termini ta teden", value: bookingsThisWeek, icon: Calendar, color: "text-violet-600", bg: "bg-violet-50", delta: null },
  ];

  // Trial exhaustion banners
  const trialSendsOut = business?.subscription_status === "trialing" && (business?.trial_sends_remaining ?? 20) <= 0;
  const trialCostOut = business?.subscription_status === "trialing" && (business?.trial_cost_used_eur ?? 0) >= (business?.trial_cost_cap_eur ?? 0.45);
  const noEmailProvider = !business?.email_provider && !business?.gmail_access_token && !business?.outlook_access_token && !business?.smtp_host;

  return (
    <div>
      <TrialBanner business={business} />
      {trialSendsOut && (
        <StatusBanner variant="warning" message="Porabili ste vse brezplačne pošiljke preizkusa (20). Aktivirajte naročnino za nadaljevanje pošiljanja." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />
      )}
      {trialCostOut && !trialSendsOut && (
        <StatusBanner variant="warning" message="AI kredit za preizkus je porabljen. Aktivirajte naročnino za generiranje novih osnutkov." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />
      )}
      {noEmailProvider && business?.onboarding_complete && (
        <StatusBanner variant="info" message="E-pošta ni nastavljena. Povežite Gmail, Outlook ali SMTP, da bo sistem lahko pošiljal sporočila." action={{ label: "Nastavi", href: "/nastavitve?tab=integracije" }} />
      )}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pregled</h1>
          <p className="text-muted-foreground mt-1">{business?.name ? `${business.name} — ` : ""}kaj se dogaja z vašimi strankami.</p>
        </div>
        <ReactivationPanel />
      </div>

      {/* KPI KARTICE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className="text-3xl font-bold leading-none">{kpi.value}</p>
                <p className="text-sm text-muted-foreground mt-1.5">{kpi.label}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{kpi.delta || "—"}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {drafts.length > 0 && (
        <Link to="/prejeto" className="block mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between hover:bg-amber-100 transition-colors">
            <div>
              <p className="font-semibold text-amber-900">{drafts.length} {drafts.length === 1 ? "sporočilo čaka" : drafts.length < 5 ? "sporočila čakajo" : "sporočil čaka"} na vašo odobritev</p>
              <p className="text-sm text-amber-700">AI jih je pripravil za vaše stranke. Nič se ne pošlje brez vašega klika.</p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-700 shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PILLARS.map((pillar) => {
          const enabled = pillar.always_on ? true : hasModule(business, pillar.key);
          const Icon = pillar.icon;

          return (
            <Card key={pillar.key} className={`border-0 shadow-sm transition-opacity ${!enabled ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${pillar.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{pillar.label}</CardTitle>
                    </div>
                  </div>
                  {pillar.always_on && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Brezplačno</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">{pillar.desc}</p>
                {enabled ? (
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link to={pillar.href}>Odpri <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50" asChild>
                    <Link to="/nastavitve?tab=billing">Aktiviraj modul</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}