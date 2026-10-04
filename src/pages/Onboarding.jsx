import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Rocket, ChevronRight, ChevronLeft, Loader2, Globe, Sparkles, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/functions/completeOnboarding";
import { scanWebsite } from "@/functions/scanWebsite";
import { fnError } from "@/lib/fn-error";

const INDUSTRY_OPTIONS = [
  { value: "gym", label: "Fitnes / wellness" },
  { value: "dental_medspa", label: "Zobozdravstvo / lepota" },
  { value: "home_services", label: "Dom in popravila" },
  { value: "restaurant", label: "Gostinstvo" },
  { value: "salon_barber", label: "Frizerski / lepotni salon" },
  { value: "auto", label: "Avtoservis" },
  { value: "other", label: "Storitve / drugo" },
];

const STEPS = ["Spletna stran", "Preverite podatke", "Zaključek"];

export default function Onboarding() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState(null); // { pages_read, knowledgeCount }
  const [url, setUrl] = useState("");

  const [form, setForm] = useState({
    name: "", industry_template: "other", phone: "", address: "", website: "", hours: "",
    services: "", current_offer: "", google_review_link: "", brand_voice: "", knowledge: [], gdpr_confirmed: false,
  });
  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleScan = async () => {
    if (!url.trim()) return;
    setScanning(true);
    try {
      const res = await scanWebsite({ url: url.trim() });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      const d = data.data || {};
      setForm((f) => ({
        ...f,
        name: d.name || f.name,
        industry_template: d.industry_template || f.industry_template,
        phone: d.phone || f.phone,
        address: d.address || f.address,
        website: d.website || url.trim(),
        hours: d.hours || f.hours,
        services: d.services || f.services,
        current_offer: d.current_offer || f.current_offer,
        brand_voice: d.brand_voice || f.brand_voice,
        knowledge: d.knowledge || [],
      }));
      setScanInfo({ pages_read: d.pages_read || 1, knowledgeCount: (d.knowledge || []).length, description: d.short_description || "" });
      setStep(2);
    } catch (err) {
      toast.error(fnError(err) || "Strani ni bilo mogoče prebrati.");
    } finally {
      setScanning(false);
    }
  };

  const handleFinish = async () => {
    if (!form.gdpr_confirmed || !form.name.trim()) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const res = await completeOnboarding({ form });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      await queryClient.invalidateQueries({ queryKey: ["business", user.email] });
      window.location.href = "/";
    } catch (err) {
      toast.error("Napaka pri zaključku: " + (fnError(err) || "Poskusite znova."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[440px_1fr]">
      {/* Levi panel — znamka */}
      <aside className="hidden lg:flex flex-col justify-between bg-space bg-space-stars text-white p-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(13,94%,55%)] to-[hsl(41,100%,53%)] flex items-center justify-center shadow-lg">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-lg">AI Aristotle</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">by Spletnost</p>
          </div>
        </div>
        <div>
          <h1 className="text-white text-3xl leading-tight">Vaš marketing <span className="text-gradient-brand">dela sam</span>, vi samo odobrite.</h1>
          <ul className="mt-6 space-y-3 text-white/80 text-sm">
            {["Odgovori novim strankam v nekaj minutah", "Vrne stranke, ki jih dolgo ni bilo", "Prosi za Google ocene po vsaki storitvi", "Spletni klepet, ki odgovarja 24/7", "Ponudba v PDF v nekaj minutah"].map((t) => (
              <li key={t} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-[hsl(41,100%,53%)] shrink-0" /> {t}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Nastavitev traja 2 minuti. Večino podatkov preberemo z vaše spletne strani.</p>
      </aside>

      {/* Desni panel — koraki */}
      <main className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-xl">
          <ol className="flex items-center gap-2 text-xs mb-8">
            {STEPS.map((s, i) => {
              const n = i + 1; const done = n < step; const active = n === step;
              return (
                <li key={s} className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${done ? "bg-emerald-500 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{done ? "✓" : n}</span>
                  <span className={active ? "font-semibold" : "text-muted-foreground"}>{s}</span>
                  {n < STEPS.length && <span className="w-8 h-px bg-border mx-1" />}
                </li>
              );
            })}
          </ol>

          <div className="card-elevated p-7">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl">Vnesite svojo spletno stran</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Preberemo jo in sami izpolnimo ime, storitve, kontakt in delovni čas. Spletni klepet se iz nje tudi nauči odgovarjati.</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9 h-11" placeholder="www.vase-podjetje.si" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScan()} autoFocus />
                  </div>
                  <Button className="btn-brand h-11 px-5" onClick={handleScan} disabled={scanning || !url.trim()}>
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {scanning ? "Berem stran …" : "Preberi stran"}
                  </Button>
                </div>
                {scanning && <p className="text-xs text-muted-foreground">Berem do 8 podstrani (storitve, cenik, kontakt). Traja 10–30 sekund.</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex-1 h-px bg-border" /> ali <span className="flex-1 h-px bg-border" />
                </div>
                <Button variant="outline" className="w-full h-11" onClick={() => setStep(2)}>
                  <Pencil className="w-4 h-4 mr-2" /> Nimam spletne strani, vnesem ročno
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl">Preverite podatke</h2>
                  {scanInfo
                    ? <p className="text-sm text-muted-foreground mt-1.5">Prebrali smo {scanInfo.pages_read} {scanInfo.pages_read === 1 ? "stran" : scanInfo.pages_read < 5 ? "strani" : "strani"} in pripravili {scanInfo.knowledgeCount} vnosov za spletni klepet. Popravite, kar ni točno.</p>
                    : <p className="text-sm text-muted-foreground mt-1.5">Ti podatki so osnova za vsa sporočila, ki jih bo AI pisal v vašem imenu.</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2"><Label>Ime podjetja *</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Npr. Studio Fit Ljubljana" /></div>
                  <div className="space-y-1.5"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="030 301 300" /></div>
                  <div className="space-y-1.5"><Label>Spletna stran</Label><Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://…" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Naslov</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Ulica 1, 1000 Ljubljana" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Delovni čas</Label><Input value={form.hours} onChange={(e) => update("hours", e.target.value)} placeholder="Pon–Pet 8:00–16:00" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Storitve (vsaka v svoji vrstici)</Label><Textarea value={form.services} onChange={(e) => update("services", e.target.value)} className="h-28" placeholder="Striženje&#10;Barvanje&#10;Nega" /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Trenutna ponudba (ni obvezno)</Label><Input value={form.current_offer} onChange={(e) => update("current_offer", e.target.value)} placeholder="Npr. Prvi obisk –20 %" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Panoga</Label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => update("industry_template", opt.value)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${form.industry_template === opt.value ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border hover:border-primary/50"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl">Še potrditev in začnemo</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Prvih 14 dni je brezplačnih. AI nikoli ne pošlje sporočila brez vaše odobritve.</p>
                </div>
                <div className="rounded-xl border bg-muted/40 p-4 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Podjetje:</span> <strong>{form.name || "—"}</strong></p>
                  <p><span className="text-muted-foreground">Storitve:</span> {form.services ? form.services.split("\n").filter(Boolean).slice(0, 4).join(", ") : "—"}</p>
                  <p><span className="text-muted-foreground">Kontakt:</span> {[form.phone, form.address].filter(Boolean).join(" · ") || "—"}</p>
                  {form.knowledge?.length > 0 && <p><span className="text-muted-foreground">Spletni klepet:</span> {form.knowledge.length} vnosov znanja z vaše strani</p>}
                </div>
                <label htmlFor="gdpr" className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/30">
                  <Checkbox id="gdpr" checked={form.gdpr_confirmed} onCheckedChange={(v) => update("gdpr_confirmed", !!v)} className="mt-0.5" />
                  <span className="text-sm leading-relaxed">
                    Potrjujem, da imam soglasje svojih strank za pošiljanje e-pošte (ZEPT-1, GDPR čl. 7) in sprejemam <a href="/pogoji" target="_blank" rel="noreferrer" className="underline">pogoje uporabe</a> ter <a href="/zasebnost" target="_blank" rel="noreferrer" className="underline">politiko zasebnosti</a>.
                  </span>
                </label>
              </div>
            )}

            {step > 1 && (
              <div className="flex justify-between mt-8">
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="w-4 h-4 mr-1" /> Nazaj</Button>
                {step === 2 ? (
                  <Button className="btn-brand" onClick={() => setStep(3)} disabled={!form.name.trim()}>Naprej <ChevronRight className="w-4 h-4 ml-1" /></Button>
                ) : (
                  <Button className="btn-brand" onClick={handleFinish} disabled={saving || !form.gdpr_confirmed || !form.name.trim()}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />} Začni uporabljati
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
