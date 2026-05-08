import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { differenceInDays, format } from "date-fns";

const PLAN_COLORS = { free: "bg-gray-100 text-gray-600", starter: "bg-blue-100 text-blue-700", growth: "bg-violet-100 text-violet-700", scale: "bg-amber-100 text-amber-700" };
const STATUS_COLORS = { active: "bg-emerald-100 text-emerald-700", trialing: "bg-sky-100 text-sky-700", past_due: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-500" };

export default function AdminBusinesses() {
  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ["admin-businesses"],
    queryFn: () => base44.entities.Business.list("-created_date"),
  });

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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">MRR Est.</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Last Activity</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Churn Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {businesses.map((biz) => {
              const daysSinceActivity = biz.last_activity_at
                ? differenceInDays(new Date(), new Date(biz.last_activity_at))
                : null;
              const churnRisk = daysSinceActivity !== null && daysSinceActivity >= 7;
              const mrr = biz.plan === "starter" ? 49 : biz.plan === "growth" ? 99 : biz.plan === "scale" ? 199 : 0;

              return (
                <tr key={biz.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{biz.name}</p>
                    <p className="text-xs text-muted-foreground">{biz.industry_template || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[biz.plan] || "bg-gray-100 text-gray-600"}`}>{biz.plan || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[biz.subscription_status] || "bg-gray-100"}`}>{biz.subscription_status || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell font-medium">{mrr > 0 ? `€${mrr}` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {biz.last_activity_at ? format(new Date(biz.last_activity_at), "d MMM yyyy") : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    {churnRisk ? (
                      <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {daysSinceActivity}d inactive
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}