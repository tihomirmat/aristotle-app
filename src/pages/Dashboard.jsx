import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Lock, Mail, Star, Globe, MessageSquare, Bot, BarChart3, ArrowRight, Users, UserPlus, Calendar, TrendingUp } from "lucide-react";
import ReactivationPanel from "@/components/dashboard/ReactivationPanel";

const PILLARS = [
  { key: "pillar_reactivation", label: "Reaktivacija strank", desc: "Avtomatska reaktivacija neaktivnih strank po e-pošti.", icon: Mail, color: "bg-blue-500", href: "/prejeto", stat_label: "sporočil ta teden", plans: ["starter","growth","scale"] },
  { key: "pillar_reviews", label: "Ocene & napotitve", desc: "Avtomatske prošnje za Google ocene in napotitve.", icon: Star, color: "bg-amber-500", href: "/ocene", stat_label: "prošenj ta teden", plans: ["starter","growth","scale"] },
  { key: "pillar_leads", label: "Pridobivanje & CRM", desc: "Webhook, embed forma in upravljanje leadov. Brezplačen modul.", icon: Globe, color: "bg-emerald-500", href: "/pridobivanje", stat_label: "novih strank ta teden", plans: ["starter","growth","scale"], always_on: true },
  { key: "pillar_chatbot", label: "Klepetalni pomočnik", desc: "AI klepetalni widget na vašem spletnem mestu.", icon: MessageSquare, color: "bg-violet-500", href: "/klepet", stat_label: "pogovorov ta teden", plans: ["starter","growth","scale"] },
  { key: "pillar_assistant", label: "Osebni asistent", desc: "AI asistent za upravljanje terminov in dnevnih nalog.", icon: Bot, color: "bg-rose-500", href: "/asistent", stat_label: "akcij ta teden", plans: ["growth","scale"], min_plan: "growth" },
  { key: "pillar_digest", label: "Tedenski povzetek", desc: "Avtomatski tedenski poročili vsak ponedeljek.", icon: BarChart3, color: "bg-indigo-500", href: "/asistent", stat_label: "poročil", plans: ["scale"], min_plan: "scale" },
];

const PLAN_ORDER = ["free", "starter", "growth", "scale"];

function planGte(userPlan, minPlan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan);
}

export default function Dashboard() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const { data: drafts = [] } = useQuery({
    queryKey: ["drafts", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id, status: "pending" }),
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

  const plan = business?.plan || "starter";

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
    { label: "Leadi ta mesec", value: leadsThisMonth, icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-50", delta: null },
    { label: "Čakajoči drafts", value: drafts.length, icon: Mail, color: "text-amber-600", bg: "bg-amber-50", delta: drafts.length > 0 ? "čaka na odobritev" : null },
    { label: "Rezervacije ta teden", value: bookingsThisWeek, icon: Calendar, color: "text-violet-600", bg: "bg-violet-50", delta: null },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pregled</h1>
          <p className="text-muted-foreground mt-1">Dobrodošli. Tukaj je pregled vašega sistema.</p>
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
              <p className="font-semibold text-amber-900">Imate {drafts.length} sporočil za pregled</p>
              <p className="text-sm text-amber-700">Kliknite za odobritev ali urejanje.</p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-700 shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PILLARS.map((pillar) => {
          const enabled = pillar.always_on ? true : (business?.[pillar.key] || false);
          const canUse = !pillar.min_plan || planGte(plan, pillar.min_plan);
          const Icon = pillar.icon;

          return (
            <Card key={pillar.key} className={`border-0 shadow-sm transition-opacity ${!enabled && canUse ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${pillar.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{pillar.label}</CardTitle>
                      {!canUse && (
                        <Badge variant="outline" className="text-xs mt-0.5 border-amber-300 text-amber-600">
                          <Lock className="w-2.5 h-2.5 mr-1" />
                          {pillar.min_plan === "growth" ? "Growth+" : "Scale"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {canUse && business?.id && !pillar.always_on && (
                    <Switch checked={enabled} onCheckedChange={(v) => toggleMutation.mutate({ key: pillar.key, val: v })} />
                  )}
                  {pillar.always_on && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Brezplačno</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">{pillar.desc}</p>
                {!canUse ? (
                  <Button size="sm" variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50" asChild>
                    <Link to="/nastavitve?tab=billing">Nadgradi načrt</Link>
                  </Button>
                ) : enabled ? (
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link to={pillar.href}>Odpri <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="w-full text-muted-foreground" onClick={() => toggleMutation.mutate({ key: pillar.key, val: true })}>
                    Aktiviraj
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