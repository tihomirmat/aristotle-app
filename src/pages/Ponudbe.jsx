import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { eur } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Upload, Pencil, Download, AlertCircle, ArrowRight, Settings } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import OfferPreview from "@/components/ponudbe/OfferPreview";

const STATUS = {
  draft: { label: "Še ni poslana", cls: "bg-slate-100 text-slate-700" },
  sent: { label: "Poslana", cls: "bg-blue-100 text-blue-700" },
  accepted: { label: "Sprejeta", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Zavrnjena", cls: "bg-red-100 text-red-700" },
};
const clientOf = (g) => g.client_name || g.resolved_vars_json?.stranka_naziv || "Brez imena stranke";
const day = (d) => (d ? format(new Date(d), "d. M. yyyy") : "");

export default function Ponudbe() {
  const { business, user } = useBusiness();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const hasOffers = hasModule(business, "pillar_offers");
  const [selId, setSelId] = useState(null);
  const previewRef = useRef(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["offer-templates", business?.id],
    queryFn: () => base44.entities.OfferTemplate.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: generations = [], isLoading } = useQuery({
    queryKey: ["offer-generations", business?.id],
    queryFn: () => base44.entities.OfferGeneration.filter({ business_id: business.id }, "-created_date", 50),
    enabled: !!business?.id,
  });

  const offers = generations.filter((g) => g.status !== "failed" && (g.output_markdown || g.output_pdf_url));
  const sel = offers.find((o) => o.id === selId) || offers[0] || null;
  const freeGenLeft = Math.max(0, 5 - (business?.offers_free_generations_used || 0));
  const hasByok = business?.offers_byok_provider && business?.offers_byok_verified_at;
  const quotaExhausted = freeGenLeft === 0 && !hasByok;

  const pick = (o) => { setSelId(o.id); if (window.innerWidth < 1280) setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const setStatus = async (o, offer_status) => {
    try { await base44.entities.OfferGeneration.update(o.id, { offer_status }); qc.invalidateQueries({ queryKey: ["offer-generations", business.id] }); toast.success("Shranjeno."); }
    catch { toast.error("Shranjevanje ni uspelo."); }
  };

  if (!hasOffers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2">Ponudbe</h2>
        <p className="text-muted-foreground max-w-sm mb-6">Priprava ponudb ni vključena v vaš paket. Vključite jo v Naročnini.</p>
        <Link to="/nastavitve?tab=billing"><Button className="btn-brand">Vključi ponudbe</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1>Ponudbe</h1>
          <p className="text-muted-foreground mt-1">Vpišete stranko in ceno, ponudba nastane po vašem vzorcu. Tu jo pogledate, spremenite in prenesete.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/ponudbe/skener"><Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />Dodaj obstoječo ponudbo</Button></Link>
          <Link to="/ponudbe/nova"><Button className="btn-brand gap-2"><Plus className="w-4 h-4" />Nova ponudba</Button></Link>
        </div>
      </div>

      {quotaExhausted && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1"><p className="font-medium">Porabili ste 5 brezplačnih ponudb.</p><p>Obstoječe ponudbe lahko še vedno gledate in prenašate. Za nove ponudbe odprite nastavitve ponudb.</p></div>
          <Link to="/ponudbe/nastavitve"><Button size="sm" variant="outline" className="bg-white">Odpri nastavitve</Button></Link>
        </div>
      )}

      {/* Brez vzorca in brez ponudb: en jasen začetek */}
      {!isLoading && offers.length === 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/ponudbe/skener" className="card-elevated p-6 hover:border-primary/40 border-2 border-transparent transition-colors">
            <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center"><Upload className="w-5 h-5" /></div>
            <p className="font-semibold text-lg mt-4">{templates.length ? "Dodajte še eno svojo ponudbo" : "1. Dodajte ponudbo, ki jo že pošiljate"}</p>
            <p className="text-sm text-muted-foreground mt-1">Naložite PDF ali Word, fotografijo ali prilepite besedilo. Iz nje nastane vaš vzorec — nove ponudbe bodo videti enako.</p>
            <span className="text-sm font-medium text-primary inline-flex items-center gap-1 mt-4">Dodaj obstoječo ponudbo<ArrowRight className="w-4 h-4" /></span>
          </Link>
          <Link to="/ponudbe/nova" className="card-elevated p-6 hover:border-primary/40 border-2 border-transparent transition-colors">
            <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center"><Plus className="w-5 h-5" /></div>
            <p className="font-semibold text-lg mt-4">{templates.length ? "Pripravite prvo ponudbo" : "2. Pripravite novo ponudbo"}</p>
            <p className="text-sm text-muted-foreground mt-1">Vpišete stranko, storitev in ceno. Ponudbo najprej vidite, šele nato jo prenesete ali pošljete.</p>
            <span className="text-sm font-medium text-primary inline-flex items-center gap-1 mt-4">Nova ponudba<ArrowRight className="w-4 h-4" /></span>
          </Link>
        </div>
      )}

      {/* Seznam levo, predogled desno */}
      {offers.length > 0 && (
        <div className="grid xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-2">
            <h2 className="text-lg mb-1">Vaše ponudbe <span className="text-muted-foreground font-normal text-base">({offers.length})</span></h2>
            {offers.map((o) => {
              const St = STATUS[o.offer_status] || STATUS.draft; const active = sel?.id === o.id;
              return (
                <button key={o.id} onClick={() => pick(o)} className={`w-full text-left rounded-xl border-2 bg-card px-4 py-3 transition-all ${active ? "border-primary shadow-md" : "border-transparent shadow-sm hover:border-primary/30"}`}>
                  <div className="flex items-center gap-2"><p className="font-semibold flex-1 truncate">{clientOf(o)}</p>{o.amount ? <span className="font-semibold text-sm">{eur(o.amount)}</span> : null}</div>
                  <div className="flex items-center gap-2 mt-1.5"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${St.cls}`}>{St.label}</span><span className="text-xs text-muted-foreground">{day(o.created_date)}</span></div>
                </button>
              );
            })}
          </div>

          {sel && (
            <div ref={previewRef} className="xl:sticky xl:top-20 space-y-3 scroll-mt-20">
              <div className="card-elevated p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <p className="font-semibold text-lg leading-tight">{clientOf(sel)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pripravljena {day(sel.created_date)}{sel.amount ? ` · ${eur(sel.amount)}` : ""}</p>
                </div>
                <Link to={`/ponudbe/nova?duplicate=${sel.id}`}><Button size="lg" className="btn-brand gap-2 text-base"><Pencil className="w-4 h-4" />Spremeni ponudbo</Button></Link>
                {sel.output_pdf_url && <a href={sel.output_pdf_url} target="_blank" rel="noreferrer"><Button size="lg" variant="outline" className="gap-2"><Download className="w-4 h-4" />Prenesi PDF</Button></a>}
                {sel.output_docx_url && <a href={sel.output_docx_url} target="_blank" rel="noreferrer"><Button size="lg" variant="outline" className="gap-2"><Download className="w-4 h-4" />Prenesi Word</Button></a>}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground">Kaj se je zgodilo s ponudbo?</span>
                {Object.entries(STATUS).map(([k, s]) => (
                  <button key={k} onClick={() => setStatus(sel, k)} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${((sel.offer_status || "draft") === k) ? `${s.cls} border-transparent ring-2 ring-offset-1 ring-slate-300` : "bg-card hover:bg-muted"}`}>{s.label}</button>
                ))}
                {sel.lead_id && <Link to={`/stranke/${sel.lead_id}`} className="ml-auto text-primary font-medium inline-flex items-center gap-1">Odpri stranko<ArrowRight className="w-3.5 h-3.5" /></Link>}
              </div>
              <OfferPreview markdown={sel.output_markdown} />
            </div>
          )}
        </div>
      )}

      {/* Vzorci */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg">Vaši vzorci</h2>
          <p className="text-sm text-muted-foreground">Vzorec je vaša ponudba brez podatkov stranke. Po njem nastane vsaka nova ponudba.</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="card-elevated p-4 flex flex-col">
              <div className="flex items-start gap-2"><FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" /><p className="font-semibold text-sm flex-1">{t.name}</p>{t.is_default && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-primary">Glavni</span>}</div>
              <div className="flex gap-2 mt-4">
                <Link to={`/ponudbe/nova?template=${t.id}`} className="flex-1"><Button size="sm" className="w-full btn-brand gap-1"><Plus className="w-3.5 h-3.5" />Nova ponudba</Button></Link>
                <Link to={`/ponudbe/templati/${t.id}`}><Button size="sm" variant="outline">Uredi vzorec</Button></Link>
              </div>
            </div>
          ))}
          <Link to="/ponudbe/skener" className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[104px] text-center">
            <Upload className="w-5 h-5" /><span className="text-sm font-medium">Dodaj vzorec iz obstoječe ponudbe</span>
          </Link>
        </div>
      </section>

      <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground border-t pt-4">
        {!hasByok && !quotaExhausted && <span>Brezplačno lahko pripravite še <strong className="text-foreground">{freeGenLeft}</strong> od 5 ponudb.</span>}
        {isAdmin && hasByok && <span>Admin: lasten AI račun ({business.offers_byok_provider} · {business.offers_byok_model})</span>}
        <Link to="/ponudbe/nastavitve" className="ml-auto inline-flex items-center gap-1.5 hover:text-foreground"><Settings className="w-4 h-4" />Nastavitve ponudb</Link>
      </div>
    </div>
  );
}
