import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, X, Pencil, Mail, Loader2, Inbox, Sparkles } from "lucide-react";
import { format } from "date-fns";
import DemoMessageModal from "@/components/prejeto/DemoMessageModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GenerateDraftButton from "@/components/prejeto/GenerateDraftButton";

const PILLAR_LABELS = {
  reactivation: "Reaktivacija",
  review_request: "Prošnja za oceno",
  review_response: "Odgovor na oceno",
  referral_ask: "Napotitev",
  web_form_lead: "Spletni obrazec",
  chatbot_handoff: "Klepet",
  assistant_action: "Asistent",
  booking_proposal: "Predlog termina",
  booking_confirmation: "Potrditev termina",
};

export default function Prejeto() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showDemo, setShowDemo] = useState(false);
  const [showHowAI, setShowHowAI] = useState(false);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["drafts-pending", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id, status: "pending" }),
    enabled: !!business?.id,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const leadsMap = Object.fromEntries(leads.map((l) => [l.id, l]));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DraftMessage.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts-pending", business?.id] }),
  });

  const approve = (msg) => updateMutation.mutate({ id: msg.id, data: { status: "approved" } });
  const skip = (msg) => updateMutation.mutate({ id: msg.id, data: { status: "skipped" } });
  const saveEdit = (msg) => {
    updateMutation.mutate({ id: msg.id, data: { ...editForm, status: "approved" } });
    setEditing(null);
  };

  const startEdit = (msg) => {
    setEditing(msg.id);
    setEditForm({ subject: msg.subject || "", body: msg.body || "" });
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prejeto</h1>
        <p className="text-muted-foreground mt-1">Sporočila, ki čakajo na vašo odobritev pred pošiljanjem.</p>
      </div>

      <DemoMessageModal open={showDemo} onOpenChange={setShowDemo} />

      <Dialog open={showHowAI} onOpenChange={setShowHowAI}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Kako AI ustvarja sporočila?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>AI analizira podatke vaših strank in samodejno pripravi personalizirana sporočila za različne scenarije:</p>
            <ul className="space-y-2 list-none">
              {[
                { icon: "🔁", title: "Reaktivacija", desc: "Stranke, ki niso obiskale vašega podjetja dlje časa, prejmejo prijazen opomnik." },
                { icon: "⭐", title: "Prošnja za oceno", desc: "Po zaključeni storitvi AI predlaga e-pošto, ki stranko povabi k pisanju Google ocene." },
                { icon: "📅", title: "Predlog termina", desc: "Ko stranka izrazi zanimanje za storitev, AI pripravi sporočilo s predlogom terminov." },
                { icon: "💬", title: "Klepet", desc: "Ko chatbot prepozna potencialno stranko, AI pripravi nadaljnje sporočilo za osebni stik." },
              ].map((item) => (
                <li key={item.title} className="flex gap-3 bg-muted/50 rounded-lg p-3">
                  <span className="text-lg">{item.icon}</span>
                  <div><p className="font-medium text-foreground">{item.title}</p><p>{item.desc}</p></div>
                </li>
              ))}
            </ul>
            <div className="bg-accent rounded-lg p-4 border border-primary/20">
              <p className="font-semibold text-foreground mb-1">Primer AI sporočila — Reaktivacija</p>
              <p className="italic text-xs leading-relaxed">"Pozdravljeni Ana, v Studio vas že dolgo nismo videli! 😊 Ker cenimo vaše zaupanje, smo za vas pripravili posebno ponudbo. Rezervirajte termin do konca meseca in prihranite. Veselimo se vašega obiska!"</p>
            </div>
            <p className="text-xs">Vsako sporočilo <strong className="text-foreground">najprej pregledate vi</strong> — AI ga nikoli ne pošlje brez vaše odobritve.</p>
          </div>
        </DialogContent>
      </Dialog>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-medium text-muted-foreground">Ni sporočil za pregled.</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Ko AI pripravi nova sporočila, se bodo pojavila tukaj.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDemo(true)}>
              <Mail className="w-4 h-4 mr-2" /> Glej primer sporočila
            </Button>
            <Button variant="outline" onClick={() => setShowHowAI(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Glej kako AI ustvarja sporočila
            </Button>
          </div>
        </div>
      ) : (
        <><div className="flex justify-end gap-2 mb-4">
          <GenerateDraftButton />
          <Button variant="outline" size="sm" onClick={() => setShowHowAI(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Kako AI ustvarja sporočila
          </Button>
        </div>
        <div className="space-y-4">
          {drafts.map((msg) => {
            const lead = leadsMap[msg.lead_id];
            const isEditing = editing === msg.id;

            return (
              <div key={msg.id} className="bg-card border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{PILLAR_LABELS[msg.pillar] || msg.pillar}</Badge>
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Mail className="w-3 h-3" /> E-pošta
                    </Badge>
                    {lead && <span className="text-sm font-medium text-foreground">→ {lead.name}</span>}
                    {msg.scheduled_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.scheduled_at), "d. M. yyyy HH:mm")}
                      </span>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Zadeva</Label>
                      <Input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vsebina</Label>
                      <Textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} className="h-40" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(msg)} disabled={updateMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Shrani in odobri
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Prekliči</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.subject && <p className="text-sm font-semibold mb-1">{msg.subject}</p>}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" onClick={() => approve(msg)} disabled={updateMutation.isPending}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Odobri
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(msg)}>
                        <Pencil className="w-4 h-4 mr-1" /> Uredi
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => skip(msg)} disabled={updateMutation.isPending}>
                        <X className="w-4 h-4 mr-1" /> Preskoči
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div></>
      )}
    </div>
  );
}