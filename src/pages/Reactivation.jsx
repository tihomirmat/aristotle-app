import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomerImport from "@/components/reactivation/CustomerImport";
import CustomerTable from "@/components/reactivation/CustomerTable";
import CampaignBuilder from "@/components/reactivation/CampaignBuilder";
import CampaignList from "@/components/reactivation/CampaignList";

export default function Reactivation() {
  const [tab, setTab] = useState("customers");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => base44.entities.Campaign.list("-created_date"),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.BusinessSettings.list(),
  });

  const webhookUrl = settings[0]?.webhook_url || "";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Database Reactivation</h1>
        <p className="text-muted-foreground mt-1">
          Import customers, segment your list, and send reactivation campaigns.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="campaign">New Campaign</TabsTrigger>
          <TabsTrigger value="results">Campaign Results</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-6">
          <CustomerImport />
          <CustomerTable customers={customers} />
        </TabsContent>

        <TabsContent value="campaign" className="space-y-6">
          <CampaignBuilder
            customerCount={customers.length}
            segmentFilter={{}}
            webhookUrl={webhookUrl}
          />
        </TabsContent>

        <TabsContent value="results">
          <CampaignList campaigns={campaigns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}