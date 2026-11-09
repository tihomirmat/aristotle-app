import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, Loader2, CheckCircle2, XCircle, Search, Globe, Pencil, UserRound, Users, Mail, FileText, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { checkChatInstall } from "@/functions/checkChatInstall";
import { fnError } from "@/lib/fn-error";
import { cnt, W } from "@/lib/crm";
import { Stepper, StepCard } from "@/components/pomocniki/HelperKit";
import ChatPreview from "@/components/klepet/ChatPreview";
import WebsiteLearnCard from "@/components/klepet/WebsiteLearnCard";
import KnowledgeBaseTab from "@/components/klepet/KnowledgeBaseTab";

const WIDGET_URL = "https://aristotle-smart-growth.base44.app/api/functions/chatbotWidget";
const COLORS = ["#f84214", "#091f93", "#340698", "#0f766e", "#b91c1c", "#111827"];
const QUESTIONS = ["Koliko stane?", "Kdaj ste odprti?", "Kako vas lahko pokličem?", "Kaj vse delate?"];
const PLATFORMS = [
  { key: "wp", label: "WordPress", steps: ["V WordPressu odprite Vtičniki → Dodaj nov in namestite »WPCode«.", "Odprite Code Snippets → Header & Footer.", "V polje »Footer« prilepite kodo in kliknite Save."] },
  { key: "wix", label: "Wix", steps: ["Odprite Nastavitve → Custom Code → Add Custom Code.", "Prilepite kodo, izberite »All pages« in »Body - end«.", "Kliknite Publish."] },
  { key: "shopify", label: "Shopify", steps: ["Odprite Online Store → Themes → … → Edit code.", "Odprite theme.liquid in kodo prilepite tik pred </body>.", "Kliknite Save."] },
  { key: "other", label: "Drugo", steps: ["Kodo prilepite na vse strani tik pred zaključno oznako </body>.", "Shranite in objavite stran."] },
];

