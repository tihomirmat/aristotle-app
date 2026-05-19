import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Code2, Eye, Copy, Check, Loader2, UserPlus, Send, Zap } from "lucide-react";
import { toast } from "sonner";
import { generateDraft } from "@/functions/generateDraft";
import GenerateDraftButton from "@/components/stranke/GenerateDraftButton";
import { format } from "date-fns";

const STATUS_LABELS = { new: "Novo", contacted: "Kontaktiran/a", replied: "Odgovoril/a", converted: "Pretvorjen/a", unsubscribed: "Odjavljen/a" };
const STATUS_COLORS = { new: "bg-blue-100 text-blue-700", contacted: "bg-amber-100 text-amber-700", replied: "bg-emerald-100 text-emerald-700", converted: "bg-violet-100 text-violet-700", unsubscribed: "bg-gray-100 text-gray-500" };

export default function Pridobivanje() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [formConfig, setFormConfig] = useState({
    lead_form_title: "Pošljite povpraševanje",
    lead_form_button_text: "Pošlji povpraševanje",
    lead_form_success_message: "Hvala! Kontaktirali vas bomo v najkrajšem možnem času.",
    lead_form_consent_text: "",
    lead_form_primary_color: "#10b981",
    lead_form_show_phone: true,
    lead_form_show_service: false,
  });

  useEffect(() => {
    if (business) {
      setFormConfig({
        lead_form_title: business.lead_form_title || "Pošljite povpraševanje",
        lead_form_button_text: business.lead_form_button_text || "Pošlji povpraševanje",
        lead_form_success_message: business.lead_form_success_message || "Hvala! Kontaktirali vas bomo v najkrajšem možnem času.",
        lead_form_consent_text: business.lead_form_consent_text || `Soglašam, da me ${business.name} kontaktira glede povpraševanja. Soglasje lahko prekličem.`,
        lead_form_primary_color: business.lead_form_primary_color || "#10b981",
        lead_form_show_phone: business.lead_form_show_phone ?? true,
        lead_form_show_service: business.lead_form_show_service ?? false,
      });
    }
  }, [business]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-form", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Nastavitve obrazca shranjene");
    },
  });

  const formLeads = leads.filter(l => l.source === "form" || l.source === "chatbot");

  const embedCode = `<script src="https://aristotle-smart-growth.base44.app/lead-form.js"
  data-business-id="${business?.id || 'VAŠ_BUSINESS_ID'}"
  data-color="${formConfig.lead_form_primary_color}"
  defer></script>
<div id="aristotle-lead-form"></div>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Koda kopirana");
  };

  const handleTestLead = async () => {
    setSendingTest(true);
    try {
      const testLead = await base44.entities.Lead.create({
        business_id: business.id,
        name: "Test Stranka",
        email: "test@primer.si",
        phone: "+386 40 000 000",
        source: "form",
        status: "new",
        consent_email: true,
        notes: "Testno povpraševanje — zanima me vaša storitev",
        is_demo: true,
      });
      await generateDraft({ business_id: business.id, lead_id: testLead.id, pillar: "web_form_lead", sequence_step: 1 });
      queryClient.invalidateQueries({ queryKey: ["leads-form", business?.id] });
      toast.success("Testni lead ustvarjen in draft generiran — preverite Prejeto.");
    } catch (e) {
      toast.error("Napaka: " + e.message);
    } finally {
      setSendingTest(false);
    }
  };

  const color = formConfig.lead_form_primary_color;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pridobivanje strank</h1>
        <p className="text-muted-foreground mt-1">Spletni obrazec in upravljanje novih leadov.</p>
      </div>

      <Tabs defaultValue="stranke">
        <TabsList className="mb-6">
          <TabsTrigger value="stranke" className="gap-2">
            <Users className="w-4 h-4" /> Stranke
            {formLeads.length > 0 && <Badge variant="secondary" className="text-xs">{formLeads.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="obrazec" className="gap-2">
            <Code2 className="w-4 h-4" /> Spletni obrazec
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Stranke iz obrazca */}
        <TabsContent value="stranke">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : formLeads.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Ni še leadov iz obrazca</p>
              <p className="text-xs text-muted-foreground mt-1">Namestite spletni obrazec in stranke se bodo prikazale tukaj.</p>
              <Button size="sm" className="mt-4" onClick={handleTestLead} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Pošlji testni lead
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">{formLeads.length} leadov iz obrazca/klepeta</p>
                <Button size="sm" variant="outline" onClick={handleTestLead} disabled={sendingTest} className="gap-1.5">
                  {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Testni lead
                </Button>
              </div>
              <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ime</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">E-pošta</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Datum</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Akcija</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {formLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{lead.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.email || "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || "bg-gray-100"}`}>
                            {STATUS_LABELS[lead.status] || lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {lead.created_date ? format(new Date(lead.created_date), "d. M. yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <GenerateDraftButton lead={lead} businessId={business?.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB 2: Spletni obrazec */}
        <TabsContent value="obrazec">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            {/* Config */}
            <div className="space-y-5">
              <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold text-sm">Nastavitve obrazca</h3>

                <div className="space-y-1.5">
                  <Label>Naslov obrazca</Label>
                  <Input value={formConfig.lead_form_title} onChange={(e) => setFormConfig({ ...formConfig, lead_form_title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Besedilo gumba</Label>
                  <Input value={formConfig.lead_form_button_text} onChange={(e) => setFormConfig({ ...formConfig, lead_form_button_text: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sporočilo po oddaji</Label>
                  <Input value={formConfig.lead_form_success_message} onChange={(e) => setFormConfig({ ...formConfig, lead_form_success_message: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>GDPR soglasje</Label>
                  <Textarea
                    value={formConfig.lead_form_consent_text}
                    onChange={(e) => setFormConfig({ ...formConfig, lead_form_consent_text: e.target.value })}
                    className="h-16 text-xs resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Barva obrazca</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formConfig.lead_form_primary_color} onChange={(e) => setFormConfig({ ...formConfig, lead_form_primary_color: e.target.value })} className="h-9 w-16 rounded-md border border-input cursor-pointer p-1" />
                    <Input value={formConfig.lead_form_primary_color} onChange={(e) => setFormConfig({ ...formConfig, lead_form_primary_color: e.target.value })} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Polja obrazca</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked disabled /> Ime (obvezno)</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked disabled /> E-pošta (obvezno)</div>
                    <div className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setFormConfig({ ...formConfig, lead_form_show_phone: !formConfig.lead_form_show_phone })}>
                      <Checkbox checked={formConfig.lead_form_show_phone} /> Telefon
                    </div>
                    <div className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setFormConfig({ ...formConfig, lead_form_show_service: !formConfig.lead_form_show_service })}>
                      <Checkbox checked={formConfig.lead_form_show_service} /> Storitev (dropdown)
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked disabled /> Sporočilo (obvezno)</div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => saveMutation.mutate(formConfig)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Shrani nastavitve
                </Button>
              </div>

              {/* Embed code */}
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="w-4 h-4 text-primary" />
                  <h3 className="font-medium text-sm">Embed koda</h3>
                </div>
                <div className="relative">
                  <pre className="bg-muted/60 rounded-lg p-3 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                    {embedCode}
                  </pre>
                  <Button size="sm" variant="outline" className="absolute top-2 right-2 gap-1.5 text-xs" onClick={handleCopy}>
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Kopirano!" : "Kopiraj"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Predogled obrazca</p>
              <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">{formConfig.lead_form_title || "Pošljite povpraševanje"}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Ime *</label>
                    <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center text-xs text-gray-400">Vaše ime</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">E-pošta *</label>
                    <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center text-xs text-gray-400">ime@primer.si</div>
                  </div>
                  {formConfig.lead_form_show_phone && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Telefon</label>
                      <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center text-xs text-gray-400">+386 40 123 456</div>
                    </div>
                  )}
                  {formConfig.lead_form_show_service && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Storitev</label>
                      <div className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center text-xs text-gray-400">Izberite storitev…</div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Sporočilo *</label>
                    <div className="h-20 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400">Vaše povpraševanje…</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-3.5 h-3.5 mt-0.5 rounded border border-gray-300 shrink-0" />
                    <p className="text-xs text-gray-500 leading-relaxed">{formConfig.lead_form_consent_text || `Soglašam, da me ${business?.name || 'podjetje'} kontaktira.`}</p>
                  </div>
                  <button
                    className="w-full h-10 rounded-md text-white text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: color }}
                  >
                    {formConfig.lead_form_button_text || "Pošlji"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}