import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, X, Plus, ArrowUp } from "lucide-react";

// Storitve kot seznam: dodaj, odstrani, premakni gor; z zvezdico označi najpomembnejše (do 3).
// value / main: nizi, ena storitev na vrstico.
const toList = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
export const MAX_MAIN = 3;

export default function ServicesPicker({ value, main, onChange }) {
  const list = toList(value);
  const mainList = toList(main).filter((m) => list.includes(m));
  const [input, setInput] = useState("");

  const emit = (nextList, nextMain = mainList) => onChange({ services: nextList.join("\n"), main_services: nextMain.filter((m) => nextList.includes(m)).join("\n") });
  const add = () => {
    const parts = input.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).filter((s) => !list.includes(s));
    if (!parts.length) return;
    emit([...list, ...parts]); setInput("");
  };
  const remove = (s) => emit(list.filter((x) => x !== s), mainList.filter((x) => x !== s));
  const toggleMain = (s) => {
    if (mainList.includes(s)) return emit(list, mainList.filter((x) => x !== s));
    if (mainList.length >= MAX_MAIN) return;
    // Glavne storitve gredo na vrh seznama.
    emit([s, ...list.filter((x) => x !== s)], [...mainList, s]);
  };
  const up = (i) => { if (i === 0) return; const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; emit(n); };

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">Še ni storitev. Dodajte prvo spodaj.</p>}
      <ul className="space-y-1.5">
        {list.map((s, i) => {
          const isMain = mainList.includes(s);
          const full = !isMain && mainList.length >= MAX_MAIN;
          return (
            <li key={s} className={`group flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${isMain ? "border-amber-300 bg-amber-50/70" : "bg-card"}`}>
              <button type="button" onClick={() => toggleMain(s)} disabled={full} title={isMain ? "Odstrani med najpomembnejšimi" : full ? `Največ ${MAX_MAIN} najpomembnejše` : "Označi kot najpomembnejšo"}
                className={`shrink-0 p-1 rounded-md ${isMain ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500"} disabled:opacity-30 disabled:hover:text-muted-foreground/40`}>
                <Star className={`w-4 h-4 ${isMain ? "fill-amber-400" : ""}`} />
              </button>
              <span className="flex-1 text-sm">{s}</span>
              {isMain && <span className="text-[11px] font-medium text-amber-700">najpomembnejša</span>}
              <button type="button" onClick={() => up(i)} disabled={i === 0} className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-foreground disabled:hidden" title="Premakni gor"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => remove(s)} className="p-1 rounded-md text-muted-foreground hover:text-red-600" title="Odstrani"><X className="w-3.5 h-3.5" /></button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Dodajte storitev (Enter)" />
        <Button type="button" variant="outline" onClick={add} disabled={!input.trim()}><Plus className="w-4 h-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500" />Z zvezdico označite do {MAX_MAIN} storitve, ki so za vas najpomembnejše — AI jih bo strankam priporočal prednostno.</p>
    </div>
  );
}
