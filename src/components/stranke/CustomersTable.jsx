import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ListChecks, MailCheck, Download, X, MailX, Bookmark, SlidersHorizontal, Search, List, LayoutGrid, Check } from "lucide-react";
import IconHint from "@/components/ui/IconHint";
import { cleanTag } from "@/components/stranke/TagsEditor";
import { STAGES, STAGE, SOURCES, ago, eur, cnt, fmtDate } from "@/lib/crm";

// Stranke za namizje: en mirni pas orodij (iskanje, faze, Filtri, Pogledi, pogled) + pregledna tabela.
export const lastTouch = (l) => l.last_inbound_at && l.last_contacted_at ? (new Date(l.last_inbound_at) > new Date(l.last_contacted_at) ? l.last_inbound_at : l.last_contacted_at) : (l.last_inbound_at || l.last_contacted_at || l.created_date);
const DAY = 86400000;
const OPRAVILA = ["odprto opravilo", "odprti opravili", "odprta opravila", "odprtih opravil"];
export const isQuiet = (l) => !["converted", "lost", "unsubscribed"].includes(l.status) && Date.now() - new Date(lastTouch(l)).getTime() > 30 * DAY;
export const quickFilters = (pendingByLead, tasksByLead) => [
  { k: "pending", label: "Odgovor pripravljen", fn: (l) => pendingByLead[l.id] > 0 },
  { k: "tasks", label: "Z odprtim opravilom", fn: (l) => tasksByLead[l.id] > 0 },
  { k: "quiet", label: "Brez stika 30+ dni", fn: isQuiet },
];

// Ikone stanja v vrstici/kartici: pripravljen odgovor, opravila, vrnjena e-pošta.
export function StatusIcons({ lead, pending = 0, tasks = 0, onOpen }) {
  if (!pending && !tasks && !lead.email_bounced) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {pending > 0 && (
        <IconHint label={pending > 1 ? `${pending} pripravljeni odgovori čakajo na vaš pregled` : "Odgovor je pripravljen in čaka na vaš pregled"}>
          <button type="button" aria-label="Odgovor je pripravljen" onClick={(e) => { e.stopPropagation(); onOpen?.(lead.id); }}
            className="relative w-7 h-7 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
            <MailCheck className="w-4 h-4" />
            {pending > 1 && <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-primary text-white rounded-full min-w-[14px] h-[14px] px-0.5 inline-flex items-center justify-center">{pending}</span>}
          </button>
        </IconHint>
      )}
      {tasks > 0 && (
        <IconHint label={cnt(tasks, OPRAVILA)}>
          <span aria-label={cnt(tasks, OPRAVILA)} className="h-7 min-w-7 px-1.5 rounded-full bg-slate-100 text-slate-600 inline-flex items-center justify-center gap-0.5 text-[11px] font-medium"><ListChecks className="w-3.5 h-3.5" />{tasks > 1 ? tasks : ""}</span>
        </IconHint>
      )}
      {lead.email_bounced && (
        <IconHint label="E-pošta na ta naslov se je vrnila – naslov verjetno ne obstaja">
          <span aria-label="E-pošta se je vrnila" className="w-7 h-7 rounded-full bg-red-50 text-red-600 inline-flex items-center justify-center"><MailX className="w-3.5 h-3.5" /></span>
        </IconHint>
      )}
    </span>
  );
}

export function SourceIcon({ source }) {
  const S = SOURCES[source] || SOURCES.manual;
  return (
    <IconHint label={`Vir: ${S.label}`}>
      <span aria-label={`Vir: ${S.label}`} className="inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-md text-muted-foreground"><S.icon className="w-3.5 h-3.5" /></span>
    </IconHint>
  );
}

