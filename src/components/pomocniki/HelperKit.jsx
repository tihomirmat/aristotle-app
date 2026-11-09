import React from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Skupni gradniki vseh pomočnikov: ista glava, isti čarovnik, isti zavihki.
// Pravilo: en zaslon = ena glavna stvar. Nastavitev vedno po korakih, en korak naenkrat.

export const TONES = {
  orange: "bg-[#fff1ec] text-[#f84214]",
  blue: "bg-[#eef1ff] text-[#091f93]",
  amber: "bg-[#fff6dd] text-[#b97700]",
  green: "bg-emerald-50 text-emerald-700",
  violet: "bg-[#f1ecff] text-[#340698]",
};

export function StatusPill({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />{children}
    </span>
  );
}

export function HelperHeader({ icon: Icon, tone = "orange", title, subtitle, ok, statusLabel, children }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Link to="/pomocniki" className="w-9 h-9 rounded-full border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 shrink-0" title="Vsi pomočniki"><ChevronLeft className="w-4 h-4" /></Link>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-6 h-6" /></div>
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-3 flex-wrap"><h1 className="!text-2xl leading-tight">{title}</h1>{statusLabel && <StatusPill ok={ok}>{statusLabel}</StatusPill>}</div>
        {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

// Zavihki v obliki »tabletk« — največ trije, da ni izbire preveč.
export function PillTabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1 gap-1">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-2 ${value === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {t.icon && <t.icon className="w-4 h-4" />}{t.label}
          {t.badge > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// Vrstica korakov: 1 —— 2 —— 3. Klik na korak ga odpre.
export function Stepper({ steps, current, onStep }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = current === s.key;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && <div className={`h-0.5 flex-1 max-w-16 rounded ${steps[i - 1].done ? "bg-emerald-400" : "bg-border"}`} />}
            <button onClick={() => onStep(s.key)} className={`flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 border-2 transition-all ${active ? "border-primary bg-card shadow-sm" : "border-transparent hover:bg-card"}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${s.done ? "bg-emerald-500 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}</span>
              <span className={`text-sm font-semibold whitespace-nowrap ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// En korak čarovnika: velik naslov, kratek stavek, vsebina, spodaj Nazaj / Naprej.
export function StepCard({ n, total, title, text, children, onBack, onNext, nextLabel = "Naprej", nextDisabled, nextHint, footer }) {
  return (
    <div className="card-elevated p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Korak {n} od {total}</p>
      <h2 className="!text-2xl mt-1">{title}</h2>
      {text && <p className="text-muted-foreground mt-2 max-w-xl">{text}</p>}
      <div className="mt-6">{children}</div>
      {(onBack || onNext || footer) && (
        <div className="flex items-center gap-3 mt-8 pt-5 border-t flex-wrap">
          {onBack && <Button variant="ghost" onClick={onBack} className="gap-1.5"><ChevronLeft className="w-4 h-4" />Nazaj</Button>}
          {footer}
          <div className="flex-1" />
          {nextHint && <span className="text-xs text-muted-foreground">{nextHint}</span>}
          {onNext && <Button size="lg" className="btn-brand gap-2 text-base px-7" onClick={onNext} disabled={nextDisabled}>{nextLabel}<ArrowRight className="w-4 h-4" /></Button>}
        </div>
      )}
    </div>
  );
}

export function Stat({ value, label, tone }) {
  return (
    <div className="card-elevated px-5 py-4">
      <p className={`font-display text-3xl font-bold leading-none ${tone || ""}`}>{value}</p>
      <p className="text-sm text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="rounded-2xl border-2 border-dashed px-6 py-12 text-center">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center"><Icon className="w-7 h-7 text-muted-foreground/60" /></div>}
      <p className="font-semibold text-lg mt-4">{title}</p>
      {text && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{text}</p>}
      {children && <div className="mt-5 flex justify-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
