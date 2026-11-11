import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import TermsReview from "@/components/TermsReview";
import { TERMS_VERSION } from "@/pages/Pravno";

// Obvezen sprejem splošnih pogojev: velja za račune, ki pogojev še niso sprejeli,
// in za vse ob novi različici (TERMS_VERSION). Okna ni mogoče zapreti brez sprejema.
export default function TermsGate() {
  const { business, user, refetch } = useBusiness() || {};
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!business?.id || business.is_demo || done || business.terms_version === TERMS_VERSION) return null;
  const renewal = !!business.terms_version;

  const accept = async () => {
    setSaving(true);
    try {
      await base44.entities.Business.update(business.id, {
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_by: user?.email || "",
      });
      setDone(true);
      refetch?.();
    } catch (e) {
      toast.error("Sprejema ni bilo mogoče shraniti. Poskusite znova.");
    } finally { setSaving(false); }
  };

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{renewal ? "Splošni pogoji so posodobljeni" : "Splošni pogoji uporabe"}</AlertDialogTitle>
          <AlertDialogDescription>
            {renewal ? "Pogoje smo spremenili. Preberite jih in potrdite, da lahko nadaljujete." : "Pred nadaljnjo uporabo preberite, kako aplikacija deluje in kaj se zgodi z vašimi podatki."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <TermsReview id="terms-gate" accepted={accepted} onAccept={setAccepted} />
        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => base44.auth.logout?.()}>Ne sprejmem — odjava</button>
          <Button className="btn-brand px-6" disabled={!accepted || saving} onClick={accept}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sprejemam
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
