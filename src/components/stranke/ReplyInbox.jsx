import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Users } from "lucide-react";
import ReplyReview, { reasonFor } from "@/components/crm/ReplyReview";
import { ago, firstLine } from "@/lib/crm";

// »Čaka na odgovor«: levo seznam strank s pripravljenim odgovorom, desno kaj je stranka pisala + predlagan odgovor.
export default function ReplyInbox({ drafts = [], leads = [], activities = [] }) {
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const items = useMemo(() => drafts
    .filter((d) => ["pending", "flagged_for_review"].includes(d.status))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)), [drafts]);
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  useEffect(() => { if (!items.find((d) => d.id === selectedId)) setSelectedId(items[0]?.id); }, [items, selectedId]);
  const selected = items.find((d) => d.id === selectedId);

  if (items.length === 0) {
    return (
      <div className="card-elevated p-12 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
        <h2 className="text-xl mt-4">Vsem strankam ste odgovorili</h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">Ko vam stranka piše (e-pošta, obrazec, klepet), AI tukaj pripravi odgovor. Vi ga preberete, po želji popravite in pošljete.</p>
        <Link to="/stranke?tab=stranke" className="inline-flex items-center gap-1.5 text-primary text-sm mt-4"><Users className="w-4 h-4" />Vse stranke</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] 2xl:grid-cols-[400px_1fr] gap-4 items-start">
      <div className="card-elevated overflow-hidden lg:sticky lg:top-20">
        <div className="px-4 py-3 border-b bg-muted/30 text-sm font-semibold">{items.length} {items.length === 1 ? "stranka čaka" : "strank čaka"} na vaš odgovor</div>
        <div className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
          {items.map((d) => {
            const l = leadsById[d.lead_id]; const r = reasonFor(d.pillar);
            const active = d.id === selectedId;
            return (
              <button key={d.id} onClick={() => setSelectedId(d.id)} className={`w-full text-left px-4 py-3 transition-colors ${active ? "bg-accent/60 border-l-4 border-primary pl-3" : "hover:bg-muted/40"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{l?.name || "Stranka"}</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">{ago(d.created_date)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><r.icon className="w-3 h-3" />{r.label}{d.status === "flagged_for_review" ? " · preverite" : ""}</p>
                <p className="text-xs mt-1 line-clamp-1">{d.subject || firstLine(d.body)}</p>
              </button>
            );
          })}
        </div>
      </div>
      {selected && <ReplyReview key={selected.id} draft={selected} lead={leadsById[selected.lead_id]} activities={activities} showCustomerLink />}
    </div>
  );
}
