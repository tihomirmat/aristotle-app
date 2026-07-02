import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Star, Globe, MessageSquare, Bot, Package, CheckCircle, AlertCircle, Clock, Plus, Sparkles, FileSignature } from "lucide-react";
import { differenceInDays, addMonths, format } from "date-fns";
import { toast } from "sonner";

const MODULES = [
  { key: "pillar_reactivation", label: "Reaktivacija strank", desc: "Avtomatska reaktivacija neaktivnih strank po e-pošti.", icon: Mail, color: "bg-blue-500" },
  { key: "pillar_reviews", label: "Ocene & napotitve", desc: "Avtomatske prošnje za Google ocene in napotitve.", icon: Star, color: "bg-amber-500" },
  { key: "pillar_leads", label: "Pridobivanje strank", desc: "Avtomatska nega potencialnih strank iz spletnega obrazca.", icon: Globe, color: "bg-emerald-500" },
  { key: "pillar_chatbot", label: "Klepetalni pomočnik", desc: "AI klepetalni widget na vašem spletnem mestu.", icon: MessageSquare, color: "bg-violet-500" },
  { key: "pillar_assistant", label: "Osebni asistent", desc: "AI asistent za upravljanje terminov, dnevnih nalog in tedenskih poročil.", icon: Bot, color: "bg-rose-500" },
  { key: "pillar_offers", label: "Generator ponudb", desc: "AI generator ponudb iz obstoječih predlog. Skeniranje obstoječe ponudbe, OCR, transkripti, izvoz v PDF/DOCX.", icon: FileSignature, color: "bg-cyan-600" },
];

