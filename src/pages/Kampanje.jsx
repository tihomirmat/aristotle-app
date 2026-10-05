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
import { Megaphone, Plus, Loader2, Play, Pause, Pencil, Trash2, Users, Send, MessageCircleReply, Sparkles, Clock, X, RotateCcw, HeartHandshake, Newspaper, Target, Star } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import { CAMPAIGN_GOALS, CAMPAIGN_STATUS, STAGES, SOURCES, ago } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";

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
    audience: { stages: ["new"], inactive_days: 0, sources: ["import", "manual"], has_company: "yes", auto_enroll: false },
    steps: [
      { delay_days: 0, subject: "Predlog za vaše podjetje", body: "Spoštovani,\n\n[v dveh stavkih: kaj delate in kakšno korist ima podjetje od tega]\n\nAli bi bil primeren kratek 15-minutni klic ta ali naslednji teden?", ai_personalize: true },
      { delay_days: 4, subject: "Kratek opomnik", body: "Spoštovani,\n\nle preverjam, ali ste prejeli moje sporočilo. Z veseljem pošljem primer ali referenco.", ai_personalize: true },
      { delay_days: 10, subject: "Zadnje sporočilo", body: "Spoštovani,\n\nne bom več pisal na to temo. Če bo kdaj aktualno, mi preprosto odgovorite.", ai_personalize: true },
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
  if (!lead.email || lead.consent_email === false || lead.status === "unsubscribed") return false;
  if (a.stages?.length && !a.stages.includes(lead.status || "new")) return false;
  if (a.sources?.length && !a.sources.includes(lead.source)) return false;
  if (a.has_company === "yes" && !lead.company_id) return false;
  if (a.has_company === "no" && lead.company_id) return false;
  if (a.inactive_days > 0 && Date.now() - lastTouch(lead) < a.inactive_days * 86400000) return false;
  return true;
};

