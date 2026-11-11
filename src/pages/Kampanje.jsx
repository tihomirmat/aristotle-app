import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Megaphone, Plus, Loader2, Play, Pause, Pencil, Trash2, Users, Send, MessageCircleReply, Sparkles, Clock, X, RotateCcw, HeartHandshake, Newspaper, Target, Star, ArrowRight, AlertTriangle, MailX, ListChecks, Mail, Paperclip, PenLine, Settings2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { addDays } from "date-fns";
import { CAMPAIGN_GOALS, CAMPAIGN_STATUS, STAGES, SOURCES, pl, cnt, W, fmtDateTime } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";
import SendingMailboxes, { dailyLimit, sentToday, SignatureDialog } from "@/components/kampanje/SendingMailboxes";
import ContactLists, { VerifyHelp } from "@/components/kampanje/ContactLists";

const GOAL_ICON = { reactivation: RotateCcw, nurture: HeartHandshake, newsletter: Newspaper, acquisition: Target, review: Star };

// Predloge kampanj: prazni nagovor/podpis doda AI oziroma sistem.
// Komu je cilj namenjen — kratka razlaga števila na kartici cilja.
const AUDIENCE_TEXT = {
  reactivation: "Stranke brez stika več kot 120 dni",
  nurture: "Povpraševanja brez odločitve (3+ dni)",
  newsletter: "Vaše stranke (faza Stranka)",
  acquisition: "Naslovi s seznama, ki niso vaše stranke",
  review: "Vaše stranke (faza Stranka)",
};
const TEMPLATES = {
  reactivation: {
    name: "Vrnite stare stranke",
    audience: { stages: ["converted", "contacted", "replied"], inactive_days: 120, sources: [], has_company: "any", auto_enroll: true },
    steps: [
      { delay_days: 0, subject: "Že dolgo se nismo slišali", body: "Spoštovani,\n\nže nekaj časa se nismo slišali, zato smo se spomnili na vas. Ali vam lahko pri čem pomagamo?\n\nČe imate vprašanje ali potrebo, preprosto odgovorite na to sporočilo.", ai_personalize: true },
      { delay_days: 7, subject: "Kratek opomnik", body: "Spoštovani,\n\nle kratek opomnik na prejšnje sporočilo. Če vas zanima, kaj je pri nas novega, odgovorite in vam z veseljem pripravimo predlog.", ai_personalize: true },
      { delay_days: 14, subject: "Zadnjič od nas", body: "Spoštovani,\n\nne želimo vas motiti, zato je to naše zadnje sporočilo na to temo. Ko nas boste potrebovali, smo tukaj.", ai_personalize: true },
    ],
  },
  nurture: {
    name: "Ogrejte povpraševanja",
    audience: { stages: ["new", "contacted"], inactive_days: 3, sources: [], has_company: "any", auto_enroll: true },
    steps: [
      { delay_days: 0, subject: "Ali imate še kakšno vprašanje?", body: "Spoštovani,\n\nhvala za vaše povpraševanje. Ali vam lahko še kaj pojasnimo ali pripravimo predlog?", ai_personalize: true },
      { delay_days: 4, subject: "Kako so to rešili drugi", body: "Spoštovani,\n\nna kratko vam pošiljamo, kako smo podobno rešili za druge stranke. Če želite, se dogovorimo za kratek klic.", ai_personalize: true },
      { delay_days: 10, subject: "Ostajamo na voljo", body: "Spoštovani,\n\nkadarkoli boste pripravljeni, smo vam na voljo. Odgovorite na to sporočilo in se oglasimo.", ai_personalize: true },
    ],
  },
  newsletter: {
    name: "Novica za stranke",
    audience: { stages: ["converted"], inactive_days: 0, sources: [], has_company: "any", auto_enroll: false },
    steps: [{ delay_days: 0, subject: "Novost pri nas", body: "Spoštovani,\n\n[opišite novost, akcijo ali koristen nasvet]\n\nZa vprašanja preprosto odgovorite na to sporočilo.", ai_personalize: false }],
  },
  acquisition: {
    name: "Pridobivanje novih podjetij",
    source: "list",
    audience: { stages: ["new"], inactive_days: 0, sources: ["import", "manual"], has_company: "yes", auto_enroll: false },
    steps: [
      { delay_days: 0, subject: "Predlog za {podjetje}", body: "Spoštovani,\n\n[v dveh stavkih: kaj delate in kakšno korist ima podjetje od tega]\n\nAli bi bil primeren kratek 15-minutni klic ta ali naslednji teden?", ai_personalize: false },
      { delay_days: 4, subject: "Kratek opomnik", body: "Spoštovani,\n\nle preverjam, ali ste prejeli moje sporočilo. Z veseljem pošljem primer ali referenco.", ai_personalize: false },
      { delay_days: 10, subject: "Zadnje sporočilo", body: "Spoštovani,\n\nne bom več pisal na to temo. Če bo kdaj aktualno, mi preprosto odgovorite.", ai_personalize: false },
    ],
  },
  review: {
    name: "Prošnja za Google oceno",
    audience: { stages: ["converted"], inactive_days: 0, sources: [], has_company: "any", auto_enroll: true },
    steps: [
      { delay_days: 1, subject: "Hvala za zaupanje", body: "Spoštovani,\n\nhvala, da ste nam zaupali. Če ste bili zadovoljni, bi nam zelo pomagala vaša ocena na Googlu{povezava}.", ai_personalize: true },
      { delay_days: 7, subject: "Kratek opomnik", body: "Spoštovani,\n\nle prijazen opomnik — vaša ocena nam veliko pomeni{povezava}. Hvala!", ai_personalize: true },
    ],
  },
};

