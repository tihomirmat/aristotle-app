import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Building2, ListChecks, MailCheck, Download, X, MailX, Tag, Bookmark, BookmarkPlus } from "lucide-react";
import { cleanTag } from "@/components/stranke/TagsEditor";
import { STAGES, STAGE, SOURCES, ago, eur, cnt, W, fmtDate } from "@/lib/crm";

// Namizna tabela strank za več sto zapisov: faze s števci, hitri filtri, razvrščanje, strani, množična dejanja.
// Klik na vrstico odpre stranko. Fazo je mogoče spremeniti kar v vrstici.
const lastTouch = (l) => l.last_inbound_at && l.last_contacted_at ? (new Date(l.last_inbound_at) > new Date(l.last_contacted_at) ? l.last_inbound_at : l.last_contacted_at) : (l.last_inbound_at || l.last_contacted_at || l.created_date);
const DAY = 86400000;
const SORTS = {
  name: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sl"),
  company: (a, b, ctx) => String(ctx.comp(a) || "￿").localeCompare(String(ctx.comp(b) || "￿"), "sl"),
  value: (a, b) => (Number(a.value) || 0) - (Number(b.value) || 0),
  touch: (a, b) => new Date(lastTouch(a)) - new Date(lastTouch(b)),
  created: (a, b) => new Date(a.created_date) - new Date(b.created_date),
};

