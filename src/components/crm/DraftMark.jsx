import React from "react";
import { FilePen } from "lucide-react";
import IconHint from "@/components/ui/IconHint";

// Enoten znak za vse, kar je AI PRIPRAVIL in še ČAKA na vaš pregled (osnutek odgovora, ponudbe, prošnje …).
// Povsod ista ikona (listek s svinčnikom), jantarna barva in črtkan rob — da se na prvi pogled ve: »to še ni poslano«.
export const DRAFT_ICON = FilePen;
export const DRAFT_LABEL = "Pripravljeno — čaka na vaš pregled";
export const DRAFT_TONE = {
  icon: "bg-amber-50 text-amber-700 border border-dashed border-amber-400",
  row: "border border-dashed border-amber-300 bg-amber-50/50",
  badge: "bg-amber-50 text-amber-800 border border-dashed border-amber-300",
  text: "text-amber-700",
};

// Majhna značka »Čaka na vaš pregled« z ikono.
export function DraftBadge({ label = "Čaka na vaš pregled", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${DRAFT_TONE.badge} ${className}`}>
      <FilePen className="w-3 h-3" />{label}
    </span>
  );
}

// Okrogla ikona (za vrstice, tabele, časovnico). size: sm (7) | md (9)
export function DraftIcon({ size = "sm", hint = DRAFT_LABEL, onClick }) {
  const box = size === "md" ? "w-9 h-9 rounded-xl" : "w-7 h-7 rounded-full";
  const ico = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const inner = <FilePen className={ico} />;
  const cls = `${box} inline-flex items-center justify-center shrink-0 ${DRAFT_TONE.icon}`;
  return (
    <IconHint label={hint}>
      {onClick
        ? <button type="button" aria-label={hint} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`${cls} hover:bg-amber-100`}>{inner}</button>
        : <span aria-label={hint} className={cls}>{inner}</span>}
    </IconHint>
  );
}
