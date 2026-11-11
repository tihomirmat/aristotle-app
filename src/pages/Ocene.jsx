import React, { useState, useEffect, useRef } from "react";
import { useBusiness } from "@/lib/business-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Star, ExternalLink, Loader2, Send, ArrowRight, Settings2, Link2, UserRound } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateDraft } from "@/functions/generateDraft";
import { fnError } from "@/lib/fn-error";
import { HelperHeader, PillTabs, Stepper, StepCard, Stat, Empty } from "@/components/pomocniki/HelperKit";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ReplyReview from "@/components/crm/ReplyReview";
import { DraftIcon } from "@/components/crm/DraftMark";
import { X } from "lucide-react";

const DELAYS = [[2, "Še isti dan", "Čez 2 uri"], [24, "Naslednji dan", "Priporočamo"], [72, "Čez 3 dni", "Ko se vtisi poležejo"]];
const STATUS = {
  pending: ["Čaka na vašo potrditev", "bg-amber-100 text-amber-800"], flagged_for_review: ["Čaka na vašo potrditev", "bg-amber-100 text-amber-800"],
  approved: ["Potrjena, kmalu poslana", "bg-blue-100 text-blue-700"], sent: ["Poslana", "bg-emerald-100 text-emerald-700"],
  failed: ["Pošiljanje ni uspelo", "bg-red-100 text-red-700"], skipped: ["Niste je poslali", "bg-slate-100 text-slate-600"],
};