export default function BillingTab({ business }) {
  const queryClient = useQueryClient();

  // Determine initially selected modules from active pillars
  const initialSelected = useMemo(() => {
    if (!business) return new Set();
    return new Set(MODULES.filter(m => business[m.key]).map(m => m.key));
  }, [business]);

  const [selected, setSelected] = useState(initialSelected);
  const [isBundle, setIsBundle] = useState(business?.bundle_active || false);
  const [loading, setLoading] = useState(false);

  const status = business?.subscription_status;
  const isTrialing = status === "trialing";
  const isActive = status === "active";
  const trialDaysLeft = business?.trial_ends_at ? Math.max(0, differenceInDays(new Date(business.trial_ends_at), new Date())) : 0;
  const creditsLeft = business ? Math.max(0, (business.trial_cost_cap_eur || 0.45) - (business.trial_cost_used_eur || 0)) : 0;
  const sendsLeft = business?.trial_sends_remaining ?? 20;

  const activePillars = MODULES.filter(m => business?.[m.key]);
  const nextPaymentDate = format(addMonths(new Date(), 1), "d. M. yyyy");

  // Pricing
  const monthlyTotal = isBundle ? 399 : selected.size * 99;
  const integrationFee = (isBundle || business?.integration_fee_paid) ? 0 : 199;
  const firstInvoice = monthlyTotal + integrationFee;

  const toggleModule = (key) => {
    if (isBundle) return; // when bundle is on, all are selected
    const next = new Set(selected);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    setSelected(next);
    if (next.size < 6) setIsBundle(false);
  };

  const selectBundle = () => {
    setIsBundle(true);
    setSelected(new Set(MODULES.map(m => m.key)));
  };

  const deselectBundle = () => {
    setIsBundle(false);
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      const pillarUpdates = {};
      MODULES.forEach(m => { pillarUpdates[m.key] = isBundle || selected.has(m.key); });
      // pillar_digest follows pillar_assistant
      pillarUpdates.pillar_digest = pillarUpdates.pillar_assistant;

      const updates = {
        ...pillarUpdates,
        subscription_status: "active",
        billing_mode: isBundle ? "bundle" : "alacarte",
        bundle_active: isBundle,
        integration_fee_paid: true,
      };
      await base44.entities.Business.update(business.id, updates);

      // Send confirmation email
      const moduleList = MODULES
        .filter(m => pillarUpdates[m.key])
        .map(m => `• ${m.label}`)
        .join("\n");
      await base44.integrations.Core.SendEmail({
        to: business.created_by,
        subject: "Vaša naročnina je aktivna",
        body: `Pozdravljeni!\n\nVaša naročnina je uspešno aktivirana. Aktivni moduli:\n\n${moduleList}\n\nNaslednji datum plačila: ${nextPaymentDate}\n\nHvala, da ste izbrali naš sistem.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Naročnina je aktivirana!");
    },
    onError: (err) => toast.error("Napaka: " + err.message),
  });

  return (
    <div className="space-y-6">
      {/* ── STATUS HEADER ── */}
      <div className={`rounded-xl p-5 border shadow-sm ${
        isTrialing ? "bg-sky-50 border-sky-200" :
        isActive ? "bg-emerald-50 border-emerald-200" :
        "bg-red-50 border-red-200"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {isTrialing && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <h3 className="font-bold text-sky-900">Preizkusno obdobje</h3>
                </div>
                <p className="text-sm text-sky-700">
                  {trialDaysLeft} dni preostalo · {creditsLeft.toFixed(2)} € kreditov preostalo · {sendsLeft} pošiljanj preostalo
                </p>
              </>
            )}
            {isActive && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-emerald-900">Aktivna naročnina</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {activePillars.map(m => (
                    <Badge key={m.key} className="bg-emerald-100 text-emerald-700 border-0 text-xs">{m.label}</Badge>
                  ))}
                </div>
                <p className="text-sm text-emerald-700">
                  {business?.bundle_active ? "399 €/mes" : `${activePillars.length * 99} €/mes`} · Naslednje plačilo: {nextPaymentDate}
                </p>
              </>
            )}
            {!isTrialing && !isActive && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-red-900">Naročnina ni aktivna</h3>
                </div>
                <p className="text-sm text-red-700">Aktivirajte naročnino za dostop do modulov.</p>
              </>
            )}
          </div>
          {!isActive && (
            <Button
              className="shrink-0"
              onClick={() => document.getElementById("confirm-btn")?.scrollIntoView({ behavior: "smooth" })}
            >
              Aktiviraj naročnino
            </Button>
          )}
          {isActive && (
            <Button variant="outline" className="shrink-0">Upravljaj naročnino</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          {/* ── MODUL SELECTOR ── */}
          <div>
            <h3 className="font-semibold mb-3">Izberite module</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODULES.map(m => {
                const Icon = m.icon;
                const isSelected = isBundle || selected.has(m.key);
                return (
                  <div
                    key={m.key}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
                      isSelected ? "border-primary bg-accent shadow-sm" : "bg-card hover:border-primary/40"
                    }`}
                    onClick={() => toggleModule(m.key)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${m.color} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{m.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                        </div>
                      </div>
                      <div className="shrink-0 mt-0.5">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                            <Plus className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-bold">99 €/mes</span>
                      <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                        {isSelected ? "Aktivno" : "Dodaj"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── BUNDLE KARTICA ── */}
          <div
            className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
              isBundle ? "border-primary bg-gradient-to-br from-primary/5 to-violet-50 shadow-md" : "border-dashed border-primary/40 bg-card hover:border-primary/70"
            }`}
            onClick={isBundle ? deselectBundle : selectBundle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-base">Vsi moduli — Paket</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">Prihranite 195 €/mes</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Brez stroška namestitve</Badge>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {isBundle ? (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <Sparkles className="w-6 h-6 text-primary" />
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Vseh 6 modulov v enem paketu. Idealno za podjetja, ki želijo polno AI rast.
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-2xl font-bold">399 €<span className="text-sm font-normal text-muted-foreground">/mes</span></span>
              <Button size="sm" variant={isBundle ? "default" : "outline"} className="pointer-events-none">
                {isBundle ? "Izbrano" : "Izberi paket"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── ORDER SUMMARY ── */}
        <div className="xl:sticky xl:top-6 h-fit">
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base">Povzetek naročila</h3>

            {/* selected items */}
            <div className="space-y-2">
              {isBundle ? (
                <div className="flex justify-between text-sm">
                  <span>Vsi moduli — Paket</span>
                  <span className="font-medium">399 €/mes</span>
                </div>
              ) : selected.size === 0 ? (
                <p className="text-xs text-muted-foreground italic">Noben modul ni izbran.</p>
              ) : (
                MODULES.filter(m => selected.has(m.key)).map(m => (
                  <div key={m.key} className="flex justify-between text-sm">
                    <span>{m.label}</span>
                    <span className="font-medium">99 €/mes</span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Skupaj mesečno</span>
                <span className="font-semibold">{monthlyTotal} €/mes</span>
              </div>

              {/* Integration fee */}
              {!business?.integration_fee_paid && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Strošek namestitve</span>
                  {isBundle ? (
                    <span className="text-emerald-600 font-medium">
                      <span className="line-through text-muted-foreground mr-1">199 €</span>
                      brezplačno
                    </span>
                  ) : (
                    <span className="font-medium">199 € (enkratno)</span>
                  )}
                </div>
              )}

              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold">Prvi račun</span>
                <span className="font-bold text-lg">{firstInvoice} €</span>
              </div>
            </div>

            <Button
              id="confirm-btn"
              className="w-full"
              size="lg"
              disabled={selected.size === 0 || loading || activateMutation.isPending}
              onClick={() => activateMutation.mutate()}
            >
              {activateMutation.isPending ? "Obdelavam..." : "Potrdi in plačaj"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">Vse cene so brez DDV.</p>
            <div className="flex justify-center gap-3 text-xs text-muted-foreground">
              <a href="#" className="hover:underline">Pogoji storitve</a>
              <span>·</span>
              <a href="#" className="hover:underline">Pogoji preklica</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}