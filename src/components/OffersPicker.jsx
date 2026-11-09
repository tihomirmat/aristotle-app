import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Plus, Globe } from "lucide-react";

// Ponudbe/akcije, najdene na strani, kot izbira (kljukice) + ročni vnos.
// options: najdene na strani; value: izbrane (ena na vrstico).
const toList = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export default function OffersPicker({ options = [], value, onChange }) {
  const selected = toList(value);
  const [extra, setExtra] = useState([]); // ročno dodane
  const [input, setInput] = useState("");
  const all = [...new Set([...options, ...extra, ...selected])];
  const toggle = (o) => onChange((selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]).join("\n"));
  const add = () => { const v = input.trim(); if (!v) return; setExtra((e) => [...e, v]); onChange([...new Set([...selected, v])].join("\n")); setInput(""); };

  return (
    <div className="space-y-2">
      {options.length > 0 && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Na vaši strani smo našli — označite, kar še velja:</p>}
      <div className="space-y-1.5">
        {all.map((o) => {
          const on = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)} className={`w-full text-left flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${on ? "border-primary bg-accent/40" : "hover:border-primary/40"}`}>
              <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-white" : "bg-background"}`}>{on && <Check className="w-3 h-3" />}</span>
              <span className="flex-1">{o}</span>
              {!options.includes(o) && <span className="text-[11px] text-muted-foreground">dodali ste</span>}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Dodajte svojo, npr. »Prvi pregled brezplačno«" />
        <Button type="button" variant="outline" onClick={add} disabled={!input.trim()}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
