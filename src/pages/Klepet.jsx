import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { BookOpen, MessageSquare, Code2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import KnowledgeBaseTab from "@/components/klepet/KnowledgeBaseTab";
import ConversationsTab from "@/components/klepet/ConversationsTab";
import EmbedTab from "@/components/klepet/EmbedTab";
import WebsiteLearnCard from "@/components/klepet/WebsiteLearnCard";

// Spletni klepet: trije koraki, vedno vidni na vrhu. Vsak pove, ali je narejen in kaj je naslednje.
export default function Klepet() {
  const { business } = useBusiness();
  const [step, setStep] = useState(null);

  const { data: conversations = [], isLoading: l1 } = useQuery({
    queryKey: ["convs", business?.id],
    queryFn: () => base44.entities.ChatbotConversation.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: docs = [], isLoading: l2 } = useQuery({
    queryKey: ["kb", business?.id],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const real = conversations.filter((c) => c.visitor_id !== "lastnik_preizkus");
  const escalated = real.filter((c) => c.escalated && c.status !== "resolved").length;
  const learned = docs.length > 0;
  const installed = !!business?.chat_installed_url || real.length > 0;

  // Odpre prvi korak, ki še ni narejen.
  useEffect(() => {
    if (step || !business?.id || l1 || l2) return;
    setStep(!learned ? "learn" : !installed ? "install" : "convs");
  }, [business?.id, l1, l2, learned, installed, step]);

  const next = !learned ? "learn" : !installed ? "install" : null;
  const STEPS = [
    { key: "learn", icon: BookOpen, title: "Naučite klepet", text: "Prebere vašo spletno stran in odgovarja samo iz tega, kar tam piše.", done: learned, state: learned ? `Ve ${docs.length} ${docs.length === 1 ? "stvar" : "stvari"} o vas` : "Še ne ve ničesar" },
    { key: "install", icon: Code2, title: "Postavite ga na svojo stran", text: "Kopirate kratko kodo in jo prilepite na stran. Pokažemo, kam.", done: installed, state: installed ? (business?.chat_installed_url ? `Deluje na ${String(business.chat_installed_url).replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "Deluje — obiskovalci že pišejo") : "Še ni na vaši strani" },
    { key: "convs", icon: MessageSquare, title: "Spremljajte pogovore", text: "Vidite, kaj so obiskovalci vprašali in kdo je pustil kontakt.", done: real.length > 0, state: real.length ? `${real.length} ${real.length === 1 ? "pogovor" : "pogovorov"}` : "Še ni pogovorov", alert: escalated },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1>Spletni klepet</h1>
        <p className="text-muted-foreground mt-1">Okence na vaši spletni strani, ki obiskovalcem odgovarja namesto vas — tudi ponoči. Kdor pusti kontakt, se pojavi med strankami.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {STEPS.map((s, i) => {
          const active = step === s.key; const isNext = next === s.key;
          return (
            <button key={s.key} onClick={() => setStep(s.key)} className={`text-left rounded-2xl border-2 p-4 transition-all bg-card ${active ? "border-primary shadow-md" : "border-transparent shadow-sm hover:border-primary/30"}`}>
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${s.done ? "bg-emerald-100 text-emerald-700" : isNext ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{s.done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}</span>
                <p className="font-semibold flex-1">{s.title}</p>
                {isNext && !active && <span className="text-xs font-medium text-primary inline-flex items-center gap-1">Naredite zdaj<ArrowRight className="w-3.5 h-3.5" /></span>}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{s.text}</p>
              <p className={`text-xs font-medium mt-3 inline-flex items-center gap-1.5 ${s.done ? "text-emerald-700" : "text-muted-foreground"}`}>
                {s.state}
                {s.alert > 0 && <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 rounded-full px-2 py-0.5"><AlertTriangle className="w-3 h-3" />{s.alert} čaka na vas</span>}
              </p>
            </button>
          );
        })}
      </div>

      {step === "learn" && (
        <div className="grid xl:grid-cols-[minmax(0,480px)_1fr] gap-6 items-start">
          <div className="space-y-3">
            <WebsiteLearnCard docs={docs} />
            {learned && !installed && <button onClick={() => setStep("install")} className="w-full rounded-xl border border-primary/30 bg-accent/50 hover:bg-accent px-4 py-3 text-sm font-medium flex items-center gap-2">Naprej: postavite klepet na svojo stran<ArrowRight className="w-4 h-4 ml-auto text-primary" /></button>}
          </div>
          <div className="card-elevated p-5">
            <h3 className="text-lg">Kaj klepet ve</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Iz teh zapisov odgovarja. Kar manjka (npr. cenik, delovni čas), dodajte sami.</p>
            <KnowledgeBaseTab businessId={business?.id} />
          </div>
        </div>
      )}
      {step === "install" && <EmbedTab business={business} />}
      {step === "convs" && <ConversationsTab businessId={business?.id} />}
    </div>
  );
}