const lastTouch = (l) => Math.max(...[l.last_inbound_at, l.last_contacted_at, l.created_date].filter(Boolean).map((d) => new Date(d).getTime()));
export const matchAudience = (lead, a = {}) => {
  if (!lead.email || lead.consent_email === false || lead.status === "unsubscribed" || lead.email_bounced) return false;
  if (a.stages?.length && !a.stages.includes(lead.status || "new")) return false;
  if (a.sources?.length && !a.sources.includes(lead.source)) return false;
  if (a.has_company === "yes" && !lead.company_id) return false;
  if (a.has_company === "no" && lead.company_id) return false;
  if (a.inactive_days > 0 && Date.now() - lastTouch(lead) < a.inactive_days * 86400000) return false;
  return true;
};

// Koliko naslovov s seznamov bo prejelo sporočila (v redu, brez podvojenih in brez obstoječih strank).
const listReach = (listIds, contacts, leads) => {
  const leadEmails = new Set(leads.map((l) => String(l.email || "").toLowerCase()).filter(Boolean));
  const blocked = new Set(contacts.filter((c) => ["bounced", "unsubscribed", "replied", "invalid"].includes(c.status)).map((c) => c.email));
  const set = new Set();
  contacts.forEach((c) => { if (listIds.includes(c.list_id) && c.status === "ok" && !leadEmails.has(c.email) && !blocked.has(c.email)) set.add(c.email); });
  return set.size;
};
const PLACEHOLDER = /\[[^\]]{4,}\]/;

