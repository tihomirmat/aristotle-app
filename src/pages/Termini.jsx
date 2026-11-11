import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Loader2, MapPin, ExternalLink, User, Clock } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, format, isToday } from "date-fns";
import { sl } from "date-fns/locale";
import { assistantContext } from "@/functions/assistantContext";
import { cnt } from "@/lib/crm";

// Termini: mesečni koledar (Google Koledar + termini, dogovorjeni v aplikaciji), desno izbrani dan in predlogi, ki čakajo.
const DOW = ["pon", "tor", "sre", "čet", "pet", "sob", "ned"];
const W_TERMIN = ["termin", "termina", "termini", "terminov"];

export default function Termini() {
  const { business } = useBusiness();
  const bid = business?.id;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState(() => new Date());
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const connected = !!business?.google_calendar_connected;

  const { data: cal, isLoading: calLoading } = useQuery({
    queryKey: ["calendar-events", bid, gridStart.toISOString()],
    queryFn: async () => { const r = await assistantContext({ business_id: bid, action: "calendar", from: gridStart.toISOString(), to: addDays(gridEnd, 1).toISOString() }); return r?.data ?? r; },
    enabled: !!bid && connected, staleTime: 60_000,
  });
  const { data: bookings = [] } = useQuery({ queryKey: ["confirmed_bookings_all", bid], queryFn: () => base44.entities.ConfirmedBooking.filter({ business_id: bid }), enabled: !!bid });
  const { data: proposals = [] } = useQuery({ queryKey: ["proposals", bid], queryFn: () => base44.entities.BookingProposal.filter({ business_id: bid }), enabled: !!bid });
  const { data: leads = [] } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }, "-created_date", 5000), enabled: !!bid });
  const leadById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  // Združeni dogodki: Google Koledar (modro) + termini iz aplikacije (oranžno), brez podvajanja istega Google dogodka.
  const events = useMemo(() => {
    const g = (cal?.events || []).map((e) => ({ ...e, kind: "google", startD: new Date(e.start) }));
    const gIds = new Set(g.map((e) => e.id));
    const a = bookings.filter((b) => b.booked_at && b.status !== "cancelled" && !gIds.has(b.google_event_id)).map((b) => {
      const l = leadById[b.lead_id];
      return { id: b.id, kind: "app", title: l ? `Termin: ${l.name}` : "Termin s stranko", startD: new Date(b.booked_at), end: new Date(new Date(b.booked_at).getTime() + (b.duration_minutes || 60) * 60000).toISOString(), lead_id: b.lead_id, notes: b.notes };
    });
    // Google dogodek, ki je nastal iz termina v aplikaciji, dobi povezavo do stranke
    const byG = Object.fromEntries(bookings.filter((b) => b.google_event_id).map((b) => [b.google_event_id, b]));
    g.forEach((e) => { const b = byG[e.id]; if (b) { e.lead_id = b.lead_id; e.kind = "app"; } });
    return [...g, ...a].sort((x, y) => x.startD - y.startD);
  }, [cal, bookings, leadById]);

  const days = []; for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const onDay = (d) => events.filter((e) => isSameDay(e.startD, d));
  const dayEvents = onDay(day);
  const pending = proposals.filter((p) => p.status === "pending");
  const monthCount = events.filter((e) => isSameMonth(e.startD, month)).length;
  const time = (e) => (e.all_day ? "cel dan" : format(e.startD, "HH:mm"));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1>Termini</h1>
          <span className="text-sm text-muted-foreground mt-1">{cnt(monthCount, W_TERMIN)} v tem mesecu</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setMonth(startOfMonth(new Date())); setDay(new Date()); }}>Danes</Button>
          <div className="inline-flex items-center rounded-lg border bg-card">
            <button aria-label="Prejšnji mesec" onClick={() => setMonth(addMonths(month, -1))} className="w-9 h-9 inline-flex items-center justify-center hover:bg-muted rounded-l-lg"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 text-sm font-semibold min-w-[140px] text-center capitalize">{format(month, "LLLL yyyy", { locale: sl })}</span>
            <button aria-label="Naslednji mesec" onClick={() => setMonth(addMonths(month, 1))} className="w-9 h-9 inline-flex items-center justify-center hover:bg-muted rounded-r-lg"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {!connected && (
        <div className="rounded-xl border bg-card px-4 py-3 text-sm flex items-center gap-3 flex-wrap">
          <Calendar className="w-4 h-4 text-primary" />
          <span>Google Koledar ni povezan, zato tu vidite samo termine, dogovorjene v aplikaciji.</span>
          <Button asChild size="sm" variant="outline" className="ml-auto"><Link to="/nastavitve?tab=termini">Poveži koledar</Link></Button>
        </div>
      )}
      {connected && cal?.error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{cal.error}</p>}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {DOW.map((d) => <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 relative">
            {calLoading && <div className="absolute inset-0 bg-card/60 flex items-center justify-center z-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
            {days.map((d) => {
              const list = onDay(d); const sel = isSameDay(d, day); const other = !isSameMonth(d, month);
              return (
                <button key={d.toISOString()} onClick={() => setDay(d)} aria-label={`${format(d, "d. M.")}: ${cnt(list.length, W_TERMIN)}`}
                  className={`min-h-[104px] text-left p-1.5 border-b border-r align-top transition-colors ${other ? "bg-muted/20" : ""} ${sel ? "ring-2 ring-inset ring-primary" : "hover:bg-muted/40"}`}>
                  <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs ${isToday(d) ? "bg-primary text-white font-semibold" : other ? "text-muted-foreground/60" : "text-foreground"}`}>{format(d, "d")}</span>
                  <div className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <p key={e.kind + e.id} className={`text-[11px] leading-tight truncate rounded px-1 py-0.5 ${e.kind === "app" ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-800"}`}>
                        {!e.all_day && <span className="font-medium">{format(e.startD, "HH:mm")} </span>}{e.title}
                      </p>
                    ))}
                    {list.length > 3 && <p className="text-[11px] text-muted-foreground px-1">+{list.length - 3} več</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-primary/30" />Termin s stranko</span>
            {connected && <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-200" />Google Koledar</span>}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="font-semibold capitalize">{format(day, "EEEE, d. MMMM", { locale: sl })}</p>
            {dayEvents.length === 0 ? <p className="text-sm text-muted-foreground mt-2">Ta dan ni terminov.</p> : (
              <ul className="mt-3 space-y-3">
                {dayEvents.map((e) => {
                  const l = e.lead_id && leadById[e.lead_id];
                  return (
                    <li key={e.kind + e.id} className={`border-l-2 pl-3 ${e.kind === "app" ? "border-primary" : "border-blue-400"}`}>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{time(e)}{!e.all_day && e.end ? `–${format(new Date(e.end), "HH:mm")}` : ""}</p>
                      {e.location && <p className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-2"><MapPin className="w-3 h-3" />{e.location}</p>}
                      <div className="flex gap-3 mt-1 text-xs">
                        {l && <Link to={`/stranke/${l.id}`} className="text-primary font-medium inline-flex items-center gap-1"><User className="w-3 h-3" />{l.name}</Link>}
                        {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />V Google Koledarju</a>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="font-semibold">Predlagani termini, ki čakajo</p>
            {pending.length === 0 ? <p className="text-sm text-muted-foreground mt-2">Nobena stranka trenutno ne izbira termina.</p> : (
              <ul className="mt-3 space-y-3">
                {pending.map((p) => {
                  const l = leadById[p.lead_id];
                  return (
                    <li key={p.id} className="text-sm">
                      <p className="font-medium">{l ? <Link to={`/stranke/${l.id}`} className="hover:underline">{l.name}</Link> : (p.service_requested || "Stranka")}</p>
                      <p className="text-xs text-muted-foreground">{(p.proposed_slots || []).map((s) => s.label || (s.start_datetime ? format(new Date(s.start_datetime), "d. M. HH:mm") : "")).filter(Boolean).join(" · ") || "—"}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
