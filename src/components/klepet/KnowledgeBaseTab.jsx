import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Storitve", "Cene", "Termini", "Pravila", "FAQ", "Kontakt"];

const CATEGORY_COLORS = {
  Storitve: "bg-blue-100 text-blue-700",
  Cene: "bg-emerald-100 text-emerald-700",
  Termini: "bg-violet-100 text-violet-700",
  Pravila: "bg-amber-100 text-amber-700",
  FAQ: "bg-orange-100 text-orange-700",
  Kontakt: "bg-pink-100 text-pink-700",
};

const EMPTY_FORM = { title: "", category: "", content: "", active: true };

function DocFormModal({ open, onClose, onSave, initial, isSaving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  React.useEffect(() => {
    setForm(initial || EMPTY_FORM);
  }, [initial, open]);

  const isEdit = !!initial?.id;
  const charsLeft = 5000 - (form.content?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Uredi dokument" : "Dodaj dokument"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label>Naslov *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Npr. Delovni čas, Cenik, Pogosta vprašanja"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategorija</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Izberite kategorijo…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Vsebina *</Label>
              <span className={`text-xs ${charsLeft < 200 ? "text-amber-500" : "text-muted-foreground"}`}>
                {charsLeft} znakov preostalo
              </span>
            </div>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value.slice(0, 5000) })}
              placeholder="Vnesite besedilo, ki ga bo chatbot poznal. Podpira Markdown oblikovanje."
              className="h-48 resize-none font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="active-check"
              checked={!!form.active}
              onCheckedChange={(v) => setForm({ ...form, active: !!v })}
            />
            <Label htmlFor="active-check" className="cursor-pointer font-normal">Dokument je aktiven (chatbot ga bo uporabljal)</Label>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Prekliči</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.title || !form.content || isSaving}
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isEdit ? "Shrani spremembe" : "Shrani dokument"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function KnowledgeBaseTab({ businessId }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["kb", businessId],
    queryFn: () => base44.entities.KnowledgeBase.filter({ business_id: businessId }),
    enabled: !!businessId,
  });

  const createDoc = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeBase.create({ ...data, business_id: businessId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb", businessId] });
      setShowForm(false);
      toast.success("Dokument shranjen");
    },
  });

  const updateDoc = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KnowledgeBase.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb", businessId] });
      setEditDoc(null);
      toast.success("Dokument posodobljen");
    },
  });

  const toggleDoc = useMutation({
    mutationFn: ({ id, active }) => base44.entities.KnowledgeBase.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb", businessId] }),
  });

  const deleteDoc = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeBase.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb", businessId] });
      setDeleteTarget(null);
      toast.success("Dokument izbrisan");
    },
  });

  const handleSave = (form) => {
    if (editDoc) {
      updateDoc.mutate({ id: editDoc.id, data: form });
    } else {
      createDoc.mutate(form);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const activeCount = docs.filter((d) => d.active).length;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {docs.length} {docs.length === 1 ? "dokument" : "dokumentov"} · {activeCount} aktivnih
        </p>
        <Button onClick={() => { setEditDoc(null); setShowForm(true); }} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Dodaj dokument
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Baza znanja je prazna</p>
          <p className="text-xs text-muted-foreground mt-1">Dodajte dokumente, da naučite chatbota o vašem podjetju.</p>
          <Button size="sm" className="mt-4" onClick={() => { setEditDoc(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Dodaj prvi dokument
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const catColor = CATEGORY_COLORS[doc.category] || "bg-secondary text-secondary-foreground";
            return (
              <div key={doc.id} className={`bg-card border rounded-xl p-4 shadow-sm transition-opacity ${!doc.active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="font-medium text-sm">{doc.title}</p>
                      {doc.category && (
                        <Badge className={`text-xs border-0 ${catColor}`}>{doc.category}</Badge>
                      )}
                      {!doc.active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Neaktivno</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {doc.content?.slice(0, 100)}{doc.content?.length > 100 ? "…" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={!!doc.active}
                      onCheckedChange={(v) => toggleDoc.mutate({ id: doc.id, active: v })}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditDoc(doc); setShowForm(true); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Uredi
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(doc)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Izbriši
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <DocFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditDoc(null); }}
        onSave={handleSave}
        initial={editDoc}
        isSaving={createDoc.isPending || updateDoc.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbriši dokument?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokument <strong>"{deleteTarget?.title}"</strong> bo trajno izbrisan. Tega dejanja ni mogoče razveljaviti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDoc.mutate(deleteTarget.id)}
              disabled={deleteDoc.isPending}
            >
              {deleteDoc.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Izbriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}