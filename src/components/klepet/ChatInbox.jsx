import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, Phone, UserRound, ArrowRight, MessageSquare, Bot, AlertTriangle, Clock } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { Empty } from "@/components/pomocniki/HelperKit";

const when = (c) => c.started_at || c.updated_date || c.created_date;
const short = (d) => { if (!d) return ""; const x = new Date(d); return isToday(x) ? format(x, "HH:mm") : isYesterday(x) ? "včeraj" : format(x, "d. M."); };
const nameOf = (c, i) => c.visitor_email || c.visitor_phone || `Obiskovalec ${i}`;
const waits = (c) => !!c.escalated && c.status !== "resolved";
const lastUser = (c) => [...(c.messages || [])].reverse().find((m) => m.role === "user")?.content || "";

// Predal pogovorov: levo seznam, v sredini pogovor, desno kdo je obiskovalec in kaj lahko naredite.
export default function ChatInbox({ business, conversations = [], onSetup }) {
  const qc = useQueryClient();
  const sorted = [...conversations].sort((a, b) => (waits(b) - waits(a)) || (new Date(when(b) || 0) - new Date(when(a) || 0)));
  const numbered = sorted.map((c, i) => ({ ...c, _n: sorted.length - i }));
  const [selId, setSelId] = useState(null);
  const sel = numbered.find((c) => c.id === selId) || numbered[0] || null;
  const resolve = useMutation({
    mutationFn: (id) => base44.entities.ChatbotConversation.update(id, { status: "resolved" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["convs", business?.id] }); toast.success("Označeno kot urejeno."); },
  });

  if (!numbered.length) {
    return (
      <Empty icon={MessageSquare} title="Še ni pogovorov" text="Ko obiskovalec na vaši spletni strani kaj vpraša, se pogovor pojavi tukaj. Nič vam ni treba narediti — klepet odgovarja sam.">
        {onSetup && <Button variant="outline" onClick={onSetup}>Preizkusi klepet</Button>}
      </Empty>
    );
  }

  return (
    <div className="card-elevated overflow-hidden grid lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px] lg:h-[calc(100vh-250px)] lg:min-h-[520px]">
      {/* Seznam */}
      <div className="border-b lg:border-b-0 lg:border-r overflow-y-auto max-h-72 lg:max-h-none">
        {numbered.map((c) => {
          const active = sel?.id === c.id;
          return (
            <button key={c.id} onClick={() => setSelId(c.id)} className={`w-full text-left px-4 py-3.5 flex gap-3 border-b transition-colors ${active ? "bg-accent/60" : "hover:bg-muted/50"}`}>
              <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${waits(c) ? "bg-red-100 text-red-700" : c.converted ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{c.visitor_email ? c.visitor_email[0].toUpperCase() : <UserRound className="w-5 h-5" />}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2"><span className="font-semibold text-sm truncate flex-1">{nameOf(c, c._n)}</span><span className="text-[11px] text-muted-foreground shrink-0">{short(when(c))}</span></span>
                <span className="block text-sm text-muted-foreground truncate mt-0.5">{lastUser(c) || "Brez sporočil"}</span>
                {(waits(c) || c.converted || c.status === "resolved") && (
                  <span className="flex gap-1.5 mt-1.5 flex-wrap">
                    {waits(c) && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Čaka na vas</span>}
                    {c.converted && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Pustil kontakt</span>}
                    {c.status === "resolved" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Urejeno</span>}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pogovor */}
      {sel && (
        <div className="flex flex-col min-h-[360px] lg:min-h-0">
          <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0"><p className="font-semibold truncate">{nameOf(sel, sel._n)}</p><p className="text-xs text-muted-foreground">{when(sel) ? format(new Date(when(sel)), "d. M. yyyy 'ob' HH:mm") : ""} · odgovarjal je klepet</p></div>
            {sel.status !== "resolved" && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => resolve.mutate(sel.id)} disabled={resolve.isPending}><CheckCircle2 className="w-4 h-4" />Označi kot urejeno</Button>}
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/70">
            {(sel.messages || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-10">V tem pogovoru ni sporočil.</p>}
            {(sel.messages || []).map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "" : "flex-row-reverse"}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${m.role === "user" ? "bg-white border text-muted-foreground" : "bg-primary text-white"}`}>{m.role === "user" ? <UserRound className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}</span>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-white border rounded-tl-md" : "bg-[#fff1ec] text-slate-900 rounded-tr-md"}`}>
                  {m.content}
                  <span className="block text-[10px] text-muted-foreground mt-1">{m.role === "user" ? "Obiskovalec" : "Klepet"}{m.timestamp ? ` · ${format(new Date(m.timestamp), "HH:mm")}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kdo je in kaj naredim */}
      {sel && (
        <div className="border-t xl:border-t-0 xl:border-l p-5 space-y-4 lg:col-span-2 xl:col-span-1 overflow-y-auto">
          {waits(sel) && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5">
              <p className="font-semibold text-red-800 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" />Čaka na vas</p>
              <p className="text-sm text-red-900 mt-1">{sel.escalation_reason || "Obiskovalec želi, da se mu oglasite osebno."}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Obiskovalec</p>
            <div className="mt-2 space-y-2 text-sm">
              {sel.visitor_email ? <p className="flex items-center gap-2 break-all"><Mail className="w-4 h-4 text-muted-foreground shrink-0" />{sel.visitor_email}</p> : null}
              {sel.visitor_phone ? <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground shrink-0" />{sel.visitor_phone}</p> : null}
              {!sel.visitor_email && !sel.visitor_phone && <p className="text-muted-foreground">Ni pustil kontakta.</p>}
              <p className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4 shrink-0" />Sporočil v pogovoru: {(sel.messages || []).length}</p>
            </div>
          </div>
          <div className="space-y-2">
            {sel.lead_id && <Link to={`/stranke/${sel.lead_id}`} className="block"><Button className="btn-brand w-full gap-2">Odpri stranko<ArrowRight className="w-4 h-4" /></Button></Link>}
            {sel.visitor_email && <a href={`mailto:${sel.visitor_email}`} className="block"><Button variant="outline" className="w-full gap-2"><Mail className="w-4 h-4" />Piši mu po e-pošti</Button></a>}
            {sel.visitor_phone && <a href={`tel:${sel.visitor_phone}`} className="block"><Button variant="outline" className="w-full gap-2"><Phone className="w-4 h-4" />Pokliči</Button></a>}
          </div>
          {!sel.lead_id && !sel.visitor_email && !sel.visitor_phone && <p className="text-xs text-muted-foreground">Klepet obiskovalca sam prosi za kontakt, ko pokaže zanimanje.</p>}
        </div>
      )}
    </div>
  );
}