// Pas orodij: vse filtre združi v eno vrstico; aktivni filtri so vidni kot majhni čipi pod njo.
export function CustomersToolbar({ leads, search, setSearch, stage, setStage, showStages, quick, setQuick, quickDefs, tag, setTag, source, setSource, views = [], onSaveViews, view, setView }) {
  const [naming, setNaming] = useState("");
  const stageCounts = useMemo(() => { const m = {}; leads.forEach((l) => { const k = l.status || "new"; m[k] = (m[k] || 0) + 1; }); return m; }, [leads]);
  const stageValue = useMemo(() => { const m = {}; leads.forEach((l) => { const k = l.status || "new"; m[k] = (m[k] || 0) + (Number(l.value) || 0); }); return m; }, [leads]);
  const allTags = useMemo(() => { const m = {}; leads.forEach((l) => (l.tags || []).forEach((t) => { m[t] = (m[t] || 0) + 1; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [leads]);
  const srcCounts = Object.keys(SOURCES).map((k) => [k, leads.filter((l) => l.source === k).length]).filter(([, n]) => n > 0);
  const nActive = (quick ? 1 : 0) + (tag ? 1 : 0) + (source !== "all" ? 1 : 0);
  const filtersOn = nActive > 0 || (showStages && stage !== "all");
  const cur = { stage: showStages ? stage : "all", quick: quick || null, tag: tag || "", source };
  const isView = (v) => (v.stage || "all") === cur.stage && (v.quick || null) === cur.quick && (v.tag || "") === cur.tag && (v.source || "all") === cur.source;
  const applyView = (v) => { setStage(v.stage || "all"); setQuick(v.quick || null); setTag(v.tag || ""); setSource(v.source || "all"); };
  const saveView = () => { const name = naming.trim().slice(0, 30); if (!name) return; onSaveViews?.([...views.filter((v) => v.name !== name), { name, ...cur }].slice(-8)); setNaming(""); };
  const Opt = ({ on, onClick, children, n }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted ${on ? "font-medium" : ""}`}>
      <span className={`w-4 h-4 rounded border inline-flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-white" : "border-slate-300"}`}>{on && <Check className="w-3 h-3" />}</span>
      <span className="flex-1 truncate">{children}</span>{n != null && <span className="text-xs text-muted-foreground">{n}</span>}
    </button>
  );
  const chips = [
    quick && { k: "q", label: quickDefs.find((q) => q.k === quick)?.label, clear: () => setQuick(null) },
    source !== "all" && { k: "s", label: `Vir: ${SOURCES[source]?.label || source}`, clear: () => setSource("all") },
    tag && { k: "t", label: `Oznaka: ${tag}`, clear: () => setTag("") },
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Išči stranko" aria-label="Išči po imenu, podjetju, e-pošti, telefonu ali oznaki" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        {showStages && (
          <div className="inline-flex items-center rounded-lg bg-muted/70 p-0.5 overflow-x-auto max-w-full" role="tablist" aria-label="Faza">
            {[{ key: "all", label: "Vse", hint: "Vse stranke" }, ...STAGES].map((s) => {
              const n = s.key === "all" ? leads.length : (stageCounts[s.key] || 0);
              const on = stage === s.key;
              return (
                <button key={s.key} role="tab" aria-selected={on} onClick={() => setStage(s.key)} title={`${s.hint}${stageValue[s.key] > 0 ? ` · ${eur(stageValue[s.key])}` : ""}`}
                  className={`px-3 h-8 rounded-md text-sm whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${on ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {s.dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}{s.label}<span className="text-xs tabular-nums text-muted-foreground/80">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9"><SlidersHorizontal className="w-4 h-4 mr-1.5" />Filtri{nActive > 0 && <span className="ml-1.5 text-[11px] font-bold text-white bg-primary rounded-full w-5 h-5 inline-flex items-center justify-center">{nActive}</span>}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2">
              <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">Pokaži samo</p>
              {quickDefs.map((q) => <Opt key={q.k} on={quick === q.k} onClick={() => setQuick(quick === q.k ? null : q.k)} n={q.n}>{q.label}</Opt>)}
              {srcCounts.length > 1 && <>
                <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">Od kod je stranka</p>
                {srcCounts.map(([k, n]) => <Opt key={k} on={source === k} onClick={() => setSource(source === k ? "all" : k)} n={n}>{SOURCES[k].label}</Opt>)}
              </>}
              {allTags.length > 0 && <>
                <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">Oznaka</p>
                <div className="max-h-40 overflow-y-auto">{allTags.map(([t, n]) => <Opt key={t} on={tag === t} onClick={() => setTag(tag === t ? "" : t)} n={n}>{t}</Opt>)}</div>
              </>}
              {nActive > 0 && <button onClick={() => { setQuick(null); setTag(""); setSource("all"); }} className="w-full mt-2 border-t pt-2 text-xs text-muted-foreground hover:text-foreground">Počisti filtre</button>}
            </PopoverContent>
          </Popover>

          {onSaveViews && (views.length > 0 || filtersOn) && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9"><Bookmark className="w-4 h-4 mr-1.5" />Pogledi</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2">
                {views.length > 0 ? <>
                  <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">Moji pogledi</p>
                  {views.map((v) => (
                    <div key={v.name} className="flex items-center">
                      <Opt on={isView(v)} onClick={() => applyView(v)}>{v.name}</Opt>
                      <button onClick={() => onSaveViews(views.filter((x) => x.name !== v.name))} aria-label={`Izbriši pogled ${v.name}`} title="Izbriši pogled" className="p-1.5 text-muted-foreground hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </> : <p className="px-2 py-1 text-xs text-muted-foreground">Shranite izbrane filtre, da jih naslednjič odprete z enim klikom.</p>}
                {filtersOn && !views.some(isView) && (
                  <div className="border-t mt-2 pt-2 px-1 flex gap-1.5">
                    <Input value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveView(); }} placeholder="Ime, npr. Vroči posli" className="h-8 text-sm" />
                    <Button size="sm" variant="outline" className="h-8" onClick={saveView} disabled={!naming.trim()}>Shrani</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          <div className="inline-flex rounded-lg border p-0.5 bg-card" role="group" aria-label="Pogled">
            <IconHint label="Tabela"><button aria-label="Tabela" onClick={() => setView("list")} className={`w-8 h-8 rounded-md inline-flex items-center justify-center ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}><List className="w-4 h-4" /></button></IconHint>
            <IconHint label="Faze (kartice po stolpcih)"><button aria-label="Faze" onClick={() => setView("pipeline")} className={`w-8 h-8 rounded-md inline-flex items-center justify-center ${view === "pipeline" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-4 h-4" /></button></IconHint>
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {chips.map((c) => (
            <span key={c.k} className="inline-flex items-center gap-1 rounded-full bg-accent/70 text-foreground pl-2.5 pr-1 py-0.5">{c.label}
              <button onClick={c.clear} aria-label={`Odstrani filter ${c.label}`} className="p-0.5 rounded-full hover:bg-white/70"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {chips.length > 1 && <button onClick={() => { setQuick(null); setTag(""); setSource("all"); }} className="text-muted-foreground hover:text-foreground ml-1">Počisti vse</button>}
        </div>
      )}
    </div>
  );
}

const SORTS = {
  name: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sl"),
  value: (a, b) => (Number(a.value) || 0) - (Number(b.value) || 0),
  touch: (a, b) => new Date(lastTouch(a)) - new Date(lastTouch(b)),
  created: (a, b) => new Date(a.created_date) - new Date(b.created_date),
};

// Tabela: prejme že filtrirane stranke (iskanje, filtri, faza). Razvrščanje, strani, izbor in množična dejanja.
export default function CustomersTable({ leads, companiesById = {}, pendingByLead = {}, tasksByLead = {}, onOpen, onStage, onExport, onTag }) {
  const [bulkTag, setBulkTag] = useState("");
  const [sort, setSort] = useState({ key: "touch", dir: "desc" });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [selected, setSelected] = useState(() => new Set());
  const comp = (l) => companiesById[l.company_id]?.name || "";
  const allTags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags || []))], [leads]);

  const rows = useMemo(() => {
    const out = [...leads];
    const f = SORTS[sort.key] || SORTS.touch;
    out.sort((a, b) => f(a, b) * (sort.dir === "asc" ? 1 : -1));
    return out;
  }, [leads, sort]);
  useEffect(() => { setPage(0); }, [leads.length, size]);

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
      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-xl border bg-card shadow-sm px-4 py-2 text-sm">
          <span className="font-semibold">Izbrano: {selected.size}</span>
          <select aria-label="Premakni v fazo" className="h-8 rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => { if (e.target.value) { onStage(selectedLeads, e.target.value); setSelected(new Set()); } }}>
            <option value="">Premakni v fazo …</option>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {onTag && <span className="inline-flex items-center gap-1.5">
            <input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && cleanTag(bulkTag)) { onTag(selectedLeads, cleanTag(bulkTag)); setBulkTag(""); setSelected(new Set()); } }} list="oznake-vse" placeholder="Dodaj oznako, npr. VIP" aria-label="Dodaj oznako" className="h-8 w-44 rounded-md border bg-background px-2 text-sm" />
            <datalist id="oznake-vse">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
            <Button size="sm" variant="outline" className="h-8" disabled={!cleanTag(bulkTag)} onClick={() => { onTag(selectedLeads, cleanTag(bulkTag)); setBulkTag(""); setSelected(new Set()); }}>Dodaj</Button>
          </span>}
          <Button size="sm" variant="outline" className="h-8" onClick={() => onExport(selectedLeads)}><Download className="w-3.5 h-3.5 mr-1.5" />Izvozi izbrane</Button>
          <button className="ml-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => setSelected(new Set())}><X className="w-4 h-4" />Počisti izbor</button>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-muted-foreground text-xs text-left">
              <tr>
                <th className="pl-4 pr-1 py-2.5 w-8"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Izberi vse na tej strani" title="Izberi vse na tej strani" /></th>
                <Th k="name">Stranka</Th>
                <th className="px-3 py-2.5 font-medium">Faza</th>
                <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Kaj želi</th>
                <Th k="value" className="hidden lg:table-cell text-right">Vrednost</Th>
                <Th k="touch">Zadnji stik</Th>
                <Th k="created" className="hidden 2xl:table-cell">Dodano</Th>
                <th className="px-3 py-2.5 w-28"><span className="sr-only">Stanje</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {shown.map((l) => {
                const st = STAGE[l.status] || STAGE.new;
                const c = comp(l);
                return (
                  <tr key={l.id} onClick={() => onOpen(l.id)} className={`cursor-pointer hover:bg-muted/40 ${selected.has(l.id) ? "bg-accent/40" : ""}`}>
                    <td className="pl-4 pr-1 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Izberi ${l.name}`} /></td>
                    <td className="px-3 py-2.5 max-w-[320px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <SourceIcon source={l.source} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{l.name}{(l.tags || []).slice(0, 2).map((t) => <span key={t} className="ml-1.5 align-middle text-[10px] font-normal text-muted-foreground border rounded px-1 py-px">{t}</span>)}{(l.tags || []).length > 2 && <span className="ml-1 text-[10px] text-muted-foreground">+{l.tags.length - 2}</span>}</p>
                          <p className="text-xs text-muted-foreground truncate">{c || l.email || l.phone || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                        <select value={l.status || "new"} onChange={(e) => onStage([l], e.target.value)} aria-label="Spremeni fazo" title="Spremeni fazo" className="bg-transparent text-sm rounded-md border border-transparent hover:border-border focus:border-primary py-0.5 pr-5 cursor-pointer">
                          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}{l.status === "unsubscribed" && <option value="unsubscribed">Odjavljen</option>}
                        </select></span>
                    </td>
                    <td className="px-3 py-2.5 hidden xl:table-cell text-muted-foreground max-w-[300px]"><span className="line-clamp-1">{l.service_requested || String(l.notes || "").replace(/^\[[^\]]*\]\s*/, "").split("\n")[0] || "—"}</span></td>
                    <td className="px-3 py-2.5 text-right hidden lg:table-cell whitespace-nowrap tabular-nums">{l.value ? eur(l.value) : <span className="text-muted-foreground/60">—</span>}</td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${isQuiet(l) ? "text-amber-700" : "text-muted-foreground"}`} title={isQuiet(l) ? "Več kot 30 dni brez stika" : undefined}>{ago(lastTouch(l))}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden 2xl:table-cell whitespace-nowrap">{fmtDate(l.created_date)}</td>
                    <td className="px-3 py-1.5 text-right"><StatusIcons lead={l} pending={pendingByLead[l.id] || 0} tasks={tasksByLead[l.id] || 0} onOpen={onOpen} /></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Ni strank, ki bi ustrezale izbranim filtrom.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 flex-wrap px-4 py-2 border-t text-xs text-muted-foreground">
          <span>{rows.length ? `${cur * size + 1}–${Math.min(rows.length, cur * size + size)} od ${rows.length}` : "0 strank"}</span>
          <label className="inline-flex items-center gap-1.5">Na stran
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-7 rounded-md border bg-background px-1.5">{[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          {pages > 1 && <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="w-4 h-4" />Nazaj</Button>
            <span className="px-1">Stran {cur + 1} od {pages}</span>
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Naprej<ChevronRight className="w-4 h-4" /></Button>
          </div>}
        </div>
      </div>
    </div>
  );
}
