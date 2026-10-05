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

  const addGood = () => {
    if (form.example_good_messages.length >= 5) return;
    setForm({ ...form, example_good_messages: [...form.example_good_messages, emptyGood()] });
  };
  const updateGood = (i, field, val) => {
    const arr = [...form.example_good_messages];
    arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, example_good_messages: arr });
  };
  const removeGood = (i) => setForm({ ...form, example_good_messages: form.example_good_messages.filter((_, idx) => idx !== i) });

  const addBad = () => {
    if (form.example_bad_messages.length >= 5) return;
    setForm({ ...form, example_bad_messages: [...form.example_bad_messages, emptyBad()] });
  };
  const updateBad = (i, field, val) => {
    const arr = [...form.example_bad_messages];
    arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, example_bad_messages: arr });
  };
  const removeBad = (i) => setForm({ ...form, example_bad_messages: form.example_bad_messages.filter((_, idx) => idx !== i) });

  // Funkcija (ne komponenta), da polja ob tipkanju ne izgubijo fokusa.
  const renderExample = (kind, msg, i) => {
    const good = kind === "good";
    const upd = good ? updateGood : updateBad;
    return (
      <div className={`border rounded-lg p-4 space-y-3 ${good ? "bg-emerald-50/50" : "bg-red-50/50"}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${good ? "text-emerald-700" : "text-red-600"}`}>{good ? "Dobro" : "Slabo"} sporočilo #{i + 1}</span>
          <button onClick={() => (good ? removeGood(i) : removeBad(i))} className="text-muted-foreground hover:text-destructive" title="Odstrani"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
        <Input value={msg.subject || ""} onChange={(e) => upd(i, "subject", e.target.value)} placeholder="Zadeva" />
        <Textarea value={msg.body || ""} onChange={(e) => upd(i, "body", e.target.value)} placeholder="Besedilo sporočila" className="h-44" />
        <div className="space-y-1.5">
          <Label className="text-xs">{good ? "Zakaj je dobro?" : "Zakaj je slabo?"}</Label>
          <Input value={(good ? msg.why_good : msg.why_bad) || ""} onChange={(e) => upd(i, good ? "why_good" : "why_bad", e.target.value)} placeholder={good ? "Npr. osebno, kratko, en jasen naslednji korak" : "Npr. preveč prodajno, generično, predolgo"} />
        </div>
      </div>
    );
  };

  const sections = [
    ["good", "Primeri dobrih sporočil", form.example_good_messages, addGood, "Najhitreje: v Stranke → Čaka na vaš odgovor pri odgovoru, ki vam je všeč, kliknite »Dober primer«. AI se po teh primerih zgleduje. Največ 5 — nov primer zamenja najstarejšega."],
    ["bad", "Primeri slabih sporočil", form.example_bad_messages, addBad, "Najhitreje: v Stranke → Čaka na vaš odgovor pri odgovoru, ki vam ni všeč, kliknite »Slab primer« in napišite zakaj. Takim sporočilom se AI izogiba."],
  ];

  return (
    <div className="space-y-6 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="font-semibold">Opis tona in glasu znamke</h3>
          <div className="space-y-2">
            <Label>Kako pišete strankam <span className="text-muted-foreground font-normal">(do 2000 znakov)</span></Label>
            <Textarea value={form.brand_voice} onChange={(e) => setForm({ ...form, brand_voice: e.target.value.slice(0, 2000) })} placeholder="Strankam pišemo toplo in osebno. Vedno vikamo, izogibamo se žargonu ..." className="h-40" />
            <p className="text-xs text-muted-foreground text-right">{form.brand_voice.length}/2000</p>
          </div>
          <div className="space-y-2 max-w-md">
            <Label>Stil komunikacije</Label>
            <Select value={form.tone_preset} onValueChange={(v) => setForm({ ...form, tone_preset: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TONE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3 flex flex-col">
          <h3 className="font-semibold">E-poštni podpis</h3>
          <Label>Podpis na koncu vsake e-pošte</Label>
          <Textarea value={form.email_signature} onChange={(e) => setForm({ ...form, email_signature: e.target.value })} placeholder={"Lep pozdrav,\nIme Priimek\nPodjetje | +386 40 123 456"} className="flex-1 min-h-[160px] font-mono text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {sections.map(([kind, title, list, add, hint]) => (
          <div key={kind} className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{title} <span className="text-muted-foreground font-normal text-sm">{list.length}/5</span></h3>
              <Button size="sm" variant="outline" onClick={add} disabled={list.length >= 5}><Plus className="w-3.5 h-3.5 mr-1" /> Dodaj ročno</Button>
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
            {list.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">Še ni primerov.</p>}
            {list.map((msg, i) => <React.Fragment key={i}>{renderExample(kind, msg, i)}</React.Fragment>)}
          </div>
        ))}
      </div>

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
