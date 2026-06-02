import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-sky-100 text-sky-700",
  past_due: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const BILLING_MODE_COLORS = {
  trial: "bg-sky-50 text-sky-600",
  alacarte: "bg-violet-50 text-violet-600",
  bundle: "bg-amber-50 text-amber-600",
};

const ALL_PILLARS = [
  "pillar_reactivation",
  "pillar_reviews",
  "pillar_leads",
  "pillar_chatbot",
  "pillar_assistant",
];

export default function AdminBusinesses() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [simulating, setSimulating] = useState(null);

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ["admin-businesses"],
    queryFn: () => base44.entities.Business.list("-created_date"),
  });

  const handleMarkPaymentSucceeded = async (biz, isBundle) => {
    setSimulating(biz.id);
    const pillarUpdates = {};
    ALL_PILLARS.forEach(k => { pillarUpdates[k] = true; });
    pillarUpdates.pillar_digest = true;

    await base44.entities.Business.update(biz.id, {
      ...pillarUpdates,
      subscription_status: "active",
      billing_mode: isBundle ? "bundle" : "alacarte",
      bundle_active: isBundle,
      integration_fee_paid: true,
    });

    await queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
    setSimulating(null);
    toast.success(`${biz.name}: plačilo simulirano ✓`);
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">All Businesses</h1>
        <p className="text-muted-foreground mt-1">Admin view — all tenants ({businesses.length} total)</p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Business</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">MRR Est.</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Last Activity</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Churn Risk</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {businesses.map((biz) => {
              const daysSinceActivity = biz.last_activity_at
                ? differenceInDays(new Date(), new Date(biz.last_activity_at))
                : null;
              const churnRisk = daysSinceActivity !== null && daysSinceActivity >= 7;
              const activePillars = ALL_PILLARS.filter(k => biz[k]);
              const mrr = biz.bundle_active ? 399 : activePillars.length * 99;
              const isExpanded = expandedId === biz.id;

              return (
                <React.Fragment key={biz.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{biz.name}</p>
                      <p className="text-xs text-muted-foreground">{biz.industry_template || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[biz.subscription_status] || "bg-gray-100"}`}>
                        {biz.subscription_status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BILLING_MODE_COLORS[biz.billing_mode] || "bg-gray-50 text-gray-500"}`}>
                        {biz.billing_mode || "trial"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-medium">{mrr > 0 ? `€${mrr}` : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {biz.last_activity_at ? format(new Date(biz.last_activity_at), "d MMM yyyy") : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {churnRisk ? (
                        <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />{daysSinceActivity}d inactive
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {biz.subscription_status !== "active" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              disabled={simulating === biz.id}
                              onClick={() => handleMarkPaymentSucceeded(biz, false)}
                            >
                              {simulating === biz.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              A la carte
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
                              disabled={simulating === biz.id}
                              onClick={() => handleMarkPaymentSucceeded(biz, true)}
                            >
                              {simulating === biz.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              Bundle
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 px-2"
                          onClick={() => setExpandedId(isExpanded ? null : biz.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/20">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Aktivni moduli</p>
                            {activePillars.length === 0 ? <p className="text-muted-foreground">Noben</p> : activePillars.map(k => (
                              <p key={k} className="text-emerald-600">✓ {k.replace("pillar_", "")}</p>
                            ))}
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Trial</p>
                            <p>Ends: {biz.trial_ends_at ? format(new Date(biz.trial_ends_at), "d MMM yyyy") : "—"}</p>
                            <p>Sends left: {biz.trial_sends_remaining ?? 20}</p>
                            <p>Cost used: €{(biz.trial_cost_used_eur || 0).toFixed(3)}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Billing</p>
                            <p>Mode: {biz.billing_mode || "trial"}</p>
                            <p>Bundle: {biz.bundle_active ? "Da" : "Ne"}</p>
                            <p>Integration fee: {biz.integration_fee_paid ? "Plačano" : "Ni plačano"}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Business ID</p>
                            <p className="font-mono break-all">{biz.id}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}