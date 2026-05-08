import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sunrise, MessageSquare, Calendar, Send, Loader2, Bot } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

function BriefingTab({ business }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: briefings = [], isLoading } = useQuery({
    queryKey: ["briefings", business?.id],
    queryFn: () => base44.entities.AssistantBriefing.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const todaysBriefing = briefings.find((b) => b.date === today);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      {!todaysBriefing ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Sunrise className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-medium text-muted-foreground">Jutro poročilo za danes še ni pripravljeno.</p>
          <p className="text-sm text-muted-foreground mt-1">Vsak dan zjutraj bo AI pripravil povzetek za vas.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-6 shadow-sm prose prose-sm max-w-none">
          <div className="flex items-center gap-2 mb-4 not-prose">
            <Sunrise className="w-5 h-5 text-amber-500" />
            <span className="font-semibold">Jutro poročilo — {format(new Date(todaysBriefing.date), "d. M. yyyy")}</span>
          </div>
          <ReactMarkdown>{todaysBriefing.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ChatTab({ business, user }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState([]);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: sessions = [] } = useQuery({
    queryKey: ["assistant-chat", business?.id, today],
    queryFn: () => base44.entities.AssistantChat.filter({ business_id: business.id, session_date: today }),
    enabled: !!business?.id,
  });

  const session = sessions[0];
  const messages = session?.messages || localMessages;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input, ts: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg];
    setLocalMessages(updatedMessages);
    setInput("");
    setThinking(true);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Si osebni AI asistent slovenskega podjetja "${business?.name}". Odgovarjaj formalno (vikanje) v slovenščini.
      
Kontekst podjetja:
- Dejavnost: ${business?.industry_template || "splošno"}
- Storitve: ${business?.services || "—"}
- Delovni čas: ${business?.hours || "—"}
- Trenutna ponudba: ${business?.current_offer || "—"}

Zgodovina pogovora:
${updatedMessages.map((m) => `${m.role === "user" ? "Lastnik" : "Asistent"}: ${m.content}`).join("\n")}

Odgovori na zadnje sporočilo lastnika.`,
    });

    const assistantMsg = { role: "assistant", content: result, ts: new Date().toISOString() };
    const finalMessages = [...updatedMessages, assistantMsg];

    if (session) {
      await base44.entities.AssistantChat.update(session.id, { messages: finalMessages });
    } else {
      await base44.entities.AssistantChat.create({ business_id: business.id, user_id: user?.id, session_date: today, messages: finalMessages });
    }

    setLocalMessages(finalMessages);
    queryClient.invalidateQueries({ queryKey: ["assistant-chat", business?.id, today] });
    setThinking(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="font-medium text-muted-foreground">Pozdravljen/a! Kako vam lahko pomagam danes?</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {msg.role === "assistant" ? <ReactMarkdown className="prose prose-sm max-w-none">{msg.content}</ReactMarkdown> : msg.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-muted px-4 py-3 rounded-2xl flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Razmišljam...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vnesite sporočilo..." onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} disabled={thinking} />
        <Button onClick={sendMessage} disabled={!input.trim() || thinking}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function BookingsTab({ business }) {
  const { data: proposals = [], isLoading: propLoading } = useQuery({
    queryKey: ["proposals", business?.id],
    queryFn: () => base44.entities.BookingProposal.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: confirmed = [], isLoading: confLoading } = useQuery({
    queryKey: ["confirmed-bookings", business?.id],
    queryFn: () => base44.entities.ConfirmedBooking.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const STATUS_COLORS = { pending: "bg-amber-100 text-amber-700", accepted: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700", expired: "bg-gray-100 text-gray-500" };
  const STATUS_LABELS = { pending: "Čaka", accepted: "Sprejet", rejected: "Zavrnjen", expired: "Potekel" };

  if (propLoading || confLoading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Predlogi terminov</h3>
        {proposals.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Ni predlogov terminov.</p> : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{p.service_requested || "Termin"}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                </div>
                <div className="space-y-1">
                  {(p.proposed_slots || []).map((slot, i) => (
                    <div key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${p.selected_slot?.start_datetime === slot.start_datetime ? "border-primary bg-accent" : "border-border bg-muted/30"}`}>
                      {slot.label || (slot.start_datetime ? format(new Date(slot.start_datetime), "d. M. yyyy HH:mm") : "—")}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-3">Potrjeni termini</h3>
        {confirmed.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Ni potrjenih terminov.</p> : (
          <div className="space-y-3">
            {confirmed.map((b) => (
              <div key={b.id} className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="font-medium text-sm">{b.booked_at ? format(new Date(b.booked_at), "d. M. yyyy HH:mm") : "—"}</p>
                  <p className="text-xs text-muted-foreground">{b.duration_minutes} minut{b.notes ? ` · ${b.notes}` : ""}</p>
                </div>
                <Badge className={b.status === "confirmed" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                  {b.status === "confirmed" ? "Potrjeno" : b.status === "cancelled" ? "Preklicano" : "Zaključeno"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Asistent() {
  const { business, user } = useBusiness();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Asistent</h1>
        <p className="text-muted-foreground mt-1">Vaš osebni AI asistent za upravljanje terminov in komunikacije.</p>
      </div>
      <Tabs defaultValue="briefing">
        <TabsList className="mb-6">
          <TabsTrigger value="briefing" className="flex items-center gap-2"><Sunrise className="w-4 h-4" /> Jutro</TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Klepet</TabsTrigger>
          <TabsTrigger value="bookings" className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Termini</TabsTrigger>
        </TabsList>
        <TabsContent value="briefing"><BriefingTab business={business} /></TabsContent>
        <TabsContent value="chat"><ChatTab business={business} user={user} /></TabsContent>
        <TabsContent value="bookings"><BookingsTab business={business} /></TabsContent>
      </Tabs>
    </div>
  );
}