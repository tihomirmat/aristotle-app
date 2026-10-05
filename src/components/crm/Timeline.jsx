import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Bot, ChevronDown } from "lucide-react";
import { ACTIVITY, fmtDateTime, ago } from "@/lib/crm";

// Časovnica stranke/podjetja: vsi dogodki (e-pošta, klici, opombe, termini, ponudbe, spremembe faze).
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

function Item({ a, leadName }) {
  const [open, setOpen] = useState(false);
  const T = ACTIVITY[a.type] || ACTIVITY.system;
  const long = String(a.content || "").length > 220;
  return (
    <div className="relative pl-12 pb-5 last:pb-0">
      <span className={`absolute left-0 top-0 w-9 h-9 rounded-xl flex items-center justify-center ${T.cls}`}><T.icon className="w-4 h-4" /></span>
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{T.label}</span>
        {leadName && <span>· {leadName}</span>}
        {a.is_automated && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5"><Bot className="w-3 h-3" />samodejno</span>}
        <span title={fmtDateTime(a.occurred_at || a.created_date)}>· {ago(a.occurred_at || a.created_date)}</span>
      </div>
      {a.subject && a.subject !== T.label && <p className="text-sm font-medium mt-1">{a.subject}</p>}
      {a.content && (
        <div className={`mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap rounded-xl ${["email_in", "email_out"].includes(a.type) ? "bg-muted/40 border px-3 py-2" : ""}`}>
          <p className={open || !long ? "" : "line-clamp-4"}>{a.content}</p>
          {long && <button onClick={() => setOpen(!open)} className="text-xs text-primary mt-1 inline-flex items-center gap-1">{open ? "Skrij" : "Pokaži vse"}<ChevronDown className={`w-3 h-3 ${open ? "rotate-180" : ""}`} /></button>}
        </div>
      )}
    </div>
  );
}

export default function Timeline({ activities = [], pendingDrafts = [], leadsById, emptyText = "Še ni dogodkov." }) {
  const [filter, setFilter] = useState("all");
  const items = [...activities].filter((a) => inFilter(a, filter)).sort((a, b) => new Date(b.occurred_at || b.created_date) - new Date(a.occurred_at || a.created_date));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{l}</button>
        ))}
      </div>
      {pendingDrafts.length > 0 && (
        <Link to="/stranke?tab=odgovori" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/50 px-4 py-3 hover:bg-accent">
          <Inbox className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{pendingDrafts.length === 1 ? "Pripravljen odgovor čaka na vas" : `${pendingDrafts.length} pripravljeni odgovori čakajo na vas`}</p>
            <p className="text-xs text-muted-foreground truncate">{pendingDrafts[0].subject}</p>
          </div>
          <span className="text-xs font-medium text-primary">Preglej →</span>
        </Link>
      )}
      {items.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p> : (
        <div className="relative">
          <span className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />
          {items.map((a) => <Item key={a.id} a={a} leadName={leadsById?.[a.lead_id]?.name} />)}
        </div>
      )}
    </div>
  );
}
