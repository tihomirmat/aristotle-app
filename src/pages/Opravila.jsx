import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, AlertTriangle, Sun, CalendarDays, CalendarClock, CheckCircle2, PartyPopper } from "lucide-react";
import TaskRow from "@/components/crm/TaskRow";
import { TaskDialog } from "@/components/crm/CrmDialogs";
import { taskBucket, TASK_TYPES } from "@/lib/crm";

const BUCKETS = [
  { key: "overdue", label: "Zamuja", icon: AlertTriangle, cls: "text-red-600" },
  { key: "today", label: "Danes", icon: Sun, cls: "text-primary" },
  { key: "week", label: "Naslednjih 7 dni", icon: CalendarDays, cls: "text-foreground" },
  { key: "later", label: "Kasneje in brez roka", icon: CalendarClock, cls: "text-muted-foreground" },
];

// Opravila: kaj morate narediti danes, kaj zamuja, kaj prihaja. Nastajajo ročno, iz pošte (stranka je odpisala) in iz kampanj.
export default function Opravila() {
  const { business } = useBusiness();
  const bid = business?.id;
  const [dlg, setDlg] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["tasks", bid, "all"], queryFn: () => base44.entities.Task.filter({ business_id: bid }), enabled: !!bid });
  const { data: leads = [] } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }), enabled: !!bid });
  const { data: companies = [] } = useQuery({ queryKey: ["companies", bid], queryFn: () => base44.entities.Company.filter({ business_id: bid }), enabled: !!bid });
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const compById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const open = tasks.filter((t) => t.status === "open" && (typeFilter === "all" || t.type === typeFilter));
  const grouped = BUCKETS.map((b) => ({ ...b, items: open.filter((t) => taskBucket(t) === b.key).sort((a, c) => new Date(a.due_at || "2999") - new Date(c.due_at || "2999") || (a.priority === "high" ? -1 : 1)) }));
  const done = tasks.filter((t) => t.status === "done" && t.done_at && Date.now() - new Date(t.done_at) < 14 * 86400000).sort((a, b) => new Date(b.done_at) - new Date(a.done_at));
  const counts = { overdue: grouped[0].items.length, today: grouped[1].items.length };
  const edit = (t) => { setEditTask(t); setDlg(true); };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1>Opravila</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">Klici, ponovni stiki in vse, kar ne sme pasti skozi. Ko stranka odpiše, AI sam doda opravilo »Odgovorite«.</p>
        </div>
        <Button className="btn-brand" onClick={() => edit(null)}><Plus className="w-4 h-4 mr-2" />Novo opravilo</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Zamuja", counts.overdue, "text-red-600"], ["Danes", counts.today, "text-primary"], ["Odprto skupaj", open.length, "text-foreground"], ["Opravljeno (14 dni)", done.length, "text-emerald-600"]].map(([l, n, c]) => (
          <div key={l} className="card-elevated p-4"><p className="text-xs text-muted-foreground">{l}</p><p className={`text-2xl font-display font-bold mt-1 ${c}`}>{n}</p></div>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setTypeFilter("all")} className={`text-xs px-3 py-1.5 rounded-full border ${typeFilter === "all" ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>Vse vrste</button>
        {Object.entries(TASK_TYPES).map(([k, t]) => <button key={k} onClick={() => setTypeFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${typeFilter === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}><t.icon className="w-3 h-3" />{t.label}</button>)}
      </div>

      {open.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <PartyPopper className="w-12 h-12 mx-auto text-primary/60" />
          <h2 className="text-xl mt-4">Vse je opravljeno</h2>
          <p className="text-muted-foreground mt-2">Ni odprtih opravil. Novo dodate z gumbom zgoraj ali na strani stranke.</p>
        </div>
      ) : grouped.filter((g) => g.items.length).map((g) => (
        <div key={g.key} className="card-elevated overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2"><g.icon className={`w-4 h-4 ${g.cls}`} /><p className={`text-sm font-semibold ${g.cls}`}>{g.label}</p><span className="text-xs text-muted-foreground">{g.items.length}</span></div>
          <div className="divide-y">{g.items.map((t) => <TaskRow key={t.id} task={t} lead={leadsById[t.lead_id]} company={compById[t.company_id] || compById[leadsById[t.lead_id]?.company_id]} onEdit={edit} />)}</div>
        </div>
      ))}

      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{showDone ? "Skrij opravljena" : `Pokaži opravljena (${done.length})`}</button>
          {showDone && <div className="card-elevated mt-2 divide-y">{done.map((t) => <TaskRow key={t.id} task={t} lead={leadsById[t.lead_id]} company={compById[t.company_id]} />)}</div>}
        </div>
      )}

      <TaskDialog open={dlg} onOpenChange={setDlg} task={editTask} leads={[...leads].sort((a, b) => a.name.localeCompare(b.name))} companies={companies} />
    </div>
  );
}
