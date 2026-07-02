import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, ChevronRight, ChevronLeft, Loader2, CheckCircle, Edit } from "lucide-react";
import { toast } from "sonner";
import { offerScan } from "@/functions/offerScan";

const STEPS = ["Naložite vir", "Ekstrakcija besedila", "AI analiza", "Shranite template"];
const KIND_LABELS = { service: "Storitev", product: "Izdelek", saas: "SaaS", custom: "Po meri" };

export default function PonudbeSkener() {
  const { business } = useBusiness();
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const [step, setStep] = useState(0);
  const [pastedText, setPastedText] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [editedResult, setEditedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleExtract = async () => {
    setLoading(true);
    setStep(1);
    try {
      let textContent = pastedText;

      if (uploadedFile) {
        const ext = uploadedFile.name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png'].includes(ext)) {
          // Upload and use Anthropic vision via offerExtract
          const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
          const res = await base44.integrations.Core.InvokeLLM({
            prompt: `Ekstrahiraj vso besedilo iz te slike ponudbe/dokumenta. Vrni samo besedilo, brez formatiranja.`,
            file_urls: [file_url],
          });
          textContent = res;
        } else if (['pdf', 'docx', 'txt'].includes(ext)) {
          // Use ExtractDataFromUploadedFile
          const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
          const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: { type: "object", properties: { full_text: { type: "string" } } },
          });
          textContent = extracted.output?.full_text || extractedText || "";
        } else if (['mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a'].includes(ext)) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
          textContent = transcript;
        }
      }

      if (!textContent.trim()) {
        toast.error("Ni besedila za analizo. Preverite naloženo datoteko ali prilepite besedilo.");
        setStep(0);
        setLoading(false);
        return;
      }

      setExtractedText(textContent);
      setStep(2);

      // AI analysis
      const res = await offerScan({ business_id: business.id, text_content: textContent });
      const result = res.data?.result || {};
      setScanResult(result);
      setEditedResult(result);
      setStep(3);
    } catch (err) {
      toast.error("Napaka pri ekstrakciji: " + err.message);
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editedResult) return;
    setSaving(true);
    try {
      // Check if first of this kind (for is_default)
      const existing = await base44.entities.OfferTemplate.filter({ business_id: business.id, kind: editedResult.detected_kind });
      const isDefault = existing.length === 0;

      const template = await base44.entities.OfferTemplate.create({
        business_id: business.id,
        name: editedResult.template_name || "Nova ponudba",
        kind: editedResult.detected_kind || "service",
        source: "scanned",
        body_markdown: editedResult.sections?.map(s => `## ${s.title}\n\n${s.body_template}`).join("\n\n") || "",
        variables: editedResult.suggested_variables || [],
        is_default: isDefault,
      });

      toast.success("Template je shranjen!");
      navigate(`/ponudbe/templati/${template.id}`);
    } catch (err) {
      toast.error("Napaka pri shranjevanju: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Skeniraj obstoječo ponudbo</h1>
        <p className="text-muted-foreground mt-1">AI bo iz vaše obstoječe ponudbe ustvaril template z vsemi spremenljivkami.</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= step ? "text-primary" : "text-muted-foreground/50"}`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px]">{i + 1}</span>}
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${uploadedFile ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.mp4,.mov,.webm,.mp3,.wav,.m4a" onChange={handleFileChange} />
            {uploadedFile ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-primary" />
                <p className="font-medium text-sm">{uploadedFile.name}</p>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>Odstrani</Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <p className="font-medium text-sm">Povlecite datoteko ali kliknite za nalaganje</p>
                <p className="text-xs">PDF, DOCX, JPG, PNG, MP4/MOV (posnetek)</p>
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">ALI</span>
            <div className="flex-1 border-t" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prilepite besedilo obstoječe ponudbe</label>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Prilepite vsebino vaše obstoječe ponudbe tukaj..."
              className="h-40"
            />
          </div>

          <Button
            onClick={handleExtract}
            disabled={!uploadedFile && !pastedText.trim()}
            className="w-full gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Začni analizo
          </Button>
        </div>
      )}

      {/* Step 1: Extracting */}
      {step === 1 && (
        <div className="flex flex-col items-center py-12 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="font-medium">Ekstrahiram besedilo...</p>
          <p className="text-sm text-muted-foreground">Pripravljam vsebino za AI analizo.</p>
        </div>
      )}

      {/* Step 2: AI Analysis in progress */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-medium">AI analizira ponudbo...</p>
            <p className="text-sm text-muted-foreground">Ustvarjam template in spremenljivke. Prosim počakajte.</p>
          </div>
          {extractedText && (
            <details className="border rounded-lg">
              <summary className="px-4 py-3 text-sm font-medium cursor-pointer text-muted-foreground">Ekstrahirano besedilo (preverba)</summary>
              <div className="px-4 pb-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-auto">{extractedText.substring(0, 2000)}{extractedText.length > 2000 ? "..." : ""}</pre>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Step 3: Review AI result */}
      {step === 3 && editedResult && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="font-medium text-emerald-800">AI je analiziral ponudbo</p>
          </div>

          <div className="border rounded-xl p-4 bg-card space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ime template-a</label>
                <input
                  className="w-full border rounded-lg px-3 py-1.5 text-sm"
                  value={editedResult.template_name || ""}
                  onChange={(e) => setEditedResult({ ...editedResult, template_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tip ponudbe</label>
                <select
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
                  value={editedResult.detected_kind || "service"}
                  onChange={(e) => setEditedResult({ ...editedResult, detected_kind: e.target.value })}
                >
                  {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Zaznane sekcije ({editedResult.sections?.length || 0})</p>
              <div className="space-y-2">
                {(editedResult.sections || []).map((s, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                    <p className="font-medium text-xs">{s.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{s.body_template?.substring(0, 100)}...</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Spremenljivke ({editedResult.suggested_variables?.length || 0})</p>
              <div className="flex flex-wrap gap-1.5">
                {(editedResult.suggested_variables || []).map((v, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{`{{${v.key}}}`} · {v.label}</Badge>
                ))}
              </div>
            </div>

            {editedResult.improvement_notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <strong>Opažanja AI:</strong> {editedResult.improvement_notes}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSaveTemplate} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Shrani template
            </Button>
            <Button variant="outline" onClick={() => { setStep(0); setUploadedFile(null); setPastedText(""); setExtractedText(""); setScanResult(null); }}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}