const RichEditor = React.lazy(() => import("@/components/kampanje/RichEditor"));
const toHtml = (t) => String(t || "").trim().split(/\n{2,}/).map((b) => `<p>${b.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("");
const toText = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
const FIELDS_LIST = [["Ime", "{ime}"], ["Podjetje", "{podjetje}"], ["Spletna stran", "{spletna_stran}"]];

function StepAttachments({ step, onChange, first, isList }) {
  const ref = React.useRef(null);
  const [busy, setBusy] = useState(false);
  const list = step.attachments || [];
  const add = async (files) => {
    const arr = Array.from(files || []); if (!arr.length) return;
    if (list.length + arr.length > 3) { toast.error("Največ 3 priponke na sporočilo."); return; }
    setBusy(true);
    try {
      const out = [...list];
      for (const f of arr) {
        if (f.size > 5_000_000) { toast.error(`${f.name}: največ 5 MB.`); continue; }
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        out.push({ name: f.name, url: file_url });
      }
      onChange(out);
    } catch (e) { toast.error("Priponke ni bilo mogoče naložiti."); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {list.map((a, j) => (
        <span key={a.url} className="text-xs inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1"><Paperclip className="w-3 h-3" />{a.name}<button onClick={() => onChange(list.filter((_, k) => k !== j))} className="text-muted-foreground hover:text-red-600"><X className="w-3 h-3" /></button></span>
      ))}
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}Dodaj priponko</button>
      <input ref={ref} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      {first && isList && list.length > 0 && <span className="text-[11px] text-amber-700 w-full">Priponka v prvem sporočilu neznanim naslovom poveča možnost, da sporočilo pristane med neželeno pošto. Raje jo pošljite v nadaljevanju ali kot povezavo.</span>}
    </div>
  );
}

function Builder({ open, onOpenChange, campaign, leads, lists, contacts, mailboxes, onLaunch, onMailboxesChanged }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [goal, setGoal] = useState("reactivation");
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sigFor, setSigFor] = useState(null);
  const okMailboxes = mailboxes.filter((m) => m.status !== "error");
  const withHtml = (steps) => (steps || []).map((s) => ({ ...s, body_html: s.body_html || toHtml(s.body) }));
  const init = (tpl, g) => {
    const source = tpl.source || "leads";
    // Seznam = privzeto vsi naslovi za kampanje; lastne stranke = privzeto glavni naslov.
    return { ...structuredClone(tpl), steps: withHtml(tpl.steps), goal: g, source, list_ids: source === "list" ? lists.map((l) => l.id) : [], mailbox_ids: source === "list" ? okMailboxes.map((m) => m.id) : [], auto_send: false };
  };
  React.useEffect(() => {
    if (!open) return;
    if (campaign?.id) { setGoal(campaign.goal); setC({ ...campaign, source: campaign.source || "leads", list_ids: campaign.list_ids || [], mailbox_ids: campaign.mailbox_ids || [], audience: { ...TEMPLATES[campaign.goal]?.audience, ...(campaign.audience || {}) }, steps: withHtml(campaign.steps) }); }
    else { const g = campaign?.goal || "reactivation"; setGoal(g); setC(init(TEMPLATES[g], g)); }
  }, [open, campaign?.id, campaign?.goal]);
  if (!c) return null;

  const isList = c.source === "list";
  const setA = (patch) => setC({ ...c, audience: { ...c.audience, ...patch } });
  const toggleIn = (key, v) => { const arr = c.audience[key] || []; setA({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }); };
  const toggleArr = (key, v) => setC({ ...c, [key]: (c[key] || []).includes(v) ? c[key].filter((x) => x !== v) : [...(c[key] || []), v] });
  const setStep = (i, patch) => setC({ ...c, steps: c.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const reach = isList ? listReach(c.list_ids || [], contacts, leads) : leads.filter((l) => matchAudience(l, c.audience)).length;
  const reviewLink = business?.google_review_link ? `: ${business.google_review_link}` : "";
  const selMailboxes = mailboxes.filter((m) => (c.mailbox_ids || []).includes(m.id));
  const perDay = selMailboxes.reduce((s, m) => s + dailyLimit(m), 0);
  const unit = isList ? W.naslov : W.stranka;
  // Izbira naslova: en meni (vsi izmenično / posamezen / glavni naslov pri strankah)
  const mbChoice = !selMailboxes.length ? "__main" : selMailboxes.length > 1 ? "__all" : selMailboxes[0].id;
  const pickMailbox = (v) => setC({ ...c, mailbox_ids: v === "__all" ? okMailboxes.map((m) => m.id) : v === "__main" ? [] : [v] });
  const sigMb = selMailboxes[0] || null;
  const sigHtml = sigMb?.signature_html || (business?.email_signature ? toHtml(business.email_signature) : "");
  const mainAddress = business?.smtp_from_email || business?.imap_user || "vaš glavni naslov";

  const save = async (launch) => {
    const steps = c.steps.map((s) => ({ ...s, text: toText(s.body_html) }));
    if (!c.name?.trim() || !steps.length || steps.some((s) => !String(s.subject || "").trim() || !s.text)) { toast.error("Izpolnite ime ter zadevo in besedilo vsakega sporočila."); return; }
    if (launch && steps.some((s) => PLACEHOLDER.test(s.text) || PLACEHOLDER.test(s.subject))) { toast.error("V besedilu je še oznaka v oglatih oklepajih [ … ]. Zamenjajte jo s svojim besedilom."); return; }
    if (isList && !(c.list_ids || []).length) { toast.error("Izberite vsaj en seznam naslovov."); return; }
    if (isList && !(c.mailbox_ids || []).length) { toast.error("Najprej povežite naslov, s katerega se pošilja."); return; }
    if (launch && selMailboxes.length && !selMailboxes.every((m) => m.signature_html) && !business?.email_signature) { toast.error("Dodajte podpis (gumb »Uredi podpis« pod sporočili)."); return; }
    setSaving(true);
    try {
      const data = {
        name: c.name.trim(), goal, description: CAMPAIGN_GOALS[goal].hint, audience: c.audience, auto_send: isList ? true : !!c.auto_send,
        source: c.source, list_ids: isList ? c.list_ids : [], mailbox_ids: c.mailbox_ids || [],
        steps: steps.map((s, i) => ({ order: i + 1, delay_days: Number(s.delay_days) || 0, subject: s.subject, body: s.text.replace("{povezava}", reviewLink), body_html: String(s.body_html || "").replace("{povezava}", reviewLink), attachments: s.attachments || [], ai_personalize: isList ? false : !!s.ai_personalize })),
      };
      let saved;
      if (campaign?.id) saved = await base44.entities.Campaign.update(campaign.id, data);
      else saved = await base44.entities.Campaign.create({ ...data, business_id: business.id, owner_email: business.owner_email || business.created_by, status: "draft", stats: {} });
      const id = campaign?.id || saved.id;
      if (launch) await onLaunch({ ...saved, ...data, id });
      invalidate(); onOpenChange(false);
      if (!launch) toast.success("Kampanja shranjena.");
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  const GoalIcon = GOAL_ICON[goal] || Megaphone;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">{campaign?.id ? "Uredi e-poštno kampanjo" : "Nova e-poštna kampanja"}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5"><GoalIcon className="w-4 h-4 text-primary" />{CAMPAIGN_GOALS[goal]?.label}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-5">
          <div className="space-y-1.5"><Label>Ime kampanje</Label><Input value={c.name || ""} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>

          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">1. Komu?</Label><span className="text-sm font-semibold text-primary inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{cnt(reach, unit)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {[["list", ListChecks, "Naslovom s seznama", "Uvožen Excel/CSV z e-naslovi"], ["leads", Users, "Vašim strankam", "Iz Stranke, po fazi in viru"]].map(([k, I, l, h]) => (
                <button key={k} disabled={!!campaign?.id && campaign.status !== "draft" && k !== c.source} onClick={() => setC({ ...c, source: k, list_ids: k === "list" && !(c.list_ids || []).length ? lists.map((x) => x.id) : c.list_ids, mailbox_ids: k === "list" && !(c.mailbox_ids || []).length ? okMailboxes.map((m) => m.id) : c.mailbox_ids })} className={`text-left rounded-xl border p-3 disabled:opacity-40 ${c.source === k ? "border-primary ring-2 ring-primary/20 bg-accent/40" : "hover:border-primary/40"}`}>
                  <p className="text-sm font-semibold flex items-center gap-2"><I className="w-4 h-4 text-primary" />{l}</p><p className="text-xs text-muted-foreground mt-0.5">{h}</p>
                </button>
              ))}
            </div>
            {isList ? (
              lists.length === 0 ? <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">Še nimate seznama. Zaprite to okno in desno pri »Seznami naslovov« kliknite »Uredi« → »Uvozi seznam«.</p> : (
                <div className="space-y-1.5">
                  {lists.map((l) => { const ok = contacts.filter((x) => x.list_id === l.id && x.status === "ok").length; return (
                    <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={(c.list_ids || []).includes(l.id)} onChange={() => toggleArr("list_ids", l.id)} />{l.name}<span className="text-xs text-muted-foreground">(v redu: {ok})</span></label>
                  ); })}
                  <p className="text-[11px] text-muted-foreground">Ne pišemo naslovom, ki so neveljavni, so se že vrnili, so se odjavili ali so že med vašimi strankami.</p>
                </div>
              )
            ) : (
              <>
                <div><p className="text-xs mb-1.5">Faza</p><div className="flex flex-wrap gap-1.5">{STAGES.map((s) => <button key={s.key} onClick={() => toggleIn("stages", s.key)} className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${c.audience.stages?.includes(s.key) ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</button>)}</div></div>
                <div><p className="text-xs mb-1.5">Vir (prazno = vsi)</p><div className="flex flex-wrap gap-1.5">{Object.entries(SOURCES).map(([k, s]) => <button key={k} onClick={() => toggleIn("sources", k)} className={`text-xs px-2.5 py-1 rounded-full border ${c.audience.sources?.includes(k) ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{s.label}</button>)}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs mb-1.5">Brez stika vsaj (dni)</p><Input type="number" min={0} value={c.audience.inactive_days ?? 0} onChange={(e) => setA({ inactive_days: Number(e.target.value) || 0 })} className="h-8" /></div>
                  <div><p className="text-xs mb-1.5">Vrsta stranke</p>
                    <select className="w-full h-8 rounded-md border bg-background px-2 text-sm" value={c.audience.has_company || "any"} onChange={(e) => setA({ has_company: e.target.value })}>
                      <option value="any">Vse</option><option value="yes">Samo podjetja</option><option value="no">Samo zasebne osebe</option>
                    </select></div>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm"><span>Samodejno dodaj tudi nove stranke, ki ustrezajo pogojem</span><Switch checked={!!c.audience.auto_enroll} onCheckedChange={(v) => setA({ auto_enroll: v })} /></label>
              </>
            )}
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">2. S katerega naslova se pošilja?</Label>
            {mailboxes.length === 0 ? (
              <p className="text-sm">{isList ? <span className="text-amber-800">Najprej povežite naslov za kampanje: zaprite to okno in desno pri »Naslov za pošiljanje« kliknite »Poveži«.</span> : <>Z vašega glavnega naslova <strong>{mainAddress}</strong>.</>}</p>
            ) : okMailboxes.length === 1 && isList ? (
              <p className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><strong>{okMailboxes[0].email}</strong><span className="text-xs text-muted-foreground">(največ {dailyLimit(okMailboxes[0])} na dan)</span></p>
            ) : (
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={mbChoice} onChange={(e) => pickMailbox(e.target.value)}>
                {okMailboxes.length > 1 && <option value="__all">Z vseh naslovov izmenično ({okMailboxes.length}) — skupaj do {okMailboxes.reduce((s, m) => s + dailyLimit(m), 0)} na dan</option>}
                {okMailboxes.map((m) => <option key={m.id} value={m.id}>{m.email} — do {dailyLimit(m)} na dan</option>)}
                {!isList && <option value="__main">Z glavnega naslova ({mainAddress})</option>}
              </select>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">3. Sekvenca (sporočila po vrsti)</Label>
            {c.steps.map((s, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2 relative">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{i === 0 ? "Pošlji" : "Če ne odgovori, čez"}</span>
                  <Input type="number" min={0} value={s.delay_days} onChange={(e) => setStep(i, { delay_days: e.target.value })} className="h-7 w-16 text-xs" />
                  <span className="text-xs text-muted-foreground">{i === 0 ? "dni po začetku" : "dni"}</span>
                  {c.steps.length > 1 && <button onClick={() => setC({ ...c, steps: c.steps.filter((_, j) => j !== i) })} className="ml-auto text-muted-foreground hover:text-red-600" title="Odstrani sporočilo"><X className="w-4 h-4" /></button>}
                </div>
                <Input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Zadeva" />
                <React.Suspense fallback={<div className="h-44 rounded-lg border animate-pulse" />}>
                  <RichEditor value={s.body_html} onChange={(html) => setStep(i, { body_html: html })} fields={isList ? FIELDS_LIST : []} />
                </React.Suspense>
                {PLACEHOLDER.test(toText(s.body_html)) && <p className="text-xs text-amber-700">Zamenjajte besedilo v oglatih oklepajih [ … ] s svojim.</p>}
                <StepAttachments step={s} first={i === 0} isList={isList} onChange={(attachments) => setStep(i, { attachments })} />
                {!isList && <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!s.ai_personalize} onChange={(e) => setStep(i, { ai_personalize: e.target.checked })} /><Sparkles className="w-3.5 h-3.5 text-primary" />AI prilagodi besedilo vsaki stranki (oblikovanje in slike se pri tem ne ohranijo)</label>}
              </div>
            ))}
            {c.steps.length < 6 && <Button variant="outline" size="sm" onClick={() => setC({ ...c, steps: [...c.steps, { delay_days: 4, subject: "", body_html: "<p>Spoštovani,</p><p><br></p>", attachments: [], ai_personalize: false }] })}><Plus className="w-4 h-4 mr-1" />Dodaj sporočilo</Button>}
            {isList && <p className="text-[11px] text-muted-foreground">»Spoštovani,« zamenjamo z »Pozdravljeni, Ime,«, če ime poznamo. Povezavo za odjavo doda sistem sam.</p>}

            <div className="rounded-xl bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Podpis (doda se na konec vsakega sporočila{selMailboxes.length > 1 ? "; vsak naslov ima svojega" : ""})</p>
                {sigMb ? <Button size="sm" variant="outline" className="h-7" onClick={() => setSigFor(sigMb)}><PenLine className="w-3.5 h-3.5 mr-1.5" />{sigMb.signature_html ? "Uredi podpis" : "Dodaj podpis"}</Button>
                  : <Link to="/nastavitve?tab=glas" className="text-xs text-primary hover:underline">Uredi v Nastavitvah</Link>}
              </div>
              {sigHtml ? <div className="text-sm bg-background rounded-lg border p-3 [&_img]:max-w-[220px] [&_p]:m-0" dangerouslySetInnerHTML={{ __html: sigHtml }} />
                : <p className="text-sm text-amber-800">Podpis še ni nastavljen. Brez podpisa kampanje ne morete zagnati.</p>}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            {isList ? (
              <div><p className="text-sm font-medium">Pošilja se samo</p><p className="text-xs text-muted-foreground mt-0.5">Od ponedeljka do petka med 8. in 17. uro, enakomerno čez dan{perDay ? `, skupaj največ ${perDay} sporočil na dan` : ""}. Če se vrnejo 3 sporočila (naslov ne obstaja) ali več kot 3 %, kampanjo ustavimo in vas obvestimo.</p></div>
            ) : (
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div><p className="text-sm font-medium">Pošlji brez moje odobritve</p><p className="text-xs text-muted-foreground mt-0.5">{c.auto_send ? "Sporočila se pošljejo sama (samo tista, ki jih AI oceni kot dobra)." : "Vsako sporočilo najprej počaka v Stranke → Čaka na vaš odgovor."}</p></div>
                <Switch checked={!!c.auto_send} onCheckedChange={(v) => setC({ ...c, auto_send: v })} />
              </label>
            )}
          </div>

          <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>Shrani kot osnutek</Button>
            <Button className="btn-brand flex-1" onClick={() => save(true)} disabled={saving || !reach || (isList && !(c.mailbox_ids || []).length)}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}{campaign?.status === "active" ? "Shrani" : `Zaženi za ${cnt(reach, isList ? ["naslov", "naslova", "naslove", "naslovov"] : ["stranko", "stranki", "stranke", "strank"])}`}</Button>
          </div>
        </div>
        {sigFor && <SignatureDialog mb={sigFor} business={business} open={!!sigFor} onOpenChange={(o) => !o && setSigFor(null)} onSaved={onMailboxesChanged} />}
      </SheetContent>
    </Sheet>
  );
}

