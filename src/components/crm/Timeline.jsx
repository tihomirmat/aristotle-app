import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ChevronDown, Plus, ArrowRight } from "lucide-react";
import { ACTIVITY, fmtDateTime, ago } from "@/lib/crm";
import { reasonFor } from "@/components/crm/ReplyReview";
import { DraftIcon, DraftBadge, DRAFT_TONE } from "@/components/crm/DraftMark";

// Časovnica stranke/podjetja: vsak dogodek je ena vrstica (kaj, kratek povzetek, kdaj); klik odpre celotno vsebino in od kod je prišel.
const FILTERS = [
  ["all", "Vse"],
  ["messages", "Sporočila"],
  ["calls", "Klici in sestanki"],
  ["notes", "Opombe"],
  ["system", "Ostalo"],
];
const inFilter = (a, f) => {
  if (f === "all") return true;
  if (f === "messages") return ["email_in", "email_out", "chat", "form", "sms"].includes(a.type);
  if (f === "calls") return ["call", "meeting", "booking"].includes(a.type);
  if (f === "notes") return a.type === "note";
  return ["system", "task_done", "offer"].includes(a.type);
};
const ORIGIN = {
  email_in: "prejeto po e-pošti", email_out: "poslano po e-pošti", chat: "iz klepeta na spletni strani", form: "iz obrazca na spletni strani",
  call: "vpisano ročno", meeting: "vpisano ročno", note: "vpisano ročno", sms: "vpisano ročno", offer: "iz Ponudb", booking: "iz koledarja", task_done: "iz Opravil",
};
const firstLine = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 160);

function Item({ a, leadName }) {
  const [open, setOpen] = useState(false);
  const T = ACTIVITY[a.type] || ACTIVITY.system;
  const when = a.occurred_at || a.created_date;
  const title = a.subject && a.subject !== T.label ? a.subject : T.label;
  const preview = firstLine(a.content);
  const origin = a.is_automated ? "samodejno (aplikacija)" : ORIGIN[a.type] || "";
  const dir = a.direction === "inbound" ? "Stranka → vi" : a.direction === "outbound" ? "Vi → stranka" : "";
  const hasMore = !!a.content;
  return (
    <div className="relative pl-12 pb-3 last:pb-0">
      <span className={`absolute left-0 top-1 w-9 h-9 rounded-xl flex items-center justify-center ${T.cls}`}><T.icon className="w-4 h-4" /></span>
      <button type="button" onClick={() => hasMore && setOpen(!open)} aria-expanded={open}
        className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${open ? "bg-card shadow-sm border-border" : "border-transparent hover:bg-muted/40 hover:border-border"} ${hasMore ? "cursor-pointer" : "cursor-default"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{title}</span>
          {a.subject && a.subject !== T.label && <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">· {T.label}</span>}
          {leadName && <span className="text-xs text-muted-foreground shrink-0">· {leadName}</span>}
          {a.is_automated && <Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="samodejno" />}
          <span className="ml-auto text-xs text-muted-foreground shrink-0" title={fmtDateTime(when)}>{ago(when)}</span>
          {hasMore && <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />}
        </div>
        {!open && preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>}
      </button>
      {open && (
        <div className="mt-1.5 ml-1 rounded-xl border bg-card px-4 py-3 space-y-2">
          <p className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
            <span>{fmtDateTime(when)}</span>{dir && <span>{dir}</span>}{origin && <span>Vir: {origin}</span>}
          </p>
          <div className="text-sm whitespace-pre-wrap max-h-[420px] overflow-y-auto">{a.content}</div>
        </div>
      )}
    </div>
  );
}

// Pripravljeno (osnutek), ki čaka na pregled: jantarna ikona listka s svinčnikom + črtkan rob — enako povsod v aplikaciji.
function DraftItem({ d, leadName, onOpen }) {
  const r = reasonFor(d.pillar);
  const body = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate">{d.subject || r.label}</span>
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">· {r.label}</span>
        {leadName && <span className="text-xs text-muted-foreground shrink-0">· {leadName}</span>}
        <DraftBadge className="ml-auto" />
        <span className="text-xs text-muted-foreground shrink-0">{ago(d.created_date)}</span>
      </div>
      <p className={`text-xs mt-0.5 inline-flex items-center gap-1 font-medium ${DRAFT_TONE.text}`}>Še ni poslano — preberite in pošljite<ArrowRight className="w-3 h-3" /></p>
    </>
  );
  return (
    <div className="relative pl-12 pb-3">
      <span className="absolute left-0 top-1"><DraftIcon size="md" /></span>
      {onOpen
        ? <button type="button" onClick={() => onOpen(d)} className={`w-full text-left rounded-xl px-3 py-2 hover:bg-amber-50 ${DRAFT_TONE.row}`}>{body}</button>
        : <Link to="/stranke?tab=odgovori" className={`block rounded-xl px-3 py-2 hover:bg-amber-50 ${DRAFT_TONE.row}`}>{body}</Link>}
    </div>
  );
}

export default function Timeline({ activities = [], pendingDrafts = [], leadsById, emptyText = "Še ni dogodkov.", onAdd, onPendingClick }) {
  const [filter, setFilter] = useState("all");
  // Dogodki, ki samo napovedujejo pripravljen osnutek (»Čaka na vaš pregled«), se ne podvajajo: osnutek je že prikazan kot svoja vrstica.
  const pendingIds = new Set(pendingDrafts.map((d) => d.id));
  const hasPendingOffer = pendingDrafts.some((d) => d.pillar === "offer");
  const isDraftEcho = (a) => (a.draft_id && pendingIds.has(a.draft_id)) || (hasPendingOffer && a.type === "offer" && /Čaka na vaš pregled/i.test(a.content || ""));
  const items = [...activities].filter((a) => !isDraftEcho(a) && inFilter(a, filter)).sort((a, b) => new Date(b.occurred_at || b.created_date) - new Date(a.occurred_at || a.created_date));
  const drafts = filter === "all" || filter === "messages" ? [...pendingDrafts].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)) : [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{l}</button>
        ))}
        {onAdd && <button onClick={onAdd} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-accent inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Dodaj v časovnico</button>}
      </div>
      {items.length === 0 && drafts.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p> : (
        <div className="relative">
          <span className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />
          {drafts.map((d) => <DraftItem key={"d" + d.id} d={d} leadName={leadsById?.[d.lead_id]?.name} onOpen={onPendingClick} />)}
          {items.map((a) => <Item key={a.id} a={a} leadName={leadsById?.[a.lead_id]?.name} />)}
        </div>
      )}
    </div>
  );
}
