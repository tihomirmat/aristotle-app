import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronDown, Loader2, CheckCircle2, FileDown, Pencil, Sparkles, AlertCircle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { offerDesign } from "@/functions/offerDesign";
import { fnError } from "@/lib/fn-error";
import OfferPreview from "@/components/ponudbe/OfferPreview";

const RULES_EXAMPLE = "Primer:\nSpletna stran do 5 podstrani: 1.200 €\nVsaka dodatna podstran: 90 €\nSpletna trgovina do 50 izdelkov: 2.400 €; nad 50 izdelkov: 3.200 €\nVzdrževanje: 60 €/mesec\nPravilo: za stranke izven Slovenije dodaj angleško različico (+400 €).";

// Nova ponudba v dizajnu naložene ponudbe: stranka + kaj želi → AI napiše vsebino po ceniku → PDF v istem dizajnu.
export default function DesignOffer({ business, template, templates = [], onChooseTemplate, leadId, companyId, clientName, source }) {
  const qc = useQueryClient();
  const [client, setClient] = useState(clientName || "");
  const [request, setRequest] = useState("");
  const [extra, setExtra] = useState("");
  const [rules, setRules] = useState(business?.offers_price_rules || "");
  const [rulesOpen, setRulesOpen] = useState(!business?.offers_price_rules);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: lead } = useQuery({ queryKey: ["offer-lead", leadId], queryFn: () => base44.entities.Lead.filter({ id: leadId }).then((d) => d[0] || null), enabled: !!leadId });
  useEffect(() => {
    if (lead) { setClient((c) => c || lead.name || ""); setRequest((r) => r || [lead.email_subject, lead.service_requested, lead.notes].filter(Boolean).join("\n").slice(0, 4000)); }
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (source) { setClient((c) => c || source.client_name || ""); setRequest((r) => r || source.inputs_json?.request_text || ""); setExtra((e) => e || source.inputs_json?.extra || ""); }
  }, [source?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fonts = template.design_fonts || [];
  const replaced = fonts.filter((f) => !f.exact);

  const generate = async () => {
    if (!request.trim() && !extra.trim()) { toast.error("Napišite, kaj stranka želi."); return; }
    setBusy(true); setError(null);
    try {
      if (rules.trim() !== (business?.offers_price_rules || "").trim()) { await base44.entities.Business.update(business.id, { offers_price_rules: rules.trim() }); qc.invalidateQueries({ queryKey: ["business"] }); }
      const res = await offerDesign({ action: "generate", business_id: business.id, template_id: template.id, client_name: client.trim(), request_text: request.trim(), extra: extra.trim(), ...(leadId ? { lead_id: leadId } : {}), ...(companyId ? { company_id: companyId } : {}) });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      setResult(d);
      qc.invalidateQueries({ queryKey: ["offer-generations", business.id] });
      toast.success("Ponudba je pripravljena.");
    } catch (e) { const msg = fnError(e); setError(msg); toast.error(msg); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/ponudbe" className="w-9 h-9 rounded-full border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-[220px]">
          <h1 className="!text-2xl">{source ? "Spremeni ponudbo" : "Nova ponudba"}</h1>
          <p className="text-sm text-muted-foreground">Videti bo enako kot vaša ponudba »{template.name}« — ista glava, noga, pisave in barve.</p>
        </div>
        {templates.filter((t) => t.letterhead_url).length > 1 && (
          <Select value={template.id} onValueChange={onChooseTemplate}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
        )}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-6 items-start">
        {/* Vnos */}
        <div className="card-elevated p-6 space-y-5">
          <div><Label className="text-sm font-semibold">Stranka</Label><Input className="mt-1.5 h-11" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ime ali podjetje stranke" /></div>
          <div>
            <Label className="text-sm font-semibold">Kaj stranka želi</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Prilepite njeno sporočilo ali napišite s svojimi besedami.{lead ? " Vpisano je povpraševanje te stranke." : ""}</p>
            <Textarea className="mt-1.5 h-36" value={request} onChange={(e) => setRequest(e.target.value)} placeholder="Npr. Potrebujemo spletno trgovino za 40 izdelkov s spletnim plačilom …" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Posebnosti za to ponudbo <span className="font-normal text-muted-foreground">(po želji)</span></Label>
            <Textarea className="mt-1.5 h-20" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Npr. 10 % popusta, rok izvedbe 30 dni, brez vzdrževanja." />
          </div>

          <div className="rounded-xl border">
            <button type="button" onClick={() => setRulesOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
              <ListChecks className="w-4 h-4 text-primary" /><span className="font-semibold text-sm flex-1">Cenik in pravila</span>
              <span className={`text-xs ${rules.trim() ? "text-emerald-700" : "text-amber-700"}`}>{rules.trim() ? "Vpisano" : "Še ni vpisano"}</span><ChevronDown className={`w-4 h-4 transition-transform ${rulesOpen ? "rotate-180" : ""}`} />
            </button>
            {rulesOpen && (
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground mb-2">Velja za vse ponudbe. Napišite cene in pravila z besedami — cene v ponudbi so samo iz tega. Česar tu ni, bo v ponudbi »po dogovoru«.</p>
                <Textarea className="h-40 text-sm" value={rules} onChange={(e) => setRules(e.target.value)} placeholder={RULES_EXAMPLE} />
              </div>
            )}
          </div>

          <Button size="lg" className="btn-brand w-full gap-2 text-base h-12" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}{busy ? "Pripravljam ponudbo …" : result ? "Pripravi znova" : "Pripravi ponudbo"}
          </Button>
          {busy && <p className="text-xs text-muted-foreground text-center">Traja 15–60 sekund. Strani ne zapirajte.</p>}
          {replaced.length > 0 && <p className="text-xs text-muted-foreground">Pisava: {replaced.map((f) => `${f.name} → ${f.used}`).join(", ")} (izvirna ni prosto dostopna, uporabljena je najbližja).</p>}
        </div>

        {/* Rezultat */}
        <div className="space-y-3 min-w-0">
          {error && !busy && <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-4 text-sm flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
          {!result && !busy && !error && (
            <div className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">
              <p className="font-semibold text-foreground">Tukaj se pokaže ponudba</p>
              <p className="text-sm mt-1 max-w-md mx-auto">Najprej jo vidite. Če kaj ni prav, dopišite navodilo levo in kliknite »Pripravi znova«. Nič se ne pošlje samo.</p>
              {template.source_pdf_url && <a href={template.source_pdf_url} target="_blank" rel="noreferrer" className="text-sm text-primary font-medium inline-block mt-4">Poglej izvirno ponudbo, po kateri bo narejena</a>}
            </div>
          )}
          {busy && <div className="rounded-2xl border-2 border-dashed p-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /><p className="font-medium mt-4">Pišem ponudbo po vašem ceniku in jo oblikujem v vašem dizajnu …</p></div>}
          {result && !busy && (
            <>
              <div className="card-elevated p-4 flex items-center gap-3 flex-wrap">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-[180px]"><p className="font-semibold">Ponudba je pripravljena{result.client_name ? ` — ${result.client_name}` : ""}</p><p className="text-xs text-muted-foreground">Strani: {result.pages}{result.amount ? ` · skupaj ${new Intl.NumberFormat("sl-SI").format(result.amount)} €` : ""}. Preverite cene, preden jo pošljete.</p></div>
                <a href={result.output_pdf_url} target="_blank" rel="noreferrer"><Button size="lg" className="btn-brand gap-2"><FileDown className="w-4 h-4" />Odpri PDF</Button></a>
                <Button size="lg" variant="outline" className="gap-2" onClick={() => document.getElementById("offer-extra-hint")?.scrollIntoView({ behavior: "smooth" })}><Pencil className="w-4 h-4" />Spremeni</Button>
              </div>
              <p id="offer-extra-hint" className="text-xs text-muted-foreground">Za spremembo dopišite navodilo v »Posebnosti za to ponudbo« (npr. »odstrani vzdrževanje«) in kliknite »Pripravi znova«.</p>
              <object data={`${result.output_pdf_url}#toolbar=0&view=FitH`} type="application/pdf" className="w-full h-[78vh] rounded-xl border bg-white">
                <OfferPreview markdown={result.output_markdown} />
              </object>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
