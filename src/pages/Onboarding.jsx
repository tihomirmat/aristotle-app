import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, ChevronRight, ChevronLeft, Check } from "lucide-react";

const INDUSTRY_OPTIONS = [
  { value: "gym", label: "Fitnes / Gym" },
  { value: "dental_medspa", label: "Zobozdravstvo / Med Spa" },
  { value: "home_services", label: "Domače storitve" },
  { value: "restaurant", label: "Restavracija / Café" },
  { value: "salon_barber", label: "Salon / Frizerstvo" },
  { value: "auto", label: "Avto storitve" },
  { value: "other", label: "Drugo" },
];

const STEPS = [
  "Ime podjetja",
  "Informacije",
  "Soglasje GDPR",
  "Nastavitev e-pošte",
  "Termini",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry_template: "",
    hours: "",
    current_offer: "",
    services: "",
    google_review_link: "",
    gdpr_confirmed: false,
    email_provider: "",
  });

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleFinish = async () => {
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.Business.create({
      name: form.name,
      industry_template: form.industry_template || "other",
      hours: form.hours,
      current_offer: form.current_offer,
      services: form.services,
      google_review_link: form.google_review_link,
      email_provider: form.email_provider || undefined,
      onboarding_complete: true,
      plan: "starter",
      subscription_status: "trialing",
      draft_mode: true,
      pillar_reactivation: true,
      pillar_reviews: true,
      pillar_leads: true,
    });
    await queryClient.invalidateQueries({ queryKey: ["business", user.email] });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">AI Aristotle</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${i < step ? "bg-primary text-white" : i === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-1">{STEPS[step]}</h2>

          {/* Step 0: Business name + industry */}
          {step === 0 && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Ime podjetja *</Label>
                <Input placeholder="Npr. Studio Fit Ljubljana" value={form.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Panoga</Label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => update("industry_template", opt.value)}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${form.industry_template === opt.value ? "border-primary bg-accent text-primary font-medium" : "border-border hover:border-primary/50"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Info */}
          {step === 1 && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Delovni čas</Label>
                <Input placeholder="Pon–Pet 8:00–18:00, Sob 9:00–13:00" value={form.hours} onChange={(e) => update("hours", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Trenutna ponudba / akcija</Label>
                <Input placeholder="Npr. 20% popust za nove stranke" value={form.current_offer} onChange={(e) => update("current_offer", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Storitve</Label>
                <Input placeholder="Npr. Osebni trening, skupinske vadbe, prehransko svetovanje" value={form.services} onChange={(e) => update("services", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Povezava za Google ocene</Label>
                <Input placeholder="https://g.page/r/..." value={form.google_review_link} onChange={(e) => update("google_review_link", e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2: GDPR */}
          {step === 2 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">Pred nadaljevanjem potrdite skladnost z zakonodajo o varstvu osebnih podatkov.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                <strong>Pomembno (GDPR / ZEPT)</strong><br />
                Sistem bo v vašem imenu pošiljal e-poštna sporočila vašim strankam. Za to potrebujete veljavno pravno podlago (soglasje ali zakonit interes).
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="gdpr" checked={form.gdpr_confirmed} onCheckedChange={(v) => update("gdpr_confirmed", v)} />
                <Label htmlFor="gdpr" className="text-sm leading-relaxed cursor-pointer">
                  Potrjujem, da imam veljavno soglasje za pošiljanje e-poštnih sporočil mojim strankam in da ravnam v skladu z Uredbo GDPR ter Zakonom o elektronskih komunikacijah (ZEPT).
                </Label>
              </div>
            </div>
          )}

          {/* Step 3: Email integration */}
          {step === 3 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Izberite način pošiljanja e-pošte. To lahko nastavite tudi pozneje v razdelku Nastavitve → Integracije.</p>
              {[
                { value: "gmail", label: "Gmail", desc: "Povežite Google račun za pošiljanje." },
                { value: "outlook", label: "Outlook / Microsoft 365", desc: "Povežite Microsoft račun." },
                { value: "smtp", label: "SMTP (lastni strežnik)", desc: "Ročna konfiguracija SMTP strežnika." },
              ].map((p) => (
                <button key={p.value} onClick={() => update("email_provider", p.value)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${form.email_provider === p.value ? "border-primary bg-accent" : "border-border hover:border-primary/40"}`}>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                </button>
              ))}
              <button onClick={() => update("email_provider", "")} className="text-xs text-muted-foreground underline w-full text-center pt-1">
                Preskoči za zdaj
              </button>
            </div>
          )}

          {/* Step 4: Bookings */}
          {step === 4 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">Modul za rezervacije vam omogoča avtomatsko predlaganje terminov strankam. Zahteva povezavo z Google Kalendarjem.</p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground text-center">
                Podrobno nastavljanje terminov je na voljo v Nastavitve → Termini po zaključku uvajanja.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Nazaj
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !form.name || step === 2 && !form.gdpr_confirmed}>
                Naprej <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? "Nalaganje..." : "Zaključi uvajanje"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}