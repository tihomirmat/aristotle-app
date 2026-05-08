import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, BookOpen, MessageSquare, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function Klepet() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", content: "", category: "" });
  const [selectedConv, setSelectedConv] = useState(null);

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["kb", business?.id],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ["convs", business?.id],
    queryFn: () => base44.entities.ChatbotConversation.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const createDoc = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeBase.create({ ...data, business_id: business.id, active: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["kb", business?.id] }); setShowAdd(false); setNewDoc({ title: "", content: "", category: "" }); },
  });

  const toggleDoc = useMutation({
    mutationFn: ({ id, active }) => base44.entities.KnowledgeBase.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb", business?.id] }),
  });

  const deleteDoc = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeBase.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb", business?.id] }),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Klepetalni pomočnik</h1>
        <p className="text-muted-foreground mt-1">Upravljajte znanje chatbota in pregledujte pogovore.</p>
      </div>

      <Tabs defaultValue="kb">
        <TabsList className="mb-6">
          <TabsTrigger value="kb" className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Baza znanja</TabsTrigger>
          <TabsTrigger value="convs" className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Pogovori</TabsTrigger>
        </TabsList>

        <TabsContent value="kb">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-2" /> Dodaj dokument
            </Button>
          </div>
          {docsLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
            <div className="space-y-3">
              {docs.length === 0 && <p className="text-center py-16 text-muted-foreground text-sm">Baza znanja je prazna. Dodajte dokument, da naučite chatbota.</p>}
              {docs.map((doc) => (
                <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-start justify-between gap-4 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{doc.title}</p>
                      {doc.category && <Badge variant="outline" className="text-xs">{doc.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{doc.content}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch checked={doc.active} onCheckedChange={(v) => toggleDoc.mutate({ id: doc.id, active: v })} />
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteDoc.mutate(doc.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="convs">
          {convsLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
            <div className="space-y-3">
              {conversations.length === 0 && <p className="text-center py-16 text-muted-foreground text-sm">Ni pogovorov. Pogovori se bodo pojavili, ko bo klepetalni widget aktiven.</p>}
              {conversations.map((conv) => (
                <div key={conv.id} className="bg-card border rounded-xl p-4 cursor-pointer hover:bg-muted/30 transition-colors shadow-sm" onClick={() => setSelectedConv(conv)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {conv.flagged_for_review && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      <span className="text-sm font-medium">{conv.visitor_email || conv.visitor_id || "Neznan obiskovalec"}</span>
                      {conv.converted && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Pretvorjen/a</Badge>}
                      {conv.escalated && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Eskaliran/a</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{conv.started_at ? format(new Date(conv.started_at), "d. M. yyyy HH:mm") : "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{(conv.messages || []).length} sporočil</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Dodaj dokument v bazo znanja</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2"><Label>Naslov *</Label><Input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Npr. Delovni čas" /></div>
            <div className="space-y-2"><Label>Kategorija</Label><Input value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })} placeholder="Npr. splošno, storitve, cene" /></div>
            <div className="space-y-2"><Label>Vsebina *</Label><Textarea value={newDoc.content} onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })} placeholder="Vnesite besedilo, ki ga bo chatbot poznal..." className="h-40" /></div>
            <Button className="w-full" onClick={() => createDoc.mutate(newDoc)} disabled={!newDoc.title || !newDoc.content || createDoc.isPending}>
              {createDoc.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Shrani dokument
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedConv} onOpenChange={() => setSelectedConv(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pogovor</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {(selectedConv?.messages || []).map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}