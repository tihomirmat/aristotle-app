import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FEATURES, CORE_FEATURE, featureOn } from "@/lib/features";

// Nastavitve → Pomočniki: stranka sama izbere, kaj vidi v meniju.
export default function FeaturesCard({ business }) {
  const qc = useQueryClient();
  const toggle = async (key, on) => {
    const current = Array.isArray(business.enabled_features) ? business.enabled_features : FEATURES.map((f) => f.key);
    const next = on ? [...new Set([...current, key])] : current.filter((k) => k !== key);
    try {
      await base44.entities.Business.update(business.id, { enabled_features: next });
      qc.invalidateQueries({ queryKey: ["business"] });
      toast.success(on ? "Pomočnik vklopljen — najdete ga v meniju." : "Pomočnik skrit iz menija.");
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Pomočniki</h3>
        <p className="text-sm text-muted-foreground mt-1">Vklopite samo tiste, ki jih potrebujete. V meniju vidite le vklopljene.</p>
      </div>
      <div className="rounded-xl border border-primary/30 bg-accent/40 p-4 flex gap-3">
        <CORE_FEATURE.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div><p className="font-medium text-sm">{CORE_FEATURE.title} <span className="text-xs text-muted-foreground font-normal">· vedno vključeno</span></p><p className="text-sm text-muted-foreground mt-0.5">{CORE_FEATURE.desc}</p></div>
      </div>
      <div className="rounded-xl border divide-y bg-card">
        {FEATURES.map((f) => {
          const on = featureOn(business, f.key);
          return (
            <label key={f.key} className="flex items-center gap-4 p-4 cursor-pointer">
              <f.icon className={`w-5 h-5 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1"><p className="font-medium text-sm">{f.title}</p><p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p></div>
              <Switch checked={on} onCheckedChange={(v) => toggle(f.key, v)} />
            </label>
          );
        })}
      </div>
    </div>
  );
}
