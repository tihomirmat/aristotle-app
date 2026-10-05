import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Send, X, Pencil, Loader2, ThumbsUp, ThumbsDown, Globe, MessageSquare, RotateCcw, Star, CalendarDays, Bot, Megaphone, PenLine, Mail, ShieldCheck, ArrowRight, Sparkles, Inbox } from "lucide-react";
import { toast } from "sonner";
import { SOURCES, ACTIVITY, ago, fmtDateTime } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";
import { learnInBackground } from "@/lib/learn";

// Zakaj je AI pripravil odgovor — v jeziku stranke.
export const REASONS = {
  web_form_lead: { label: "Novo povpraševanje", why: "Stranka vam je pisala. AI je pripravil prvi odgovor.", icon: Globe, color: "bg-emerald-100 text-emerald-700" },
  chatbot_handoff: { label: "Iz spletnega klepeta", why: "Obiskovalec je v klepetu na vaši strani pustil kontakt. AI je pripravil nadaljevanje.", icon: MessageSquare, color: "bg-violet-100 text-violet-700" },
  reactivation: { label: "Stara stranka", why: "S stranko dolgo niste bili v stiku. AI jo vljudno povabi nazaj.", icon: RotateCcw, color: "bg-blue-100 text-blue-700" },
  review_request: { label: "Prošnja za oceno", why: "Posel je zaključen. AI prosi stranko za Google oceno.", icon: Star, color: "bg-amber-100 text-amber-700" },
  review_response: { label: "Odgovor na oceno", why: "Stranka je pustila oceno. AI je pripravil odgovor.", icon: Star, color: "bg-amber-100 text-amber-700" },
  referral_ask: { label: "Prošnja za priporočilo", why: "Zadovoljna stranka. AI jo prosi, da vas priporoči naprej.", icon: Star, color: "bg-amber-100 text-amber-700" },
  booking_proposal: { label: "Predlog termina", why: "Stranka želi termin. AI je iz koledarja izbral proste termine.", icon: CalendarDays, color: "bg-rose-100 text-rose-700" },
  booking_confirmation: { label: "Potrditev termina", why: "Termin je potrjen. AI je pripravil potrditev.", icon: CalendarDays, color: "bg-rose-100 text-rose-700" },
  assistant_action: { label: "Predlog asistenta", why: "Asistent je predlagal to sporočilo.", icon: Bot, color: "bg-slate-100 text-slate-700" },
  campaign: { label: "Kampanja", why: "Naslednje sporočilo vaše kampanje. Ko stranka odgovori, se kampanja zanjo ustavi.", icon: Megaphone, color: "bg-orange-100 text-orange-700" },
  manual: { label: "Vaše sporočilo", why: "Sporočilo, ki ste ga začeli pisati pri stranki.", icon: PenLine, color: "bg-slate-100 text-slate-700" },
};
export const reasonFor = (p) => REASONS[p] || { label: "Sporočilo", why: "AI je pripravil to sporočilo.", icon: Mail, color: "bg-slate-100 text-slate-700" };

const INBOUND = ["email_in", "form", "chat"];
// Pri teh vrstah je odgovor na sporočilo stranke; pri ostalih (ocena, vabilo, kampanja) pokažemo razlog.
const REPLY_PILLARS = ["web_form_lead", "chatbot_handoff", "booking_proposal", "booking_confirmation", "manual", "assistant_action"];
// Kaj je stranka nazadnje poslala: zadnji prejeti dogodek ali izvirno sporočilo iz opomb.
export const lastInbound = (lead, activities = []) => {
  const a = activities.filter((x) => x.lead_id === lead?.id && INBOUND.includes(x.type))
    .sort((x, y) => new Date(y.occurred_at || y.created_date) - new Date(x.occurred_at || x.created_date))[0];
  if (a) return { type: a.type, subject: a.subject, content: a.content, at: a.occurred_at || a.created_date };
  const notes = String(lead?.notes || "");
  const orig = notes.split("Izvirno sporočilo:")[1];
  if (orig || lead?.email_subject) return { type: lead?.source === "chatbot" ? "chat" : lead?.source === "form" ? "form" : "email_in", subject: lead?.email_subject, content: (orig || notes).trim(), at: lead?.last_inbound_at || lead?.created_date };
  return null;
};

