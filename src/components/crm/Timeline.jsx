import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Bot, ChevronDown, Plus } from "lucide-react";
import { ACTIVITY, fmtDateTime, ago } from "@/lib/crm";

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

export default function Timeline({ activities = [], pendingDrafts = [], leadsById, emptyText = "Še ni dogodkov.", onAdd, onPendingClick }) {
  const [filter, setFilter] = useState("all");
  const items = [...activities].filter((a) => inFilter(a, filter)).sort((a, b) => new Date(b.occurred_at || b.created_date) - new Date(a.occurred_at || a.created_date));
  const pendingBox = (
    <>
      <Inbox className="w-5 h-5 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{pendingDrafts.length === 1 ? "Pripravljen odgovor čaka na vas" : `${pendingDrafts.length} pripravljeni odgovori čakajo na vas`}</p>
        <p className="text-xs text-muted-foreground truncate">{pendingDrafts[0]?.subject}</p>
      </div>
      <span className="text-xs font-medium text-primary">Preglej →</span>
    </>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{l}</button>
        ))}
        {onAdd && <button onClick={onAdd} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-accent inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Dodaj v časovnico</button>}
      </div>
      {pendingDrafts.length > 0 && (onPendingClick
        ? <button onClick={onPendingClick} className="w-full text-left flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/50 px-4 py-3 hover:bg-accent">{pendingBox}</button>
        : <Link to="/stranke?tab=odgovori" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/50 px-4 py-3 hover:bg-accent">{pendingBox}</Link>)}
      {items.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p> : (
        <div className="relative">
          <span className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />
          {items.map((a) => <Item key={a.id} a={a} leadName={leadsById?.[a.lead_id]?.name} />)}
        </div>
      )}
    </div>
  );
}
