import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, FileText, Tag } from "lucide-react";

export default function KnowledgeBaseTab({ businessId }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", content: "", category: "" });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["kb", businessId],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: businessId }),
    enabled: !!businessId,
  });

  const createDoc = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeBase.create({ ...data, business_id: businessId, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb", businessId] });
      setShowAdd(false);
      setNewDoc({ title: "", content: "", category: "" });
    },
  });

  const toggleDoc = useMutation({
    mutationFn: ({ id, active }) => base44.entities.KnowledgeBase.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb", businessId] }),
  });

  const deleteDoc = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeBase.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb", businessId] }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{docs.length} dokument{docs.length !== 1 ? "i" : ""} · {docs.filter(d => d.active).length} aktivnih</p>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Dodaj dokument
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Baza znanja je prazna</p>
          <p className="text-xs text-muted-foreground mt-1">Dodajte dokumente, da naučite chatbota o vašem podjetju.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-card border rounded-xl p-4 flex items-start justify-between gap-4 shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-medium text-sm">{doc.title}</p>
                  {doc.category && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />{doc.category}
                    </Badge>
                  )}
                  {!doc.active && <Badge variant="outline" className="text-xs text-muted-foreground">Neaktivno</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{doc.content}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch checked={!!doc.active} onCheckedChange={(v) => toggleDoc.mutate({ id: doc.id, active: v })} />
                <Button
                  variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteDoc.mutate(doc.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Dodaj dokument v bazo znanja</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Naslov *</Label>
              <Input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Npr. Delovni čas, Cenik, Storitve" />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Input value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })} placeholder="Npr. splošno, storitve, cene, FAQ" />
            </div>
            <div className="space-y-1.5">
              <Label>Vsebina *</Label>
              <Textarea
                value={newDoc.content}
                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                placeholder="Vnesite besedilo, ki ga bo chatbot poznal..."
                className="h-40 resize-none"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createDoc.mutate(newDoc)}
              disabled={!newDoc.title || !newDoc.content || createDoc.isPending}
            >
              {createDoc.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Shrani dokument
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}