// Nastavitev klepeta v 4 korakih. Levo en korak, desno ves čas pravi klepet (kot bo na spletni strani).
export default function ChatSetup({ business, docs = [], installed, initialStep, onFinish }) {
  const queryClient = useQueryClient();
  const learned = docs.length > 0;
  const [step, setStep] = useState(initialStep || (!learned ? "learn" : "test"));
  const [tested, setTested] = useState(false);
  const [ask, setAsk] = useState({ text: "", n: 0 });
  const [kbOpen, setKbOpen] = useState(false);
  const [form, setForm] = useState({ widget_primary_color: "#f84214", widget_welcome_message: "Pozdravljeni! Kako vam lahko pomagam?", widget_position: "bottom-right", widget_title: "" });
  const [saving, setSaving] = useState(false);
  const [who, setWho] = useState("me");
  const [platform, setPlatform] = useState("wp");
  const [copied, setCopied] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [checkUrl, setCheckUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null);

  useEffect(() => {
    if (!business) return;
    setForm({ widget_primary_color: business.widget_primary_color || "#f84214", widget_welcome_message: business.widget_welcome_message || "Pozdravljeni! Kako vam lahko pomagam?", widget_position: business.widget_position || "bottom-right", widget_title: business.widget_title || business.name || "" });
    setCheckUrl((u) => u || business.chat_installed_url || business.website || "");
  }, [business?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = form.widget_primary_color;
  const title = form.widget_title || business?.name || "Pomočnik";
  const dirty = business && ["widget_primary_color", "widget_welcome_message", "widget_position", "widget_title"].some((k) => (form[k] || "") !== (business[k] || (k === "widget_title" ? business.name || "" : k === "widget_primary_color" ? "#f84214" : k === "widget_position" ? "bottom-right" : k === "widget_welcome_message" ? "Pozdravljeni! Kako vam lahko pomagam?" : "")));

  const embedCode = `<!-- Spletni klepet -->
<script>
  window.ARISTOTLE_CONFIG = {
    businessId: ${JSON.stringify(business?.id || "")},
    primaryColor: ${JSON.stringify(color)},
    welcomeMessage: ${JSON.stringify(form.widget_welcome_message || "")},
    position: ${JSON.stringify(form.widget_position)},
    title: ${JSON.stringify(title)}
  };
</script>
<script src="${WIDGET_URL}" defer></script>`;
  const letter = `Pozdravljeni,\n\nprosim, da na vse strani naše spletne strani tik pred zaključno oznako </body> dodate spodnjo kodo za spletni klepet.\n\n${embedCode}\n\nHvala in lep pozdrav`;

  const copy = (what, text) => { navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2500); toast.success(what === "code" ? "Koda je kopirana. Zdaj jo prilepite na svojo stran." : "Sporočilo je kopirano."); };
  const saveLook = async () => {
    if (!dirty) return true;
    setSaving(true);
    try { await base44.entities.Business.update(business.id, form); queryClient.invalidateQueries({ queryKey: ["business"] }); toast.success("Videz je shranjen."); return true; }
    catch (e) { toast.error(fnError(e)); return false; } finally { setSaving(false); }
  };
  const runCheck = async () => {
    setChecking(true); setCheck(null);
    try {
      const res = await checkChatInstall({ business_id: business.id, url: checkUrl });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      setCheck(d);
      if (!!d.installed !== !!business.chat_installed_url || (d.installed && d.url !== business.chat_installed_url)) {
        await base44.entities.Business.update(business.id, d.installed ? { chat_installed_url: d.url, chat_installed_at: new Date().toISOString() } : { chat_installed_url: "" });
        queryClient.invalidateQueries({ queryKey: ["business"] });
      }
    } catch (e) { toast.error(fnError(e)); } finally { setChecking(false); }
  };

  const steps = [
    { key: "learn", title: "Naučite ga", done: learned },
    { key: "test", title: "Preizkusite ga", done: learned && (tested || installed) },
    { key: "look", title: "Izberite videz", done: installed || !!business?.widget_title },
    { key: "install", title: "Dajte ga na stran", done: installed },
  ];
  const P = PLATFORMS.find((p) => p.key === platform);

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-1"><Stepper steps={steps} current={step} onStep={setStep} /></div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
        <div className="min-w-0">
          {step === "learn" && (
            <StepCard n={1} total={4} title="Naj klepet prebere vašo spletno stran" text="Vpišite naslov svoje strani. Klepet si zapomni storitve, cene in kontakt ter odgovarja samo iz tega — ničesar si ne izmišlja." onNext={() => setStep("test")} nextDisabled={!learned} nextHint={!learned ? "Najprej preberite stran" : ""}>
              <WebsiteLearnCard docs={docs} />
              {learned && (
                <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                  <p className="font-semibold text-emerald-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />Klepet zdaj ve: {cnt(docs.length, W.zapis)}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">{docs.slice(0, 8).map((d) => <span key={d.id} className="text-xs bg-white border border-emerald-200 rounded-full px-2.5 py-1 inline-flex items-center gap-1.5"><FileText className="w-3 h-3 text-emerald-700" />{d.title}</span>)}{docs.length > 8 && <span className="text-xs text-emerald-800 px-1 py-1">+ {docs.length - 8}</span>}</div>
                  <button onClick={() => setKbOpen(true)} className="text-sm font-medium text-emerald-900 underline underline-offset-4 mt-3 inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" />Poglej, popravi ali dodaj znanje</button>
                </div>
              )}
              {!learned && <button onClick={() => setKbOpen(true)} className="text-sm text-muted-foreground underline underline-offset-4 mt-4">Nimam spletne strani — znanje bom vpisal sam</button>}
            </StepCard>
          )}

          {step === "test" && (
            <StepCard n={2} total={4} title="Vprašajte ga, kar bi vprašala stranka" text="Kliknite vprašanje ali napišite svoje v okence na desni. Odgovarja točno tako, kot bo na vaši strani." onBack={() => setStep("learn")} onNext={() => setStep("look")} nextLabel="Odgovarja dobro">
              <div className="flex flex-wrap gap-2">
                {QUESTIONS.map((t) => <button key={t} onClick={() => { setAsk((a) => ({ text: t, n: a.n + 1 })); setTested(true); }} disabled={!learned} className="rounded-full border-2 px-4 py-2.5 text-sm font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-50">{t}</button>)}
              </div>
              <div className="mt-6 rounded-2xl bg-muted/60 p-4 flex items-start gap-3">
                <Pencil className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1"><p className="font-medium">Odgovor ni pravi ali česa ne ve?</p><p className="text-sm text-muted-foreground">Dopišite mu, kar manjka (npr. cenik ali delovni čas), in vprašajte znova.</p></div>
                <Button variant="outline" className="bg-card shrink-0" onClick={() => setKbOpen(true)}>Dopolni znanje</Button>
              </div>
            </StepCard>
          )}

          {step === "look" && (
            <StepCard n={3} total={4} title="Izberite barvo in pozdrav" text="Spremembe takoj vidite na desni. To lahko kadar koli spremenite." onBack={() => setStep("test")} onNext={async () => { if (await saveLook()) setStep("install"); }} nextLabel={saving ? "Shranjujem …" : dirty ? "Shrani in naprej" : "Naprej"} nextDisabled={saving}>
              <div className="space-y-6 max-w-xl">
                <div>
                  <Label className="text-sm font-semibold">Barva</Label>
                  <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                    {COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, widget_primary_color: c })} className={`w-11 h-11 rounded-full border-4 transition-transform hover:scale-105 ${color.toLowerCase() === c ? "border-foreground/80 scale-105" : "border-white shadow"}`} style={{ backgroundColor: c }} title={c} />)}
                    <label className="h-11 px-3 rounded-full border bg-card flex items-center gap-2 text-sm cursor-pointer hover:bg-muted"><input type="color" value={color} onChange={(e) => setForm({ ...form, widget_primary_color: e.target.value })} className="w-6 h-6 rounded border-0 p-0 bg-transparent cursor-pointer" />Druga barva</label>
                  </div>
                </div>
                <div><Label className="text-sm font-semibold">Ime v glavi okenca</Label><Input className="mt-2 h-11" value={form.widget_title} onChange={(e) => setForm({ ...form, widget_title: e.target.value })} placeholder={business?.name || "Pomočnik"} /></div>
                <div><div className="flex justify-between"><Label className="text-sm font-semibold">Prvi pozdrav</Label><span className="text-xs text-muted-foreground">{form.widget_welcome_message.length}/200</span></div><Textarea className="mt-2 h-20 resize-none" value={form.widget_welcome_message} onChange={(e) => setForm({ ...form, widget_welcome_message: e.target.value.slice(0, 200) })} /></div>
                <div>
                  <Label className="text-sm font-semibold">Kje na strani naj bo gumb</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm">{[["bottom-left", "Spodaj levo"], ["bottom-right", "Spodaj desno"]].map(([k, l]) => <button key={k} onClick={() => setForm({ ...form, widget_position: k })} className={`rounded-xl border-2 py-3 text-sm font-medium ${form.widget_position === k ? "border-primary bg-accent/50 text-primary" : "hover:border-primary/40"}`}>{l}</button>)}</div>
                </div>
              </div>
            </StepCard>
          )}

          {step === "install" && (
            <StepCard n={4} total={4} title="Dajte klepet na svojo spletno stran" text="Na stran je treba enkrat prilepiti kratko kodo. Kdo ureja vašo spletno stran?" onBack={() => setStep("look")} footer={dirty ? <Button variant="outline" onClick={saveLook} disabled={saving}>Shrani videz</Button> : null}>
              <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
                {[["me", UserRound, "Urejam jo sam", "Pokažemo vam, kam kliknite."], ["other", Users, "Ureja jo nekdo drug", "Pošljite mu pripravljeno sporočilo."]].map(([k, I, l, d]) => (
                  <button key={k} onClick={() => setWho(k)} className={`text-left rounded-2xl border-2 p-4 flex items-start gap-3 transition-colors ${who === k ? "border-primary bg-accent/40" : "hover:border-primary/40"}`}><span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${who === k ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}><I className="w-5 h-5" /></span><span><span className="font-semibold block">{l}</span><span className="text-sm text-muted-foreground">{d}</span></span></button>
                ))}
              </div>

              {who === "other" ? (
                <div className="mt-6 rounded-2xl border p-5 max-w-2xl">
                  <p className="font-semibold">Pošljite to sporočilo osebi, ki ureja vašo stran</p>
                  <p className="text-sm text-muted-foreground mt-1">V sporočilu so koda in navodila. Delo traja pet minut.</p>
                  <div className="flex gap-2 flex-wrap mt-4">
                    <Button size="lg" className="btn-brand gap-2" onClick={() => copy("letter", letter)}>{copied === "letter" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied === "letter" ? "Kopirano" : "Kopiraj sporočilo"}</Button>
                    <a href={`mailto:?subject=${encodeURIComponent("Prosim, dodajte spletni klepet na našo stran")}&body=${encodeURIComponent(letter)}`}><Button size="lg" variant="outline" className="gap-2"><Mail className="w-4 h-4" />Odpri v e-pošti</Button></a>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-5 max-w-2xl">
                  <div className="flex gap-4"><span className="w-8 h-8 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center shrink-0">1</span>
                    <div className="flex-1"><p className="font-semibold">Kopirajte kodo</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap"><Button size="lg" className="btn-brand gap-2" onClick={() => copy("code", embedCode)}>{copied === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied === "code" ? "Kopirano" : "Kopiraj kodo"}</Button><button className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => setShowCode((v) => !v)}>{showCode ? "Skrij kodo" : "Pokaži kodo"}</button></div>
                      {showCode && <pre className="bg-muted/60 rounded-xl p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all mt-3 max-h-48">{embedCode}</pre>}
                    </div></div>
                  <div className="flex gap-4"><span className="w-8 h-8 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center shrink-0">2</span>
                    <div className="flex-1"><p className="font-semibold">Prilepite jo na stran</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">{PLATFORMS.map((p) => <button key={p.key} onClick={() => setPlatform(p.key)} className={`text-sm px-4 py-1.5 rounded-full border-2 font-medium ${platform === p.key ? "border-foreground bg-foreground text-background" : "hover:border-foreground/40"}`}>{p.label}</button>)}</div>
                      <ol className="mt-3 space-y-1.5">{P.steps.map((s, i) => <li key={i} className="text-sm flex gap-2"><span className="text-muted-foreground w-4 shrink-0">{String.fromCharCode(97 + i)})</span>{s}</li>)}</ol>
                    </div></div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t max-w-2xl">
                <p className="font-semibold">{who === "other" ? "Ko vam sporočijo, da je narejeno, preverite" : "Preverite, ali klepet deluje"}</p>
                <div className="flex gap-2 mt-2 flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 min-w-[200px]"><Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={checkUrl} onChange={(e) => setCheckUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkUrl.trim() && runCheck()} placeholder="www.vasa-stran.si" className="pl-10 h-11" /></div>
                  <Button size="lg" variant="outline" className="h-11 gap-2" onClick={runCheck} disabled={checking || !checkUrl.trim()}>{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Preveri mojo stran</Button>
                </div>
                {check && !check.installed && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-3 text-sm flex gap-2 mt-3"><XCircle className="w-5 h-5 shrink-0" /><div><p className="font-medium">Klepeta na strani {check.url} še ni.</p><p className="mt-0.5">{check.message}</p></div></div>}
                {(check?.installed || (installed && !check)) && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mt-3 flex items-center gap-3 flex-wrap">
                    <PartyPopper className="w-7 h-7 text-emerald-700 shrink-0" />
                    <div className="flex-1 min-w-[200px]"><p className="font-semibold text-emerald-900">Klepet deluje na vaši strani.</p><p className="text-sm text-emerald-800">Ko vam kdo piše, pogovor vidite tukaj, kontakt pa med strankami.</p></div>
                    {onFinish && <Button className="btn-brand" onClick={onFinish}>Poglej pogovore</Button>}
                  </div>
                )}
              </div>
            </StepCard>
          )}
        </div>

        <div className="xl:sticky xl:top-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">Tako bo videti na vaši strani</p>
          {business && <ChatPreview business={business} color={color} title={title} welcome={form.widget_welcome_message} ask={ask} locked={!learned} />}
        </div>
      </div>

      <Dialog open={kbOpen} onOpenChange={setKbOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kaj klepet ve</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Iz teh zapisov odgovarja. Vsakega lahko popravite, izklopite ali dodate novega.</p>
          <KnowledgeBaseTab businessId={business?.id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
