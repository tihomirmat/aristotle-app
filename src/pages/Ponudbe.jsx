import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { eur } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { FileSignature, FileText, Plus, Upload, Pencil, Download, AlertCircle, ArrowRight, Settings, Zap, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import IconHint from "@/components/ui/IconHint";
import { format } from "date-fns";
import { toast } from "sonner";
import OfferPreview from "@/components/ponudbe/OfferPreview";
import { HelperHeader } from "@/components/pomocniki/HelperKit";

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
  const [textOffer, setTextOffer] = useState(null); // starejše ponudbe brez PDF → besedilo v oknu

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
  const freeGenLeft = Math.max(0, 5 - (business?.offers_free_generations_used || 0));
  const hasByok = business?.offers_byok_provider && business?.offers_byok_verified_at;
  const quotaExhausted = freeGenLeft === 0 && !hasByok;

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
      <HelperHeader icon={FileSignature} tone="violet" title="Ponudbe" subtitle="Vpišete stranko in ceno, ponudba nastane po vašem vzorcu. Najprej jo vidite, šele nato pošljete."
        ok={templates.length > 0 || offers.length > 0} statusLabel={templates.length > 0 ? "Vzorec je pripravljen" : offers.length ? "Pripravljeno" : "Dodajte prvo ponudbo"}>
        {offers.length > 0 && <><Link to="/ponudbe/skener"><Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />Dodaj obstoječo ponudbo</Button></Link>
        <Link to="/ponudbe/nova"><Button className="btn-brand gap-2"><Plus className="w-4 h-4" />Nova ponudba</Button></Link></>}
      </HelperHeader>

      {quotaExhausted && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1"><p className="font-medium">Porabili ste 5 brezplačnih ponudb.</p><p>Obstoječe ponudbe lahko še vedno gledate in prenašate. Za nove ponudbe odprite nastavitve ponudb.</p></div>
          <Link to="/ponudbe/nastavitve"><Button size="sm" variant="outline" className="bg-white">Odpri nastavitve</Button></Link>
        </div>
      )}

      {(() => {
      // Desni stolpec: samodejne ponudbe (če je vzorec z dizajnom) + vzorci + kvota
      const autoCard = templates.some((t) => t.letterhead_url) && (() => {
        const mode = business?.offer_auto || "review";
        const set = async (v) => { try { await base44.entities.Business.update(business.id, { offer_auto: v }); qc.invalidateQueries({ queryKey: ["business"] }); toast.success("Shranjeno."); } catch { toast.error("Shranjevanje ni uspelo."); } };
        const OPTS = [
          ["off", "Izklopljeno", "Ponudbe pripravljate sami."],
          ["review", "Pripravi, pregledam jaz", "Ko stranka povpraša, je ponudba s spremnim sporočilom že pripravljena. Vi samo preberete in pošljete."],
          ["send", "Pošlji samo", "Če so vsi podatki, gre ponudba stranki sama. Če kaj manjka, AI stranko najprej vpraša — to vedno pregledate vi."],
        ];
        return (
          <div className="card-elevated p-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><Zap className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Samodejne ponudbe ob povpraševanju</p>
                <p className="text-xs text-muted-foreground">Ko stranka povpraša ali odgovori, AI pripravi ponudbo po vašem ceniku v vašem dizajnu.</p>
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              {OPTS.map(([k, l, d]) => (
                <button key={k} onClick={() => k !== mode && set(k)} className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${mode === k ? "border-primary/50 bg-accent/50" : "hover:border-primary/30"}`}>
                  <span className="text-sm font-medium flex items-center gap-2"><span className={`w-3 h-3 rounded-full border-2 ${mode === k ? "border-primary bg-primary" : "border-slate-300"}`} />{l}</span>
                  {mode === k && <span className="block text-xs text-muted-foreground mt-0.5 pl-5">{d}</span>}
                </button>
              ))}
            </div>
            {!business?.offers_price_rules && mode !== "off" && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">Cenik še ni vpisan, zato bodo cene »po dogovoru«. Vpišete ga pri »Nova ponudba« → Cenik in pravila.</p>}
            {business?.subscription_status === "trialing" && mode === "send" && <p className="text-xs text-muted-foreground mt-2">Med preizkusnim obdobjem se nič ne pošlje samo — vse gre v pregled.</p>}
          </div>
        );
      })();
      if (offers.length === 0) return autoCard || null;
      return (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* Levo: ponudbe kot kompakten seznam — ikona PDF odpre pravo ponudbo */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <p className="px-4 py-2.5 border-b text-sm font-semibold">Vaše ponudbe <span className="text-muted-foreground font-normal">({offers.length})</span></p>
            <div className="divide-y">
              {offers.map((o) => {
                const st = o.offer_status || "draft"; const St = STATUS[st] || STATUS.draft;
                const openDoc = () => (o.output_pdf_url ? window.open(o.output_pdf_url, "_blank", "noopener") : setTextOffer(o));
                return (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                    <IconHint label={o.output_pdf_url ? "Odpri ponudbo (PDF)" : "Odpri ponudbo"}>
                      <button onClick={openDoc} aria-label="Odpri ponudbo" className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center shrink-0 hover:bg-violet-100"><FileText className="w-4 h-4" /></button>
                    </IconHint>
                    <button onClick={openDoc} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium truncate hover:text-primary">{clientOf(o)}</p>
                      <p className="text-xs text-muted-foreground">{day(o.created_date)}{o.amount ? <span className="text-foreground font-medium"> · {eur(o.amount)}</span> : null}</p>
                    </button>
                    <select value={st} onChange={(e) => setStatus(o, e.target.value)} aria-label="Kaj se je zgodilo s ponudbo" title="Kaj se je zgodilo s ponudbo?"
                      className={`text-[11px] font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${St.cls}`}>
                      {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                    </select>
                    <span className="flex items-center gap-0.5 shrink-0">
                      {o.output_pdf_url && <IconHint label="Prenesi PDF"><a href={o.output_pdf_url} target="_blank" rel="noreferrer" download aria-label="Prenesi PDF" className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><Download className="w-4 h-4" /></a></IconHint>}
                      <IconHint label="Spremeni (nova različica)"><Link to={`/ponudbe/nova?duplicate=${o.id}`} aria-label="Spremeni ponudbo" className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="w-4 h-4" /></Link></IconHint>
                      {o.lead_id && <IconHint label="Odpri stranko"><Link to={`/stranke/${o.lead_id}`} aria-label="Odpri stranko" className="w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><User className="w-4 h-4" /></Link></IconHint>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <aside className="space-y-4 xl:sticky xl:top-20">
            {autoCard}
            <div className="card-elevated p-4">
              <p className="font-semibold text-sm">Vaši vzorci</p>
              <p className="text-xs text-muted-foreground">Po njih nastane vsaka nova ponudba.</p>
              <div className="divide-y mt-2">
                {templates.map((t) => (
                  <div key={t.id} className="py-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm flex-1 truncate">{t.name}</span>
                    {t.letterhead_url && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Vaš dizajn</span>}
                    <Link to={`/ponudbe/templati/${t.id}`} className="text-xs text-muted-foreground hover:text-foreground">Uredi</Link>
                  </div>
                ))}
              </div>
              <Link to="/ponudbe/skener" className="mt-2 text-xs text-primary font-medium inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" />Dodaj svojo ponudbo (PDF)</Link>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap px-1">
              {!hasByok && !quotaExhausted && <span>Brezplačno še <strong className="text-foreground">{freeGenLeft}</strong> od 5 ponudb.</span>}
              <Link to="/ponudbe/nastavitve" className="ml-auto inline-flex items-center gap-1 hover:text-foreground"><Settings className="w-3.5 h-3.5" />Nastavitve ponudb</Link>
            </div>
          </aside>
        </div>
      );
      })()}

      {/* Brez ponudb: en jasen začetek */}
      {!isLoading && offers.length === 0 && (
        <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <div className="card-elevated p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{templates.length ? "Naslednji korak" : "Začnite tukaj"}</p>
            <h2 className="!text-2xl mt-1">{templates.length ? "Pripravite prvo ponudbo" : "Dodajte ponudbo, ki jo že pošiljate strankam"}</h2>
            <p className="text-muted-foreground mt-2 max-w-xl">{templates.length ? "Vzorec že imate. Vpišete stranko, storitev in ceno — ponudbo najprej vidite, šele nato jo prenesete ali pošljete." : "Naložite jo kot PDF. Preberemo glavo, nogo, pisave, barve in razporeditev — nove ponudbe bodo videti enako, spremenijo se samo stranka, postavke in cene."}</p>
            <Link to={templates.length ? "/ponudbe/nova" : "/ponudbe/skener"}><Button size="lg" className="btn-brand gap-2 text-base px-7 mt-6">{templates.length ? <Plus className="w-5 h-5" /> : <Upload className="w-5 h-5" />}{templates.length ? "Nova ponudba" : "Dodaj obstoječo ponudbo"}</Button></Link>
          </div>
          <div className="rounded-2xl border-2 border-dashed p-8 flex flex-col justify-center">
            <h3 className="font-semibold text-lg">{templates.length ? "Imate še kakšno svojo ponudbo?" : "Nimate še nobene ponudbe?"}</h3>
            <p className="text-sm text-muted-foreground mt-1">{templates.length ? "Dodajte jo kot dodaten vzorec, npr. za drugo storitev." : "Nič hudega. Vpišete stranko, storitev in ceno, ponudbo pa sestavimo mi."}</p>
            <Link to={templates.length ? "/ponudbe/skener" : "/ponudbe/nova"} className="text-primary font-semibold inline-flex items-center gap-1.5 mt-4">{templates.length ? "Dodaj obstoječo ponudbo" : "Pripravi ponudbo brez vzorca"}<ArrowRight className="w-4 h-4" /></Link>
          </div>
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
      {(templates.length > 0 || offers.length > 0) && <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg">Vaši vzorci</h2>
          <p className="text-sm text-muted-foreground">Vzorec je vaša ponudba brez podatkov stranke. Po njem nastane vsaka nova ponudba.</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="card-elevated p-4 flex flex-col">
              <div className="flex items-start gap-2"><FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" /><p className="font-semibold text-sm flex-1">{t.name}</p>{t.letterhead_url && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Vaš dizajn</span>}{t.is_default && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent text-primary">Glavni</span>}</div>
              <div className="flex gap-2 mt-4">
                <Link to={`/ponudbe/nova?template=${t.id}`} className="flex-1"><Button size="sm" className="w-full btn-brand gap-1"><Plus className="w-3.5 h-3.5" />Nova ponudba</Button></Link>
                <Link to={`/ponudbe/templati/${t.id}`}><Button size="sm" variant="outline">Uredi vzorec</Button></Link>
              </div>
            </div>
          ))}
          <Link to="/ponudbe/skener" className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[104px] text-center">
            <Upload className="w-5 h-5" /><span className="text-sm font-medium">Dodaj svojo ponudbo (PDF) — ohranimo dizajn</span>
          </Link>
        </div>
      </section>}

      <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground border-t pt-4">
        {!hasByok && !quotaExhausted && <span>Brezplačno lahko pripravite še <strong className="text-foreground">{freeGenLeft}</strong> od 5 ponudb.</span>}
        {isAdmin && hasByok && <span>Admin: lasten AI račun ({business.offers_byok_provider} · {business.offers_byok_model})</span>}
        <Link to="/ponudbe/nastavitve" className="ml-auto inline-flex items-center gap-1.5 hover:text-foreground"><Settings className="w-4 h-4" />Nastavitve ponudb</Link>
      </div>
    </div>
  );
}