export default function CustomersTable({ leads, companiesById = {}, pendingByLead = {}, tasksByLead = {}, onOpen, onStage, onExport, onTag, views = [], onSaveViews, initialStage = "all" }) {
  const [stage, setStage] = useState(initialStage);
  const [quick, setQuick] = useState(null); // pending | quiet | tasks
  const [tag, setTag] = useState("");
  const [naming, setNaming] = useState(null); // ime novega shranjenega pogleda
  const [bulkTag, setBulkTag] = useState("");
  const [sort, setSort] = useState({ key: "touch", dir: "desc" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => { setStage(initialStage); }, [initialStage]);

  const comp = (l) => companiesById[l.company_id]?.name || "";
  const stageCounts = useMemo(() => { const m = {}; leads.forEach((l) => { const k = l.status || "new"; m[k] = (m[k] || 0) + 1; }); return m; }, [leads]);
  const stageValue = useMemo(() => { const m = {}; leads.forEach((l) => { const k = l.status || "new"; m[k] = (m[k] || 0) + (Number(l.value) || 0); }); return m; }, [leads]);
  const quickDefs = [
    ["pending", "Odgovor pripravljen", MailCheck, (l) => pendingByLead[l.id] > 0],
    ["tasks", "Z odprtim opravilom", ListChecks, (l) => tasksByLead[l.id] > 0],
    ["quiet", "Brez stika 30+ dni", null, (l) => !["converted", "lost", "unsubscribed"].includes(l.status) && Date.now() - new Date(lastTouch(l)).getTime() > 30 * DAY],
  ].map(([k, label, Icon, fn]) => ({ k, label, Icon, fn, n: leads.filter(fn).length }));

  const allTags = useMemo(() => { const m = {}; leads.forEach((l) => (l.tags || []).forEach((t) => { m[t] = (m[t] || 0) + 1; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [leads]);
  const filtersOn = stage !== "all" || !!quick || !!tag;
  const applyView = (v) => { setStage(v.stage || "all"); setQuick(v.quick || null); setTag(v.tag || ""); if (v.sort?.key) setSort(v.sort); };
  const isView = (v) => (v.stage || "all") === stage && (v.quick || null) === quick && (v.tag || "") === tag;
  const saveView = () => { const name = String(naming || "").trim().slice(0, 30); if (!name) return; onSaveViews?.([...views.filter((v) => v.name !== name), { name, stage, quick, tag, sort }].slice(-8)); setNaming(null); };
  const rows = useMemo(() => {
    const q = quickDefs.find((x) => x.k === quick);
    const out = leads.filter((l) => (stage === "all" || (l.status || "new") === stage) && (!q || q.fn(l)) && (!tag || (l.tags || []).includes(tag)));
    const f = SORTS[sort.key] || SORTS.touch;
    out.sort((a, b) => f(a, b, { comp }) * (sort.dir === "asc" ? 1 : -1));
    return out;
  }, [leads, stage, quick, tag, sort, pendingByLead, tasksByLead, companiesById]);
  useEffect(() => { setPage(0); }, [stage, quick, tag, leads.length, size]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * size, cur * size + size);
  const allShownSelected = shown.length > 0 && shown.every((l) => selected.has(l.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); shown.forEach((l) => (allShownSelected ? n.delete(l.id) : n.add(l.id))); return n; });
  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const Th = ({ k, children, className = "" }) => (
    <th className={`px-3 py-2.5 font-medium ${className}`}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))} className={`inline-flex items-center gap-1 hover:text-foreground ${sort.key === k ? "text-foreground" : ""}`}>
        {children}{sort.key === k && (sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Faze kot filter s števci in vrednostjo */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        <button onClick={() => setStage("all")} className={`text-left rounded-xl border px-3 py-2 transition-colors ${stage === "all" ? "border-primary bg-accent/50 ring-1 ring-primary/30" : "bg-card hover:border-primary/40"}`}>
          <p className="text-xs text-muted-foreground">Vse stranke</p><p className="text-lg font-display font-bold leading-tight">{leads.length}</p>
        </button>
        {STAGES.map((s) => (
          <button key={s.key} onClick={() => setStage(s.key)} title={s.hint} className={`text-left rounded-xl border px-3 py-2 transition-colors ${stage === s.key ? "border-primary bg-accent/50 ring-1 ring-primary/30" : "bg-card hover:border-primary/40"}`}>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}</p>
            <p className="text-lg font-display font-bold leading-tight">{stageCounts[s.key] || 0}{stageValue[s.key] > 0 && <span className="text-xs font-normal text-muted-foreground ml-2">{eur(stageValue[s.key])}</span>}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {quickDefs.filter((q) => q.n > 0).map((q) => (
          <button key={q.k} onClick={() => setQuick(quick === q.k ? null : q.k)} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${quick === q.k ? "bg-primary text-white border-primary" : "bg-card hover:bg-muted"}`}>
            {q.Icon && <q.Icon className="w-3.5 h-3.5" />}{q.label}<span className={`font-semibold ${quick === q.k ? "" : "text-primary"}`}>{q.n}</span>
          </button>
        ))}
        {allTags.length > 0 && (
          <label className={`text-xs pl-3 pr-1 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${tag ? "bg-primary text-white border-primary" : "bg-card"}`}><Tag className="w-3.5 h-3.5" />
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="bg-transparent text-xs py-1 pr-1 cursor-pointer focus:outline-none">
              <option value="" className="text-foreground">Vse oznake</option>{allTags.map(([t, n]) => <option key={t} value={t} className="text-foreground">{t} ({n})</option>)}
            </select>
          </label>
        )}
        {filtersOn && <button onClick={() => { setStage("all"); setQuick(null); setTag(""); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="w-3.5 h-3.5" />Počisti filtre</button>}
        <span className="ml-auto text-xs text-muted-foreground">{rows.length === leads.length ? cnt(rows.length, W.stranka) : `${rows.length} od ${leads.length}`}</span>
      </div>

      {(views.length > 0 || (filtersOn && onSaveViews)) && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {views.length > 0 && <span className="text-muted-foreground inline-flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" />Moji pogledi:</span>}
          {views.map((v) => (
            <span key={v.name} className={`inline-flex items-center rounded-full border ${isView(v) ? "border-primary bg-accent/60 font-medium" : "bg-card hover:bg-muted"}`}>
              <button onClick={() => applyView(v)} className="pl-3 pr-1.5 py-1">{v.name}</button>
              <button onClick={() => onSaveViews?.(views.filter((x) => x.name !== v.name))} className="pr-2 text-muted-foreground hover:text-red-600" title="Izbriši pogled"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {filtersOn && onSaveViews && !views.some(isView) && (naming === null
            ? <button onClick={() => setNaming("")} className="inline-flex items-center gap-1 text-primary font-medium hover:underline"><BookmarkPlus className="w-3.5 h-3.5" />Shrani ta pogled</button>
            : <span className="inline-flex items-center gap-1.5"><input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveView(); if (e.key === "Escape") setNaming(null); }} placeholder="ime pogleda, npr. Vroči posli" className="h-7 w-48 rounded-md border px-2 bg-background" /><Button size="sm" className="h-7 btn-brand" onClick={saveView} disabled={!String(naming).trim()}>Shrani</Button><button onClick={() => setNaming(null)} className="text-muted-foreground"><X className="w-3.5 h-3.5" /></button></span>)}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-xl border border-primary/40 bg-accent/60 px-4 py-2.5 text-sm">
          <span className="font-semibold">Izbrano: {selected.size}</span>
          <label className="inline-flex items-center gap-2">Premakni v fazo
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => { if (e.target.value) { onStage(selectedLeads, e.target.value); setSelected(new Set()); } }}>
              <option value="">izberite …</option>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          {onTag && <span className="inline-flex items-center gap-1.5">Dodaj oznako
            <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && cleanTag(bulkTag)) { onTag(selectedLeads, cleanTag(bulkTag)); setBulkTag(""); setSelected(new Set()); } }} list="oznake-vse" placeholder="npr. VIP" className="h-8 w-32 rounded-md border bg-background px-2 text-sm" />
            <datalist id="oznake-vse">{allTags.map(([t]) => <option key={t} value={t} />)}</datalist>
            <Button size="sm" variant="outline" className="h-8" disabled={!cleanTag(bulkTag)} onClick={() => { onTag(selectedLeads, cleanTag(bulkTag)); setBulkTag(""); setSelected(new Set()); }}>Dodaj</Button>
          </span>}
          <Button size="sm" variant="outline" className="h-8" onClick={() => onExport(selectedLeads)}><Download className="w-3.5 h-3.5 mr-1.5" />Izvozi izbrane</Button>
          <button className="ml-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => setSelected(new Set())}><X className="w-4 h-4" />Počisti izbor</button>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b text-muted-foreground text-xs text-left sticky top-0">
              <tr>
                <th className="pl-4 pr-1 py-2.5 w-8"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} title="Izberi vse na tej strani" /></th>
                <Th k="name">Stranka</Th>
                <Th k="company" className="hidden md:table-cell">Podjetje</Th>
                <th className="px-3 py-2.5 font-medium">Faza</th>
                <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Vir</th>
                <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Kaj želi</th>
                <Th k="value" className="hidden lg:table-cell text-right">Vrednost</Th>
                <Th k="touch">Zadnji stik</Th>
                <Th k="created" className="hidden 2xl:table-cell">Dodano</Th>
                <th className="px-3 py-2.5 font-medium">Naslednje</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((l) => {
                const S = SOURCES[l.source] || SOURCES.manual; const st = STAGE[l.status] || STAGE.new;
                const quiet = Date.now() - new Date(lastTouch(l)).getTime() > 30 * DAY && !["converted", "lost", "unsubscribed"].includes(l.status);
                return (
                  <tr key={l.id} onClick={() => onOpen(l.id)} className={`cursor-pointer hover:bg-muted/40 ${selected.has(l.id) ? "bg-accent/40" : ""}`}>
                    <td className="pl-4 pr-1 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
                    <td className="px-3 py-2 max-w-[240px]"><p className="font-medium truncate">{l.name}</p><p className="text-xs text-muted-foreground truncate flex items-center gap-1">{l.email_bounced && <MailX className="w-3 h-3 text-red-600 shrink-0" title="E-pošta na ta naslov se je vrnila" />}{l.email || l.phone || "—"}</p>{(l.tags || []).length > 0 && <p className="flex gap-1 mt-0.5 flex-wrap">{l.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] rounded-full bg-accent px-1.5 py-px">{t}</span>)}{l.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{l.tags.length - 3}</span>}</p>}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell max-w-[180px]"><span className="truncate flex items-center gap-1.5">{comp(l) ? <><Building2 className="w-3.5 h-3.5 shrink-0" />{comp(l)}</> : "—"}</span></td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                        <select value={l.status || "new"} onChange={(e) => onStage([l], e.target.value)} className="bg-transparent text-xs font-medium rounded-md border border-transparent hover:border-border focus:border-primary py-1 pr-5 cursor-pointer" title="Spremeni fazo">
                          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}{l.status === "unsubscribed" && <option value="unsubscribed">Odjavljen</option>}
                        </select></span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell"><span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md whitespace-nowrap ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span></td>
                    <td className="px-3 py-2 hidden xl:table-cell text-xs text-muted-foreground max-w-[260px]"><span className="line-clamp-1">{l.service_requested || String(l.notes || "").replace(/^\[[^\]]*\]\s*/, "").split("\n")[0] || "—"}</span></td>
                    <td className="px-3 py-2 text-right hidden lg:table-cell whitespace-nowrap">{l.value ? eur(l.value) : <span className="text-muted-foreground">—</span>}</td>
                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${quiet ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>{ago(lastTouch(l))}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden 2xl:table-cell whitespace-nowrap">{fmtDate(l.created_date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {pendingByLead[l.id] > 0 ? <span className="text-[11px] font-semibold text-white bg-primary rounded-full px-2 py-0.5">odgovor pripravljen</span>
                        : tasksByLead[l.id] > 0 ? <span className="text-[11px] font-medium text-slate-700 bg-slate-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><ListChecks className="w-3 h-3" />{cnt(tasksByLead[l.id], ["opravilo", "opravili", "opravila", "opravil"])}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Ni strank, ki bi ustrezale izbranim filtrom.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
          <span>{rows.length ? `Prikazano ${cur * size + 1}–${Math.min(rows.length, cur * size + size)} od ${rows.length}` : "0 strank"}</span>
          <label className="inline-flex items-center gap-1.5">Na stran
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-7 rounded-md border bg-background px-1.5">{[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="w-4 h-4" />Nazaj</Button>
            <span className="px-2">Stran {cur + 1} od {pages}</span>
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Naprej<ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