// Desni stolpec: naslov za pošiljanje in seznami naslovov — povzetek v vrstici, urejanje v oknu.
function SetupPanel({ business, mailboxes, lists, contacts, onChanged, inSheet = false }) {
  const [open, setOpen] = useState(null); // "mb" | "lists"
  const ok = contacts.filter((c) => c.status === "ok").length;
  return (
    <aside className={inSheet ? "space-y-5" : "card-elevated p-5 space-y-5 xl:sticky xl:top-4"}>
      {!inSheet && <p className="font-semibold flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" />Nastavitve kampanj</p>}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Naslov za pošiljanje</p>{mailboxes.length > 0 && <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => setOpen("mb")}>Uredi</Button>}</div>
        {mailboxes.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">Kampanje pošiljajte z ločenega naslova (npr. novice@vase-podjetje.si), da glavni naslov ostane varen.</p>
            <Button className="btn-brand w-full" onClick={() => setOpen("mb")}><Mail className="w-4 h-4 mr-2" />Poveži naslov</Button>
          </>
        ) : mailboxes.map((m) => (
          <p key={m.id} className="text-sm flex items-center gap-2 min-w-0">
            {m.status === "error" ? <AlertCircle className="w-4 h-4 text-red-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            <span className="truncate">{m.email}</span>
            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">{m.status === "error" ? "napaka" : `danes ${sentToday(m)}/${dailyLimit(m)}`}</span>
          </p>
        ))}
      </div>
      <div className="space-y-2 pt-4 border-t">
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Seznami naslovov</p><Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => setOpen("lists")}>{lists.length ? "Uredi" : "Uvozi"}</Button></div>
        <p className="text-sm text-muted-foreground">{lists.length ? `${cnt(lists.length, ["seznam", "seznama", "seznami", "seznamov"])} · naslovov v redu: ${ok}` : "Še nimate seznama. Uvozite Excel ali CSV z e-naslovi."}</p>
      </div>
      <Sheet open={open === "mb"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto"><SheetHeader className="text-left"><SheetTitle className="font-display text-xl">Naslov za pošiljanje</SheetTitle></SheetHeader><div className="mt-4"><SendingMailboxes bare business={business} mailboxes={mailboxes} onChanged={onChanged} /></div></SheetContent>
      </Sheet>
      <Sheet open={open === "lists"} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto"><SheetHeader className="text-left"><SheetTitle className="font-display text-xl">Seznami naslovov</SheetTitle></SheetHeader><div className="mt-4"><ContactLists bare business={business} lists={lists} contacts={contacts} onChanged={onChanged} /></div></SheetContent>
      </Sheet>
    </aside>
  );
}

