import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/functions/completeOnboarding";

const INDUSTRY_OPTIONS = [
  { value: "gym", label: "Fitness / wellness" },
  { value: "dental_medspa", label: "Zobozdravstvo / medspa" },
  { value: "home_services", label: "Dom in popravila" },
  { value: "restaurant", label: "Restavracija / kavarna" },
  { value: "salon_barber", label: "Frizerski / lepotni salon" },
  { value: "auto", label: "Avtoservis" },
  { value: "other", label: "Marketing / storitve" },
  { value: "other2", label: "Drugo" },
];

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    industry_template: "",
    phone: "",
    address: "",
    website: "",
    hours: "",
    services: "",
    current_offer: "",
    google_review_link: "",
    gdpr_confirmed: false,
  });

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const canNext = () => {
    if (step === 1) return form.name.trim().length > 0;
    if (step === 4) return form.gdpr_confirmed;
    return true;
  };

  const handleFinish = async () => {
    if (!form.gdpr_confirmed) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const res = await completeOnboarding({ form });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ["business", user.email] });
      toast.success("Aplikacija je pripravljena! Baza znanja je nastavljena.");
      window.location.href = "/";
    } catch (err) {
      toast.error("Napaka pri zaključku: " + (err.message || "Poskusite znova."));
    } finally {
      setSaving(false);
    }
  };

  /* legacy client-side creation moved to backend function completeOnboarding
  const _legacyFinish = async () => {
    const user = await base44.auth.me();

    // Auto-seed Knowledge Base
    const phone = form.phone || "še ni vneseno";
    const address = form.address || "še ni vneseno";
    const website = form.website || "še ni vneseno";
    const services = form.services || "naše storitve";
    const email = user.email || "še ni vneseno";
    await Promise.all([
      base44.entities.KnowledgeBase.create({
        business_id: business.id,
        title: "Naše storitve",
        content: `Pri ${form.name} ponujamo: ${services}. Za info pišite na ${email} ali pokličite ${phone}. Termini in cene se prilagajajo. Z veseljem vam pripravimo personaliziran predlog.`,
        category: "Storitve",
        active: true,
      }),
      base44.entities.KnowledgeBase.create({
        business_id: business.id,
        title: "Rezervacija termina",
        content: `Termin lahko rezervirate na 3 načine: 1) Kliknete spodaj na Rezerviraj termin. 2) Pokličete ${phone}. 3) Pišete na ${email} s preferenco. Delovni čas pon-pet od 09:00 do 17:00. Potrditev v isti delovni dan.`,
        category: "Termini",
        active: true,
      }),
      base44.entities.KnowledgeBase.create({
        business_id: business.id,
        title: "Pogosta vprašanja",
        content: `Ali ponujate brezplačno posvetovanje? Da, prvi razgovor je brezplačen. Kako poteka prvo srečanje? Spoznamo potrebe, predstavimo storitve, določimo naslednje korake. Ali izdajate račune? Da, s pravilno izdanim računom (z DDV kjer relevantno). Kako prekličem termin? Brezplačno do 24 ur pred rezervacijo. Kakšen rok za odgovor? V naslednjih delovnih dneh, običajno isti dan.`,
        category: "FAQ",
        active: true,
      }),
      base44.entities.KnowledgeBase.create({
        business_id: business.id,
        title: "Kontaktni podatki",
        content: `Naslov: ${address}. Telefon: ${phone}. Email: ${email}. Spletna stran: ${website}. Delovni čas: pon-pet, 09:00-17:00.`,
        category: "Kontakt",
        active: true,
      }),
    ]);

    await queryClient.invalidateQueries({ queryKey: ["business", user.email] });
    toast.success("Aplikacija je pripravljena! Baza znanja je nastavljena.");
    window.location.href = "/";
  };
  */

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold">AI Aristotle</span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Korak {step} od {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6">
          {/* Step 1 — Dobrodošli */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold mb-1">Dobrodošli v AI Aristotle</h2>
                <p className="text-sm text-muted-foreground">V naslednjih 3–5 minutah bomo postavili vašo aplikacijo, ki vam pomaga avtomatizirati marketing in komunikacijo s strankami.</p>
              </div>
              <div className="space-y-2">
                <Label>Ime podjetja *</Label>
                <Input
                  placeholder="Npr. Studio Fit Ljubljana"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Panoga</Label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update("industry_template", opt.value)}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        form.industry_template === opt.value
                          ? "border-primary bg-accent text-primary font-medium"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Kontakt in lokacija */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Kontakt in lokacija</h2>
                <p className="text-sm text-muted-foreground">Te podatke bo AI uporabljal pri komunikaciji s strankami.</p>
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input placeholder="030 301 300 ali +386 30 301 300" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Naslov</Label>
                <Input placeholder="Ulica 1, Ljubljana" value={form.address} onChange={(e) => update("address", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Spletna stran</Label>
                <Input placeholder="https://www.primer.si" value={form.website} onChange={(e) => update("website", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Delovni čas</Label>
                <Input placeholder="Pon–Pet 8:00–18:00, Sob 9:00–13:00" value={form.hours} onChange={(e) => update("hours", e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 3 — Storitve in ponudba */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Storitve in ponudba</h2>
                <p className="text-sm text-muted-foreground">AI bo te podatke uporabil za personalizacijo sporočil.</p>
              </div>
              <div className="space-y-2">
                <Label>Storitve</Label>
                <Textarea
                  placeholder="Navedite vaše glavne storitve, po vrsticah"
                  value={form.services}
                  onChange={(e) => update("services", e.target.value)}
                  className="h-28"
                />
              </div>
              <div className="space-y-2">
                <Label>Trenutna posebna ponudba</Label>
                <Textarea
                  placeholder="Npr. Prvi obisk -20%"
                  value={form.current_offer}
                  onChange={(e) => update("current_offer", e.target.value)}
                  className="h-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Google Review link</Label>
                <Input placeholder="https://g.page/r/..." value={form.google_review_link} onChange={(e) => update("google_review_link", e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 4 — GDPR */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold mb-1">GDPR soglasje</h2>
              </div>
              <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
                <Checkbox
                  id="gdpr"
                  checked={form.gdpr_confirmed}
                  onCheckedChange={(v) => update("gdpr_confirmed", !!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="gdpr" className="text-sm leading-relaxed cursor-pointer">
                  Potrjujem, da imam veljavno soglasje za pošiljanje email sporočil svojim strankam (ZEPT-1, GDPR čl. 7).
                </Label>
              </div>
              <div className="bg-accent border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
                Kasneje boste lahko v Nastavitvah povezali Gmail / Outlook ali nastavili SMTP za pošiljanje. Za zdaj boste videli draft sporočila pred pošiljanjem.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Nazaj
            </Button>

            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Naprej <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={saving || !form.gdpr_confirmed}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Zaključi onboarding
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}