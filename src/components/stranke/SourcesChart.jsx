import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, TrendingUp } from "lucide-react";
import { SOURCES } from "@/lib/crm";
import { format, subMonths, startOfMonth } from "date-fns";
import { sl } from "date-fns/locale";

const BAR = { email: "bg-primary", form: "bg-emerald-500", chatbot: "bg-violet-500", import: "bg-slate-400", manual: "bg-slate-500" };

// »Od kod pridejo stranke«: samo pregled (graf). Nastavitev virov je v Nastavitve → Viri strank.
export default function SourcesChart({ leads = [] }) {
  const rows = useMemo(() => Object.keys(SOURCES).map((k) => {
    const all = leads.filter((l) => (l.source || "manual") === k);
    return { key: k, count: all.length, won: all.filter((l) => l.status === "converted").length };
  }).sort((a, b) => b.count - a.count), [leads]);
  const total = leads.length;
  const max = Math.max(1, ...rows.map((r) => r.count));

  const months = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(new Date(), i));
      const end = startOfMonth(subMonths(new Date(), i - 1));
      const inMonth = leads.filter((l) => { const d = new Date(l.created_date); return d >= start && d < end; });
      out.push({ label: format(start, "LLL", { locale: sl }), total: inMonth.length, parts: Object.keys(SOURCES).map((k) => ({ k, n: inMonth.filter((l) => (l.source || "manual") === k).length })).filter((p) => p.n > 0) });
    }
    return out;
  }, [leads]);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const best = rows[0]?.count > 0 ? rows[0] : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{best ? <>Največ strank pride prek: <strong className="text-foreground">{SOURCES[best.key].label}</strong> ({Math.round((best.count / total) * 100)} %).</> : "Ko dobite prve stranke, boste tukaj videli, od kod prihajajo."}</p>
        <Button asChild variant="outline" size="sm"><Link to="/nastavitve?tab=viri"><Settings className="w-4 h-4 mr-2" />Nastavi obrazec, pošto in uvoz</Link></Button>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card-elevated p-6">
          <h3 className="text-lg">Po viru</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Vse stranke doslej ({total}) in koliko jih je postalo plačljiva stranka.</p>
          <div className="mt-5 space-y-4">
            {rows.map((r) => {
              const S = SOURCES[r.key];
              return (
                <div key={r.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="inline-flex items-center gap-2 font-medium"><S.icon className="w-4 h-4 text-muted-foreground" />{S.label}</span>
                    <span><strong>{r.count}</strong> <span className="text-muted-foreground">· {total ? Math.round((r.count / total) * 100) : 0} %{r.won > 0 ? ` · ${r.won} sklenjenih` : ""}</span></span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${BAR[r.key]}`} style={{ width: `${(r.count / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-elevated p-6">
          <h3 className="text-lg flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Nove stranke po mesecih</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Zadnjih 6 mesecev, obarvano po viru.</p>
          <div className="mt-5 flex items-end gap-3 h-48">
            {months.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs font-medium mb-1">{m.total || ""}</span>
                <div className="w-full max-w-[56px] rounded-t-lg overflow-hidden flex flex-col-reverse bg-muted" style={{ height: `${Math.max(4, (m.total / maxMonth) * 100)}%` }}>
                  {m.parts.map((p) => <div key={p.k} className={BAR[p.k]} style={{ height: `${(p.n / m.total) * 100}%` }} title={`${SOURCES[p.k].label}: ${p.n}`} />)}
                </div>
                <span className="text-xs text-muted-foreground mt-2">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-muted-foreground">
            {Object.keys(SOURCES).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${BAR[k]}`} />{SOURCES[k].label}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
