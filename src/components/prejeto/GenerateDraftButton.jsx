import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { toast } from "sonner";
import { generateDrafts } from "@/functions/generateDrafts";

const PILLAR_OPTIONS = [
  { value: "reactivation", label: "Reaktivacija stranke" },
  { value: "review_request", label: "Prošnja za Google oceno" },
  { value: "web_form_lead", label: "Novi lead (spletni obrazec)" },
  { value: "referral_ask", label: "Napotitev" },
];

export default function GenerateDraftButton() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [pillar, setPillar] = useState("reactivation");
  const [loading, setLoading] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const eligibleLeads = leads.filter(l => l.email && l.consent_email && l.status !== 'unsubscribed');

  const handleGenerate = async () => {
    if (!leadId || !pillar) return;
    setLoading(true);
    try {
      await generateDrafts({ pillar, lead_id: leadId, business_id: business.id });
      queryClient.invalidateQueries({ queryKey: ["drafts-pending", business?.id] });
      toast.success("AI osnutek ustvarjen in čaka na odobritev.");
      setOpen(false);
      setLeadId("");
    } catch (err) {
      toast.error("Napaka pri generiranju: " + (err?.message || "Neznana napaka"));
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wand2 className="w-4 h-4 mr-2" /> Generiraj AI sporočilo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" /> Generiraj AI sporočilo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Vrsta sporočila</Label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PILLAR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stranka</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger><SelectValue placeholder="Izberite stranko..." /></SelectTrigger>
                <SelectContent>
                  {eligibleLeads.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} — {l.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleLeads.length === 0 && (
                <p className="text-xs text-muted-foreground">Ni strank z e-pošto in soglasjem. Dodajte stranke v razdelku Stranke.</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!leadId || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Ustvari sporočilo z AI
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}