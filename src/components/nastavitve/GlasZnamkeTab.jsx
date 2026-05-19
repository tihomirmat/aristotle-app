import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";

const TONE_LABELS = {
  industry_default: "Privzeto za panogo",
  warm_personal: "Toplo in osebno",
  professional_formal: "Profesionalno in formalno",
  casual_friendly: "Sproščeno in prijazno",
  expert_technical: "Strokovno in tehnično",
};

const emptyGood = () => ({ subject: "", body: "", why_good: "" });
const emptyBad = () => ({ subject: "", body: "", why_bad: "" });

export default function GlasZnamkeTab({ business }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    brand_voice: "",
    tone_preset: "industry_default",
    email_signature: "",
    example_good_messages: [],
    example_bad_messages: [],
  });
  const [savedForm, setSavedForm] = useState(null);

  useEffect(() => {
    if (business) {
      const initial = {
        brand_voice: business.brand_voice || "",
        tone_preset: business.tone_preset || "industry_default",
        email_signature: business.email_signature || "",
        example_good_messages: business.example_good_messages || [],
        example_bad_messages: business.example_bad_messages || [],
      };
      setForm(initial);
      setSavedForm(initial);
    }
  }, [business]);

  const isDirty = savedForm && JSON.stringify(form) !== JSON.stringify(savedForm);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Business.update(business.id, {
      brand_voice: form.brand_voice,
      tone_preset: form.tone_preset,
      email_signature: form.email_signature,
      example_good_messages: form.example_good_messages,
      example_bad_messages: form.example_bad_messages,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      setSavedForm({ ...form });
      sonnerToast.success("Glas znamke je posodobljen.");
    },
    onError: (err) => {
      sonnerToast.error("Napaka pri shranjevanju: " + (err?.message || "Neznana napaka"));
    },
  });

  // Good messages helpers
  const addGood = () => {
    if (form.example_good_messages.length >= 5) return;
    setForm({ ...form, example_good_messages: [...form.example_good_messages, emptyGood()] });
  };
  const updateGood = (i, field, val) => {
    const arr = [...form.example_good_messages];
    arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, example_good_messages: arr });
  };
  const removeGood = (i) => {
    setForm({ ...form, example_good_messages: form.example_good_messages.filter((_, idx) => idx !== i) });
  };

  // Bad messages helpers
  const addBad = () => {
    if (form.example_bad_messages.length >= 5) return;
    setForm({ ...form, example_bad_messages: [...form.example_bad_messages, emptyBad()] });
  };
  const updateBad = (i, field, val) => {
    const arr = [...form.example_bad_messages];
    arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, example_bad_messages: arr });
  };
  const removeBad = (i) => {
    setForm({ ...form, example_bad_messages: form.example_bad_messages.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="max-w-lg space-y-6 pb-24">

      {/* Opis tona */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold">Opis tona in glasu znamke</h3>
        <div className="space-y-2">
          <Label>Opis tona <span className="text-muted-foreground font-normal">(do 2000 znakov)</span></Label>
          <Textarea
            value={form.brand_voice}
            onChange={(e) => setForm({ ...form, brand_voice: e.target.value.slice(0, 2000) })}
            placeholder="Opisujemo stranke toplo in osebno. Vedno vikamo, izogibamo se žargonu..."
            className="h-32 resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{form.brand_voice.length}/2000</p>
        </div>
        <div className="space-y-2">
          <Label>Stil komunikacije</Label>
          <Select value={form.tone_preset} onValueChange={(v) => setForm({ ...form, tone_preset: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TONE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Primeri dobrih sporočil */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Primeri dobrih sporočil</h3>
          <Button size="sm" variant="outline" onClick={addGood} disabled={form.example_good_messages.length >= 5}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj
          </Button>
        </div>
        {form.example_good_messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ni primerov. Dodajte do 5 zglednih sporočil.</p>
        )}
        {form.example_good_messages.map((msg, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700">Dobro sporočilo #{i + 1}</span>
              <button onClick={() => removeGood(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zadeva</Label>
              <Input value={msg.subject} onChange={(e) => updateGood(i, "subject", e.target.value)} placeholder="Zadeva e-pošte..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vsebina</Label>
              <Textarea value={msg.body} onChange={(e) => updateGood(i, "body", e.target.value)} placeholder="Vsebina sporočila..." className="h-20 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zakaj je dobro?</Label>
              <Input value={msg.why_good} onChange={(e) => updateGood(i, "why_good", e.target.value)} placeholder="Npr. Osebno nagovarjanje, jasna poziv k dejanju..." />
            </div>
          </div>
        ))}
      </div>

      {/* Primeri slabih sporočil */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Primeri slabih sporočil</h3>
          <Button size="sm" variant="outline" onClick={addBad} disabled={form.example_bad_messages.length >= 5}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj
          </Button>
        </div>
        {form.example_bad_messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ni primerov. Dodajte do 5 sporočil, ki se jim AI izogiba.</p>
        )}
        {form.example_bad_messages.map((msg, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3 bg-red-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-red-600">Slabo sporočilo #{i + 1}</span>
              <button onClick={() => removeBad(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zadeva</Label>
              <Input value={msg.subject} onChange={(e) => updateBad(i, "subject", e.target.value)} placeholder="Zadeva e-pošte..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vsebina</Label>
              <Textarea value={msg.body} onChange={(e) => updateBad(i, "body", e.target.value)} placeholder="Vsebina sporočila..." className="h-20 resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zakaj je slabo?</Label>
              <Input value={msg.why_bad} onChange={(e) => updateBad(i, "why_bad", e.target.value)} placeholder="Npr. Preveč prodajno, generično, ni osebnega nagovora..." />
            </div>
          </div>
        ))}
      </div>

      {/* E-poštni podpis */}
      <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="font-semibold">E-poštni podpis</h3>
        <div className="space-y-2">
          <Label>Podpis, ki ga AI doda na konec e-pošte</Label>
          <Textarea
            value={form.email_signature}
            onChange={(e) => setForm({ ...form, email_signature: e.target.value })}
            placeholder="Lep pozdrav,&#10;Ime Priimek&#10;Studio Fit | +386 40 123 456"
            className="h-24 resize-none font-mono text-sm"
          />
        </div>
      </div>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Imate neshranjene spremembe</span>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Shrani spremembe
          </Button>
        </div>
      )}
    </div>
  );
}