function BounceAlert({ c, onResume }) {
  const a = c.bounce_alert || {};
  const list = a.addresses || [];
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3 text-sm">
      <p className="font-semibold text-red-800 flex items-center gap-2"><MailX className="w-4 h-4" />Ustavljeno. Vrnjena sporočila: {a.count || list.length}{a.sent ? ` od ${a.sent} prejemnikov (${((a.rate || 0) * 100).toFixed(1).replace(".", ",")} %)` : ""}</p>
      <p className="text-red-900/80">Ti naslovi ne obstajajo več. Ponudniki e-pošte (Gmail, Outlook, Siol …) spremljajo, koliko vaših sporočil se vrne — pri več kot nekaj odstotkih začnejo vašo pošto pošiljati med neželeno ali jo zavračati, tudi običajna sporočila z vaše domene. Vrnjene naslove smo že izločili.</p>
      <ul className="text-xs space-y-0.5">
        {list.slice(0, 5).map((x) => <li key={x.email}><span className="font-medium">{x.email}</span>{x.reason ? ` — ${x.reason}` : ""}</li>)}
        {list.length > 5 && <li className="text-muted-foreground">… in še {list.length - 5}</li>}
      </ul>
      <VerifyHelp defaultOpen />
      <div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={onResume}><Play className="w-4 h-4 mr-2" />Nadaljuj kljub temu</Button></div>
    </div>
  );
}

