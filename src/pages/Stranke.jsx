import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, UserPlus, Loader2, Users, Upload, Download, Mail, FileText, MessageSquare, PenLine, Phone, LayoutGrid, List, Inbox, Clock, CheckCircle2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import { sl } from "date-fns/locale";
import CustomerImportModal from "@/components/stranke/CustomerImportModal";
import GenerateDraftButton from "@/components/stranke/GenerateDraftButton";
import LeadSources from "@/components/stranke/LeadSources";

// Ena stran za vse stranke in povpraševanja (CRM): cevovod po fazah, vir, časovnica.
const STAGES = [
  { key: "new", label: "Novo", hint: "Še niste odgovorili", dot: "bg-blue-500" },
  { key: "contacted", label: "Kontaktirano", hint: "Poslali ste odgovor", dot: "bg-amber-500" },
  { key: "replied", label: "Odgovorili so", hint: "Stranka je odpisala", dot: "bg-emerald-500" },
  { key: "booked", label: "Termin", hint: "Dogovorjen sestanek", dot: "bg-violet-500" },
  { key: "converted", label: "Stranka", hint: "Posel sklenjen", dot: "bg-primary" },
  { key: "lost", label: "Izgubljeno", hint: "Ni zanimanja", dot: "bg-slate-400" },
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s]));
STAGE.unsubscribed = { key: "unsubscribed", label: "Odjavljen", dot: "bg-slate-300" };

const SOURCES = {
  email: { label: "E-pošta", icon: Mail, cls: "text-primary bg-accent" },
  form: { label: "Obrazec", icon: FileText, cls: "text-emerald-700 bg-emerald-50" },
  chatbot: { label: "Klepet", icon: MessageSquare, cls: "text-violet-700 bg-violet-50" },
  import: { label: "Uvoz", icon: Upload, cls: "text-slate-700 bg-slate-100" },
  manual: { label: "Ročno", icon: PenLine, cls: "text-slate-700 bg-slate-100" },
};

const ago = (d) => (d ? formatDistanceToNowStrict(new Date(d), { locale: sl, addSuffix: true }) : "");
const firstLine = (s) => String(s || "").replace(/^\[[^\]]*\]\s*/, "").split("\n")[0].slice(0, 140);

