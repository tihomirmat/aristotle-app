import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { scanWebsite } from "@/functions/scanWebsite";
import { fnError } from "@/lib/fn-error";

// »Naučite klepet iz spletne strani«: prebere do 8 strani in zapiše znanje, iz katerega klepet odgovarja.
// Prejšnji vnosi iz spletne strani (kategorija »Spletna stran«) se zamenjajo; ročni vnosi ostanejo.
export default function WebsiteLearnCard({ docs = [] }) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(business?.website || "");
  const [busy, setBusy] = useState(false);
  const fromSite = docs.filter((d) => d.category === "Spletna stran");

  const run = async () => {
    setBusy(true);
    try {
      const res = await scanWebsite({ url, business_id: business.id });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      const knowledge = data.data?.knowledge || [];
      if (!knowledge.length) throw new Error("Na strani nismo našli dovolj besedila. Dodajte znanje ročno spodaj.");
      await Promise.all(fromSite.map((d) => base44.entities.KnowledgeBase.delete(d.id)));
      await Promise.all(knowledge.map((k) => base44.entities.KnowledgeBase.create({
        business_id: business.id, title: String(k.title).slice(0, 120), content: String(k.content).slice(0, 4000),
        category: "Spletna stran", active: true, owner_email: business.owner_email || business.created_by,
      })));
      if (!business.website) await base44.entities.Business.update(business.id, { website: data.data.website });
      queryClient.invalidateQueries({ queryKey: ["kb", business.id] });
      queryClient.invalidateQueries({ queryKey: ["kb_dash", business.id] });
      toast.success(`Prebrali smo ${data.data.pages_read} strani in zapisali ${knowledge.length} vnosov znanja.`);
    } catch (e) { toast.error(fnError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="card-elevated p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shrink-0"><Globe className="w-5 h-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg">Naučite klepet iz spletne strani</h3>
          <p className="text-sm text-muted-foreground mt-1">Vnesite svojo spletno stran. Preberemo storitve, cene, kontakt in pogosta vprašanja, klepet pa odgovarja samo iz tega, kar piše na strani in spodaj.</p>
          {fromSite.length > 0 && <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {fromSite.length} vnosov iz spletne strani. Ponovno branje jih osveži.</p>}
          <div className="flex gap-2 mt-4 max-w-xl">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.vase-podjetje.si" onKeyDown={(e) => e.key === "Enter" && url && run()} />
            <Button className="btn-brand shrink-0" onClick={run} disabled={busy || !url}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {busy ? "Berem stran …" : fromSite.length ? "Preberi znova" : "Preberi stran"}
            </Button>
          </div>
          {busy && <p className="text-xs text-muted-foreground mt-2">Traja 10–30 sekund.</p>}
        </div>
      </div>
    </div>
  );
}
