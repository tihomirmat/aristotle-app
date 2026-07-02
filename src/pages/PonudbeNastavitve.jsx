import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Clock, Trash2, Plus, X, Loader2, Eye, EyeOff, Link } from "lucide-react";
import { toast } from "sonner";
import { offerBYOK } from "@/functions/offerBYOK";
import { format } from "date-fns";

const PROVIDERS = [
  { key: "anthropic", label: "Anthropic", models: ["claude-opus-4-7", "claude-sonnet-4-6"] },
  { key: "openai", label: "OpenAI", models: ["gpt-5", "gpt-5-mini"] },
  { key: "google", label: "Google Gemini", models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
];

const VAR_TYPES = ["text","number","currency","date","email","phone","textarea"];

const DEFAULT_GLOBAL_VARS = [
  { key: "podjetje_naziv", label: "Naziv podjetja", type: "text" },
  { key: "podjetje_naslov", label: "Naslov podjetja", type: "text" },
  { key: "podjetje_davcna", label: "Davčna številka", type: "text" },
  { key: "podjetje_iban", label: "IBAN", type: "text" },
  { key: "podpisnik_ime", label: "Ime podpisnika", type: "text" },
  { key: "podpisnik_funkcija", label: "Funkcija podpisnika", type: "text" },
  { key: "brand_primarna_barva", label: "Primarna barva", type: "text" },
  { key: "brand_sekundarna_barva", label: "Sekundarna barva", type: "text" },
  { key: "brand_voice", label: "Glas znamke", type: "text" },
];

export default function PonudbeNastavitve() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  // Global vars state
  const [globalVars, setGlobalVars] = useState(() => {
    const bv = business?.offers_global_vars || {};
    return DEFAULT_GLOBAL_VARS.map(v => ({ ...v, value: bv[v.key] || business?.[v.key.replace("podjetje_", "")] || "" }));
  });
  const [customVars, setCustomVars] = useState([]);
  const [showAddVar, setShowAddVar] = useState(false);
  const [newVar, setNewVar] = useState({ key: "", label: "", type: "text", value: "" });

  // BYOK state
  const [byokProvider, setByokProvider] = useState(business?.offers_byok_provider || "anthropic");
  const [byokKey, setByokKey] = useState("");
  const [byokModel, setByokModel] = useState(business?.offers_byok_model || "");
  const [showKey, setShowKey] = useState(false);
  const [byokLoading, setByokLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const providerModels = PROVIDERS.find(p => p.key === byokProvider)?.models || [];

  const saveGlobalVarsMutation = useMutation({
    mutationFn: () => {
      const obj = {};
      [...globalVars, ...customVars].forEach(v => { if (v.value) obj[v.key] = v.value; });
      return base44.entities.Business.update(business.id, { offers_global_vars: obj });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["business"] }); toast.success("Globalne spremenljivke so shranjene!"); },
    onError: (err) => toast.error("Napaka: " + err.message),
  });

  const handleSaveBYOK = async () => {
    if (!byokKey) { toast.error("Vnesite API ključ"); return; }
    if (!byokModel) { toast.error("Izberite model"); return; }
    setByokLoading(true);
    try {
      const res = await offerBYOK({ action: "save", business_id: business.id, provider: byokProvider, api_key: byokKey, model: byokModel });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ["business"] });
      setByokKey("");
      toast.success(`Ključ je shranjen (zadnje 4 znake: ****${res.data?.last4})`);
    } catch (err) {
      toast.error("Napaka: " + err.message);
    } finally {
      setByokLoading(false);
    }
  };

  const handleTestBYOK = async () => {
    setTestLoading(true);
    try {
      const res = await offerBYOK({ action: "test", business_id: business.id });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Povezava je uspešna!");
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.error("Napaka: " + err.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleRemoveBYOK = async () => {
    try {
      await offerBYOK({ action: "remove", business_id: business.id });
      queryClient.invalidateQueries({ queryKey: ["business"] });
      setByokKey("");
      toast.success("BYOK ključ je bil odstranjen");
    } catch (err) {
      toast.error("Napaka: " + err.message);
    }
  };

  const hasByok = business?.offers_byok_provider && business?.offers_byok_key_encrypted;
  const isVerified = hasByok && business?.offers_byok_verified_at;
  const hasError = hasByok && business?.offers_byok_last_error;

  const addCustomVar = () => {
    if (!newVar.key || !newVar.label) { toast.error("Ključ in oznaka sta obvezna"); return; }
    setCustomVars(v => [...v, { ...newVar }]);
    setNewVar({ key: "", label: "", type: "text", value: "" });
    setShowAddVar(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nastavitve Generatorja ponudb</h1>
        <p className="text-muted-foreground mt-1">Upravljajte globalne spremenljivke, LLM račun in nastavitve izvoza.</p>
      </div>

      <Tabs defaultValue="vars">
        <TabsList>
          <TabsTrigger value="vars">Globalne spremenljivke</TabsTrigger>
          <TabsTrigger value="byok">Moj LLM račun (BYOK)</TabsTrigger>
          <TabsTrigger value="export">Izvoz</TabsTrigger>
        </TabsList>

        {/* Global vars */}
        <TabsContent value="vars" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">Te vrednosti so predizpolnjene v vseh ponudbah. Per-template vrednosti jih preglasijo.</p>
          <div className="border rounded-xl p-4 bg-card space-y-3">
            {globalVars.map((v, i) => (
              <div key={v.key} className="flex items-center gap-3">
                <div className="w-36 shrink-0">
                  <p className="text-xs font-medium">{v.label}</p>
                  <code className="text-[10px] text-muted-foreground">{`{{${v.key}}}`}</code>
                </div>
                <Input
                  className="text-sm flex-1"
                  value={v.value}
                  onChange={(e) => setGlobalVars(gv => gv.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder={`Vrednost za ${v.label.toLowerCase()}`}
                />
              </div>
            ))}
            {customVars.map((v, i) => (
              <div key={v.key} className="flex items-center gap-3">
                <div className="w-36 shrink-0">
                  <p className="text-xs font-medium">{v.label}</p>
                  <code className="text-[10px] text-muted-foreground">{`{{${v.key}}}`}</code>
                </div>
                <Input className="text-sm flex-1" value={v.value} onChange={(e) => setCustomVars(cv => cv.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => setCustomVars(cv => cv.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>

          {showAddVar && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="ključ" value={newVar.key} onChange={(e) => setNewVar(v => ({ ...v, key: e.target.value.replace(/\s/g, "_") }))} className="text-xs h-8" />
                <Input placeholder="Oznaka" value={newVar.label} onChange={(e) => setNewVar(v => ({ ...v, label: e.target.value }))} className="text-xs h-8" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addCustomVar} className="h-7 text-xs">Dodaj</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddVar(false)} className="h-7 text-xs">Prekliči</Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddVar(true)} className="gap-1"><Plus className="w-3 h-3" />Dodaj spremenljivko</Button>
            <Button onClick={() => saveGlobalVarsMutation.mutate()} disabled={saveGlobalVarsMutation.isPending} className="gap-1">
              {saveGlobalVarsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Shrani
            </Button>
          </div>
        </TabsContent>

        {/* BYOK */}
        <TabsContent value="byok" className="space-y-5 mt-4">
          {/* Status */}
          {hasByok && (
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${isVerified && !hasError ? "bg-emerald-50 border-emerald-200" : hasError ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
              {isVerified && !hasError ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : hasError ? <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" /> : <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{isVerified && !hasError ? `Aktiven · zadnja preverba ${business.offers_byok_verified_at ? format(new Date(business.offers_byok_verified_at), "d. M. yyyy HH:mm") : "—"}` : hasError ? `Napaka: ${business.offers_byok_last_error}` : "Ni preverjen"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{business.offers_byok_provider} · {business.offers_byok_model}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={handleTestBYOK} disabled={testLoading} className="h-7 text-xs">
                  {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Preizkusi povezavo"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleRemoveBYOK} className="h-7 text-xs text-destructive hover:text-destructive gap-1"><Trash2 className="w-3 h-3" />Odstrani</Button>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="border rounded-xl p-5 bg-card space-y-4">
            <h3 className="font-semibold">Priklopi LLM račun</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Ponudnik</label>
                <Select value={byokProvider} onValueChange={(v) => { setByokProvider(v); setByokModel(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Model</label>
                <Select value={byokModel} onValueChange={setByokModel}>
                  <SelectTrigger><SelectValue placeholder="Izberite model" /></SelectTrigger>
                  <SelectContent>{providerModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">API ključ</label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={byokKey}
                    onChange={(e) => setByokKey(e.target.value)}
                    placeholder={hasByok ? "••••••••••••••••••••last4" : "Vnesite API ključ"}
                    className="pr-10 text-sm"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Ključ je šifriran z AES-256-GCM. Nikoli ga ne pošljemo na frontend.</p>
              </div>
            </div>
            <Button onClick={handleSaveBYOK} disabled={byokLoading || !byokKey} className="gap-2">
              {byokLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Shrani ključ
            </Button>
          </div>
        </TabsContent>

        {/* Export */}
        <TabsContent value="export" className="space-y-4 mt-4">
          <div className="border rounded-xl p-5 bg-card space-y-4">
            <h3 className="font-semibold">Privzete nastavitve izvoza</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Format papirja</label>
                <Select defaultValue="A4">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A4">A4</SelectItem><SelectItem value="Letter">Letter</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Glava in noga</p>
                  <p className="text-xs text-muted-foreground">Prikaži glavo z logom in nogo</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Vključi logo</p>
                  <p className="text-xs text-muted-foreground">Logo iz globalnih spremenljivk (podjetje_logo_url)</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
              </div>
            </div>
            <Button size="sm">Shrani nastavitve</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}