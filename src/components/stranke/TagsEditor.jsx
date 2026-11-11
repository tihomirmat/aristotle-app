import React, { useState } from "react";
import { Tag, X, Plus } from "lucide-react";

// Oznake stranke (npr. »VIP«, »sejem 2026«): klik na × odstrani, vpis + Enter doda. `suggestions` = že uporabljene oznake.
export const cleanTag = (t) => String(t || "").replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);

export default function TagsEditor({ tags = [], suggestions = [], onChange }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const list = Array.isArray(tags) ? tags : [];
  const add = (t) => { const c = cleanTag(t); if (c && !list.some((x) => x.toLowerCase() === c.toLowerCase())) onChange([...list, c]); setVal(""); setAdding(false); };
  const free = suggestions.filter((s) => !list.some((x) => x.toLowerCase() === s.toLowerCase())).slice(0, 6);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {list.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 text-xs rounded-full bg-accent text-foreground px-2 py-0.5"><Tag className="w-3 h-3 text-primary" />{t}<button onClick={() => onChange(list.filter((x) => x !== t))} className="text-muted-foreground hover:text-red-600" title="Odstrani oznako"><X className="w-3 h-3" /></button></span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-1 flex-wrap">
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(val); if (e.key === "Escape") { setAdding(false); setVal(""); } }} onBlur={() => (val ? add(val) : setAdding(false))} placeholder="nova oznaka" className="h-6 w-28 rounded-md border px-1.5 text-xs bg-background" />
          {free.map((s) => <button key={s} onMouseDown={(e) => { e.preventDefault(); add(s); }} className="text-[11px] rounded-full border px-1.5 py-0.5 hover:bg-muted">{s}</button>)}
        </span>
      ) : <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground rounded-full border border-dashed px-2 py-0.5"><Plus className="w-3 h-3" />Oznaka</button>}
    </div>
  );
}
