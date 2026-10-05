import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { runReactivation } from "@/functions/runReactivation";
import { base44 } from "@/api/base44Client";
import { fnError } from "@/lib/fn-error";
import { hasModule } from "@/lib/entitlements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Kartica »Vrnite stare stranke«: pove, koliko strank bi zajela, preden lastnik klikne.
export default function ReactivationPanel() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads_all", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const eligible = leads.filter((l) => l.email && l.consent_email && !["unsubscribed", "converted"].includes(l.status)
    && (!l.last_contacted_at || new Date(l.last_contacted_at) <= thirtyDaysAgo));

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runReactivation({ business_id: business.id });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      if (data.created > 0) {
        toast.success(`Pripravljenih ${data.created} sporočil. Pregledate jih v Stranke → Čaka na vaš odgovor.`);
        ["drafts", "drafts-all", "drafts-sidebar"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k, business?.id] }));
        setOpen(false);
      } else {
        toast.info(data.message || "Trenutno ni strank, ki bi jih bilo smiselno nagovoriti.");
      }
    } catch (err) {
      toast.error("Napaka: " + fnError(err));
    }
    setLoading(false);
  };

  if (!hasModule(business, "pillar_reactivation")) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <RotateCcw className="w-4 h-4" /> Vrnite stare stranke
        {eligible.length > 0 && <span className="ml-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">{eligible.length}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vrnite stare stranke</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              AI napiše osebno sporočilo vsaki stranki, s katero niste bili v stiku <strong className="text-foreground">30 dni ali več</strong>,
              in jo vljudno povabi nazaj. Sporočila najprej pregledate v Stranke → Čaka na vaš odgovor; nič se ne pošlje samo od sebe.
            </p>
            <p className="bg-muted/60 rounded-lg px-3 py-2">
              {eligible.length === 0
                ? "Trenutno ni strank, ki ustrezajo pogojem (e-naslov, soglasje, 30+ dni brez stika)."
                : <>Zajelo bi <strong className="text-foreground">{eligible.length}</strong> {eligible.length === 1 ? "stranko" : eligible.length < 5 ? "stranke" : "strank"}, naenkrat največ 10.</>}
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleRun} disabled={loading || eligible.length === 0} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Pripravi sporočila
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Prekliči</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
