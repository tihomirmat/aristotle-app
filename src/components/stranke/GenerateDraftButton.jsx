import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { generateDraft } from "@/functions/generateDraft";

const PILLAR_OPTIONS = [
  { value: "reactivation", label: "Reaktivacija" },
  { value: "review_request", label: "Prošnja za oceno" },
  { value: "web_form_lead", label: "Nega leada" },
  { value: "referral_ask", label: "Napotitev" },
  { value: "booking_proposal", label: "Predlog termina" },
];

export default function GenerateDraftButton({ lead, businessId }) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleGenerate = async (pillar) => {
    setLoading(true);
    try {
      const result = await generateDraft({
        business_id: businessId,
        lead_id: lead.id,
        pillar,
        sequence_step: 1,
      });
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      const score = result?.data?.quality_score;
      if (score && score < 6) {
        toast.warning(`Osnutek ustvarjen (kakovost: ${score}/10) — označen za pregled.`);
      } else {
        toast.success(`Osnutek za "${lead.name}" je pripravljen v Prejeto.`);
      }
    } catch (e) {
      toast.error("Napaka pri generiranju: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Osnutek
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PILLAR_OPTIONS.map(p => (
          <DropdownMenuItem key={p.value} onClick={() => handleGenerate(p.value)}>
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}