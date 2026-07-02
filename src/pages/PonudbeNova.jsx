import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronLeft, Loader2, CheckCircle, Download, Mail, ThumbsUp, ThumbsDown, AlertCircle, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { offerGenerate } from "@/functions/offerGenerate";
import { offerExtract } from "@/functions/offerExtract";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const INPUT_METHODS = [
  { key: "form", label: "Obrazec", desc: "Izpolnite polja ročno" },
  { key: "ocr", label: "Slika / screenshot", desc: "Naloži sliko, AI izpolni polja" },
  { key: "transcript", label: "Posnetek pogovora", desc: "Naloži posnetek ali avdio" },
  { key: "paste", label: "Prilepljeno besedilo", desc: "Prilepite besedilo za ekstrakcijo" },
];

const DEFAULT_GLOBAL_VARS = [
  { key: "podjetje_naziv", label: "Naziv podjetja", type: "text", required: false, placeholder: "Vaše podjetje d.o.o.", default: "" },
  { key: "podjetje_naslov", label: "Naslov podjetja", type: "text", required: false, placeholder: "Ulica 1, Ljubljana", default: "" },
  { key: "podjetje_davcna", label: "Davčna številka", type: "text", required: false, placeholder: "SI12345678", default: "" },
  { key: "podpisnik_ime", label: "Ime podpisnika", type: "text", required: false, placeholder: "Janez Novak", default: "" },
  { key: "stranka_naziv", label: "Naziv stranke", type: "text", required: true, placeholder: "Ime podjetja d.o.o.", default: "" },
  { key: "storitev", label: "Storitev/produkt", type: "textarea", required: true, placeholder: "Opis storitve ali produkta", default: "" },
  { key: "cena", label: "Cena (EUR)", type: "currency", required: false, placeholder: "1.500", default: "" },
  { key: "rok_veljavnosti", label: "Veljavnost ponudbe", type: "date", required: false, placeholder: "", default: "" },
];

