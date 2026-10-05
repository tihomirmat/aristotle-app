import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListChecks, Plus, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import TaskRow from "@/components/crm/TaskRow";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";
import { taskBucket } from "@/lib/crm";

// Opravila stranke/podjetja: vedno vidna (ne v zavihku), hitro dodajanje z Enter, zamujena izpostavljena.
export default function TasksPanel({ tasks = [], leadId, companyId, leadsById, onEdit, onAddDetailed }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => t.status === "open").sort((a, b) => new Date(a.due_at || "2999") - new Date(b.due_at || "2999"));
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));
  const overdue = open.filter((t) => taskBucket(t) === "overdue").length;

  const quickAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const due = addDays(new Date().setHours(9, 0, 0, 0), when);
      await base44.entities.Task.create({ business_id: business.id, owner_email: business.owner_email || business.created_by, title: title.trim(), type: "task", priority: "normal", status: "open", source: "manual", lead_id: leadId || null, company_id: companyId || null, due_at: new Date(due).toISOString() });
      setTitle(""); invalidate();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className={`card-elevated overflow-hidden ${overdue ? "ring-2 ring-red-200" : ""}`}>
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-primary" />
        <p className="font-semibold text-sm flex-1">Opravila {open.length > 0 && <span className="text-muted-foreground font-normal">· {open.length} odprtih</span>}</p>
        {overdue > 0 && <span className="text-[11px] font-medium text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{overdue} zamuja</span>}
        {onAddDetailed && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAddDetailed}><Plus className="w-3.5 h-3.5 mr-1" />Podrobno</Button>}
      </div>
      <div className="p-3 border-b space-y-2">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()} placeholder="Kaj je treba narediti? (Enter)" className="h-9" />
          <Button size="sm" className="btn-brand h-9 shrink-0" onClick={quickAdd} disabled={saving || !title.trim()}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button>
        </div>
        <div className="flex gap-1">
          {[["Danes", 0], ["Jutri", 1], ["Čez 3 dni", 3], ["Čez teden", 7]].map(([l, d]) => (
            <button key={l} onClick={() => setWhen(d)} className={`text-[11px] px-2 py-0.5 rounded-md border ${when === d ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="px-4 divide-y max-h-[420px] overflow-y-auto">
        {open.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Ni odprtih opravil.</p>
          : open.map((t) => <TaskRow key={t.id} task={t} compact onEdit={onEdit} lead={leadsById?.[t.lead_id]} />)}
      </div>
      {done.length > 0 && (
        <div className="border-t px-4 py-2">
          <button onClick={() => setShowDone(!showDone)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ChevronDown className={`w-3 h-3 ${showDone ? "rotate-180" : ""}`} />Opravljeno ({done.length})</button>
          {showDone && <div className="divide-y">{done.map((t) => <TaskRow key={t.id} task={t} compact />)}</div>}
        </div>
      )}
    </div>
  );
}
