import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, UserPlus, Loader2, Users, Download, Mail, LayoutGrid, List, Clock, Building2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import CustomerImportModal from "@/components/stranke/CustomerImportModal";
import LeadSources from "@/components/stranke/LeadSources";
import { STAGES, STAGE, SOURCES, ago, firstLine, eur } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";

// Ena stran za vse stranke in povpraševanja (CRM): cevovod po fazah, seznam, viri. Klik odpre celotno stran stranke.
export default function Stranke() {
  const { business } = useBusiness();
  const navigate = useNavigate();
  const invalidate = useCrmInvalidate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "viri" ? "viri" : "stranke";
  const [view, setView] = useState("pipeline");
  const [search, setSearch] = useState(params.get("q") || "");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [dragId, setDragId] = useState(null);
  const emptyLead = { name: "", email: "", phone: "", notes: "", position: "", company_id: "", new_company: "", value: "", consent_email: true };
  const [newLead, setNewLead] = useState(emptyLead);
  const bid = business?.id;

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }), enabled: !!bid });
  const { data: drafts = [] } = useQuery({ queryKey: ["drafts-all", bid], queryFn: () => base44.entities.DraftMessage.filter({ business_id: bid }), enabled: !!bid });
  const { data: companies = [] } = useQuery({ queryKey: ["companies", bid], queryFn: () => base44.entities.Company.filter({ business_id: bid }), enabled: !!bid });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks", bid], queryFn: () => base44.entities.Task.filter({ business_id: bid, status: "open" }), enabled: !!bid });
  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const pendingByLead = useMemo(() => {
    const m = {};
    drafts.forEach((d) => { if (["pending", "flagged_for_review"].includes(d.status)) m[d.lead_id] = (m[d.lead_id] || 0) + 1; });
    return m;
  }, [drafts]);
  const tasksByLead = useMemo(() => {
    const m = {};
    tasks.forEach((t) => { if (t.lead_id) m[t.lead_id] = (m[t.lead_id] || 0) + 1; });
    return m;
  }, [tasks]);

  const update = useMutation({ mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data), onSuccess: invalidate });
  const create = useMutation({
    mutationFn: async (d) => {
      let company_id = d.company_id || null;
      if (!company_id && d.new_company.trim()) {
        const c = await base44.entities.Company.create({ business_id: bid, name: d.new_company.trim(), owner_email: business.owner_email || business.created_by });
        company_id = c.id;
      }
      return base44.entities.Lead.create({
        business_id: bid, owner_email: business.owner_email || business.created_by, source: "manual", status: "new",
        name: d.name, email: d.email, phone: d.phone, notes: d.notes, position: d.position, consent_email: d.consent_email,
        company_id, ...(d.value ? { value: Number(d.value) } : {}),
      });
    },
    onSuccess: (lead) => { invalidate(); setShowAdd(false); setNewLead(emptyLead); toast.success("Stranka dodana."); navigate(`/stranke/${lead.id}`); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    const comp = companiesById[l.company_id]?.name;
    const okQ = !q || [l.name, l.email, l.phone, l.notes, comp].some((v) => String(v || "").toLowerCase().includes(q));
    const okS = sourceFilter === "all" || l.source === sourceFilter;
    return okQ && okS;
  }).sort((a, b) => new Date(b.last_inbound_at || b.created_date) - new Date(a.last_inbound_at || a.created_date));

  const sourceCounts = Object.keys(SOURCES).map((k) => [k, leads.filter((l) => l.source === k).length]).filter(([, n]) => n > 0);
  const open = (id) => navigate(`/stranke/${id}`);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Ime", "Podjetje", "E-pošta", "Telefon", "Faza", "Vir", "Vrednost", "Zadnja aktivnost", "Opombe"], ...filtered.map((l) => [l.name, companiesById[l.company_id]?.name, l.email, l.phone, STAGE[l.status]?.label || l.status, SOURCES[l.source]?.label || l.source, l.value, l.last_inbound_at || l.created_date, l.notes])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `stranke-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  const LeadCard = ({ lead }) => {
    const S = SOURCES[lead.source] || SOURCES.manual;
    const pending = pendingByLead[lead.id] || 0;
    const nTasks = tasksByLead[lead.id] || 0;
    const comp = companiesById[lead.company_id];
    return (
      <button draggable onDragStart={() => setDragId(lead.id)} onDragEnd={() => setDragId(null)} onClick={() => open(lead.id)}
        className={`w-full text-left bg-card border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all ${dragId === lead.id ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{lead.name}</p>
            {comp && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" />{comp.name}</p>}
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span>
        </div>
        {(lead.service_requested || lead.notes) && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{lead.service_requested || firstLine(lead.notes)}</p>}
        <div className="flex items-center justify-between mt-2.5 gap-2">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{ago(lead.last_inbound_at || lead.created_date)}</span>
          <span className="flex items-center gap-1.5">
            {lead.value ? <span className="text-[11px] font-medium">{eur(lead.value)}</span> : null}
            {nTasks > 0 && <span title="Odprta opravila" className="text-[10px] font-medium text-slate-700 bg-slate-100 rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5"><ListChecks className="w-3 h-3" />{nTasks}</span>}
            {pending > 0 && <span className="text-[10px] font-semibold text-white bg-primary rounded-full px-1.5 py-0.5">{pending} za odobritev</span>}
          </span>
        </div>
      </button>
    );
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1>Stranke</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">Vsa povpraševanja in stranke na enem mestu — iz e-pošte, obrazca, klepeta ali dodane ročno. Povlecite kartico v drugo fazo ali jo kliknite za celotno zgodovino.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />Izvozi</Button>
          <Button className="btn-brand" onClick={() => setShowAdd(true)}><UserPlus className="w-4 h-4 mr-2" />Dodaj stranko</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {[["stranke", `Stranke (${leads.length})`], ["viri", "Od kod pridejo stranke"]].map(([k, l]) => (
          <button key={k} onClick={() => setParams(k === "viri" ? { tab: "viri" } : {})}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
        <Link to="/podjetja" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent -mb-px text-muted-foreground hover:text-foreground">Podjetja ({companies.length})</Link>
      </div>

      {tab === "viri" ? (
        <LeadSources leads={leads} onImport={() => setShowImport(true)} />
      ) : leads.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <h2 className="text-xl mt-4">Še nimate strank</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Povežite e-poštni predal in AI bo sam našel povpraševanja, ali vstavite obrazec na svojo spletno stran.</p>
          <div className="flex gap-2 justify-center mt-5">
            <Button className="btn-brand" asChild><Link to="/nastavitve?tab=integracije"><Mail className="w-4 h-4 mr-2" />Poveži e-pošto</Link></Button>
            <Button variant="outline" onClick={() => setParams({ tab: "viri" })}>Drugi viri</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Išči po imenu, podjetju, e-pošti, telefonu" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setSourceFilter("all")} className={`text-xs px-3 py-1.5 rounded-full border ${sourceFilter === "all" ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>Vsi viri</button>
              {sourceCounts.map(([k, n]) => {
                const S = SOURCES[k];
                return <button key={k} onClick={() => setSourceFilter(k)} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${sourceFilter === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}><S.icon className="w-3 h-3" />{S.label} {n}</button>;
              })}
            </div>
            <div className="ml-auto flex rounded-xl border p-0.5 bg-card">
              <button onClick={() => setView("pipeline")} className={`px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 ${view === "pipeline" ? "bg-muted font-medium" : "text-muted-foreground"}`}><LayoutGrid className="w-3.5 h-3.5" />Faze</button>
              <button onClick={() => setView("list")} className={`px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 ${view === "list" ? "bg-muted font-medium" : "text-muted-foreground"}`}><List className="w-3.5 h-3.5" />Seznam</button>
            </div>
          </div>

          {view === "pipeline" ? (
            <div className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-3 overflow-x-auto pb-3 -mx-1 px-1">
              {STAGES.map((st) => {
                const items = filtered.filter((l) => (l.status || "new") === st.key);
                const total = items.reduce((s, l) => s + (Number(l.value) || 0), 0);
                return (
                  <div key={st.key} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragId) update.mutate({ id: dragId, data: { status: st.key } }); setDragId(null); }}
                    className={`rounded-2xl bg-muted/50 border border-transparent p-2.5 min-h-[320px] ${dragId ? "border-dashed border-primary/30" : ""}`}>
                    <div className="flex items-center justify-between px-1 pb-2">
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}</p>
                        <p className="text-[11px] text-muted-foreground">{st.hint}{total > 0 ? ` · ${eur(total)}` : ""}</p>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{items.length}</span>
                    </div>
                    <div className="space-y-2">{items.map((l) => <LeadCard key={l.id} lead={l} />)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-elevated overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Stranka</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Podjetje</th>
                    <th className="text-left px-4 py-3 font-medium">Faza</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Vir</th>
                    <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Vrednost</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Zadnja aktivnost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((l) => {
                    const S = SOURCES[l.source] || SOURCES.manual; const st = STAGE[l.status] || STAGE.new;
                    return (
                      <tr key={l.id} onClick={() => open(l.id)} className="hover:bg-muted/30 cursor-pointer">
                        <td className="px-4 py-3"><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.email || l.phone || "—"}</p></td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{companiesById[l.company_id]?.name || "—"}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}</span></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span></td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">{l.value ? eur(l.value) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{ago(l.last_inbound_at || l.created_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <CustomerImportModal open={showImport} onOpenChange={setShowImport} />

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj stranko</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5"><Label>Ime in priimek *</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>E-pošta</Label><Input value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} placeholder="ime@primer.si" /></div>
              <div className="space-y-1.5"><Label>Telefon</Label><Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="040 123 456" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Podjetje</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={newLead.company_id} onChange={(e) => setNewLead({ ...newLead, company_id: e.target.value })}>
                  <option value="">— zasebna oseba / novo —</option>{[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!newLead.company_id && <Input value={newLead.new_company} onChange={(e) => setNewLead({ ...newLead, new_company: e.target.value })} placeholder="ali vpišite novo podjetje" className="h-8 text-sm" />}
              </div>
              <div className="space-y-1.5"><Label>Funkcija</Label><Input value={newLead.position} onChange={(e) => setNewLead({ ...newLead, position: e.target.value })} placeholder="Npr. direktor" /></div>
            </div>
            <div className="space-y-1.5"><Label>Kaj želi / opombe</Label><Textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} className="h-20" placeholder="Npr. klical je glede prenove spletne strani" /></div>
            <div className="space-y-1.5"><Label>Ocenjena vrednost posla (€)</Label><Input type="number" value={newLead.value} onChange={(e) => setNewLead({ ...newLead, value: e.target.value })} placeholder="neobvezno" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={newLead.consent_email} onChange={(e) => setNewLead({ ...newLead, consent_email: e.target.checked })} />Strinja se s prejemanjem e-pošte</label>
            <Button className="w-full btn-brand" onClick={() => create.mutate(newLead)} disabled={!newLead.name || create.isPending}>{create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani stranko</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