export default function Stranke() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "viri" ? "viri" : "stranke";
  const [view, setView] = useState("pipeline");
  const [search, setSearch] = useState(params.get("q") || "");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "", notes: "", consent_email: true });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: drafts = [] } = useQuery({
    queryKey: ["drafts-all", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const draftsByLead = useMemo(() => {
    const m = {};
    drafts.forEach((d) => { (m[d.lead_id] = m[d.lead_id] || []).push(d); });
    Object.values(m).forEach((arr) => arr.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    return m;
  }, [drafts]);

  const invalidate = () => ["leads", "leads_all", "drafts-all"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const update = useMutation({ mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data), onSuccess: invalidate });
  const create = useMutation({
    mutationFn: (data) => base44.entities.Lead.create({ ...data, business_id: business.id, source: "manual", status: "new" }),
    onSuccess: () => { invalidate(); setShowAdd(false); setNewLead({ name: "", email: "", phone: "", notes: "", consent_email: true }); toast.success("Stranka dodana."); },
  });

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    const okQ = !q || [l.name, l.email, l.phone, l.notes].some((v) => String(v || "").toLowerCase().includes(q));
    const okS = sourceFilter === "all" || l.source === sourceFilter;
    return okQ && okS;
  }).sort((a, b) => new Date(b.last_inbound_at || b.created_date) - new Date(a.last_inbound_at || a.created_date));

  const selected = leads.find((l) => l.id === selectedId);
  const pendingFor = (id) => (draftsByLead[id] || []).filter((d) => d.status === "pending" || d.status === "flagged_for_review").length;
  const sourceCounts = Object.keys(SOURCES).map((k) => [k, leads.filter((l) => l.source === k).length]).filter(([, n]) => n > 0);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Ime", "E-pošta", "Telefon", "Faza", "Vir", "Zadnja aktivnost", "Opombe"], ...filtered.map((l) => [l.name, l.email, l.phone, STAGE[l.status]?.label || l.status, SOURCES[l.source]?.label || l.source, l.last_inbound_at || l.created_date, l.notes])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `stranke-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  const LeadCard = ({ lead }) => {
    const S = SOURCES[lead.source] || SOURCES.manual;
    const pending = pendingFor(lead.id);
    return (
      <button
        draggable onDragStart={() => setDragId(lead.id)} onDragEnd={() => setDragId(null)}
        onClick={() => setSelectedId(lead.id)}
        className={`w-full text-left bg-card border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all ${dragId === lead.id ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-tight truncate">{lead.name}</p>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span>
        </div>
        {(lead.service_requested || lead.notes) && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{lead.service_requested || firstLine(lead.notes)}</p>}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{ago(lead.last_inbound_at || lead.created_date)}</span>
          {pending > 0 && <span className="text-[10px] font-semibold text-white bg-primary rounded-full px-1.5 py-0.5">{pending} za odobritev</span>}
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
          <p className="text-muted-foreground mt-1 max-w-2xl">Vsa povpraševanja in stranke na enem mestu — iz e-pošte, obrazca na spletni strani, klepeta ali dodane ročno. Kliknite stranko za zgodovino in odgovor.</p>
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
              <Input placeholder="Išči po imenu, e-pošti, telefonu, opombah" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                return (
                  <div key={st.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragId) update.mutate({ id: dragId, data: { status: st.key } }); setDragId(null); }}
                    className={`rounded-2xl bg-muted/50 border border-transparent p-2.5 min-h-[320px] ${dragId ? "border-dashed border-primary/30" : ""}`}>
                    <div className="flex items-center justify-between px-1 pb-2">
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}</p>
                        <p className="text-[11px] text-muted-foreground">{st.hint}</p>
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
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Kaj želi</th>
                    <th className="text-left px-4 py-3 font-medium">Faza</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Vir</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Zadnja aktivnost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((l) => {
                    const S = SOURCES[l.source] || SOURCES.manual; const st = STAGE[l.status] || STAGE.new;
                    return (
                      <tr key={l.id} onClick={() => setSelectedId(l.id)} className="hover:bg-muted/30 cursor-pointer">
                        <td className="px-4 py-3"><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.email || l.phone || "—"}</p></td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{l.service_requested || firstLine(l.notes) || "—"}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}</span></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span></td>
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

      {/* Podrobnost stranke */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (() => {
            const S = SOURCES[selected.source] || SOURCES.manual;
            const history = draftsByLead[selected.id] || [];
            return (
              <div className="space-y-6">
                <SheetHeader className="text-left">
                  <SheetTitle className="font-display text-2xl">{selected.name}</SheetTitle>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {selected.email && <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="w-4 h-4" />{selected.email}</a>}
                    {selected.phone && <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="w-4 h-4" />{selected.phone}</a>}
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span>
                  </div>
                </SheetHeader>

                <div>
                  <Label className="text-xs text-muted-foreground">Faza</Label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {STAGES.map((st) => (
                      <button key={st.key} onClick={() => update.mutate({ id: selected.id, data: { status: st.key } })}
                        className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${selected.status === st.key ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}
                      </button>
                    ))}
                  </div>
                  {selected.status === "converted" && <p className="text-xs text-muted-foreground mt-2">Po zaključku storitve AI pripravi prošnjo za Google oceno (če je nastavljena povezava za ocene).</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <GenerateDraftButton lead={selected} businessId={business?.id} />
                  {pendingFor(selected.id) > 0 && <Button variant="outline" asChild><Link to="/prejeto"><Inbox className="w-4 h-4 mr-2" />{pendingFor(selected.id)} čaka na odobritev</Link></Button>}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Opombe in povpraševanje</Label>
                  <Textarea key={selected.id} defaultValue={selected.notes || ""} className="h-40 mt-2 text-sm"
                    onBlur={(e) => e.target.value !== (selected.notes || "") && update.mutate({ id: selected.id, data: { notes: e.target.value } })} />
                  <p className="text-[11px] text-muted-foreground mt-1">Shrani se samo, ko kliknete izven polja. AI te opombe uporabi pri pisanju odgovorov.</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Zgodovina sporočil</Label>
                  <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
                    <div className="relative">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <p className="text-xs text-muted-foreground">{format(new Date(selected.created_date), "d. M. yyyy HH:mm")}</p>
                      <p className="text-sm">Povpraševanje prek: {S.label}{selected.email_subject ? ` — »${selected.email_subject}«` : ""}</p>
                    </div>
                    {history.map((d) => (
                      <div key={d.id} className="relative">
                        <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${d.status === "sent" ? "bg-emerald-500" : d.status === "skipped" ? "bg-slate-300" : "bg-primary"}`} />
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {format(new Date(d.sent_at || d.created_date), "d. M. yyyy HH:mm")} ·
                          {d.status === "sent" ? <><Send className="w-3 h-3" />Poslano</> : d.status === "skipped" ? <><X className="w-3 h-3" />Ni poslano</> : d.status === "approved" ? <><CheckCircle2 className="w-3 h-3" />Odobreno</> : <><Inbox className="w-3 h-3" />Čaka na odobritev</>}
                        </p>
                        <p className="text-sm font-medium">{d.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{d.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

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
            <div className="space-y-1.5"><Label>Kaj želi / opombe</Label><Textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} className="h-20" placeholder="Npr. klical je glede prenove spletne strani" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={newLead.consent_email} onChange={(e) => setNewLead({ ...newLead, consent_email: e.target.checked })} />Strinja se s prejemanjem e-pošte</label>
            <Button className="w-full btn-brand" onClick={() => create.mutate(newLead)} disabled={!newLead.name || create.isPending}>{create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani stranko</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