export default function Kampanje() {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const bid = business?.id;
  const [builder, setBuilder] = useState({ open: false, campaign: null });
  const [picker, setPicker] = useState(false);
  const [settings, setSettings] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [toResume, setToResume] = useState(null);
  const useQ = (key, fn) => useQuery({ queryKey: [key, bid], queryFn: fn, enabled: !!bid });
  const { data: campaigns = [], isLoading } = useQ("campaigns", () => base44.entities.Campaign.filter({ business_id: bid }));
  const { data: enrollments = [], refetch: refetchEnr } = useQ("enrollments", () => base44.entities.CampaignEnrollment.filter({ business_id: bid }, "-created_date", 5000));
  const { data: drafts = [] } = useQ("drafts-all", () => base44.entities.DraftMessage.filter({ business_id: bid, pillar: "campaign" }));
  const { data: leads = [] } = useQ("leads", () => base44.entities.Lead.filter({ business_id: bid }));
  const { data: mailboxes = [], refetch: refetchMb } = useQ("sending-mailboxes", () => base44.entities.SendingMailbox.filter({ business_id: bid }));
  const { data: lists = [], refetch: refetchLists } = useQ("contact-lists", () => base44.entities.ContactList.filter({ business_id: bid }, "-created_date"));
  const { data: contacts = [], refetch: refetchContacts } = useQ("list-contacts", () => base44.entities.ListContact.filter({ business_id: bid }, "-created_date", 5000));
  const refreshSetup = () => { refetchMb(); refetchLists(); refetchContacts(); refetchEnr(); invalidate(); };

  const stats = useMemo(() => {
    const m = {};
    campaigns.forEach((c) => { m[c.id] = { enrolled: 0, active: 0, replied: 0, sent: 0, pending: 0, bounced: 0, unsub: 0 }; });
    enrollments.forEach((e) => {
      const s = m[e.campaign_id]; if (!s) return;
      s.enrolled++; if (e.status === "active") s.active++; if (e.status === "stopped_replied") s.replied++; if (e.status === "stopped_bounced") s.bounced++; if (e.status === "stopped_unsubscribed") s.unsub++;
      if (e.contact_id) s.sent += Number(e.current_step) || 0;
    });
    drafts.forEach((d) => { const s = m[d.campaign_id]; if (!s) return; if (d.status === "sent") s.sent++; if (["pending", "flagged_for_review"].includes(d.status)) s.pending++; });
    campaigns.forEach((c) => { if (c.source === "list") { const done = new Set(enrollments.filter((e) => e.campaign_id === c.id).map((e) => e.email)); m[c.id].waiting = Math.max(0, listReach(c.list_ids || [], contacts, leads) - [...done].filter(Boolean).length); } });
    return m;
  }, [campaigns, enrollments, drafts, contacts, leads]);

  const launch = async (c) => {
    if (c.source === "list") {
      await base44.entities.Campaign.update(c.id, { status: "active" });
      invalidate();
      toast.success("Kampanja teče. Prva sporočila odidejo v naslednji uri (pon–pet 8–17).");
      return;
    }
    const existing = new Set(enrollments.filter((e) => e.campaign_id === c.id).map((e) => e.lead_id));
    const toAdd = leads.filter((l) => matchAudience(l, c.audience) && !existing.has(l.id));
    const first = Number(c.steps?.[0]?.delay_days) || 0;
    for (const l of toAdd) {
      await base44.entities.CampaignEnrollment.create({ business_id: bid, owner_email: business.owner_email || business.created_by, campaign_id: c.id, lead_id: l.id, email: String(l.email || "").toLowerCase(), current_step: 0, status: "active", next_send_at: addDays(new Date(), first).toISOString() });
    }
    await base44.entities.Campaign.update(c.id, { status: "active" });
    invalidate();
    toast.success(toAdd.length ? `Kampanja teče: ${cnt(toAdd.length, ["stranka dodana", "stranki dodani", "stranke dodane", "strank dodanih"])}. Prva sporočila pripravi v nekaj minutah.` : "Kampanja teče.");
  };
  const setStatus = async (c, status) => {
    await base44.entities.Campaign.update(c.id, status === "active" ? { status, paused_reason: "", resumed_at: new Date().toISOString() } : { status });
    invalidate(); toast.success(status === "paused" ? "Kampanja je začasno ustavljena. Nič se ne pošilja." : "Kampanja spet teče.");
  };
  const remove = async () => {
    const c = toDelete; setToDelete(null);
    await Promise.all(enrollments.filter((e) => e.campaign_id === c.id && e.status === "active").map((e) => base44.entities.CampaignEnrollment.update(e.id, { status: "stopped_manual" })));
    await base44.entities.Campaign.delete(c.id); invalidate(); toast.success("Kampanja izbrisana.");
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  const delayText = (s, i) => (i === 0 ? (Number(s.delay_days) > 0 ? `čez ${s.delay_days} ${Number(s.delay_days) === 1 ? "dan" : "dni"}` : "takoj") : `če ne odgovori, čez ${s.delay_days} ${Number(s.delay_days) === 1 ? "dan" : "dni"}`);
  const sorted = [...campaigns].sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1) || new Date(b.created_date) - new Date(a.created_date));
  const mbById = Object.fromEntries(mailboxes.map((m) => [m.id, m]));

  const hasCampaigns = campaigns.length > 0;
  const pick = (k) => { setPicker(false); setBuilder({ open: true, campaign: { goal: k } }); };
  const setupWarn = mailboxes.length === 0 || mailboxes.some((m) => m.status === "error");
  const goalGrid = (compact) => (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"}`}>
      {Object.entries(CAMPAIGN_GOALS).map(([k, g]) => {
        const I = GOAL_ICON[k]; const tpl = TEMPLATES[k];
        const isList = tpl.source === "list";
        const n = isList ? listReach(lists.map((l) => l.id), contacts, leads) : leads.filter((l) => matchAudience(l, tpl.audience)).length;
        const msgs = tpl.steps.length;
        const reach = isList
          ? (n > 0 ? `Naslovov na vaših seznamih: ${n}` : "Najprej uvozite seznam naslovov")
          : (n > 0 ? `Zdaj ustreza: ${cnt(n, ["stranka", "stranki", "stranke", "strank"])}` : "Zdaj ni strank, ki bi ustrezale");
        return (
          <button key={k} onClick={() => pick(k)} className="text-left card-elevated p-4 flex flex-col hover:border-primary/50 hover:shadow-md transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><I className="w-5 h-5" /></div>
              <p className="font-semibold leading-tight">{g.label}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2 flex-1">{g.hint}</p>
            <p className="text-xs mt-3"><span className={n > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>{reach}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">{AUDIENCE_TEXT[k]} · {msgs} {pl(msgs, ["sporočilo", "sporočili", "sporočila", "sporočil"])} že napisan{msgs === 2 ? "i" : msgs >= 3 && msgs <= 4 ? "a" : msgs >= 5 ? "ih" : "o"}</p>
            <span className="mt-3 text-sm font-medium text-primary inline-flex items-center gap-1">Pripravi<ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1>E-poštne kampanje</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">Nekaj vnaprej napisanih sporočil, ki odidejo z razmikom nekaj dni. Ko kdo odgovori, se zanj ustavijo, odgovor pa najdete pri Strankah.</p>
        </div>
        {hasCampaigns && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSettings(true)} className="relative"><Settings2 className="w-4 h-4 mr-2" />Nastavitve{setupWarn && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" aria-label="Nastavitve potrebujejo pozornost" />}</Button>
            <Button className="btn-brand" onClick={() => setPicker(true)}><Plus className="w-4 h-4 mr-2" />Ustvari kampanjo</Button>
          </div>
        )}
      </div>

      {!hasCampaigns ? (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <section className="space-y-4 min-w-0">
            <ol className="grid sm:grid-cols-3 gap-3">
              {[["Povežite naslov", "S katerega se pošilja (desno).", mailboxes.length > 0], ["Izberite cilj", "Spodaj — sporočila so že napisana.", false], ["Preglejte in zaženite", "Nič ne odide, dokler ne kliknete »Zaženi«.", false]].map(([t, d, done], i) => (
                <li key={t} className="rounded-xl border bg-card p-3 flex gap-3">
                  <span className={`w-7 h-7 rounded-full text-sm font-semibold flex items-center justify-center shrink-0 ${done ? "bg-emerald-100 text-emerald-700" : "bg-accent text-primary"}`}>{done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}</span>
                  <span><span className="font-medium text-sm block">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                </li>
              ))}
            </ol>
            <h2 className="text-lg pt-2">Kaj želite doseči?</h2>
            {goalGrid(false)}
          </section>
          <SetupPanel business={business} mailboxes={mailboxes} lists={lists} contacts={contacts} onChanged={refreshSetup} />
        </div>
      ) : (
      <section className="space-y-3">
          <div className="grid xl:grid-cols-2 gap-4">
            {sorted.map((c) => {
              const s = stats[c.id] || {}; const St = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft; const I = GOAL_ICON[c.goal] || Megaphone;
              const isList = c.source === "list";
              const bounced = c.status === "paused" && c.paused_reason === "bounces";
              const mbs = (c.mailbox_ids || []).map((id) => mbById[id]).filter(Boolean);
              const mbError = c.status === "active" && mbs.length > 0 && mbs.every((m) => m.status === "error");
              const explain = bounced ? "Ustavili smo jo, ker se je vrnilo preveč sporočil."
                : c.status === "active" ? (isList ? `Pošilja pon–pet 8–17. Še brez prvega sporočila: ${cnt(s.waiting || 0, W.naslov)}. Sekvenco nadaljuje: ${cnt(s.active || 0, W.oseba)}.` : `Sporočila še prejema: ${cnt(s.active || 0, W.stranka)}.`)
                : c.status === "paused" ? "Nič se ne pošilja, dokler ne kliknete »Nadaljuj«."
                : c.status === "completed" ? "Vsa sporočila so bila poslana."
                : "Nič se ne pošilja, dokler ne kliknete »Zaženi«.";
              return (
                <div key={c.id} className="card-elevated p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><I className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{CAMPAIGN_GOALS[c.goal]?.label || "Lastna kampanja"}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5"><p className="font-semibold">{c.name}</p><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${bounced ? "bg-red-100 text-red-700" : St.cls}`}>{bounced ? "Ustavljena: vrnjena pošta" : St.label}</span></div>
                      <p className="text-sm text-muted-foreground mt-0.5">{explain}</p>
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5 flex-wrap">{isList ? <><ListChecks className="w-3.5 h-3.5" />Seznam</> : <><Users className="w-3.5 h-3.5" />Vaše stranke</>}{mbs.length > 0 && <><span>·</span><Mail className="w-3.5 h-3.5" />{mbs.map((m) => m.email).join(", ")}</>}</p>
                    </div>
                  </div>

                  {bounced && <BounceAlert c={c} onResume={() => setToResume(c)} />}
                  {mbError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Pošiljanje z naslova ne deluje ({mbs[0].last_error || "napaka"}). <button className="underline font-medium" onClick={() => setSettings(true)}>Popravite geslo v Nastavitvah</button>.</span></p>}

                  <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Sekvenca</p>
                    {(c.steps || []).map((st, i) => (
                      <p key={i} className="text-sm flex gap-2"><span className="w-5 h-5 rounded-full bg-background border text-[11px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span><span className="truncate">»{st.subject}« <span className="text-muted-foreground">· {delayText(st, i)}</span></span></p>
                    ))}
                    {!(c.steps || []).length && <p className="text-sm text-muted-foreground">Sporočil še ni. Kliknite »Poglej in uredi«.</p>}
                    <p className="text-xs text-muted-foreground pt-1">{isList ? "Sporočila se pošljejo sama." : c.auto_send ? "Sporočila se pošljejo sama." : "Vsako sporočilo pred pošiljanjem potrdite vi."}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[[Send, s.sent, "poslana sporočila"], [MessageCircleReply, s.replied, "odgovori"], [MailX, s.bounced, "vrnjena (ne obstaja)"]].map(([Ic, n, l]) => (
                      <div key={l} className="rounded-xl border p-2.5"><p className={`text-xl font-display font-bold ${l.startsWith("vrnjena") && n > 0 ? "text-red-600" : ""}`}>{n || 0}</p><p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Ic className="w-3 h-3" />{l}</p></div>
                    ))}
                  </div>
                  {s.unsub > 0 && <p className="text-xs text-muted-foreground -mt-2">Odjavilo se je: {cnt(s.unsub, W.oseba)}.</p>}

                  {s.replied > 0 && (
                    <Link to="/stranke?tab=odgovori" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-accent/50 px-3 py-2 text-sm hover:bg-accent">
                      <span className="font-medium">Odgovore najdete pri Strankah</span><ArrowRight className="w-4 h-4 ml-auto text-primary" />
                    </Link>
                  )}
                  {s.pending > 0 && (
                    <Link to="/stranke?tab=odgovori" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-accent/50 px-3 py-2 text-sm hover:bg-accent">
                      <span className="font-medium">Na vašo potrditev čaka: {cnt(s.pending, W.sporocilo)}</span><ArrowRight className="w-4 h-4 ml-auto text-primary" />
                    </Link>
                  )}

                  <div className="flex gap-2 flex-wrap pt-1 border-t">
                    {c.status === "active" ? <Button variant="outline" onClick={() => setStatus(c, "paused")} className="mt-3"><Pause className="w-4 h-4 mr-2" />Začasno ustavi</Button>
                      : c.status === "paused" ? (bounced ? null : <Button className="btn-brand mt-3" onClick={() => setStatus(c, "active")}><Play className="w-4 h-4 mr-2" />Nadaljuj</Button>)
                      : <Button className="btn-brand mt-3" onClick={() => launch(c)}><Play className="w-4 h-4 mr-2" />Zaženi</Button>}
                    <Button variant="outline" className="mt-3" onClick={() => setBuilder({ open: true, campaign: c })}><Pencil className="w-4 h-4 mr-2" />Poglej in uredi</Button>
                    <Button variant="ghost" className="mt-3 ml-auto text-muted-foreground hover:text-red-600" onClick={() => setToDelete(c)}><Trash2 className="w-4 h-4 mr-2" />Izbriši</Button>
                  </div>
                  {c.last_run_at && <p className="text-[11px] text-muted-foreground -mt-2">Zadnji zagon: {fmtDateTime(c.last_run_at)}</p>}
                </div>
              );
            })}
          </div>
      </section>
      )}

      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-xl">Nova kampanja — kaj želite doseči?</DialogTitle><DialogDescription>Izberite cilj. Sporočila so že napisana; pred zagonom jih pregledate in popravite.</DialogDescription></DialogHeader>
          {goalGrid(true)}
        </DialogContent>
      </Dialog>
      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto"><SheetHeader className="text-left"><SheetTitle className="font-display text-xl">Nastavitve kampanj</SheetTitle><SheetDescription>Naslovi, s katerih pošiljate, in seznami naslovov.</SheetDescription></SheetHeader>
          <div className="mt-5"><SetupPanel inSheet business={business} mailboxes={mailboxes} lists={lists} contacts={contacts} onChanged={refreshSetup} /></div>
        </SheetContent>
      </Sheet>

      <Builder open={builder.open} onOpenChange={(o) => setBuilder({ open: o, campaign: o ? builder.campaign : null })} campaign={builder.campaign} leads={leads} lists={lists} contacts={contacts} mailboxes={mailboxes} onLaunch={launch} onMailboxesChanged={refreshSetup} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Izbrišem kampanjo »{toDelete?.name}«?</AlertDialogTitle><AlertDialogDescription>Nadaljnja sporočila ne bodo poslana. Že poslana ostanejo v zgodovini.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Prekliči</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={remove}>Izbriši</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!toResume} onOpenChange={(o) => !o && setToResume(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Nadaljujem kljub vrnjenim sporočilom?</AlertDialogTitle>
            <AlertDialogDescription>Vrnjeni naslovi so izločeni, a na seznamu so verjetno še drugi, ki ne obstajajo. Če se vrnejo še 3 sporočila, bomo kampanjo spet ustavili. Vsako vrnjeno sporočilo slabša ugled vašega naslova in domene — priporočamo, da preostale naslove prej preverite v storitvi za preverjanje e-naslovov.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Prekliči</AlertDialogCancel><AlertDialogAction onClick={() => { const c = toResume; setToResume(null); setStatus(c, "active"); }}>Nadaljuj kljub temu</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
