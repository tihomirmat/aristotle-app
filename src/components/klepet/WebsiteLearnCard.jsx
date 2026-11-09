import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { scanWebsite } from "@/functions/scanWebsite";
import { fnError } from "@/lib/fn-error";

// Prebere do 8 strani spletne strani in zapiše znanje, iz katerega klepet odgovarja.
// Prejšnji zapisi iz spletne strani (kategorija »Spletna stran«) se zamenjajo; ročni ostanejo.
export default function WebsiteLearnCard({ docs = [], onDone }) {
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
      if (!knowledge.length) throw new Error("Na strani nismo našli dovolj besedila. Dodajte znanje ročno.");
      await Promise.all(fromSite.map((d) => base44.entities.KnowledgeBase.delete(d.id)));
      await Promise.all(knowledge.map((k) => base44.entities.KnowledgeBase.create({
        business_id: business.id, title: String(k.title).slice(0, 120), content: String(k.content).slice(0, 4000),
        category: "Spletna stran", active: true, owner_email: business.owner_email || business.created_by,
      })));
      if (!business.website) await base44.entities.Business.update(business.id, { website: data.data.website });
      queryClient.invalidateQueries({ queryKey: ["kb", business.id] });
      queryClient.invalidateQueries({ queryKey: ["kb_dash", business.id] });
      toast.success(`Prebrali smo ${data.data.pages_read} strani.`);
      onDone?.();
    } catch (e) { toast.error(fnError(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-[220px]"><Globe className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.vase-podjetje.si" onKeyDown={(e) => e.key === "Enter" && url && !busy && run()} className="h-12 pl-12 text-base rounded-xl" /></div>
        <Button size="lg" className="btn-brand h-12 px-6 text-base rounded-xl shrink-0" onClick={run} disabled={busy || !url}>
          {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
          {busy ? "Berem stran …" : fromSite.length ? "Preberi znova" : "Preberi mojo stran"}
        </Button>
      </div>
      {busy && <p className="text-sm text-muted-foreground mt-3">Traja 10–30 sekund. Strani ne zapirajte.</p>}
    </div>
  );
}
