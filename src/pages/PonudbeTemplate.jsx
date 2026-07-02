import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Copy, Star, Plus, X, Loader2, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const KIND_LABELS = { service: "Storitev", product: "Izdelek", saas: "SaaS", custom: "Po meri" };
const VAR_TYPES = ["text","number","currency","date","email","phone","textarea","select","table"];
const TODAY = new Date().toLocaleDateString("sl-SI");

export default function PonudbeTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const isNew = id === "novo";

  const [form, setForm] = useState({ name: "Nova ponudba", kind: "service", body_markdown: "## Ponudba\n\nSpoštovani {{stranka_naziv}},\n\npripravljamo vam ponudbo za {{storitev}}.\n\n## Cena\n\nCena: {{cena}} EUR\n\n## Kontakt\n\n{{podjetje_naziv}}", variables: [] });
  const [showVarForm, setShowVarForm] = useState(false);
  const [newVar, setNewVar] = useState({ key: "", label: "", type: "text", required: true, placeholder: "", default: "" });
  const [previewText, setPreviewText] = useState("");

  const { data: template, isLoading } = useQuery({
    queryKey: ["offer-template", id],
    queryFn: () => base44.entities.OfferTemplate.filter({ id }),
    enabled: !isNew && !!id,
    select: (d) => d[0],
  });

  useEffect(() => {
    if (template) {
      setForm({ name: template.name, kind: template.kind, body_markdown: template.body_markdown || "", variables: template.variables || [] });
    }
  }, [template]);

  // Generate preview
  useEffect(() => {
    let preview = form.body_markdown;
    const dummyVars = { stranka_naziv: "Primer d.o.o.", storitev: "Svetovanje", cena: "1.500", podjetje_naziv: business?.name || "Vaše podjetje", datum: TODAY };
    form.variables.forEach(v => { dummyVars[v.key] = v.default || v.placeholder || `(${v.label})`; });
    preview = preview.replace(/\{\{(\w+)\}\}/g, (_, k) => dummyVars[k] || `{{${k}}}`);
    setPreviewText(preview);
  }, [form, business]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return base44.entities.OfferTemplate.create({ ...form, business_id: business.id, source: "manual" });
      }
      return base44.entities.OfferTemplate.update(id, form);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      toast.success("Template je shranjen!");
      if (isNew) navigate(`/ponudbe/templati/${saved.id}`);
    },
    onError: (err) => toast.error("Napaka: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.OfferTemplate.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["offer-templates"] }); navigate("/ponudbe"); },
  });

  const setDefaultMutation = useMutation({
    mutationFn: () => base44.entities.OfferTemplate.update(id, { is_default: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["offer-templates"] }); toast.success("Nastavljeno kot privzeto!"); },
  });

  const cloneMutation = useMutation({
    mutationFn: () => base44.entities.OfferTemplate.create({ ...form, business_id: business.id, name: form.name + " (kopija)", source: "cloned", is_default: false }),
    onSuccess: (cloned) => { queryClient.invalidateQueries({ queryKey: ["offer-templates"] }); navigate(`/ponudbe/templati/${cloned.id}`); toast.success("Template je kloniran!"); },
  });

  const addVar = () => {
    if (!newVar.key || !newVar.label) { toast.error("Ključ in oznaka sta obvezna"); return; }
    setForm(f => ({ ...f, variables: [...f.variables, { ...newVar }] }));
    setNewVar({ key: "", label: "", type: "text", required: true, placeholder: "", default: "" });
    setShowVarForm(false);
  };

  const removeVar = (key) => setForm(f => ({ ...f, variables: f.variables.filter(v => v.key !== key) }));

  if (!isNew && isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/ponudbe"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" />Nazaj</Button></Link>
          <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="font-semibold text-base w-64" />
          <Select value={form.kind} onValueChange={(v) => setForm(f => ({ ...f, kind: v }))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="outline" size="sm" className="gap-1" onClick={() => cloneMutation.mutate()} disabled={cloneMutation.isPending}><Copy className="w-3.5 h-3.5" />Dupliciraj</Button>}
          {!isNew && <Button variant="outline" size="sm" className="gap-1" onClick={() => setDefaultMutation.mutate()} disabled={setDefaultMutation.isPending || template?.is_default}><Star className="w-3.5 h-3.5" />{template?.is_default ? "Privzeto" : "Nastavi kot privzeto"}</Button>}
          {!isNew && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" />Izbriši</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Izbriši template?</AlertDialogTitle><AlertDialogDescription>Tega dejanja ni mogoče razveljaviti.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Prekliči</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate()}>Izbriši</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Shrani
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Telo template-a (Markdown, spremenljivke: {'{{var_key}}'})</label>
            <Textarea
              value={form.body_markdown}
              onChange={(e) => setForm(f => ({ ...f, body_markdown: e.target.value }))}
              className="font-mono text-xs h-80"
              placeholder="## Ponudba&#10;&#10;Spoštovani {{stranka_naziv}}..."
            />
          </div>

          {/* Variables list */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Spremenljivke template-a</h3>
              <Button size="sm" variant="outline" onClick={() => setShowVarForm(!showVarForm)} className="gap-1 h-7 text-xs">
                <Plus className="w-3 h-3" />Dodaj
              </Button>
            </div>
            {showVarForm && (
              <div className="bg-muted/40 rounded-lg p-3 space-y-2 border">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="ključ (npr. stranka_naziv)" value={newVar.key} onChange={(e) => setNewVar(v => ({ ...v, key: e.target.value.replace(/\s/g, "_") }))} className="text-xs h-8" />
                  <Input placeholder="Oznaka (npr. Naziv stranke)" value={newVar.label} onChange={(e) => setNewVar(v => ({ ...v, label: e.target.value }))} className="text-xs h-8" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className="border rounded-md px-2 py-1 text-xs bg-background" value={newVar.type} onChange={(e) => setNewVar(v => ({ ...v, type: e.target.value }))}>
                    {VAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input placeholder="Privzeta vrednost" value={newVar.default} onChange={(e) => setNewVar(v => ({ ...v, default: e.target.value }))} className="text-xs h-8" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addVar} className="h-7 text-xs">Dodaj</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowVarForm(false)} className="h-7 text-xs">Prekliči</Button>
                </div>
              </div>
            )}
            {form.variables.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ni spremenljivk. Dodajte jih za dinamične ponudbe.</p>
            ) : (
              <div className="space-y-1.5">
                {form.variables.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-primary">{`{{${v.key}}}`}</code>
                      <span className="text-xs text-muted-foreground">{v.label}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4">{v.type}</Badge>
                      {v.required && <Badge className="text-[10px] px-1.5 h-4 bg-red-50 text-red-600 border-0">*</Badge>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeVar(v.key)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="border rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Predogled (z demo podatki)</p>
          <div className="prose prose-sm max-w-none text-sm">
            {previewText.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold mt-4 mb-1">{line.slice(3)}</h2>;
              if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-sm mb-1">{line}</p>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}