export default function ReplyReview({ draft, lead, activities = [], showCustomerLink = false, onDone }) {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const invalidate = useCrmInvalidate();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject || "");
  const [body, setBody] = useState(draft.body || "");
  const [busy, setBusy] = useState(null);
  const [example, setExample] = useState(null); // { kind, why }
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  useEffect(() => { setSubject(draft.subject || ""); setBody(draft.body || ""); setEditing(false); }, [draft.id]);

  const { data: campaign } = useQuery({
    queryKey: ["campaigns", "one", draft.campaign_id],
    queryFn: () => base44.entities.Campaign.filter({ id: draft.campaign_id }).then((r) => r[0] || null),
    enabled: !!draft.campaign_id,
  });

  const r = reasonFor(draft.pillar);
  const isReply = REPLY_PILLARS.includes(draft.pillar);
  const inbound = isReply ? lastInbound(lead, activities) : null;
  const S = SOURCES[lead?.source] || SOURCES.manual;
  const lowQuality = draft.status === "flagged_for_review";
  const changed = subject !== (draft.subject || "") || body !== (draft.body || "");

  const done = () => { invalidate(); qc.invalidateQueries({ queryKey: ["drafts-all"] }); onDone?.(); };
  const send = async () => {
    setBusy("send");
    try {
      await base44.entities.DraftMessage.update(draft.id, { ...(changed ? { subject, body } : {}), status: "approved" });
      toast.success(`Odgovor za ${lead?.name || "stranko"} se pošilja.`);
      if (changed) learnInBackground({ business_id: business.id, kind: "edit", original: { subject: draft.subject, body: draft.body }, final: { subject, body } }, qc);
      done();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  const skip = async () => {
    setBusy("skip");
    try {
      await base44.entities.DraftMessage.update(draft.id, { status: "skipped", ...(skipReason.trim() ? { reviewer_notes: `Lastnik: ${skipReason.trim()}` } : {}) });
      toast("Sporočilo ne bo poslano.");
      if (skipReason.trim()) learnInBackground({ business_id: business.id, kind: "skip", original: { subject: draft.subject, body: draft.body }, reason: skipReason.trim() }, qc);
      setSkipOpen(false); done();
    }
    catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  const saveExample = async () => {
    const { kind, why } = example;
    if (kind === "bad" && !why.trim()) { toast.error("Na kratko napišite, kaj je narobe — po tem se AI ravna."); return; }
    setBusy("example");
    try {
      const key = kind === "good" ? "example_good_messages" : "example_bad_messages";
      const fresh = (await base44.entities.Business.filter({ id: business.id }))[0] || business;
      const item = kind === "good" ? { subject, body, why_good: why.trim() } : { subject, body, why_bad: why.trim() };
      const list = [...(fresh[key] || []).filter((x) => x.body !== body), item].slice(-5);
      await base44.entities.Business.update(business.id, { [key]: list });
      qc.invalidateQueries({ queryKey: ["business"] });
      toast.success(kind === "good" ? "Shranjeno kot dober primer — AI se bo zgledoval po njem." : "Shranjeno kot slab primer — AI se bo temu izogibal.");
      learnInBackground({ business_id: business.id, kind: kind === "good" ? "good_example" : "bad_example", original: { subject, body }, reason: why.trim() }, qc);
      setExample(null);
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  const InIcon = (inbound && ACTIVITY[inbound.type]?.icon) || Inbox;
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Glava: kdo, od kod, zakaj */}
      <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${r.color}`}><r.icon className="w-3.5 h-3.5" />{r.label}</span>
        <span className="text-sm">
          {showCustomerLink && lead ? <Link to={`/stranke/${lead.id}`} className="font-semibold hover:text-primary inline-flex items-center gap-1">{lead.name}<ArrowRight className="w-3.5 h-3.5" /></Link> : <strong>{lead?.name}</strong>}
          {lead?.email && <span className="text-muted-foreground"> · {lead.email}</span>}
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">pripravljeno {ago(draft.created_date)}</span>
      </div>

      <div className="grid xl:grid-cols-[2fr_3fr] divide-y xl:divide-y-0 xl:divide-x">
        {/* Levo: kaj je stranka poslala */}
        <div className="p-5 space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{isReply ? "Stranka vam je pisala" : "Zakaj to sporočilo"}</p>
          {draft.pillar === "campaign" ? (
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 text-sm">
              <p className="font-medium">{campaign?.name || "Kampanja"}</p>
              <p className="text-muted-foreground mt-1">Sporočilo {draft.campaign_step || 1}{campaign?.steps?.length ? ` od ${campaign.steps.length}` : ""}. {r.why}</p>
              {lead?.notes && <p className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap line-clamp-4">O stranki: {lead.notes}</p>}
            </div>
          ) : inbound ? (
            <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><InIcon className="w-3.5 h-3.5" />{ACTIVITY[inbound.type]?.label || "Sporočilo"} · {fmtDateTime(inbound.at)}</p>
              {inbound.subject && <p className="text-sm font-medium mt-1.5">{inbound.subject}</p>}
              <p className="text-sm whitespace-pre-wrap mt-1.5 max-h-72 overflow-y-auto">{inbound.content || "—"}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm space-y-2">
              <p>{r.why}</p>
              {lead?.status && <p className="text-xs text-muted-foreground">Faza stranke: {({ new: "Novo", contacted: "Kontaktirano", replied: "Odgovorili so", booked: "Termin", converted: "Stranka", lost: "Izgubljeno" })[lead.status] || lead.status}{lead.last_contacted_at ? ` · zadnji stik ${ago(lead.last_contacted_at)}` : ""}</p>}
              {lead?.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-5">O stranki: {lead.notes}</p>}
            </div>
          )}
          {lead?.service_requested && <p className="text-xs text-muted-foreground">Kaj želi: <span className="text-foreground">{lead.service_requested}</span></p>}
        </div>

        {/* Desno: predlagan odgovor + odločitev */}
        <div className="p-5 space-y-3 bg-accent/20">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" />Predlagan odgovor</p>
            {!editing && <button onClick={() => setEditing(true)} className="text-xs text-primary inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Uredi</button>}
          </div>
          {lowQuality && (
            <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2 flex items-start gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />AI ni povsem zadovoljen s tem odgovorom ({draft.quality_score ?? "?"}/10). Preberite ga pred pošiljanjem.</p>
          )}
          {editing ? (
            <div className="space-y-2">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Zadeva" />
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] text-sm" />
            </div>
          ) : (
            <div className="rounded-xl bg-card border p-4">
              <p className="text-sm font-semibold">{subject}</p>
              <p className="text-sm whitespace-pre-wrap mt-2 leading-relaxed">{body}</p>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button className="btn-brand" onClick={send} disabled={!!busy || !lead?.email}>{busy === "send" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}{changed ? "Shrani in pošlji" : "Pošlji"}</Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setSkipOpen(true)} disabled={!!busy}><X className="w-4 h-4 mr-1" />Ne pošlji</Button>
            <span className="ml-auto inline-flex gap-1">
              <Button size="sm" variant="ghost" className="text-emerald-700 hover:bg-emerald-50" title="AI naj piše tako" onClick={() => setExample({ kind: "good", why: "" })}><ThumbsUp className="w-4 h-4 mr-1" />Dober primer</Button>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" title="AI naj se temu izogiba" onClick={() => setExample({ kind: "bad", why: "" })}><ThumbsDown className="w-4 h-4 mr-1" />Slab primer</Button>
            </span>
          </div>
          {skipOpen && (
            <div className="rounded-xl border bg-card p-3 space-y-2">
              <Label className="text-xs">Zakaj ne? <span className="text-muted-foreground font-normal">(neobvezno — AI se iz tega nauči in naslednjič ne ponovi)</span></Label>
              <Input autoFocus value={skipReason} onChange={(e) => setSkipReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && skip()} placeholder="Npr. tej stranki ne pišemo, preveč vsiljivo, napačna cena …" />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setSkipOpen(false)}>Prekliči</Button>
                <Button size="sm" variant="outline" onClick={skip} disabled={!!busy}>{busy === "skip" && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Ne pošlji</Button>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{changed && <span className="text-primary">AI si bo zapomnil vaš popravek. </span>}{lead?.email ? `Pošlje se na ${lead.email} z vašega e-naslova, podpis doda sistem.` : "Stranka nima e-naslova — dodajte ga v podatkih stranke."}</p>
        </div>
      </div>

      <Dialog open={!!example} onOpenChange={(o) => !o && setExample(null)}>
        <DialogContent className="max-w-xl">
          {example && (<>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{example.kind === "good" ? <><ThumbsUp className="w-5 h-5 text-emerald-600" />Dober primer</> : <><ThumbsDown className="w-5 h-5 text-red-600" />Slab primer</>}</DialogTitle>
              <DialogDescription>{example.kind === "good" ? "AI se bo pri novih sporočilih zgledoval po tem." : "AI se bo takemu pisanju izogibal."} Primere urejate v Nastavitve → Glas znamke.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>{example.kind === "good" ? "Kaj vam je všeč? (neobvezno)" : "Kaj je narobe?"}</Label>
              <Input autoFocus value={example.why} onChange={(e) => setExample({ ...example, why: e.target.value })} placeholder={example.kind === "good" ? "Npr. kratko, osebno, jasen naslednji korak" : "Npr. preveč formalno, predolgo, obljublja popust"} onKeyDown={(e) => e.key === "Enter" && saveExample()} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setExample(null)}>Prekliči</Button>
              <Button className="btn-brand" onClick={saveExample} disabled={busy === "example"}>{busy === "example" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani primer</Button>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
