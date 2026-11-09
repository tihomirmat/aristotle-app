import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { MessageSquare, BookOpen, Paintbrush } from "lucide-react";
import { HelperHeader, PillTabs } from "@/components/pomocniki/HelperKit";
import ChatSetup from "@/components/klepet/ChatSetup";
import ChatInbox from "@/components/klepet/ChatInbox";
import KnowledgeBaseTab from "@/components/klepet/KnowledgeBaseTab";
import WebsiteLearnCard from "@/components/klepet/WebsiteLearnCard";

// Spletni klepet. Dokler ni nastavljen: čarovnik v 4 korakih. Ko deluje: predal pogovorov.
export default function Klepet() {
  const { business } = useBusiness();
  const [tab, setTab] = useState(null);
  const [setupStep, setSetupStep] = useState(null);

  const { data: conversations = [], isLoading: l1 } = useQuery({
    queryKey: ["convs", business?.id],
    queryFn: () => base44.entities.ChatbotConversation.filter({ business_id: business.id }, "-started_at", 100),
    enabled: !!business?.id,
  });
  const { data: docs = [], isLoading: l2 } = useQuery({
    queryKey: ["kb", business?.id],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const real = conversations.filter((c) => c.visitor_id !== "lastnik_preizkus");
  const waiting = real.filter((c) => c.escalated && c.status !== "resolved").length;
  const learned = docs.length > 0;
  const installed = !!business?.chat_installed_url || real.length > 0;
  const ready = learned && installed;

  useEffect(() => {
    if (tab || !business?.id || l1 || l2) return;
    setTab(ready ? "inbox" : "setup");
  }, [business?.id, l1, l2, ready, tab]);

  const openSetup = (step) => { setSetupStep(step); setTab("setup"); };

  return (
    <div className="space-y-6">
      <HelperHeader icon={MessageSquare} tone="orange" title="Spletni klepet" subtitle="Okence na vaši spletni strani, ki obiskovalcem odgovarja namesto vas — tudi ponoči."
        ok={ready} statusLabel={ready ? "Deluje na vaši strani" : learned ? "Še ni na vaši strani" : "Še ni nastavljen"}>
        {ready && <PillTabs value={tab} onChange={(k) => (k === "setup" ? openSetup("look") : setTab(k))} tabs={[{ key: "inbox", label: "Pogovori", icon: MessageSquare, badge: waiting }, { key: "kb", label: "Kaj klepet ve", icon: BookOpen }, { key: "setup", label: "Videz in namestitev", icon: Paintbrush }]} />}
      </HelperHeader>

      {tab === "setup" && <ChatSetup key={setupStep || "auto"} business={business} docs={docs} installed={installed} initialStep={setupStep} onFinish={() => setTab("inbox")} />}
      {tab === "inbox" && <ChatInbox business={business} conversations={real} onSetup={() => openSetup("test")} />}
      {tab === "kb" && (
        <div className="grid xl:grid-cols-[minmax(0,460px)_1fr] gap-6 items-start">
          <div className="card-elevated p-6">
            <h3 className="text-lg">Preberi spletno stran znova</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Ko na strani spremenite cene ali storitve, jo preberite znova. Ročno dodani zapisi ostanejo.</p>
            <WebsiteLearnCard docs={docs} />
          </div>
          <div className="card-elevated p-6">
            <h3 className="text-lg">Kaj klepet ve</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Iz teh zapisov odgovarja. Kar manjka (npr. cenik, delovni čas), dodajte sami.</p>
            <KnowledgeBaseTab businessId={business?.id} />
          </div>
        </div>
      )}
    </div>
  );
}
