import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Rocket, ChevronRight, ChevronLeft, Loader2, Globe, Sparkles, Pencil, ChevronDown, Star, Building2, Phone, MapPin, Clock, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/functions/completeOnboarding";
import { scanWebsite } from "@/functions/scanWebsite";
import { fnError } from "@/lib/fn-error";
import ServicesPicker from "@/components/ServicesPicker";
import IndustryPicker from "@/components/IndustryPicker";
import OffersPicker from "@/components/OffersPicker";
import { LEGACY_LABEL } from "@/lib/industries";
import { FEATURES, CORE_FEATURE } from "@/lib/features";
import { Check } from "lucide-react";
import TermsReview from "@/components/TermsReview";
import { TERMS_VERSION } from "@/pages/Pravno";

const INDUSTRY_OPTIONS = [
  { value: "other", label: "Storitve / drugo" },
  { value: "home_services", label: "Dom in popravila" },
  { value: "salon_barber", label: "Frizerski / lepotni salon" },
  { value: "dental_medspa", label: "Zobozdravstvo / lepota" },
  { value: "gym", label: "Fitnes / wellness" },
  { value: "restaurant", label: "Gostinstvo" },
  { value: "auto", label: "Avtoservis" },
];
const STEPS = ["Spletna stran", "Podjetje", "Storitve", "Pomočniki", "Pogoji"];
const toList = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

