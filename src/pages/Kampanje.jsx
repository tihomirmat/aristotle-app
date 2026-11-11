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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Megaphone, Plus, Loader2, Play, Pause, Pencil, Trash2, Users, Send, MessageCircleReply, Sparkles, Clock, X, RotateCcw, HeartHandshake, Newspaper, Target, Star, ArrowRight, AlertTriangle, MailX, ListChecks, Mail } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { addDays } from "date-fns";
import { CAMPAIGN_GOALS, CAMPAIGN_STATUS, STAGES, SOURCES, pl, cnt, W, fmtDateTime } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";
import SendingMailboxes, { dailyLimit } from "@/components/kampanje/SendingMailboxes";
import ContactLists, { VerifyHelp } from "@/components/kampanje/ContactLists";

const GOAL_ICON = { reactivation: RotateCcw, nurture: HeartHandshake, newsletter: Newspaper, acquisition: Target, review: Star };

// Predloge kampanj: prazni nagovor/podpis doda AI oziroma sistem.
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

function Builder({ open, onOpenChange, campaign, leads, lists, contacts, mailboxes, onLaunch }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [goal, setGoal] = useState("reactivation");
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  const init = (tpl, g, extra = {}) => {
    const source = extra.source || tpl.source || "leads";
    return { ...structuredClone(tpl), goal: g, source, list_ids: source === "list" ? lists.map((l) => l.id) : [], mailbox_ids: mailboxes.filter((m) => m.status !== "error").map((m) => m.id), auto_send: false, ...extra };
  };
  React.useEffect(() => {
    if (!open) return;
    if (campaign?.id) { setGoal(campaign.goal); setC({ ...campaign, source: campaign.source || "leads", list_ids: campaign.list_ids || [], mailbox_ids: campaign.mailbox_ids || [], audience: { ...TEMPLATES[campaign.goal]?.audience, ...(campaign.audience || {}) }, steps: campaign.steps || [] }); }
    else { const g = campaign?.goal || "reactivation"; setGoal(g); setC(init(TEMPLATES[g], g)); }
  }, [open, campaign?.id, campaign?.goal]);
  if (!c) return null;

  const isList = c.source === "list";
  const pickGoal = (g) => { setGoal(g); if (!campaign?.id) setC(init(TEMPLATES[g], g, { auto_send: c.auto_send })); };
  const setA = (patch) => setC({ ...c, audience: { ...c.audience, ...patch } });
  const toggleIn = (key, v) => { const arr = c.audience[key] || []; setA({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }); };
  const toggleArr = (key, v) => setC({ ...c, [key]: (c[key] || []).includes(v) ? c[key].filter((x) => x !== v) : [...(c[key] || []), v] });
  const setStep = (i, patch) => setC({ ...c, steps: c.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const reach = isList ? listReach(c.list_ids || [], contacts, leads) : leads.filter((l) => matchAudience(l, c.audience)).length;
  const reviewLink = business?.google_review_link ? `: ${business.google_review_link}` : "";
  const selMailboxes = mailboxes.filter((m) => (c.mailbox_ids || []).includes(m.id));
  const perDay = selMailboxes.reduce((s, m) => s + dailyLimit(m), 0);
  const unit = isList ? W.naslov : W.stranka;

  const save = async (launch) => {
    if (!c.name?.trim() || !c.steps.length || c.steps.some((s) => !s.subject.trim() || !s.body.trim())) { toast.error("Izpolnite ime ter zadevo in besedilo vsakega sporočila."); return; }
    if (launch && c.steps.some((s) => PLACEHOLDER.test(s.body) || PLACEHOLDER.test(s.subject))) { toast.error("V besedilu je še oznaka v oglatih oklepajih [ … ]. Zamenjajte jo s svojim besedilom."); return; }
    if (isList && !(c.list_ids || []).length) { toast.error("Izberite vsaj en seznam naslovov."); return; }
    if (isList && !(c.mailbox_ids || []).length) { toast.error("Izberite naslov, s katerega se pošilja (ali ga najprej povežite)."); return; }
    setSaving(true);
    try {
      const data = {
        name: c.name.trim(), goal, description: CAMPAIGN_GOALS[goal].hint, audience: c.audience, auto_send: isList ? true : !!c.auto_send,
        source: c.source, list_ids: isList ? c.list_ids : [], mailbox_ids: c.mailbox_ids || [],
        steps: c.steps.map((s, i) => ({ order: i + 1, delay_days: Number(s.delay_days) || 0, subject: s.subject, body: s.body.replace("{povezava}", reviewLink), ai_personalize: isList ? false : !!s.ai_personalize })),
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-left"><SheetTitle className="font-display text-xl">{campaign?.id ? "Uredi kampanjo" : "Nova e-poštna kampanja"}</SheetTitle><SheetDescription>Sekvenca = nekaj sporočil, ki se pošljejo sama, z razmikom nekaj dni. Ko kdo odgovori, se zanj sekvenca ustavi.</SheetDescription></SheetHeader>
        <div className="space-y-6 mt-5">
          <div>
            <Label className="text-xs text-muted-foreground">1. Kaj želite doseči?</Label>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {Object.entries(CAMPAIGN_GOALS).map(([k, g]) => { const I = GOAL_ICON[k]; return (
                <button key={k} disabled={!!campaign?.id && k !== goal} onClick={() => pickGoal(k)} className={`text-left rounded-xl border p-3 transition-all disabled:opacity-40 ${goal === k ? "border-primary ring-2 ring-primary/20 bg-accent/40" : "hover:border-primary/40"}`}>
                  <p className="text-sm font-semibold flex items-center gap-2"><I className="w-4 h-4 text-primary" />{g.label}</p><p className="text-xs text-muted-foreground mt-1">{g.hint}</p>
                </button>
              ); })}
            </div>
          </div>

          <div className="space-y-1.5"><Label>Ime kampanje</Label><Input value={c.name || ""} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>

          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">2. Komu?</Label><span className="text-sm font-semibold text-primary inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{cnt(reach, unit)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {[["list", ListChecks, "Naslovom s seznama", "Uvožen Excel/CSV z e-naslovi"], ["leads", Users, "Vašim strankam", "Iz Stranke, po fazi in viru"]].map(([k, I, l, h]) => (
                <button key={k} disabled={!!campaign?.id && campaign.status !== "draft" && k !== c.source} onClick={() => setC({ ...c, source: k, list_ids: k === "list" && !(c.list_ids || []).length ? lists.map((x) => x.id) : c.list_ids })} className={`text-left rounded-xl border p-3 disabled:opacity-40 ${c.source === k ? "border-primary ring-2 ring-primary/20 bg-accent/40" : "hover:border-primary/40"}`}>
                  <p className="text-sm font-semibold flex items-center gap-2"><I className="w-4 h-4 text-primary" />{l}</p><p className="text-xs text-muted-foreground mt-0.5">{h}</p>
                </button>
              ))}
            </div>
            {isList ? (
              lists.length === 0 ? <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">Še nimate seznama. Zaprite to okno in v razdelku »Seznami naslovov« kliknite »Uvozi seznam«.</p> : (
                <div className="space-y-1.5">
                  {lists.map((l) => { const ok = contacts.filter((x) => x.list_id === l.id && x.status === "ok").length; return (
                    <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={(c.list_ids || []).includes(l.id)} onChange={() => toggleArr("list_ids", l.id)} />{l.name}<span className="text-xs text-muted-foreground">({ok} v redu)</span></label>
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
                <p className="text-[11px] text-muted-foreground">Vključene so samo stranke z e-naslovom, ki se strinjajo s prejemanjem e-pošte, se niso odjavile in se jim pošta ni vrnila.</p>
              </>
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
                  {c.steps.length > 1 && <button onClick={() => setC({ ...c, steps: c.steps.filter((_, j) => j !== i) })} className="ml-auto text-muted-foreground hover:text-red-600"><X className="w-4 h-4" /></button>}
                </div>
                <Input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Zadeva" />
                <Textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} className="h-28 text-sm" />
                {PLACEHOLDER.test(s.body) && <p className="text-xs text-amber-700">Zamenjajte besedilo v oglatih oklepajih [ … ] s svojim.</p>}
                {!isList && <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!s.ai_personalize} onChange={(e) => setStep(i, { ai_personalize: e.target.checked })} /><Sparkles className="w-3.5 h-3.5 text-primary" />AI prilagodi besedilo vsaki stranki (nagovor, kaj je želela)</label>}
              </div>
            ))}
            {c.steps.length < 6 && <Button variant="outline" size="sm" onClick={() => setC({ ...c, steps: [...c.steps, { delay_days: 4, subject: "", body: "Spoštovani,\n\n", ai_personalize: !isList }] })}><Plus className="w-4 h-4 mr-1" />Dodaj sporočilo</Button>}
            <p className="text-[11px] text-muted-foreground">{isList ? "V besedilo lahko vstavite {ime}, {podjetje} in {spletna_stran} — zamenjamo jih s podatki s seznama. »Spoštovani,« zamenjamo z »Pozdravljeni, Ime,«, če ime poznamo. " : ""}Podpis in povezavo za odjavo doda sistem samodejno.</p>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">4. S katerega naslova?</Label>
            {mailboxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isList ? <span className="text-amber-800">Najprej povežite naslov za kampanje (razdelek »Naslov, s katerega pošiljate«).</span> : "Sporočila gredo z vašega glavnega naslova. Za kampanje priporočamo ločen naslov."}</p>
            ) : (
              <>
                {mailboxes.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={(c.mailbox_ids || []).includes(m.id)} onChange={() => toggleArr("mailbox_ids", m.id)} disabled={m.status === "error"} />{m.email}<span className="text-xs text-muted-foreground">({dailyLimit(m)} na dan{m.status === "error" ? " · napaka" : ""})</span></label>
                ))}
                {!isList && !(c.mailbox_ids || []).length && <p className="text-[11px] text-muted-foreground">Nič izbrano = pošlje se z vašega glavnega naslova.</p>}
              </>
            )}
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
      </SheetContent>
    </Sheet>
  );
}

function BounceAlert({ c, onResume }) {
  const a = c.bounce_alert || {};
  const list = a.addresses || [];
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3 text-sm">
      <p className="font-semibold text-red-800 flex items-center gap-2"><MailX className="w-4 h-4" />Ustavljeno: vrnilo se je {cnt(a.count || list.length, W.sporocilo)}{a.sent ? ` (od ${a.sent} poslanih, ${((a.rate || 0) * 100).toFixed(1).replace(".", ",")} %)` : ""}</p>
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

  return (
    <div className="space-y-8">
      <div>
        <h1>E-poštne kampanje</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">Kampanja pošlje <strong>sekvenco</strong> — nekaj vnaprej napisanih sporočil z razmikom nekaj dni — naslovom s seznama ali vašim strankam. Ko kdo odgovori, se zanj sekvenca ustavi, odgovor pa najdete pri Strankah.</p>
      </div>

      {/* 1. Priprava: s katerega naslova in komu */}
      <section className="grid xl:grid-cols-2 gap-4">
        <SendingMailboxes business={business} mailboxes={mailboxes} onChanged={refreshSetup} />
        <ContactLists business={business} lists={lists} contacts={contacts} onChanged={refreshSetup} />
      </section>

      {/* 2. Nova kampanja */}
      <section className="space-y-3">
        <h2 className="text-lg">Nova kampanja — kaj želite doseči?</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {Object.entries(CAMPAIGN_GOALS).map(([k, g]) => {
            const I = GOAL_ICON[k]; const tpl = TEMPLATES[k];
            const n = tpl.source === "list" ? listReach(lists.map((l) => l.id), contacts, leads) : leads.filter((l) => matchAudience(l, tpl.audience)).length;
            const msgs = tpl.steps.length;
            return (
              <div key={k} className="card-elevated p-4 flex flex-col">
                <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center"><I className="w-5 h-5" /></div>
                <p className="font-semibold mt-3">{g.label}</p>
                <p className="text-sm text-muted-foreground mt-1 flex-1">{g.hint}</p>
                <p className="text-xs text-muted-foreground mt-3">{msgs} {pl(msgs, ["pripravljeno sporočilo", "pripravljeni sporočili", "pripravljena sporočila", "pripravljenih sporočil"])} · <span className={n > 0 ? "text-primary font-medium" : ""}>{tpl.source === "list" ? `${cnt(n, W.naslov)} na seznamih` : `primerno za ${cnt(n, ["stranko", "stranki", "stranke", "strank"])}`}</span></p>
                <Button variant="outline" className="mt-3 w-full" onClick={() => setBuilder({ open: true, campaign: { goal: k } })}>Pripravi<ArrowRight className="w-4 h-4 ml-1.5" /></Button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Sporočila so že napisana. Pred zagonom jih vidite in popravite — nič se ne pošlje, dokler ne kliknete »Zaženi«.</p>
      </section>

      {/* 3. Vaše kampanje */}
      <section className="space-y-3">
        <h2 className="text-lg">Vaše kampanje {campaigns.length > 0 && <span className="text-muted-foreground font-normal text-base">({campaigns.length})</span>}</h2>
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground"><Megaphone className="w-8 h-8 mx-auto opacity-40" /><p className="mt-3 text-sm">Še nimate nobene kampanje. Izberite cilj zgoraj in kliknite »Pripravi«.</p></div>
        ) : (
          <div className="grid xl:grid-cols-2 gap-4">
            {sorted.map((c) => {
              const s = stats[c.id] || {}; const St = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft; const I = GOAL_ICON[c.goal] || Megaphone;
              const isList = c.source === "list";
              const bounced = c.status === "paused" && c.paused_reason === "bounces";
              const mbs = (c.mailbox_ids || []).map((id) => mbById[id]).filter(Boolean);
              const mbError = c.status === "active" && mbs.length > 0 && mbs.every((m) => m.status === "error");
              const explain = bounced ? "Ustavili smo jo, ker se je vrnilo preveč sporočil."
                : c.status === "active" ? (isList ? `Pošilja pon–pet 8–17. Na prvo sporočilo čaka še ${cnt(s.waiting || 0, W.naslov)}, sekvenco nadaljuje ${cnt(s.active || 0, W.oseba)}.` : `Sporočila še prejema: ${cnt(s.active || 0, W.stranka)}.`)
                : c.status === "paused" ? "Nič se ne pošilja, dokler ne kliknete »Nadaljuj«."
                : c.status === "completed" ? "Vsa sporočila so bila poslana."
                : "Nič se ne pošilja, dokler ne kliknete »Zaženi«.";
              return (
                <div key={c.id} className="card-elevated p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><I className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold">{c.name}</p><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${bounced ? "bg-red-100 text-red-700" : St.cls}`}>{bounced ? "Ustavljena: vrnjena pošta" : St.label}</span></div>
                      <p className="text-sm text-muted-foreground mt-0.5">{explain}</p>
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5 flex-wrap">{isList ? <><ListChecks className="w-3.5 h-3.5" />Seznam</> : <><Users className="w-3.5 h-3.5" />Vaše stranke</>}{mbs.length > 0 && <><span>·</span><Mail className="w-3.5 h-3.5" />{mbs.map((m) => m.email).join(", ")}</>}</p>
                    </div>
                  </div>

                  {bounced && <BounceAlert c={c} onResume={() => setToResume(c)} />}
                  {mbError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />Pošiljanje z naslova ne deluje ({mbs[0].last_error || "napaka"}). Popravite geslo zgoraj pri »Naslov, s katerega pošiljate«.</p>}

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
        )}
      </section>

      <Builder open={builder.open} onOpenChange={(o) => setBuilder({ open: o, campaign: o ? builder.campaign : null })} campaign={builder.campaign} leads={leads} lists={lists} contacts={contacts} mailboxes={mailboxes} onLaunch={launch} />
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
