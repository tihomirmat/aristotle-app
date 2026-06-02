import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Plus, Trash2, Calendar, Info } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  { key: "mon", label: "Pon" },
  { key: "tue", label: "Tor" },
  { key: "wed", label: "Sre" },
  { key: "thu", label: "Čet" },
  { key: "fri", label: "Pet" },
  { key: "sat", label: "Sob" },
  { key: "sun", label: "Ned" },
];

function NumStepper({ label, value, onChange, min = 1, max = 999, unit = "" }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-md border border-input flex items-center justify-center hover:bg-muted text-lg font-medium"
        >−</button>
        <span className="w-12 text-center text-sm font-semibold">{value}{unit}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-md border border-input flex items-center justify-center hover:bg-muted text-lg font-medium"
        >+</button>
      </div>
    </div>
  );
}

export default function TerminiTab({ business }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    booking_enabled: false,
    booking_auto_mode: false,
    booking_hours_start: "09:00",
    booking_hours_end: "17:00",
    booking_days_of_week: ["mon", "tue", "wed", "thu", "fri"],
    booking_buffer_minutes: 15,
    booking_default_duration_minutes: 60,
    booking_min_advance_hours: 4,
    booking_max_advance_days: 30,
    booking_proposals_count: 3,
    booking_response_window_hours: 24,
    booking_blackout_periods: [],
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (business) {
      setForm({
        booking_enabled: business.booking_enabled ?? false,
        booking_auto_mode: business.booking_auto_mode ?? false,
        booking_hours_start: business.booking_hours_start || "09:00",
        booking_hours_end: business.booking_hours_end || "17:00",
        booking_days_of_week: business.booking_days_of_week || ["mon", "tue", "wed", "thu", "fri"],
        booking_buffer_minutes: business.booking_buffer_minutes ?? 15,
        booking_default_duration_minutes: business.booking_default_duration_minutes ?? 60,
        booking_min_advance_hours: business.booking_min_advance_hours ?? 4,
        booking_max_advance_days: business.booking_max_advance_days ?? 30,
        booking_proposals_count: business.booking_proposals_count ?? 3,
        booking_response_window_hours: business.booking_response_window_hours ?? 24,
        booking_blackout_periods: business.booking_blackout_periods || [],
      });
    }
  }, [business]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Nastavitve terminov shranjene");
    },
  });

  const toggleDay = (day) => {
    const days = form.booking_days_of_week.includes(day)
      ? form.booking_days_of_week.filter(d => d !== day)
      : [...form.booking_days_of_week, day];
    setForm({ ...form, booking_days_of_week: days });
  };

  const addBlackout = () => {
    setForm({
      ...form,
      booking_blackout_periods: [
        ...form.booking_blackout_periods,
        { start_date: "", end_date: "", reason: "" },
      ],
    });
  };

  const updateBlackout = (idx, field, val) => {
    const periods = [...form.booking_blackout_periods];
    periods[idx] = { ...periods[idx], [field]: val };
    setForm({ ...form, booking_blackout_periods: periods });
  };

  const removeBlackout = (idx) => {
    setForm({ ...form, booking_blackout_periods: form.booking_blackout_periods.filter((_, i) => i !== idx) });
  };

  const validate = () => {
    const errs = {};
    if (form.booking_hours_end <= form.booking_hours_start) errs.hours = "Čas konca mora biti po začetku";
    if (form.booking_days_of_week.length === 0) errs.days = "Izberite vsaj en delovni dan";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveMutation.mutate(form);
  };

  return (
    <div className="max-w-lg space-y-4">
      {/* Toggle booking */}
      <div className="flex items-center justify-between bg-card border rounded-xl p-4 shadow-sm">
        <div>
          <p className="font-medium">Aktiviraj rezervacije</p>
          <p className="text-sm text-muted-foreground">Dovoli AI asistentu predlagati termine strankam.</p>
        </div>
        <Switch checked={form.booking_enabled} onCheckedChange={(v) => setForm({ ...form, booking_enabled: v })} />
      </div>

      {form.booking_enabled && (
        <>
          {/* Auto mode */}
          <div className="flex items-center justify-between bg-card border rounded-xl p-4 shadow-sm">
            <div>
              <p className="font-medium">Samodejni način</p>
              <p className="text-sm text-muted-foreground">Asistent potrdi termine brez vašega pregleda.</p>
            </div>
            <Switch checked={form.booking_auto_mode} onCheckedChange={(v) => setForm({ ...form, booking_auto_mode: v })} />
          </div>

          {/* Delovni čas */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm">Delovni čas</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Začetek</Label>
                <Input type="time" value={form.booking_hours_start} onChange={(e) => setForm({ ...form, booking_hours_start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Konec</Label>
                <Input type="time" value={form.booking_hours_end} onChange={(e) => setForm({ ...form, booking_hours_end: e.target.value })} />
              </div>
            </div>
            {errors.hours && <p className="text-xs text-destructive">{errors.hours}</p>}

            {/* Dnevi */}
            <div className="space-y-2">
              <Label>Delovni dnevi</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(d => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.booking_days_of_week.includes(d.key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-input hover:border-primary/50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {errors.days && <p className="text-xs text-destructive">{errors.days}</p>}
            </div>
          </div>

          {/* Parametri */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-4">Parametri rezervacij</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <NumStepper
                label="Vmesni čas"
                value={form.booking_buffer_minutes}
                onChange={(v) => setForm({ ...form, booking_buffer_minutes: v })}
                min={0} max={120} unit=" min"
              />
              <NumStepper
                label="Trajanje termina"
                value={form.booking_default_duration_minutes}
                onChange={(v) => setForm({ ...form, booking_default_duration_minutes: v })}
                min={15} max={480} unit=" min"
              />
              <NumStepper
                label="Min. vnaprej"
                value={form.booking_min_advance_hours}
                onChange={(v) => setForm({ ...form, booking_min_advance_hours: v })}
                min={0} max={168} unit=" ur"
              />
              <NumStepper
                label="Max. vnaprej"
                value={form.booking_max_advance_days}
                onChange={(v) => setForm({ ...form, booking_max_advance_days: v })}
                min={1} max={365} unit=" dni"
              />
              <NumStepper
                label="Št. predlogov"
                value={form.booking_proposals_count}
                onChange={(v) => setForm({ ...form, booking_proposals_count: v })}
                min={1} max={5}
              />
              <NumStepper
                label="Odzivno okno"
                value={form.booking_response_window_hours}
                onChange={(v) => setForm({ ...form, booking_response_window_hours: v })}
                min={1} max={168} unit=" ur"
              />
            </div>
          </div>

          {/* Blackout periods */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Blokirani termini (počitnice, dopust…)</h3>
              <Button size="sm" variant="outline" onClick={addBlackout} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Dodaj
              </Button>
            </div>
            {form.booking_blackout_periods.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ni dodanih blokiranih obdobij.</p>
            ) : (
              <div className="space-y-3">
                {form.booking_blackout_periods.map((bp, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Od</Label>
                      <Input type="date" value={bp.start_date || ""} onChange={(e) => updateBlackout(idx, "start_date", e.target.value)} className="text-xs h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Do</Label>
                      <Input type="date" value={bp.end_date || ""} onChange={(e) => updateBlackout(idx, "end_date", e.target.value)} className="text-xs h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Razlog</Label>
                      <Input value={bp.reason || ""} onChange={(e) => updateBlackout(idx, "reason", e.target.value)} placeholder="Dopust…" className="text-xs h-8" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeBlackout(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Google Calendar */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Google Koledar</h3>
              {business?.google_calendar_connected
                ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Povezano</Badge>
                : <Badge variant="outline" className="text-muted-foreground text-xs">Ni povezano</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mb-3">Povežite Google Koledar za samodejno branje razpoložljivosti in potrjevanje terminov.</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <Info className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">OAuth integracija bo na voljo v naslednji različici. Za zdaj upravljajte termine ročno.</p>
            </div>
          </div>
        </>
      )}

      <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Shrani nastavitve terminov
      </Button>
    </div>
  );
}