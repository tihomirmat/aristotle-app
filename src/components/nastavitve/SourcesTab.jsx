import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import LeadSources from "@/components/stranke/LeadSources";
import CustomerImportModal from "@/components/stranke/CustomerImportModal";

// Nastavitve → Viri strank: kje aplikacija dobi stranke (pošta, obrazec, klepet, uvoz).
export default function SourcesTab({ business }) {
  const [showImport, setShowImport] = useState(false);
  const { data: leads = [] } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Viri strank</h3>
        <p className="text-sm text-muted-foreground mt-1">Tukaj nastavite, od kod aplikacija dobi nove stranke. Pregled z grafom je v Stranke → Od kod pridejo.</p>
      </div>
      <LeadSources leads={leads} onImport={() => setShowImport(true)} />
      <CustomerImportModal open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
