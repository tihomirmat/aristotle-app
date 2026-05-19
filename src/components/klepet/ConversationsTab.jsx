import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import ConversationDetail from "./ConversationDetail";

const STATUS_CONFIG = {
  active: { label: "Aktiven", className: "bg-blue-100 text-blue-700 border-0" },
  escalated: { label: "Eskaliran", className: "bg-red-100 text-red-700 border-0" },
  resolved: { label: "Rešen", className: "bg-emerald-100 text-emerald-700 border-0" },
};

export default function ConversationsTab({ businessId }) {
  const queryClient = useQueryClient();
  const [selectedConv, setSelectedConv] = useState(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["convs", businessId],
    queryFn: () => base44.entities.ChatbotConversation.filter({ business_id: businessId }, "-started_at", 50),
    enabled: !!businessId,
  });

  const resolveConv = useMutation({
    mutationFn: (id) => base44.entities.ChatbotConversation.update(id, { status: "resolved" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["convs", businessId] }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const escalated = conversations.filter(c => c.escalated && c.status !== "resolved");
  const others = conversations.filter(c => !c.escalated || c.status === "resolved");

  return (
    <>
      {conversations.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Ni pogovorov</p>
          <p className="text-xs text-muted-foreground mt-1">Pogovori se bodo pojavili, ko bo chatbot widget aktiven na vaši strani.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalated.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">Zahtevajo pozornost ({escalated.length})</span>
              </div>
              <div className="space-y-2">
                {escalated.map(conv => (
                  <ConvRow key={conv.id} conv={conv} onSelect={setSelectedConv} onResolve={() => resolveConv.mutate(conv.id)} />
                ))}
              </div>
            </div>
          )}

          <div>
            {escalated.length > 0 && <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Ostali pogovori</p>}
            <div className="space-y-2">
              {others.map(conv => (
                <ConvRow key={conv.id} conv={conv} onSelect={setSelectedConv} />
              ))}
            </div>
          </div>
        </div>
      )}

      <ConversationDetail conversation={selectedConv} onClose={() => setSelectedConv(null)} />
    </>
  );
}

function ConvRow({ conv, onSelect, onResolve }) {
  const statusCfg = STATUS_CONFIG[conv.status] || STATUS_CONFIG.active;
  const msgCount = (conv.messages || []).length;

  return (
    <div className="bg-card border rounded-xl p-4 hover:bg-muted/20 transition-colors shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button className="flex-1 flex items-center gap-3 text-left" onClick={() => onSelect(conv)}>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{conv.visitor_email || conv.visitor_id || "Neznan obiskovalec"}</span>
              <Badge className={`text-xs ${statusCfg.className}`}>{statusCfg.label}</Badge>
              {conv.converted && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Pretvorjen</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {msgCount} sporočil{msgCount !== 1 ? "" : "o"}
              {conv.started_at && ` · ${format(new Date(conv.started_at), "d. M. yyyy HH:mm")}`}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
        {onResolve && conv.status !== "resolved" && (
          <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={onResolve}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Reši
          </Button>
        )}
      </div>
    </div>
  );
}