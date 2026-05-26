import React, { useState } from "react";
import { useBusiness } from "@/lib/business-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Star, ExternalLink, Mail, TrendingUp, Zap, Send, Loader2, AlertCircle, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { generateDraft } from "@/functions/generateDraft";

export default function Ocene() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [generatingFor, setGeneratingFor] = useState(null);

  const { data: drafts = [] } = useQuery({
    queryKey: ["ocene-drafts", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: convertedLeads = [] } = useQuery({
    queryKey: ["converted-leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id, status: "converted" }),
    enabled: !!business?.id,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Nastavitve shranjene");
    },
  });

  const reviewDrafts = drafts.filter(d => d.pillar === "review_request");
  const sent = reviewDrafts.filter(d => d.status === "sent").length;
  const pending = reviewDrafts.filter(d => d.status === "pending").length;
  const approved = reviewDrafts.filter(d => d.status === "approved").length;

  const recentAll = reviewDrafts
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
    .slice(0, 10);

  const STATUS_COLOR = { pending: "bg-amber-100 text-amber-700", approved: "bg-blue-100 text-blue-700", sent: "bg-emerald-100 text-emerald-700", failed: "bg-red-100 text-red-700", skipped: "bg-gray-100 text-gray-500", flagged_for_review: "bg-orange-100 text-orange-700" };
  const STATUS_LABEL = { pending: "Čaka", approved: "Odobreno", sent: "Poslano", failed: "Napaka", skipped: "Preskočeno", flagged_for_review: "Pregled" };

  const handleManualReview = async (lead) => {
    if (!business?.google_review_link) {
      toast.error("Najprej nastavite Google ocena povezavo v Nastavitvah.");
      return;
    }
    if (!lead.consent_email) {
      toast.error("Stranka nima soglasja za e-pošto.");
      return;
    }
    setGeneratingFor(lead.id);
    try {
      await generateDraft({ business_id: business.id, lead_id: lead.id, pillar: "review_request", sequence_step: 1 });
      queryClient.invalidateQueries({ queryKey: ["ocene-drafts", business?.id] });
      toast.success(`Prošnja za oceno ustvarjena za ${lead.name}. Preverite Prejeto.`);
    } catch (e) {
      toast.error("Napaka pri generiranju: " + e.message);
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleTestEmail = async () => {
    if (!business?.google_review_link) {
      toast.error("Najprej nastavite Google ocena povezavo.");
      return;
    }
    const testLead = convertedLeads[0];
    if (!testLead) {
      toast.error("Ni pretvorjenih strank za test.");
      return;
    }
    setGeneratingFor("test");
    try {
      await generateDraft({ business_id: business.id, lead_id: testLead.id, pillar: "review_request", sequence_step: 1 });
      queryClient.invalidateQueries({ queryKey: ["ocene-drafts", business?.id] });
      toast.success("Testna prošnja ustvarjena. Preverite Prejeto.");
    } catch (e) {
      toast.error("Napaka: " + e.message);
    } finally {
      setGeneratingFor(null);
    }
  };

  const delayHours = business?.review_request_delay_hours || 24;
  const [reviewLinkInput, setReviewLinkInput] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const handleSaveReviewLink = async () => {
    const url = reviewLinkInput.trim();
    if (!url.startsWith("https://")) {
      toast.error("URL mora začeti z https://");
      return;
    }
    setSavingLink(true);
    await base44.entities.Business.update(business.id, { google_review_link: url });
    queryClient.invalidateQueries({ queryKey: ["business"] });
    toast.success("Google ocena povezava shranjena!");
    setSavingLink(false);
    setReviewLinkInput("");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ocene & napotitve</h1>
        <p className="text-muted-foreground mt-1">Avtomatske prošnje za Google ocene in napotitve.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Google ocene kartica */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold">Google ocene</h3>
          </div>
          {business?.google_review_link ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Vaša povezava za ocene je nastavljena.</p>
              <a href={business.google_review_link} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Odpri Google ocene
                </Button>
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">Dodajte Google ocena povezavo (format: https://g.page/r/...).</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={reviewLinkInput}
                  onChange={(e) => setReviewLinkInput(e.target.value)}
                  placeholder="https://g.page/r/..."
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSaveReviewLink} disabled={savingLink || !reviewLinkInput.trim()} className="shrink-0 gap-1.5">
                  {savingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Shrani
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Statistika */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Statistika</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{sent}</p>
              <p className="text-xs text-muted-foreground mt-1">Poslanih</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">{pending}</p>
              <p className="text-xs text-muted-foreground mt-1">Čaka</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-500">{approved}</p>
              <p className="text-xs text-muted-foreground mt-1">Odobrenih</p>
            </div>
          </div>
        </div>
      </div>

      {/* Avtomatika */}
      <div className="bg-card border rounded-xl p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Avtomatika</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="text-sm font-medium">Po pretvorbi stranke</p>
              <p className="text-xs text-muted-foreground">Ko Lead.status → converted/replied, samodejno ustvari prošnjo</p>
            </div>
            <Switch
              checked={!!business?.review_requests_enabled}
              onCheckedChange={(v) => saveSettingsMutation.mutate({ review_requests_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="text-sm font-medium">Po potrjenem terminu</p>
              <p className="text-xs text-muted-foreground">Ko ConfirmedBooking.status → completed, čez 24h sproži prošnjo</p>
            </div>
            <Switch
              checked={!!business?.pillar_reviews}
              onCheckedChange={(v) => saveSettingsMutation.mutate({ pillar_reviews: v })}
            />
          </div>
          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Zamik pošiljanja</Label>
              <span className="text-sm font-semibold text-primary">{delayHours} ur</span>
            </div>
            <Slider
              min={1} max={72} step={1}
              value={[delayHours]}
              onValueChange={([v]) => saveSettingsMutation.mutate({ review_request_delay_hours: v })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 ura</span><span>24 ur (privzeto)</span><span>72 ur</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manualno pošiljanje za converted leade */}
      {convertedLeads.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Manualno pošiljanje prošnje za oceno</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestEmail}
              disabled={generatingFor === "test"}
              className="gap-1.5"
            >
              {generatingFor === "test" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Test na moj email
            </Button>
          </div>
          <div className="divide-y">
            {convertedLeads.slice(0, 5).map(lead => (
              <div key={lead.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.email || "—"}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!generatingFor || !lead.consent_email}
                  onClick={() => handleManualReview(lead)}
                  className="gap-1.5"
                >
                  {generatingFor === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                  Pošlji prošnjo
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela review requestov */}
      {recentAll.length > 0 ? (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Prošnje za ocene — zgodovinska tabela</h3>
          </div>
          <div className="divide-y">
            {recentAll.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{d.subject || "Prošnja za oceno"}</p>
                    <p className="text-xs text-muted-foreground">{d.created_date ? format(new Date(d.created_date), "d. M. yyyy HH:mm") : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.quality_score && <span className="text-xs text-muted-foreground">Q{d.quality_score}</span>}
                  <Badge className={`${STATUS_COLOR[d.status] || "bg-gray-100 text-gray-600"} border-0 text-xs`}>
                    {STATUS_LABEL[d.status] || d.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border border-dashed rounded-xl p-8 text-center mb-6">
          <Star className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Avtomatske prošnje za ocene</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Ko bo AI ustvaril prošnjo za oceno, se bo prikazala tukaj. Pojdite v <strong>Prejeto</strong> za pregled.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/prejeto">Odpri Prejeto</Link>
          </Button>
        </div>
      )}

      {/* Napotitve */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-2">Napotitve</h3>
        <p className="text-sm text-muted-foreground mb-3">
          AI samodejno pošlje prošnjo za napotitev zadovoljnim strankam.
          Prošnje najdete v <Link to="/prejeto" className="text-primary hover:underline">Prejeto</Link>.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-violet-500">
              {drafts.filter(d => d.pillar === "referral_ask" && d.status === "sent").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Napotitev poslanih</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">
              {drafts.filter(d => d.pillar === "referral_ask" && d.status === "pending").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Čaka odobritev</p>
          </div>
        </div>
      </div>
    </div>
  );
}