function Builder({ open, onOpenChange, campaign, leads, onLaunch }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [goal, setGoal] = useState("reactivation");
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (!open) return;
    if (campaign) { setGoal(campaign.goal); setC({ ...campaign, audience: { ...TEMPLATES[campaign.goal]?.audience, ...(campaign.audience || {}) }, steps: campaign.steps || [] }); }
    else { setGoal("reactivation"); setC({ ...structuredClone(TEMPLATES.reactivation), goal: "reactivation", auto_send: false }); }
  }, [open, campaign?.id]);
  if (!c) return null;

  const pickGoal = (g) => { setGoal(g); if (!campaign?.id) setC({ ...structuredClone(TEMPLATES[g]), goal: g, auto_send: c.auto_send }); };
  const setA = (patch) => setC({ ...c, audience: { ...c.audience, ...patch } });
  const toggleIn = (key, v) => { const arr = c.audience[key] || []; setA({ [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }); };
  const setStep = (i, patch) => setC({ ...c, steps: c.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const matched = leads.filter((l) => matchAudience(l, c.audience));
  const reviewLink = business?.google_review_link ? `: ${business.google_review_link}` : "";

  const save = async (launch) => {
    if (!c.name?.trim() || !c.steps.length || c.steps.some((s) => !s.subject.trim() || !s.body.trim())) { toast.error("Izpolnite ime ter zadevo in besedilo vsakega sporočila."); return; }
    setSaving(true);
    try {
      const data = {
        name: c.name.trim(), goal, description: CAMPAIGN_GOALS[goal].hint, audience: c.audience, auto_send: !!c.auto_send,
        steps: c.steps.map((s, i) => ({ order: i + 1, delay_days: Number(s.delay_days) || 0, subject: s.subject, body: s.body.replace("{povezava}", reviewLink), ai_personalize: !!s.ai_personalize })),
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
        <SheetHeader className="text-left"><SheetTitle className="font-display text-xl">{campaign?.id ? "Uredi kampanjo" : "Nova kampanja"}</SheetTitle><SheetDescription>Zaporedje sporočil, ki jih sistem pošlje izbranim strankam. Ko stranka odgovori, se zanjo kampanja sama ustavi.</SheetDescription></SheetHeader>
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
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">2. Komu?</Label><span className="text-sm font-semibold text-primary inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{matched.length} {matched.length === 1 ? "stranka" : "strank"}</span></div>
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
            <p className="text-[11px] text-muted-foreground">Vključene so samo stranke z e-naslovom, ki se strinjajo s prejemanjem e-pošte in se niso odjavile.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">3. Sporočila</Label>
            {c.steps.map((s, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2 relative">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{i === 0 ? "Pošlji" : "Po prejšnjem čez"}</span>
                  <Input type="number" min={0} value={s.delay_days} onChange={(e) => setStep(i, { delay_days: e.target.value })} className="h-7 w-16 text-xs" />
                  <span className="text-xs text-muted-foreground">{i === 0 ? "dni po vključitvi" : "dni"}</span>
                  {c.steps.length > 1 && <button onClick={() => setC({ ...c, steps: c.steps.filter((_, j) => j !== i) })} className="ml-auto text-muted-foreground hover:text-red-600"><X className="w-4 h-4" /></button>}
                </div>
                <Input value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Zadeva" />
                <Textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} className="h-28 text-sm" />
                <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={!!s.ai_personalize} onChange={(e) => setStep(i, { ai_personalize: e.target.checked })} /><Sparkles className="w-3.5 h-3.5 text-primary" />AI prilagodi besedilo vsaki stranki (nagovor, kaj je želela)</label>
              </div>
            ))}
            {c.steps.length < 6 && <Button variant="outline" size="sm" onClick={() => setC({ ...c, steps: [...c.steps, { delay_days: 7, subject: "", body: "", ai_personalize: true }] })}><Plus className="w-4 h-4 mr-1" />Dodaj sporočilo</Button>}
            <p className="text-[11px] text-muted-foreground">Podpis in povezavo za odjavo doda sistem samodejno.</p>
          </div>

          <div className="rounded-xl border p-4">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div><p className="text-sm font-medium">Pošlji brez moje odobritve</p><p className="text-xs text-muted-foreground mt-0.5">{c.auto_send ? "Sporočila se pošljejo sama (samo tista, ki jih AI oceni kot dobra)." : "Vsako sporočilo najprej počaka v Stranke → Čaka na vaš odgovor."}</p></div>
              <Switch checked={!!c.auto_send} onCheckedChange={(v) => setC({ ...c, auto_send: v })} />
            </label>
          </div>

          <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t">
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>Shrani kot osnutek</Button>
            <Button className="btn-brand flex-1" onClick={() => save(true)} disabled={saving || !matched.length}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}{campaign?.status === "active" ? "Shrani in dodaj nove" : `Zaženi za ${matched.length} ${matched.length === 1 ? "stranko" : "strank"}`}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Kampanje() {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const bid = business?.id;
  const [builder, setBuilder] = useState({ open: false, campaign: null });
  const [toDelete, setToDelete] = useState(null);
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ["campaigns", bid], queryFn: () => base44.entities.Campaign.filter({ business_id: bid }), enabled: !!bid });
  const { data: enrollments = [] } = useQuery({ queryKey: ["enrollments", bid], queryFn: () => base44.entities.CampaignEnrollment.filter({ business_id: bid }), enabled: !!bid });
  const { data: drafts = [] } = useQuery({ queryKey: ["drafts-all", bid], queryFn: () => base44.entities.DraftMessage.filter({ business_id: bid, pillar: "campaign" }), enabled: !!bid });
  const { data: leads = [] } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }), enabled: !!bid });

  const stats = useMemo(() => {
    const m = {};
    campaigns.forEach((c) => { m[c.id] = { enrolled: 0, active: 0, replied: 0, sent: 0, pending: 0 }; });
    enrollments.forEach((e) => { const s = m[e.campaign_id]; if (!s) return; s.enrolled++; if (e.status === "active") s.active++; if (e.status === "stopped_replied") s.replied++; });
    drafts.forEach((d) => { const s = m[d.campaign_id]; if (!s) return; if (d.status === "sent") s.sent++; if (["pending", "flagged_for_review"].includes(d.status)) s.pending++; });
    return m;
  }, [campaigns, enrollments, drafts]);

  const launch = async (c) => {
    const existing = new Set(enrollments.filter((e) => e.campaign_id === c.id).map((e) => e.lead_id));
    const toAdd = leads.filter((l) => matchAudience(l, c.audience) && !existing.has(l.id));
    const first = Number(c.steps?.[0]?.delay_days) || 0;
    for (const l of toAdd) {
      await base44.entities.CampaignEnrollment.create({ business_id: bid, owner_email: business.owner_email || business.created_by, campaign_id: c.id, lead_id: l.id, current_step: 0, status: "active", next_send_at: addDays(new Date(), first).toISOString() });
    }
    await base44.entities.Campaign.update(c.id, { status: "active" });
    invalidate();
    toast.success(toAdd.length ? `Kampanja teče: ${toAdd.length} ${toAdd.length === 1 ? "stranka dodana" : "strank dodanih"}. Prva sporočila pripravi v nekaj minutah.` : "Kampanja teče.");
  };
  const setStatus = async (c, status) => { await base44.entities.Campaign.update(c.id, { status }); invalidate(); toast.success(status === "paused" ? "Kampanja ustavljena." : "Kampanja spet teče."); };
  const remove = async () => {
    const c = toDelete; setToDelete(null);
    await Promise.all(enrollments.filter((e) => e.campaign_id === c.id && e.status === "active").map((e) => base44.entities.CampaignEnrollment.update(e.id, { status: "stopped_manual" })));
    await base44.entities.Campaign.delete(c.id); invalidate(); toast.success("Kampanja izbrisana.");
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1>Kampanje</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">Redna sporočila strankam: vrnite stare stranke, ogrejte povpraševanja, pošljite novico. Vse se beleži pri stranki, kampanja se ustavi, ko stranka odgovori.</p>
        </div>
        <Button className="btn-brand" onClick={() => setBuilder({ open: true, campaign: null })}><Plus className="w-4 h-4 mr-2" />Nova kampanja</Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card-elevated p-8">
          <div className="text-center"><Megaphone className="w-12 h-12 mx-auto text-primary/60" /><h2 className="text-xl mt-4">Začnite s pripravljeno kampanjo</h2><p className="text-muted-foreground mt-2">Izberite cilj — sporočila so že napisana, prilagodite jih po želji.</p></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
            {Object.entries(CAMPAIGN_GOALS).map(([k, g]) => { const I = GOAL_ICON[k]; const n = leads.filter((l) => matchAudience(l, TEMPLATES[k].audience)).length; return (
              <button key={k} onClick={() => setBuilder({ open: true, campaign: null, goal: k })} className="text-left rounded-xl border p-4 hover:border-primary/40 hover:shadow-sm">
                <p className="font-semibold flex items-center gap-2"><I className="w-4 h-4 text-primary" />{g.label}</p><p className="text-xs text-muted-foreground mt-1">{g.hint}</p><p className="text-xs text-primary mt-2">{n} {n === 1 ? "ustrezna stranka" : "ustreznih strank"}</p>
              </button>
            ); })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[...campaigns].sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1) || new Date(b.created_date) - new Date(a.created_date)).map((c) => {
            const s = stats[c.id] || {}; const St = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft; const I = GOAL_ICON[c.goal] || Megaphone;
            return (
              <div key={c.id} className="card-elevated p-4 flex items-center gap-4 flex-wrap">
                <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><I className="w-5 h-5" /></div>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold">{c.name}</p><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${St.cls}`}>{St.label}</span>{c.auto_send && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">pošilja samodejno</span>}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{CAMPAIGN_GOALS[c.goal]?.label} · {c.steps?.length || 0} {c.steps?.length === 1 ? "sporočilo" : "sporočil"}{c.last_run_at ? ` · zadnji zagon ${ago(c.last_run_at)}` : ""}</p>
                </div>
                <div className="flex gap-5 text-center">
                  {[[Users, s.enrolled, "vključenih"], [Send, s.sent, "poslanih"], [MessageCircleReply, s.replied, "odgovorov"]].map(([Ic, n, l]) => <div key={l}><p className="text-lg font-display font-bold">{n || 0}</p><p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Ic className="w-3 h-3" />{l}</p></div>)}
                  {s.pending > 0 && <div><p className="text-lg font-display font-bold text-primary">{s.pending}</p><p className="text-[11px] text-muted-foreground">čaka</p></div>}
                </div>
                <div className="flex gap-1.5">
                  {c.status === "active" ? <Button size="sm" variant="outline" onClick={() => setStatus(c, "paused")}><Pause className="w-4 h-4 mr-1" />Ustavi</Button>
                    : c.status === "paused" ? <Button size="sm" variant="outline" onClick={() => setStatus(c, "active")}><Play className="w-4 h-4 mr-1" />Nadaljuj</Button>
                    : <Button size="sm" className="btn-brand" onClick={() => launch(c)}><Play className="w-4 h-4 mr-1" />Zaženi</Button>}
                  <Button size="icon" variant="ghost" onClick={() => setBuilder({ open: true, campaign: c })} title="Uredi"><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(c)} title="Izbriši"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BuilderWithGoal state={builder} setState={setBuilder} leads={leads} onLaunch={launch} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Izbrišem kampanjo »{toDelete?.name}«?</AlertDialogTitle><AlertDialogDescription>Nadaljnja sporočila ne bodo poslana. Že poslana ostanejo v zgodovini strank.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Prekliči</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={remove}>Izbriši</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Odpre graditelja z vnaprej izbranim ciljem (s kartic predlog).
function BuilderWithGoal({ state, setState, leads, onLaunch }) {
  const preset = state.goal && !state.campaign ? { ...structuredClone(TEMPLATES[state.goal]), goal: state.goal, auto_send: false, __preset: true } : null;
  return <Builder open={state.open} onOpenChange={(o) => setState({ open: o, campaign: null })} campaign={state.campaign || preset} leads={leads} onLaunch={onLaunch} />;
}
