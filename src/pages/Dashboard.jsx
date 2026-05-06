import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, UserPlus, Star, PhoneMissed, DollarSign } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInDays, startOfMonth } from "date-fns";

export default function Dashboard() {
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list(),
  });

  const now = new Date();
  const monthStart = startOfMonth(now);

  const totalCustomers = customers.length;
  const leadsThisMonth = customers.filter(
    (c) => new Date(c.created_date) >= monthStart
  ).length;
  const lapsedCustomers = customers.filter(
    (c) => c.last_visit_date && differenceInDays(now, new Date(c.last_visit_date)) > 90
  ).length;
  const reactivatedCount = customers.filter((c) => c.status === "reactivated").length;
  const revenueRecovered = campaigns.reduce((sum, c) => sum + (c.revenue_recovered || 0), 0);

  const kpis = [
    { label: "Customers in Database", value: totalCustomers, icon: Users, color: "bg-indigo-500", trend: 12 },
    { label: "Leads This Month", value: leadsThisMonth, icon: UserPlus, color: "bg-emerald-500", trend: 8 },
    { label: "Lapsed (90+ days)", value: lapsedCustomers, icon: PhoneMissed, color: "bg-amber-500", trend: -5 },
    { label: "Reactivated", value: reactivatedCount, icon: Star, color: "bg-violet-500", trend: 22 },
    { label: "Revenue Recovered", value: `$${revenueRecovered.toLocaleString()}`, icon: DollarSign, color: "bg-rose-500", trend: 15 },
  ];

  const recentCampaigns = campaigns.slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back. Here's your business overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No campaigns yet. Create one in Database Reactivation.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{campaign.status} · {campaign.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{campaign.sent_count || 0} sent</p>
                      <p className="text-xs text-muted-foreground">{campaign.replied_count || 0} replied</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction label="Import Customer Database" desc="Upload CSV with your customer list" href="/reactivation" />
            <QuickAction label="Create Reactivation Campaign" desc="Win back lapsed customers" href="/reactivation" />
            <QuickAction label="Configure Webhook" desc="Connect to n8n automation" href="/settings" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ label, desc, href }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-accent transition-colors group"
    >
      <div>
        <p className="font-medium text-sm group-hover:text-accent-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <span className="text-muted-foreground group-hover:text-accent-foreground">→</span>
    </a>
  );
}