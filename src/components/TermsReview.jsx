import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, FileText } from "lucide-react";
import { KRATKO, PogojiVsebina, ZasebnostVsebina, TERMS_DATE } from "@/pages/Pravno";

// Splošni pogoji za sprejem: povzetek vedno viden, celotno besedilo (pogoji + zasebnost) v drsnem oknu.
// Uporablja uvod (Onboarding, korak 5) in TermsGate (ponovni sprejem ob novi različici).
export default function TermsReview({ accepted, onAccept, id = "terms" }) {
  const [open, setOpen] = useState(null); // "pogoji" | "zasebnost" | null

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />Splošni pogoji na kratko <span className="text-xs font-normal text-muted-foreground">· veljajo od {TERMS_DATE}</span></p>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground/85 list-disc pl-5">
          {KRATKO.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
        <div className="flex flex-wrap gap-2 mt-3">
          {[["pogoji", "Preberi celotne splošne pogoje"], ["zasebnost", "Preberi politiko zasebnosti"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setOpen(open === k ? null : k)}
              className={`text-sm inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${open === k ? "bg-accent text-accent-foreground border-primary/30" : "bg-background hover:bg-muted/50"}`}>
              {label}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${open === k ? "rotate-180" : ""}`} />
            </button>
          ))}
        </div>
        {open && (
          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border bg-background px-4 pb-4" data-testid="terms-full">
            {open === "pogoji" ? <PogojiVsebina /> : <ZasebnostVsebina />}
          </div>
        )}
      </div>

      <label htmlFor={id} className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/30">
        <Checkbox id={id} checked={accepted} onCheckedChange={(v) => onAccept(!!v)} className="mt-0.5" />
        <span className="text-sm leading-relaxed">Prebral sem splošne pogoje in politiko zasebnosti in ju <strong>sprejemam</strong>. Razumem, kaj aplikacija počne z mojim predalom, katere zunanje ponudnike uporablja in da se AI lahko zmoti.</span>
      </label>
    </div>
  );
}
