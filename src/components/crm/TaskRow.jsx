import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Check, Pencil, Bot, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { TASK_TYPES, PRIORITY, dueLabel, logActivity } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";

// Ena vrstica opravila: kljukica = opravljeno (zapiše se na časovnico stranke).
export default function TaskRow({ task, lead, company, onEdit, compact = false }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [busy, setBusy] = useState(false);
  const T = TASK_TYPES[task.type] || TASK_TYPES.task;
  const done = task.status === "done";
  const due = dueLabel(task.due_at);

  const toggle = async () => {
    setBusy(true);
    try {
      if (done) {
        await base44.entities.Task.update(task.id, { status: "open", done_at: null });
      } else {
        await base44.entities.Task.update(task.id, { status: "done", done_at: new Date().toISOString() });
        if (task.lead_id || task.company_id) {
          await logActivity(business, { lead_id: task.lead_id || null, company_id: task.company_id || null, type: "task_done", subject: task.title, content: task.description || "", task_id: task.id });
        }
        toast.success("Opravljeno.");
      }
      invalidate();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className={`group flex items-start gap-3 ${compact ? "py-2" : "py-3 px-4"} ${done ? "opacity-60" : ""}`}>
      <button onClick={toggle} disabled={busy} title={done ? "Označi kot neopravljeno" : "Označi kot opravljeno"}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary"}`}>
        {done && <Check className="w-3.5 h-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? "line-through" : ""}`}>{task.title}</p>
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><T.icon className="w-3 h-3" />{T.label}</span>
          {!done && <span className={due.cls}>{due.text}</span>}
          {task.priority === "high" && !done && <span className={`px-1.5 py-px rounded border text-[10px] font-medium ${PRIORITY.high.cls}`}>Nujno</span>}
          {task.source && task.source !== "manual" && <span className="inline-flex items-center gap-1"><Bot className="w-3 h-3" />{task.source === "campaign" ? "kampanja" : "samodejno"}</span>}
          {!compact && lead && <Link to={`/stranke/${lead.id}`} className="inline-flex items-center gap-1 hover:text-foreground"><User className="w-3 h-3" />{lead.name}</Link>}
          {!compact && company && <Link to={`/podjetja/${company.id}`} className="inline-flex items-center gap-1 hover:text-foreground"><Building2 className="w-3 h-3" />{company.name}</Link>}
        </div>
        {!compact && task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
      </div>
      {onEdit && <button onClick={() => onEdit(task)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground" title="Uredi"><Pencil className="w-3.5 h-3.5" /></button>}
    </div>
  );
}
