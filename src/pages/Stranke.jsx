import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import ReplyInbox from "@/components/stranke/ReplyInbox";
import CustomersTable, { CustomersToolbar, StatusIcons, SourceIcon, quickFilters } from "@/components/stranke/CustomersTable";
import SourcesChart from "@/components/stranke/SourcesChart";
import { CompaniesPanel } from "@/pages/Podjetja";
import { Building2 as BuildingIcon, Upload as UploadIcon } from "lucide-react";
import { STAGES, STAGE, SOURCES, ago, firstLine, eur } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";

// Ena stran za vse stranke in povpraševanja (CRM): cevovod po fazah, seznam, viri. Klik odpre celotno stran stranke.
export default function Stranke() {
  const { business } = useBusiness();
  const navigate = useNavigate();
  const invalidate = useCrmInvalidate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  // Pogled: tabela (privzeto pri več strankah) ali faze; izbira si zapomni.
  const [viewPref, setViewPref] = useState(() => { try { return localStorage.getItem("stranke-pogled") || ""; } catch { return ""; } });
  const [tableStage, setTableStage] = useState("all");
  const [search, setSearch] = useState(params.get("q") || "");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [quick, setQuick] = useState(null);
  const [tagFilter, setTagFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [dragId, setDragId] = useState(null);
  const emptyLead = { name: "", email: "", phone: "", notes: "", position: "", company_id: "", new_company: "", value: "", consent_email: true };
  const [newLead, setNewLead] = useState(emptyLead);
  const bid = business?.id;

  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }, "-created_date", 5000), enabled: !!bid });
  const view = viewPref || (leads.length > 30 ? "list" : "pipeline");
  const setView = (v) => { setViewPref(v); try { localStorage.setItem("stranke-pogled", v); } catch { /* */ } };
  const { data: drafts = [] } = useQuery({ queryKey: ["drafts-all", bid], queryFn: () => base44.entities.DraftMessage.filter({ business_id: bid }), enabled: !!bid });
  const { data: companies = [] } = useQuery({ queryKey: ["companies", bid], queryFn: () => base44.entities.Company.filter({ business_id: bid }), enabled: !!bid });
  const { data: activities = [] } = useQuery({ queryKey: ["activities", bid], queryFn: () => base44.entities.Activity.filter({ business_id: bid }, "-created_date", 1000), enabled: !!bid });
  const pendingCount = drafts.filter((d) => ["pending", "flagged_for_review"].includes(d.status)).length;
  const tabParam = params.get("tab");
  const tab = ["viri", "odgovori", "stranke", "podjetja"].includes(tabParam) ? tabParam : (pendingCount > 0 ? "odgovori" : "stranke");
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

  const quickBase = useMemo(() => quickFilters(pendingByLead, tasksByLead), [pendingByLead, tasksByLead]);
  const quickDefs = quickBase.map((q) => ({ ...q, n: leads.filter(q.fn).length }));
  // Iskanje + filtri (brez faze) = osnova za števce faz in pogled Faze; faza se uporabi samo v tabeli.
  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    const comp = companiesById[l.company_id]?.name;
    const okQ = !q || [l.name, l.email, l.phone, l.notes, comp, (l.tags || []).join(" ")].some((v) => String(v || "").toLowerCase().includes(q));
    const okS = sourceFilter === "all" || l.source === sourceFilter;
    const qf = quickBase.find((x) => x.k === quick);
    return okQ && okS && (!qf || qf.fn(l)) && (!tagFilter || (l.tags || []).includes(tagFilter));
  }).sort((a, b) => new Date(b.last_inbound_at || b.created_date) - new Date(a.last_inbound_at || a.created_date));
  const tableRows = tableStage === "all" ? filtered : filtered.filter((l) => (l.status || "new") === tableStage);
  const open = (id) => navigate(`/stranke/${id}`);

  const stageMany = async (list, status) => {
    const todo = list.filter((l) => (l.status || "new") !== status);
    for (let i = 0; i < todo.length; i += 10) await Promise.all(todo.slice(i, i + 10).map((l) => base44.entities.Lead.update(l.id, { status })));
    invalidate();
    if (todo.length > 1) toast.success(`Premaknjeno v fazo »${STAGE[status]?.label}«: ${todo.length}.`);
  };
  const tagMany = async (list, tag) => {
    const todo = list.filter((l) => !(l.tags || []).includes(tag));
    for (let i = 0; i < todo.length; i += 10) await Promise.all(todo.slice(i, i + 10).map((l) => base44.entities.Lead.update(l.id, { tags: [...(l.tags || []), tag] })));
    invalidate(); toast.success(`Oznaka »${tag}« dodana: ${todo.length}.`);
  };
  const saveViews = async (views) => { try { await base44.entities.Business.update(bid, { customer_views: views }); queryClient.invalidateQueries({ queryKey: ["business"] }); } catch (e) { toast.error(e.message); } };
  const exportCsv = (list) => {
    const data = Array.isArray(list) ? list : filtered;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Ime", "Podjetje", "E-pošta", "Telefon", "Faza", "Vir", "Vrednost", "Zadnja aktivnost", "Opombe"], ...data.map((l) => [l.name, companiesById[l.company_id]?.name, l.email, l.phone, STAGE[l.status]?.label || l.status, SOURCES[l.source]?.label || l.source, l.value, l.last_inbound_at || l.created_date, l.notes])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `stranke-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  const LeadCard = ({ lead }) => {
    const comp = companiesById[lead.company_id];
    return (
      <div role="button" tabIndex={0} draggable onDragStart={() => setDragId(lead.id)} onDragEnd={() => setDragId(null)} onClick={() => open(lead.id)} onKeyDown={(e) => { if (e.key === "Enter") open(lead.id); }}
        className={`w-full text-left bg-card border rounded-lg p-3 hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer ${dragId === lead.id ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm leading-tight truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{comp?.name || lead.email || lead.phone || "—"}</p>
          </div>
          <SourceIcon source={lead.source} />
        </div>
        {(lead.service_requested || lead.notes) && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{lead.service_requested || firstLine(lead.notes)}</p>}
        <div className="flex items-center justify-between mt-2 gap-2 min-h-7">
          <span className="text-xs text-muted-foreground">{ago(lead.last_inbound_at || lead.created_date)}{lead.value ? <span className="text-foreground font-medium"> · {eur(lead.value)}</span> : null}</span>
          <StatusIcons lead={lead} pending={pendingByLead[lead.id] || 0} tasks={tasksByLead[lead.id] || 0} onOpen={open} />
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1>Stranke</h1>
        <div className="flex gap-1.5 items-center">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowImport(true)}><UploadIcon className="w-4 h-4 mr-2" />Uvozi</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={() => exportCsv()} disabled={!filtered.length}><Download className="w-4 h-4 mr-2" />Izvozi</Button>
          {tab === "podjetja"
            ? <Button className="btn-brand" onClick={() => setShowAddCompany(true)}><BuildingIcon className="w-4 h-4 mr-2" />Dodaj podjetje</Button>
            : <Button className="btn-brand" onClick={() => setShowAdd(true)}><UserPlus className="w-4 h-4 mr-2" />Dodaj stranko</Button>}
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {[["odgovori", "Čaka na vaš odgovor", pendingCount], ["stranke", `Vse stranke (${leads.length})`], ["podjetja", `Podjetja (${companies.length})`], ["viri", "Od kod pridejo"]].map(([k, l, n]) => (
          <button key={k} onClick={() => setParams({ tab: k })}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2 ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}{n > 0 && <span className="text-[11px] font-bold text-white bg-primary rounded-full min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center">{n}</span>}</button>
        ))}
      </div>

      {tab === "viri" ? (
        <SourcesChart leads={leads} />
      ) : tab === "podjetja" ? (
        <CompaniesPanel showAdd={showAddCompany} setShowAdd={setShowAddCompany} />
      ) : tab === "odgovori" ? (
        <ReplyInbox drafts={drafts} leads={leads} activities={activities} />
      ) : leads.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <h2 className="text-xl mt-4">Še nimate strank</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Povežite e-poštni predal in AI bo sam našel povpraševanja, ali vstavite obrazec na svojo spletno stran.</p>
          <div className="flex gap-2 justify-center mt-5">
            <Button className="btn-brand" asChild><Link to="/nastavitve?tab=integracije"><Mail className="w-4 h-4 mr-2" />Poveži e-pošto</Link></Button>
            <Button variant="outline" asChild><Link to="/nastavitve?tab=viri">Drugi viri</Link></Button>
          </div>
        </div>
      ) : (
        <>
          <CustomersToolbar leads={filtered} search={search} setSearch={setSearch} stage={tableStage} setStage={setTableStage} showStages={view === "list"}
            quick={quick} setQuick={setQuick} quickDefs={quickDefs} tag={tagFilter} setTag={setTagFilter} source={sourceFilter} setSource={setSourceFilter}
            views={business?.customer_views || []} onSaveViews={saveViews} view={view} setView={setView} />

          {view === "pipeline" ? (
            <div className="grid grid-flow-col auto-cols-[minmax(200px,1fr)] gap-3 overflow-x-auto pb-3 -mx-1 px-1">
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
                    <div className="space-y-2">{items.slice(0, 12).map((l) => <LeadCard key={l.id} lead={l} />)}</div>
                    {items.length > 12 && <button onClick={() => { setTableStage(st.key); setView("list"); }} className="w-full mt-2 text-xs text-primary font-medium rounded-lg border border-dashed py-2 hover:bg-accent/50">Pokaži vseh {items.length} v tabeli</button>}
                  </div>
                );
              })}
            </div>
          ) : (
            <CustomersTable leads={tableRows} companiesById={companiesById} pendingByLead={pendingByLead} tasksByLead={tasksByLead} onOpen={open} onStage={stageMany} onExport={exportCsv} onTag={tagMany} />
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
