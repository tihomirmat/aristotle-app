import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, ScanLine, Edit, Download, Copy, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const KIND_LABELS = { service: "Storitev", product: "Izdelek", saas: "SaaS", custom: "Po meri" };
const KIND_COLORS = { service: "bg-blue-100 text-blue-700", product: "bg-emerald-100 text-emerald-700", saas: "bg-violet-100 text-violet-700", custom: "bg-amber-100 text-amber-700" };
const PROVIDER_LABELS = { platform_anthropic: "Platforma", byok_anthropic: "BYOK Anthropic", byok_openai: "BYOK OpenAI", byok_google: "BYOK Google" };

export default function Ponudbe() {
  const { business } = useBusiness();
  const hasOffers = hasModule(business, "pillar_offers");

  const { data: templates = [] } = useQuery({
    queryKey: ["offer-templates", business?.id],
    queryFn: () => base44.entities.OfferTemplate.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: generations = [] } = useQuery({
    queryKey: ["offer-generations", business?.id],
    queryFn: () => base44.entities.OfferGeneration.filter({ business_id: business.id }, "-created_date", 10),
    enabled: !!business?.id,
  });

  const freeGenLeft = Math.max(0, 5 - (business?.offers_free_generations_used || 0));
  const freeImpLeft = Math.max(0, 10 - (business?.offers_free_improvements_used || 0));
  const hasByok = business?.offers_byok_provider && business?.offers_byok_verified_at;
  const quotaExhausted = freeGenLeft === 0 && !hasByok;

  if (!hasOffers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2">Generator ponudb</h2>
        <p className="text-muted-foreground max-w-sm mb-6">Ta modul ni aktiven. Aktivirajte ga v Naročnini za dostop do AI generatorja ponudb.</p>
        <Link to="/nastavitve?tab=billing"><Button>Aktiviraj modul</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Generator ponudb</h1>
          <p className="text-muted-foreground mt-1">AI generator ponudb iz obstoječih predlog.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/ponudbe/skener"><Button variant="outline" className="gap-2"><ScanLine className="w-4 h-4" />Skeniraj obstoječo ponudbo</Button></Link>
          <Link to="/ponudbe/nova"><Button className="gap-2"><Plus className="w-4 h-4" />Nova ponudba</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Empty state if no templates */}
          {templates.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-12 text-center">
              <ScanLine className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">Začnite s skeniranjem obstoječe ponudbe</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">Naložite trenutno ponudbo, ki jo pošiljate strankam. AI bo iz nje izdelal vaš osebni template in vhodna polja.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/ponudbe/skener"><Button className="gap-2"><ScanLine className="w-4 h-4" />Skeniraj obstoječo ponudbo</Button></Link>
                <Link to="/ponudbe/templati/novo"><Button variant="outline">Začnem od ničle</Button></Link>
              </div>
            </div>
          ) : (
            <>
              {/* Templates grid */}
              <div>
                <h2 className="font-semibold mb-3">Moji templati</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map(t => (
                    <div key={t.id} className="border rounded-xl p-4 bg-card shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="font-semibold text-sm">{t.name}</p>
                          <Badge className={`mt-1 text-xs border-0 ${KIND_COLORS[t.kind]}`}>{KIND_LABELS[t.kind]}</Badge>
                        </div>
                        {t.is_default && <Badge className="bg-primary/10 text-primary border-0 text-xs">Privzeto</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/ponudbe/nova?template=${t.id}`} className="flex-1">
                          <Button size="sm" className="w-full gap-1"><Plus className="w-3 h-3" />Uporabi</Button>
                        </Link>
                        <Link to={`/ponudbe/templati/${t.id}`}>
                          <Button size="sm" variant="outline" className="gap-1"><Edit className="w-3 h-3" />Uredi</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  <Link to="/ponudbe/templati/novo" className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[120px]">
                    <Plus className="w-5 h-5" />
                    <span className="text-sm font-medium">Nov template</span>
                  </Link>
                </div>
              </div>

              {/* Recent generations */}
              {generations.length > 0 && (
                <div>
                  <h2 className="font-semibold mb-3">Zadnje ponudbe</h2>
                  <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Datum</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Stranka</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Model</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Akcije</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {generations.map(g => (
                          <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{g.created_date ? format(new Date(g.created_date), "d. M. yy") : "—"}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium">{g.resolved_vars_json?.stranka_naziv || "Neznana stranka"}</span>
                              <Badge className="ml-2 text-xs border-0 bg-muted text-muted-foreground">{g.kind === "full" ? "Ponudba" : "Izboljšava"}</Badge>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">{PROVIDER_LABELS[g.provider_used] || g.provider_used || "—"}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 justify-end">
                                {g.output_pdf_url && <a href={g.output_pdf_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"><Download className="w-3 h-3" />PDF</Button></a>}
                                {g.output_docx_url && <a href={g.output_docx_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"><Download className="w-3 h-3" />DOCX</Button></a>}
                                <Link to={`/ponudbe/nova?duplicate=${g.id}`}><Button size="sm" variant="ghost" className="h-7 px-2"><Copy className="w-3 h-3" /></Button></Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status sidebar */}
        <div className="space-y-4">
          <div className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">Status kreditov</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Brezplačne generacije</span>
                <span className="font-semibold">{freeGenLeft} / 5</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${((5 - freeGenLeft) / 5) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-muted-foreground">Izboljšave</span>
                <span className="font-semibold">{freeImpLeft} / 10</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${((10 - freeImpLeft) / 10) * 100}%` }} />
              </div>
            </div>

            {hasByok ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 text-xs">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>BYOK aktiven: {business.offers_byok_provider} · {business.offers_byok_model}</span>
              </div>
            ) : quotaExhausted ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-lg px-3 py-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Brezplačna kvota porabljena — priklopite svoj LLM račun za nadaljevanje.</span>
                </div>
                <Link to="/ponudbe/nastavitve"><Button size="sm" className="w-full gap-1 text-xs">Priklopi LLM račun <ChevronRight className="w-3 h-3" /></Button></Link>
              </div>
            ) : null}
          </div>

          <Link to="/ponudbe/nastavitve">
            <Button variant="outline" size="sm" className="w-full gap-2"><FileText className="w-3.5 h-3.5" />Nastavitve modula</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}