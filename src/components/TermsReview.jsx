import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database, Lock, KeyRound, Inbox } from "lucide-react";
import { PogojiVsebina, ZasebnostVsebina } from "@/pages/Pravno";

// Sprejem pogojev: kratko in prijazno — najprej to, kar človeka zanima, celotno besedilo v oknu na klik.
// Uporablja uvod (korak »Pogoji«) in TermsGate. Ena kljukica nastavi oba podatka (pogoji + pravna podlaga za pisanje strankam).
const POINTS = [
  { icon: Lock, title: "Podatki so vaši", text: "Ne prodajamo jih in ne delimo jih z drugimi podjetji. Izvoz ali izbris kadar koli." },
  { icon: Database, title: "Kaj hranimo", text: "To, kar vidite v aplikaciji: podatke o podjetju, stranke, sporočila, pogovore klepeta, ponudbe in račune. Vidi jih le vaše podjetje (in skrbnik, kadar pomaga pri težavi)." },
  { icon: Inbox, title: "Vaša pošta ostane vaša", text: "Iz predala ničesar ne brišemo in ne premikamo. Odgovori čakajo na vaš pregled." },
  { icon: KeyRound, title: "Gesla so šifrirana", text: "Geslo predala je v bazi zaklenjeno; uporabi ga samo naš strežnik, nikoli brskalnik." },
];

export default function TermsReview({ accepted, onAccept, id = "terms" }) {
  const [open, setOpen] = useState(null); // "pogoji" | "zasebnost" | null
  const link = (k, label) => (
    <button type="button" onClick={(e) => { e.preventDefault(); setOpen(k); }} className="underline underline-offset-2 hover:text-primary">{label}</button>
  );

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-xl border bg-background p-3.5 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0"><p.icon className="w-4 h-4" /></div>
            <div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.text}</p></div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Podatki so shranjeni v bazi na strežnikih Base44 (ZDA); besedila pripravlja AI ponudnika Anthropic. Po prenehanju jih izbrišemo najkasneje v 12 mesecih, na zahtevo v 30 dneh. Vse podrobnosti so v {link("pogoji", "splošnih pogojih")} in {link("zasebnost", "politiki zasebnosti")}.
      </p>

      <label htmlFor={id} className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/30">
        <Checkbox id={id} checked={accepted} onCheckedChange={(v) => onAccept(!!v)} className="mt-0.5" />
        <span className="text-sm leading-relaxed">Sprejemam {link("pogoji", "splošne pogoje")} in {link("zasebnost", "politiko zasebnosti")}. Strankam pišem le, če so mi pisale same ali imam njihovo dovoljenje.</span>
      </label>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open === "zasebnost" ? "Politika zasebnosti" : "Splošni pogoji uporabe"}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 text-sm">
            {[["pogoji", "Splošni pogoji"], ["zasebnost", "Zasebnost"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setOpen(k)} className={`rounded-lg px-3 py-1 border ${open === k ? "bg-accent text-accent-foreground border-primary/30" : "hover:bg-muted/50"}`}>{l}</button>
            ))}
          </div>
          {open === "zasebnost" ? <ZasebnostVsebina /> : <PogojiVsebina />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