// Uvod: miren, 5 kratkih korakov (zadnji: obvezen sprejem splošnih pogojev), eno vprašanje naenkrat. Desno (na računalniku) sproti vidite, kaj bo AI vedel o vas.
export default function Onboarding({ preview = false }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState(null);
  const [url, setUrl] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", industry_template: "other", industry: "", offer_options: [], phone: "", address: "", website: "", hours: "",
    services: "", main_services: "", enabled_features: [], current_offer: "", google_review_link: "", brand_voice: "", knowledge: [], gdpr_confirmed: false, terms_accepted: false,
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
      const services = Array.isArray(d.services) ? d.services.join("\n")
        : d.services && !d.services.includes("\n") ? d.services.split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean).join("\n") : d.services;
      setForm((f) => ({
        ...f,
        name: d.name || f.name, industry_template: d.industry_template || f.industry_template,
        industry: d.industry || LEGACY_LABEL[d.industry_template] || f.industry,
        offer_options: Array.isArray(d.offers) ? d.offers : (d.current_offer ? [d.current_offer] : []),
        phone: d.phone || f.phone, address: d.address || f.address, website: d.website || url.trim(),
        hours: d.hours || f.hours, services: services || f.services, current_offer: f.current_offer,
        brand_voice: d.brand_voice || f.brand_voice, knowledge: d.knowledge || [],
      }));
      setScanInfo({ pages_read: d.pages_read || 1, knowledgeCount: (d.knowledge || []).length, description: d.short_description || "" });
      setStep(2);
    } catch (err) {
      toast.error(fnError(err) || "Strani ni bilo mogoče prebrati. Podatke lahko vnesete ročno.");
    } finally { setScanning(false); }
  };

  const handleFinish = async () => {
    if (!form.gdpr_confirmed || !form.terms_accepted || !form.name.trim()) return;
    if (preview) { toast.success("Predogled uvoda — nič ni shranjeno."); window.location.href = "/"; return; }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const res = await completeOnboarding({ form: { ...form, terms_version: TERMS_VERSION } });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      await queryClient.invalidateQueries({ queryKey: ["business", user.email] });
      window.location.href = "/nastavitve?tab=integracije&uvod=1"; // zadnji korak: povezava e-poštnega predala
    } catch (err) {
      toast.error("Napaka pri zaključku: " + (fnError(err) || "Poskusite znova."));
    } finally { setSaving(false); }
  };

  const services = toList(form.services);
  const mainServices = toList(form.main_services);
  const canNext = step === 2 ? !!form.name.trim() : true;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Glava */}
      <header className="h-16 px-6 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(13,94%,55%)] to-[hsl(41,100%,53%)] flex items-center justify-center"><Rocket className="w-4 h-4 text-white" /></div>
          <span className="font-display font-semibold">AI Aristotle</span>
        </div>
        <span className="text-xs text-muted-foreground">{preview && <span className="mr-3 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">Predogled — nič se ne shrani</span>}Korak {step} od {STEPS.length} · približno 2 minuti</span>
      </header>
      <div className="h-1 bg-border"><div className="h-1 bg-primary transition-all duration-500" style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <section className="bg-background rounded-2xl border shadow-sm p-6 md:p-10">
          {step === 1 && (
            <div className="space-y-7 max-w-xl">
              <div>
                <p className="text-sm text-primary font-medium">Dobrodošli</p>
                <h1 className="text-3xl mt-1">Začnimo z vašo spletno stranjo</h1>
                <p className="text-muted-foreground mt-2">Preberemo jo in predizpolnimo podatke o podjetju. Vse lahko v naslednjem koraku pregledate in popravite.</p>
              </div>
              <div className="space-y-3">
                <Label>Naslov spletne strani</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9 h-12 text-base" placeholder="www.vase-podjetje.si" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScan()} autoFocus />
                  </div>
                  <Button className="btn-brand h-12 px-6" onClick={handleScan} disabled={scanning || !url.trim()}>
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}{scanning ? "Berem …" : "Preberi"}
                  </Button>
                </div>
                {scanning && <p className="text-xs text-muted-foreground">Berem stran in podstrani. Traja 10–30 sekund.</p>}
              </div>
              <button type="button" onClick={() => setStep(2)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" />Nimam spletne strani — vnesem sam</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7 max-w-xl">
              <div>
                <h1 className="text-3xl">Vaše podjetje</h1>
                <p className="text-muted-foreground mt-2">{scanInfo ? "To smo prebrali na vaši strani. Popravite, kar ni točno." : "Osnovni podatki, s katerimi AI piše v vašem imenu."}</p>
              </div>
              <div className="space-y-1.5"><Label>Ime podjetja *</Label><Input className="h-11" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Npr. Studio Fit" /></div>
              <div className="space-y-1.5">
                <Label>Dejavnost</Label>
                <IndustryPicker value={form.industry} onChange={({ industry, industry_template }) => setForm((f) => ({ ...f, industry, industry_template }))} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="030 301 300" /></div>
                <div className="space-y-1.5"><Label>Spletna stran</Label><Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="www.…" /></div>
              </div>
              <div className="rounded-xl border">
                <button type="button" onClick={() => setMoreOpen(!moreOpen)} className="w-full flex items-center justify-between px-4 py-3 text-sm">
                  <span>Naslov in delovni čas <span className="text-muted-foreground">(ni obvezno)</span></span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <div className="px-4 pb-4 grid gap-4">
                    <div className="space-y-1.5"><Label>Naslov</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Ulica 1, 1000 Ljubljana" /></div>
                    <div className="space-y-1.5"><Label>Delovni čas</Label><Input value={form.hours} onChange={(e) => update("hours", e.target.value)} placeholder="Pon–Pet 8:00–16:00" /></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-7 max-w-xl">
              <div>
                <h1 className="text-3xl">Kaj ponujate?</h1>
                <p className="text-muted-foreground mt-2">Uredite seznam in z zvezdico označite, kar vam je najbolj pomembno. Tega bo AI strankam predlagal najprej.</p>
              </div>
              <ServicesPicker value={form.services} main={form.main_services} onChange={({ services: s, main_services: m }) => setForm((f) => ({ ...f, services: s, main_services: m }))} />
              <div className="space-y-2 pt-4 border-t">
                <Label>Akcije in posebne ponudbe <span className="text-muted-foreground font-normal">(ni obvezno)</span></Label>
                <p className="text-xs text-muted-foreground">AI jih omeni strankam, ko so smiselne. Označite samo tiste, ki še veljajo.</p>
                <OffersPicker options={form.offer_options} value={form.current_offer} onChange={(v) => update("current_offer", v)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-7 max-w-xl">
              <div>
                <h1 className="text-3xl">Pri čem naj vam pomagamo?</h1>
                <p className="text-muted-foreground mt-2">Izberite samo, kar potrebujete. V meniju boste videli le izbrano, ostalo lahko kadarkoli vklopite v Nastavitvah.</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-accent/40 p-4 flex gap-3">
                <CORE_FEATURE.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1"><p className="font-medium text-sm">{CORE_FEATURE.title} <span className="text-xs text-muted-foreground font-normal">· vedno vključeno</span></p><p className="text-sm text-muted-foreground mt-0.5">{CORE_FEATURE.desc}</p></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {FEATURES.map((f) => {
                  const on = form.enabled_features.includes(f.key);
                  return (
                    <button key={f.key} type="button" onClick={() => update("enabled_features", on ? form.enabled_features.filter((k) => k !== f.key) : [...form.enabled_features, f.key])}
                      className={`text-left rounded-xl border p-4 transition-all relative ${on ? "border-primary ring-2 ring-primary/15 bg-accent/30" : "hover:border-primary/40"}`}>
                      <span className={`absolute top-3 right-3 w-5 h-5 rounded-md border flex items-center justify-center ${on ? "bg-primary border-primary text-white" : "bg-background"}`}>{on && <Check className="w-3.5 h-3.5" />}</span>
                      <f.icon className={`w-5 h-5 ${on ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="font-medium text-sm mt-2 pr-6">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-7 max-w-xl">
              <div>
                <h1 className="text-3xl">Preden začnete</h1>
                <p className="text-muted-foreground mt-2">Preberite, kako aplikacija deluje in kaj se zgodi z vašimi podatki. Brez drobnega tiska — vse je zapisano spodaj. Nato vas odpeljemo na povezavo e-poštnega predala (to lahko naredite tudi pozneje).</p>
              </div>
              <TermsReview id="terms" accepted={form.terms_accepted} onAccept={(v) => update("terms_accepted", v)} />
              <label htmlFor="gdpr" className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/30">
                <Checkbox id="gdpr" checked={form.gdpr_confirmed} onCheckedChange={(v) => update("gdpr_confirmed", !!v)} className="mt-0.5" />
                <span className="text-sm leading-relaxed">Strankam pišem le, če imam za to pravno podlago (soglasje, obstoječe poslovno razmerje ali so mi pisale same) — GDPR in ZEKom-2.</span>
              </label>
              <p className="text-xs text-muted-foreground flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />Prvih 14 dni je brezplačnih, brez kartice. Odgovori na povpraševanja privzeto čakajo na vaš pregled.</p>
            </div>
          )}

          {step > 1 && (
            <div className="flex justify-between items-center mt-10 pt-6 border-t max-w-xl">
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="w-4 h-4 mr-1" />Nazaj</Button>
              {step < 5 ? (
                <Button className="btn-brand px-6" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Naprej<ChevronRight className="w-4 h-4 ml-1" /></Button>
              ) : (
                <Button className="btn-brand px-6" onClick={handleFinish} disabled={saving || !form.gdpr_confirmed || !form.terms_accepted || !form.name.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Sprejemam in začnem<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Desno: sproti, kaj bo AI vedel */}
        <aside className="hidden lg:block sticky top-8 bg-background rounded-2xl border shadow-sm p-6 space-y-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Kaj bo AI vedel o vas</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
            <div className="min-w-0"><p className="font-semibold truncate">{form.name || "Ime podjetja"}</p><p className="text-xs text-muted-foreground">{form.industry || "Dejavnost"}</p></div>
          </div>
          {scanInfo?.description && <p className="text-sm text-muted-foreground">{scanInfo.description}</p>}
          <div className="space-y-2 text-sm">
            {form.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />{form.phone}</p>}
            {form.address && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" />{form.address}</p>}
            {form.hours && <p className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4" />{form.hours}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Storitve {services.length > 0 && `(${services.length})`}</p>
            {services.length === 0 ? <p className="text-sm text-muted-foreground/70">—</p> : (
              <div className="flex flex-wrap gap-1.5">
                {services.slice(0, 10).map((s) => <span key={s} className={`text-xs px-2 py-1 rounded-md border inline-flex items-center gap-1 ${mainServices.includes(s) ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-muted/40"}`}>{mainServices.includes(s) && <Star className="w-3 h-3 fill-amber-400 text-amber-500" />}{s}</span>)}
                {services.length > 10 && <span className="text-xs text-muted-foreground">+{services.length - 10}</span>}
              </div>
            )}
          </div>
          {form.knowledge?.length > 0 && <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-3 border-t"><MessageCircle className="w-3.5 h-3.5" />Spletni klepet že pozna {form.knowledge.length} tem z vaše strani.</p>}
        </aside>
      </main>
    </div>
  );
}
