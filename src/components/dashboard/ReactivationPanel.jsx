import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { runReactivation } from "@/functions/runReactivation";

export default function ReactivationPanel() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runReactivation({ business_id: business.id });
      const data = res?.data || res;
      if (data.created > 0) {
        toast.success(`Reaktivacija: ustvarjenih ${data.created} AI sporočil. Preverite Prejeto.`);
        queryClient.invalidateQueries({ queryKey: ["drafts", business?.id] });
        queryClient.invalidateQueries({ queryKey: ["drafts-pending", business?.id] });
        queryClient.invalidateQueries({ queryKey: ["drafts-sidebar", business?.id] });
      } else {
        toast.info(data.message || "Ni ustreznih strank za reaktivacijo.");
      }
    } catch (err) {
      toast.error("Napaka: " + (err?.message || "Neznana napaka"));
    }
    setLoading(false);
  };

  if (!business?.pillar_reactivation) return null;

  return (
    <Button size="sm" variant="outline" onClick={handleRun} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
      Zaženi reaktivacijo
    </Button>
  );
}