export default function PonudbeNova() {
  const { business } = useBusiness();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");
  const duplicateId = searchParams.get("duplicate");

  const [step, setStep] = useState(0);
  const [inputMethod, setInputMethod] = useState("form");
  const [formValues, setFormValues] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [generationId, setGenerationId] = useState(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const { data: template } = useQuery({
    queryKey: ["offer-template-single", templateId],
    queryFn: () => base44.entities.OfferTemplate.filter({ id: templateId }).then(d => d[0]),
    enabled: !!templateId,
  });

  const { data: defaultTemplates } = useQuery({
    queryKey: ["offer-templates-default", business?.id],
    queryFn: () => base44.entities.OfferTemplate.filter({ business_id: business.id }),
    enabled: !templateId && !!business?.id,
    select: (d) => d[0],
  });

  const activeTemplate = template || defaultTemplates;
  const globalVars = business?.offers_global_vars || {};

  // Build variables list: global defaults + template vars
  const allVariables = DEFAULT_GLOBAL_VARS.map(v => ({
    ...v,
    default: globalVars[v.key] || v.default || business?.[v.key.replace("podjetje_", "")] || "",
  })).concat((activeTemplate?.variables || []).filter(v => !DEFAULT_GLOBAL_VARS.find(d => d.key === v.key)));

  useEffect(() => {
    // Pre-fill from global vars and business data
    const initial = {};
    DEFAULT_GLOBAL_VARS.forEach(v => {
      initial[v.key] = globalVars[v.key] || "";
    });
    initial.podjetje_naziv = globalVars.podjetje_naziv || business?.name || "";
    initial.podjetje_naslov = globalVars.podjetje_naslov || business?.address || "";
    initial.podpisnik_ime = globalVars.podpisnik_ime || "";
    setFormValues(initial);
  }, [business, globalVars]);

  const hasOffers = hasModule(business, "pillar_offers");
  const freeGenLeft = Math.max(0, 5 - (business?.offers_free_generations_used || 0));
  const hasByok = business?.offers_byok_provider && business?.offers_byok_verified_at;

  const handleExtractFromFile = async () => {
    if (!uploadedFile && !pasteText.trim()) { toast.error("Naložite datoteko ali prilepite besedilo"); return; }
    setExtracting(true);
    try {
      let extractedVars = {};
      if (inputMethod === "paste") {
        const res = await offerExtract({ business_id: business.id, file_url: pasteText, file_type: "paste", variables: allVariables });
        extractedVars = res.data?.extracted_values || {};
      } else if (uploadedFile) {
        const ext = uploadedFile.name.split('.').pop().toLowerCase();
        let fileUrl = "";
        if (['mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a'].includes(ext)) {
          const uploaded = await base44.integrations.Core.UploadFile({ file: uploadedFile });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: uploaded.file_url });
          const res = await offerExtract({ business_id: business.id, file_url: transcript, file_type: "transcript", variables: allVariables });
          extractedVars = res.data?.extracted_values || {};
        } else {
          const uploaded = await base44.integrations.Core.UploadFile({ file: uploadedFile });
          fileUrl = uploaded.file_url;
          const res = await offerExtract({ business_id: business.id, file_url: fileUrl, file_type: ext, variables: allVariables });
          extractedVars = res.data?.extracted_values || {};
        }
      }
      setFormValues(fv => ({ ...fv, ...extractedVars }));
      toast.success("Vrednosti so bile ekstrahirane iz vira");
      setStep(1);
    } catch (err) {
      toast.error("Napaka pri ekstrakciji: " + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    if (!hasOffers) { toast.error("Aktivirajte modul Generator ponudb v Naročnini."); return; }
    if (freeGenLeft === 0 && !hasByok) { setShowQuotaModal(true); return; }
    setGenerating(true);
    setStep(2);
    try {
      const res = await offerGenerate({ business_id: business.id, template_id: activeTemplate?.id, kind: "full", resolved_vars: formValues, input_method: inputMethod });
      if (res.data?.error) throw new Error(res.data.error);
      setGenerationResult(res.data);
      setGenerationId(res.data.generation_id);
      setStep(3);
    } catch (err) {
      if (err.message.includes("OFFERS_FREE_QUOTA_REACHED") || err.message.includes("BYOK_REQUIRED")) {
        setShowQuotaModal(true);
        setStep(1);
      } else {
        toast.error("Napaka pri generaciji: " + err.message);
        setStep(1);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleImprovement = async (section_to_improve, parentId) => {
    if (freeGenLeft === 0 && !hasByok) { setShowQuotaModal(true); return; }
    try {
      const res = await offerGenerate({ business_id: business.id, template_id: activeTemplate?.id, kind: "improvement", resolved_vars: formValues, input_method: "form", parent_id: parentId, section_to_improve });
      toast.success("Izboljšava je bila ustvarjena!");
      // Update improvements in result
      setGenerationResult(r => ({ ...r, improvements_suggested: r.improvements_suggested?.map(imp => imp.section === section_to_improve.section ? { ...imp, accepted: true } : imp) }));
    } catch (err) {
      toast.error("Napaka: " + err.message);
    }
  };

  const renderField = (v) => {
    const val = formValues[v.key] || "";
    const onChange = (e) => setFormValues(fv => ({ ...fv, [v.key]: e.target.value }));
    if (v.type === "textarea") return <Textarea value={val} onChange={onChange} placeholder={v.placeholder} className="h-20 text-sm" />;
    return <Input type={v.type === "date" ? "date" : v.type === "email" ? "email" : v.type === "phone" ? "tel" : "text"} value={val} onChange={onChange} placeholder={v.placeholder} className="text-sm" />;
  };

  if (!hasOffers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Modul ni aktiven</h2>
        <p className="text-muted-foreground mb-6">Aktivirajte modul Generator ponudb v Naročnini.</p>
        <Link to="/nastavitve?tab=billing"><Button>Aktiviraj v Naročnini</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/ponudbe"><Button variant="ghost" size="sm" className="gap-1"><ChevronLeft className="w-4 h-4" />Nazaj</Button></Link>
        <div>
          <h1 className="text-xl font-bold">Nova ponudba</h1>
          {activeTemplate && <p className="text-xs text-muted-foreground mt-0.5">Template: {activeTemplate.name}</p>}
        </div>
      </div>

      {/* Step 0: Input method selection */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold mb-3">Izberite način vnosa</h2>
            <div className="grid grid-cols-2 gap-3">
              {INPUT_METHODS.map(m => (
                <div
                  key={m.key}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${inputMethod === m.key ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                  onClick={() => setInputMethod(m.key)}
                >
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {(inputMethod === "ocr" || inputMethod === "transcript") && (
            <div className="border-2 border-dashed rounded-xl p-6 text-center">
              <input type="file" id="offer-upload" className="hidden"
                accept={inputMethod === "ocr" ? ".jpg,.jpeg,.png" : ".mp4,.mov,.webm,.mp3,.wav,.m4a"}
                onChange={(e) => setUploadedFile(e.target.files?.[0])} />
              <label htmlFor="offer-upload" className="cursor-pointer">
                {uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-primary" />
                    <p className="text-sm font-medium">{uploadedFile.name}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="w-6 h-6" />
                    <p className="text-sm">{inputMethod === "ocr" ? "Naloži sliko (JPG, PNG)" : "Naloži posnetek (MP4, MOV, MP3)"}</p>
                  </div>
                )}
              </label>
            </div>
          )}

          {inputMethod === "paste" && (
            <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Prilepite besedilo iz katerega bomo ekstrahirali podatke..." className="h-32 text-sm" />
          )}

          <div className="flex gap-3">
            {inputMethod === "form" ? (
              <Button onClick={() => setStep(1)} className="gap-2">Nadaljuj <ChevronRight className="w-4 h-4" /></Button>
            ) : (
              <Button onClick={handleExtractFromFile} disabled={extracting || (!uploadedFile && !pasteText.trim())} className="gap-2">
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Ekstrahiraj podatke
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Form review */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="font-semibold">Pregled in dopolnitev podatkov</h2>
          <div className="border rounded-xl p-5 space-y-4 bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allVariables.map(v => (
                <div key={v.key} className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1">
                    {v.label}
                    {v.required && <span className="text-red-500">*</span>}
                    {formValues[v.key] && inputMethod !== "form" && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] px-1.5 h-4 ml-1">Ekstrahirano</Badge>
                    )}
                  </label>
                  {renderField(v)}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)} className="gap-1"><ChevronLeft className="w-4 h-4" />Nazaj</Button>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2 flex-1">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generiraj ponudbo
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 2 && (
        <div className="flex flex-col items-center py-16 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-medium">AI generira ponudbo...</p>
          <p className="text-sm text-muted-foreground">Pripravljam profesionalno ponudbo z razrešenimi spremenljivkami.</p>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && generationResult && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="font-semibold text-emerald-800">Ponudba je bila ustvarjena</p>
          </div>

          {/* Output preview */}
          <div className="border rounded-xl p-6 bg-card prose prose-sm max-w-none">
            <ReactMarkdown>{generationResult.output_markdown || ""}</ReactMarkdown>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {generationResult.output_pdf_url && (
              <a href={generationResult.output_pdf_url} target="_blank" rel="noreferrer">
                <Button className="gap-2"><Download className="w-4 h-4" />Prenesi PDF</Button>
              </a>
            )}
            {generationResult.output_docx_url && (
              <a href={generationResult.output_docx_url} target="_blank" rel="noreferrer">
                <Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Prenesi DOCX</Button>
              </a>
            )}
            <Button variant="outline" className="gap-2"><Mail className="w-4 h-4" />Pošlji po e-pošti</Button>
          </div>

          {/* Improvements */}
          {(generationResult.improvements_suggested || []).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Predlogi izboljšav</h3>
              {generationResult.improvements_suggested.map((imp, i) => (
                <div key={i} className={`border rounded-xl p-4 space-y-3 ${imp.accepted ? "bg-emerald-50 border-emerald-200" : "bg-card"}`}>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{imp.section}</Badge>
                    {imp.accepted && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Sprejeto</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground">Prej:</p>
                      <p className="text-muted-foreground line-clamp-3">{imp.before}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-primary">Po:</p>
                      <p className="line-clamp-3">{imp.after}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{imp.rationale}</p>
                  {!imp.accepted && (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleImprovement(imp, generationId)}><ThumbsUp className="w-3 h-3" />Sprejmi</Button>
                      <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs"><ThumbsDown className="w-3 h-3" />Zavrni</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quota modal */}
      <Dialog open={showQuotaModal} onOpenChange={setShowQuotaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brezplačna kvota porabljena</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Za nadaljevanje povežite svoj račun pri Anthropic, OpenAI ali Google. Tako plačujete samo dejansko uporabo modela.</p>
          <div className="flex gap-3 mt-2">
            <Link to="/ponudbe/nastavitve" className="flex-1">
              <Button className="w-full" onClick={() => setShowQuotaModal(false)}>Priklopi LLM račun</Button>
            </Link>
            <Button variant="outline" onClick={() => setShowQuotaModal(false)}>Zapri</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}