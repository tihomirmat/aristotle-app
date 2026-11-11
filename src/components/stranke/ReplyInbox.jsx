import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Users, Mail, MessageCircleReply, MessageSquare, Megaphone, Star } from "lucide-react";
import ReplyReview, { reasonFor } from "@/components/crm/ReplyReview";
import { ago, firstLine, SOURCES } from "@/lib/crm";

// Skupine v »Čaka na vaš odgovor« — od kod je prišlo (lastnik 11. 11.: ne mešaj povpraševanj, kampanj in klepeta).
const GROUPS = [
  { key: "inquiries", label: "Povpraševanja", hint: "Stranke so vam pisale po e-pošti ali prek obrazca", icon: Mail },
  { key: "campaign_replies", label: "Odgovori na kampanje", hint: "Odgovorili so na vašo e-poštno kampanjo", icon: MessageCircleReply },
  { key: "chat", label: "Iz klepeta", hint: "Pustili so kontakt v klepetu na vaši strani", icon: MessageSquare },
  { key: "outgoing", label: "Kampanje za potrditev", hint: "Sporočila kampanj, ki jih potrdite pred pošiljanjem", icon: Megaphone },
  { key: "reviews", label: "Ocene", hint: "Prošnje za oceno in odgovori na ocene", icon: Star },
];
export const groupOf = (d, lead) => {
  if (["campaign", "reactivation"].includes(d.pillar)) return "outgoing";
  if (["review_request", "review_response", "referral_ask"].includes(d.pillar)) return "reviews";
  if (d.pillar === "chatbot_handoff" || lead?.source === "chatbot") return "chat";
  if (lead?.source === "campaign") return "campaign_replies";
  return "inquiries";
};

// »Čaka na odgovor«: zgoraj skupine, levo seznam, desno kaj je stranka pisala + predlagan odgovor.
export default function ReplyInbox({ drafts = [], leads = [], activities = [] }) {
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const all = useMemo(() => drafts
    .filter((d) => ["pending", "flagged_for_review"].includes(d.status))
    .map((d) => ({ ...d, _group: groupOf(d, leadsById[d.lead_id]) }))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)), [drafts, leadsById]);
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.key, all.filter((d) => d._group === g.key).length])), [all]);
  const shown = GROUPS.filter((g) => counts[g.key] > 0);
  const [group, setGroup] = useState(null);
  const active = group && counts[group] ? group : shown[0]?.key;
  const items = all.filter((d) => d._group === active);
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  useEffect(() => { if (!items.find((d) => d.id === selectedId)) setSelectedId(items[0]?.id); }, [items, selectedId]);
  const selected = items.find((d) => d.id === selectedId);
  const G = GROUPS.find((g) => g.key === active);

  if (all.length === 0) {
    return (
      <div className="card-elevated p-12 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
        <h2 className="text-xl mt-4">Vsem strankam ste odgovorili</h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">Ko vam stranka piše (e-pošta, obrazec, klepet ali odgovor na kampanjo), AI tukaj pripravi odgovor. Vi ga preberete, po želji popravite in pošljete.</p>
        <Link to="/stranke?tab=stranke" className="inline-flex items-center gap-1.5 text-primary text-sm mt-4"><Users className="w-4 h-4" />Vse stranke</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shown.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {shown.map((g) => (
            <button key={g.key} onClick={() => setGroup(g.key)} title={g.hint}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${active === g.key ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"}`}>
              <g.icon className="w-4 h-4" />{g.label}<span className={`text-xs font-semibold rounded-full px-1.5 ${active === g.key ? "bg-background/20" : "bg-muted"}`}>{counts[g.key]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] 2xl:grid-cols-[400px_1fr] gap-4 items-start">
        <div className="card-elevated overflow-hidden lg:sticky lg:top-20">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">{G && <G.icon className="w-4 h-4 text-primary" />}{G?.label} ({items.length})</p>
            <p className="text-xs text-muted-foreground mt-0.5">{G?.hint}</p>
          </div>
          <div className="divide-y max-h-[calc(100vh-260px)] overflow-y-auto">
            {items.map((d) => {
              const l = leadsById[d.lead_id]; const r = reasonFor(d.pillar); const src = SOURCES[l?.source];
              const on = d.id === selectedId;
              return (
                <button key={d.id} onClick={() => setSelectedId(d.id)} className={`w-full text-left px-4 py-3 transition-colors ${on ? "bg-accent/60 border-l-4 border-primary pl-3" : "hover:bg-muted/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{l?.name || "Stranka"}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{ago(d.created_date)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><r.icon className="w-3 h-3" />{r.label}{active === "inquiries" && src ? ` · ${src.label}` : ""}{d.status === "flagged_for_review" ? " · preverite" : ""}</p>
                  <p className="text-xs mt-1 line-clamp-1">{d.subject || firstLine(d.body)}</p>
                </button>
              );
            })}
          </div>
        </div>
        {selected && <ReplyReview key={selected.id} draft={selected} lead={leadsById[selected.lead_id]} activities={activities} showCustomerLink />}
      </div>
    </div>
  );
}