// Primer prošnje, kot jo vidi stranka (ilustracija, pravo besedilo napiše AI v vašem slogu).
function RequestPreview({ business }) {
  return (
    <div className="rounded-3xl border shadow-xl bg-white overflow-hidden">
      <div className="px-5 py-3 border-b bg-slate-50 text-xs text-slate-500"><p><span className="font-medium text-slate-700">Od:</span> {business?.name || "Vaše podjetje"}</p><p><span className="font-medium text-slate-700">Zadeva:</span> Kako ste zadovoljni?</p></div>
      <div className="p-5 text-sm text-slate-800 space-y-3 leading-relaxed">
        <p>Pozdravljeni,</p>
        <p>hvala, da ste nam zaupali. Upamo, da ste z opravljenim delom zadovoljni.</p>
        <p>Če imate minuto časa, nam bo vaša ocena na Googlu zelo pomagala.</p>
        <div className="rounded-2xl bg-[#fff6dd] p-4 text-center">
          <div className="flex justify-center gap-1">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-6 h-6 fill-[#ffb50e] text-[#ffb50e]" />)}</div>
          <span className="inline-block mt-3 rounded-full bg-[#f84214] text-white text-sm font-semibold px-5 py-2">Napišite oceno</span>
        </div>
        <p>Lep pozdrav,<br />{business?.name || "Vaše podjetje"}</p>
      </div>
    </div>
  );
}

export default function Ocene() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const bid = business?.id;
  const [tab, setTab] = useState("work");
  const [step, setStep] = useState("link");
  const [linkInput, setLinkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyFor, setBusyFor] = useState(null);
  const [reviewId, setReviewId] = useState(null); // prošnja, odprta v oknu za pregled in pošiljanje
  const [toCancel, setToCancel] = useState(null);
  const abortAsk = useRef(null); // »Prekliči« med pripravo: pripravljena prošnja se takoj zavrže

  const { data: drafts = [] } = useQuery({ queryKey: ["ocene-drafts", bid], queryFn: () => base44.entities.DraftMessage.filter({ business_id: bid }), enabled: !!bid });
  const { data: customers = [] } = useQuery({ queryKey: ["converted-leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid, status: "converted" }), enabled: !!bid });
  const { data: allLeads = [] } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }, "-created_date", 5000), enabled: !!bid });

  useEffect(() => { setLinkInput(business?.google_review_link || ""); }, [business?.google_review_link]);

  const hasLink = !!business?.google_review_link;
  const auto = !!business?.review_requests_enabled;
  const delay = business?.review_request_delay_hours || 24;
  const reqs = drafts.filter((d) => d.pillar === "review_request").sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  const sent = reqs.filter((d) => d.status === "sent").length;
  const pending = reqs.filter((d) => d.status === "pending" || d.status === "flagged_for_review").length;
  const asked = new Set(reqs.map((d) => d.lead_id));
  const toAsk = customers.filter((l) => !asked.has(l.id));
  const leadOf = (id) => allLeads.find((l) => l.id === id) || customers.find((l) => l.id === id);
  const nameOf = (id) => leadOf(id)?.name;
  const isPending = (d) => d.status === "pending" || d.status === "flagged_for_review";
  const reviewDraft = reqs.find((d) => d.id === reviewId);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ocene-drafts", bid] }); qc.invalidateQueries({ queryKey: ["drafts-all", bid] }); };
  // Prekliči prošnjo: osnutek se izbriše, stranka se vrne med »Koga lahko prosite«.
  const cancelRequest = async (d) => {
    try { await base44.entities.DraftMessage.delete(d.id); refresh(); if (reviewId === d.id) setReviewId(null); toast.success("Prošnja je preklicana. Nič ni bilo poslano."); }
    catch (e) { toast.error(fnError(e)); }
  };

  const save = async (data, msg = "Shranjeno.") => {
    setSaving(true);
    try { await base44.entities.Business.update(bid, data); qc.invalidateQueries({ queryKey: ["business"] }); if (msg) toast.success(msg); return true; }
    catch (e) { toast.error(fnError(e)); return false; } finally { setSaving(false); }
  };
  const saveLink = async () => {
    const url = linkInput.trim();
    if (!/^https:\/\/.+\..+/.test(url)) { toast.error("Povezava se mora začeti s https://"); return false; }
    return save({ google_review_link: url }, "Povezava je shranjena.");
  };
  const askFor = async (lead) => {
    if (!lead.email) { toast.error("Ta stranka nima e-naslova."); return; }
    if (!lead.consent_email) { toast.error("Ta stranka ni dala soglasja za e-pošto."); return; }
    const token = {}; abortAsk.current = token;
    setBusyFor(lead.id);
    try {
      const res = await generateDraft({ business_id: bid, lead_id: lead.id, pillar: "review_request", sequence_step: 1 });
      const d = res?.data ?? res; if (d?.error) throw new Error(d.error);
      if (abortAsk.current !== token) { if (d?.draft?.id && !d.duplicate) await base44.entities.DraftMessage.delete(d.draft.id).catch(() => {}); refresh(); toast.info("Prošnja je preklicana."); return; }
      await qc.refetchQueries({ queryKey: ["ocene-drafts", bid] }); qc.invalidateQueries({ queryKey: ["drafts-all", bid] });
      // Takoj odpri pripravljeno prošnjo: preberete, pošljete ali prekličete.
      if (d?.draft?.id) setReviewId(d.draft.id);
    } catch (e) { if (abortAsk.current === token) toast.error(fnError(e)); } finally { if (abortAsk.current === token) setBusyFor(null); }
  };

  const LinkField = (
    <div className="flex gap-2 flex-wrap sm:flex-nowrap max-w-2xl">
      <div className="relative flex-1 min-w-[220px]"><Link2 className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="https://g.page/r/…/review" className="h-12 pl-12 text-base rounded-xl" /></div>
    </div>
  );
  const DelayPicker = (
    <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
      {DELAYS.map(([h, l, d]) => <button key={h} onClick={() => save({ review_request_delay_hours: h }, "")} className={`rounded-2xl border-2 p-4 text-left transition-colors ${delay === h ? "border-primary bg-accent/40" : "hover:border-primary/40"}`}><span className="font-semibold block">{l}</span><span className="text-sm text-muted-foreground">{d}</span></button>)}
    </div>
  );
  const AutoSwitch = (
    <label className="flex items-start gap-3 rounded-2xl border p-4 max-w-2xl cursor-pointer">
      <Switch checked={auto} onCheckedChange={(v) => save({ review_requests_enabled: v }, v ? "Prošnje se bodo pripravljale same." : "Prošnje pripravite sami, ko želite.")} className="mt-0.5" />
      <span><span className="font-semibold block">Prošnjo pripravi samodejno</span><span className="text-sm text-muted-foreground">Ko stranko v Strankah premaknete v »Stranka«, se prošnja pripravi sama. Pred pošiljanjem jo vedno potrdite vi.</span></span>
    </label>
  );

  const steps = [{ key: "link", title: "Povezava do ocen", done: hasLink }, { key: "when", title: "Kdaj prosimo", done: hasLink && auto }, { key: "done", title: "Preglejte", done: false }];

  return (
    <div className="space-y-6">
      <HelperHeader icon={Star} tone="amber" title="Google ocene" subtitle="Po opravljenem delu stranko vljudno prosi za oceno na Googlu. Več ocen pomeni več novih strank."
        ok={hasLink} statusLabel={!hasLink ? "Še ni nastavljeno" : auto ? "Deluje samodejno" : "Pripravljeno — prosite sami"}>
        {hasLink && <PillTabs value={tab} onChange={setTab} tabs={[{ key: "work", label: "Prošnje", icon: Star, badge: pending }, { key: "settings", label: "Nastavitve", icon: Settings2 }]} />}
      </HelperHeader>

      {/* Čarovnik, dokler ni povezave */}
      {!hasLink && (
        <div className="space-y-5">
          <div className="overflow-x-auto pb-1"><Stepper steps={steps} current={step} onStep={setStep} /></div>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
            <div className="min-w-0">
              {step === "link" && (
                <StepCard n={1} total={3} title="Prilepite povezavo do svojih Google ocen" text="To je povezava, ki stranko pripelje naravnost do okenca za oceno vašega podjetja." onNext={async () => { if (await saveLink()) setStep("when"); }} nextLabel={saving ? "Shranjujem …" : "Shrani in naprej"} nextDisabled={saving || !linkInput.trim()}>
                  <ol className="space-y-3 max-w-2xl mb-6">
                    {["Na Googlu poiščite svoje podjetje (prijavljeni kot lastnik).", "Kliknite gumb za mnenja (»Ask for reviews«).", "Kopirajte povezavo in jo prilepite spodaj."].map((t, i) => <li key={i} className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-muted text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span><span className="pt-0.5">{t}</span></li>)}
                  </ol>
                  {LinkField}
                  <a href="https://business.google.com/" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground underline underline-offset-4 inline-flex items-center gap-1.5 mt-4"><ExternalLink className="w-3.5 h-3.5" />Odpri Google profil podjetja</a>
                </StepCard>
              )}
              {step === "when" && (
                <StepCard n={2} total={3} title="Kdaj naj stranko prosimo za oceno?" text="Štejemo od trenutka, ko stranko označite kot »Stranka« (delo je opravljeno)." onBack={() => setStep("link")} onNext={() => setStep("done")}>
                  <div className="space-y-4">{DelayPicker}{AutoSwitch}</div>
                </StepCard>
              )}
              {step === "done" && (
                <StepCard n={3} total={3} title="Tako deluje" text="Nič se ne pošlje brez vas." onBack={() => setStep("when")}>
                  <ol className="space-y-3 max-w-2xl">
                    {["Delo je opravljeno — stranko v Strankah premaknete v »Stranka«.", "Pripravi se prošnja za oceno v vašem slogu (primer je na desni).", "Prošnjo preberete in kliknete »Pošlji«. Stranka dobi e-pošto s povezavo do ocene."].map((t, i) => <li key={i} className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span><span className="pt-0.5">{t}</span></li>)}
                  </ol>
                  {!linkInput.trim() && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-5 max-w-2xl">Manjka še povezava do ocen (korak 1).</p>}
                </StepCard>
              )}
            </div>
            <div className="xl:sticky xl:top-20"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">Primer prošnje, ki jo dobi stranka</p><RequestPreview business={business} /></div>
          </div>
        </div>
      )}

      {/* Delo */}
      {hasLink && tab === "work" && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat value={toAsk.length} label="Stranke, ki jih še niste prosili" tone={toAsk.length ? "text-primary" : ""} />
            <Stat value={pending} label="Prošnje, ki čakajo na vašo potrditev" tone={pending ? "text-amber-600" : ""} />
            <Stat value={sent} label="Poslane prošnje doslej" />
          </div>
          {pending > 0 && (
            <button onClick={() => setReviewId(reqs.find(isPending)?.id)} className="w-full text-left flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-accent/50 px-5 py-4 hover:bg-accent">
              <Send className="w-5 h-5 text-primary" /><span className="font-semibold flex-1">Pripravljene prošnje čakajo, da jih preberete in pošljete.</span><span className="text-primary font-semibold inline-flex items-center gap-1">Odpri<ArrowRight className="w-4 h-4" /></span>
            </button>
          )}
          <div className="grid xl:grid-cols-2 gap-6 items-start">
            <div className="card-elevated p-6">
              <h2 className="!text-lg">Koga lahko prosite za oceno</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Stranke, za katere ste delo že opravili in jih še niste prosili.</p>
              {toAsk.length === 0 ? <Empty icon={UserRound} title="Trenutno nikogar" text="Ko stranko v Strankah premaknete v »Stranka«, se pojavi tukaj." /> : (
                <div className="divide-y">
                  {toAsk.slice(0, 12).map((l) => (
                    <div key={l.id} className="py-3 flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm text-muted-foreground shrink-0">{(l.name || "?")[0].toUpperCase()}</span>
                      <div className="flex-1 min-w-0"><p className="font-medium truncate">{l.name}</p><p className="text-xs text-muted-foreground truncate">{l.email || "brez e-naslova"}</p></div>
                      {busyFor === l.id ? (
                        <span className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Pripravljam …
                          <Button size="sm" variant="outline" onClick={() => { abortAsk.current = null; setBusyFor(null); }}><X className="w-3.5 h-3.5 mr-1" />Prekliči</Button></span>
                      ) : <Button className="btn-brand gap-2 shrink-0" disabled={!!busyFor || !l.email} onClick={() => askFor(l)}><Star className="w-4 h-4" />Prosi za oceno</Button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card-elevated p-6">
              <h2 className="!text-lg">Zadnje prošnje</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Kaj se je zgodilo z vsako prošnjo.</p>
              {reqs.length === 0 ? <Empty icon={Star} title="Prošenj še ni" text="Prva se pojavi, ko nekoga prosite za oceno." /> : (
                <div className="divide-y">
                  {reqs.slice(0, 12).map((d) => { const [label, cls] = STATUS[d.status] || [d.status, "bg-slate-100 text-slate-600"]; const p = isPending(d); return (
                    <div key={d.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0"><p className="font-medium truncate">{nameOf(d.lead_id) || d.subject || "Prošnja za oceno"}</p><p className="text-xs text-muted-foreground">{d.created_date ? format(new Date(d.created_date), "d. M. yyyy") : ""}</p></div>
                      {p ? (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <DraftIcon hint="Prošnja je pripravljena — še ni poslana" />
                          <Button size="sm" variant="outline" className="border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100" onClick={() => setReviewId(d.id)} title="Preberite prošnjo in jo pošljite">Preglej in pošlji<ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600 px-2" onClick={() => setToCancel(d)} aria-label="Prekliči prošnjo" title="Prekliči prošnjo"><X className="w-4 h-4" /></Button>
                        </span>
                      ) : <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{label}</span>}
                    </div>
                  ); })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pregled prošnje: preberete, uredite, pošljete ali prekličete */}
      <Sheet open={!!reviewDraft} onOpenChange={(o) => { if (!o) { setReviewId(null); refresh(); } }}>
        <SheetContent className="w-full sm:max-w-5xl overflow-y-auto">
          <SheetHeader className="text-left"><SheetTitle className="font-display text-xl">Prošnja za oceno{reviewDraft ? ` — ${nameOf(reviewDraft.lead_id) || ""}` : ""}</SheetTitle><SheetDescription>Preberite in pošljite. Če si premislite, prošnjo prekličite — nič ne bo poslano.</SheetDescription></SheetHeader>
          {reviewDraft && (
            <div className="mt-4 space-y-4">
              <ReplyReview draft={reviewDraft} lead={leadOf(reviewDraft.lead_id)} showCustomerLink onDone={() => { setReviewId(null); refresh(); }} />
              <div className="flex justify-end"><Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => cancelRequest(reviewDraft)}><X className="w-4 h-4 mr-1.5" />Prekliči prošnjo</Button></div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Prekličem prošnjo za {toCancel ? nameOf(toCancel.lead_id) || "to stranko" : ""}?</AlertDialogTitle><AlertDialogDescription>Prošnja ni bila poslana in ne bo. Stranka se vrne na seznam »Koga lahko prosite za oceno«.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Ne, obdrži</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { const d = toCancel; setToCancel(null); cancelRequest(d); }}>Prekliči prošnjo</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nastavitve */}
      {hasLink && tab === "settings" && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          <div className="card-elevated p-6 sm:p-8 space-y-8">
            <div><h2 className="!text-lg mb-1">Kdaj prosimo za oceno</h2><p className="text-sm text-muted-foreground mb-4">Štejemo od trenutka, ko stranko označite kot »Stranka«.</p>{DelayPicker}</div>
            {AutoSwitch}
            <div><h2 className="!text-lg mb-1">Povezava do vaših Google ocen</h2><p className="text-sm text-muted-foreground mb-4">Na to povezavo pride stranka, ko klikne »Napišite oceno«.</p>
              <div className="flex gap-2 flex-wrap items-center">{LinkField}<Button variant="outline" className="h-12" onClick={saveLink} disabled={saving || linkInput.trim() === (business?.google_review_link || "")}>Shrani</Button><a href={business.google_review_link} target="_blank" rel="noreferrer"><Button variant="ghost" className="h-12 gap-2"><ExternalLink className="w-4 h-4" />Preizkusi</Button></a></div>
            </div>
          </div>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">Primer prošnje, ki jo dobi stranka</p><RequestPreview business={business} /></div>
        </div>
      )}
    </div>
  );
}
