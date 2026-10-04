import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, FileText, MessageSquare, Upload, Copy, Check, Loader2, CheckCircle2, ArrowRight, Zap, Webhook } from "lucide-react";
import { toast } from "sonner";
import { generateDraft } from "@/functions/generateDraft";
import { fnError } from "@/lib/fn-error";
import WebhookTab from "@/components/pridobivanje/WebhookTab";

// Viri strank: od kod pridejo povpraševanja. Vsak vir pove stanje in kaj narediti.
export default function LeadSources({ leads = [], onImport }) {
  const { business, user } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(null); // 'form' | 'webhook'
  const [copied, setCopied] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [cfg, setCfg] = useState({});

  useEffect(() => {
    if (!business) return;
    setCfg({
      lead_form_title: business.lead_form_title || "Pošljite povpraševanje",
      lead_form_button_text: business.lead_form_button_text || "Pošlji povpraševanje",
      lead_form_success_message: business.lead_form_success_message || "Hvala! Kontaktirali vas bomo v najkrajšem možnem času.",
      lead_form_consent_text: business.lead_form_consent_text || `Soglašam, da me ${business.name} kontaktira glede povpraševanja. Soglasje lahko prekličem.`,
      lead_form_primary_color: business.lead_form_primary_color || "#f84214",
      lead_form_show_phone: business.lead_form_show_phone ?? true,
      lead_form_show_service: business.lead_form_show_service ?? false,
    });
  }, [business]);

  const save = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["business"] }); toast.success("Obrazec shranjen."); },
  });

  const count = (src) => leads.filter((l) => l.source === src).length;
  const mailConnected = !!business?.imap_enabled && !!business?.imap_host;

  const embedCode = `<script src="https://aristotle-smart-growth.base44.app/api/functions/leadFormWidget"
  data-business-id="${business?.id}"
  data-color="${String(cfg.lead_form_primary_color || "#f84214").replace(/[^#0-9a-fA-F]/g, "")}"
  defer></script>
<div id="aristotle-lead-form"></div>`;

  const copy = () => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Koda kopirana. Prilepite jo na svojo spletno stran."); };

  const testLead = async () => {
    setSendingTest(true);
    try {
      const lead = await base44.entities.Lead.create({ business_id: business.id, name: "Testna stranka", email: "test@primer.si", phone: "+386 40 000 000", source: "form", status: "new", consent_email: true, notes: "Testno povpraševanje — zanima me vaša storitev.", is_demo: true });
      await generateDraft({ business_id: business.id, lead_id: lead.id, pillar: "web_form_lead", sequence_step: 1 });
      ["leads", "leads_all", "drafts-all"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success("Testna stranka je dodana, AI odgovor čaka v »Za odobritev«.");
    } catch (e) { toast.error(fnError(e)); } finally { setSendingTest(false); }
  };

  const Source = ({ icon: Icon, tone, title, desc, status, ok, action }) => (
    <div className="card-elevated p-5 flex flex-col">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shrink-0`}><Icon className="w-[18px] h-[18px] text-white" /></div>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${ok ? "text-emerald-700" : "text-muted-foreground"}`}>{ok && <CheckCircle2 className="w-3.5 h-3.5" />}{status}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-3 flex-1">{desc}</p>
      <div className="mt-4">{action}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Source icon={Mail} tone="from-primary to-[hsl(41,100%,53%)]" title="E-pošta" ok={mailConnected}
          status={mailConnected ? `Povezano · ${count("email")} strank` : "Ni povezano"}
          desc="AI bere vaš poštni predal in sam prepozna povpraševanja — tudi obvestila obrazcev z vaše spletne strani."
          action={<Button asChild variant={mailConnected ? "outline" : "default"} className={mailConnected ? "w-full" : "w-full btn-brand"}><Link to="/nastavitve?tab=integracije">{mailConnected ? "Nastavitve pošte" : "Poveži predal"} <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>} />
        <Source icon={FileText} tone="from-emerald-500 to-teal-400" title="Obrazec na spletni strani" ok={count("form") > 0}
          status={count("form") > 0 ? `Deluje · ${count("form")} strank` : "Še ni prejel povpraševanja"}
          desc="Naš obrazec vstavite na svojo stran. Vsako oddano povpraševanje takoj dobi pripravljen odgovor."
          action={<Button variant="outline" className="w-full" onClick={() => setOpen(open === "form" ? null : "form")}>{open === "form" ? "Skrij" : "Nastavi obrazec"}</Button>} />
        <Source icon={MessageSquare} tone="from-violet-600 to-indigo-500" title="Spletni klepet" ok={count("chatbot") > 0}
          status={count("chatbot") > 0 ? `${count("chatbot")} strank iz klepeta` : "Še ni strank iz klepeta"}
          desc="Ko obiskovalec v klepetu pusti kontakt, postane stranka z zapisom pogovora."
          action={<Button asChild variant="outline" className="w-full"><Link to="/klepet">Odpri spletni klepet <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>} />
        <Source icon={Upload} tone="from-slate-700 to-slate-500" title="Uvoz obstoječih strank" ok={count("import") > 0}
          status={count("import") > 0 ? `${count("import")} uvoženih` : "Še nič uvoženega"}
          desc="Naložite Excel ali CSV s strankami, ki jih že imate. Uporabimo jih za vabila nazaj in prošnje za ocene."
          action={<Button variant="outline" className="w-full" onClick={onImport}>Uvozi datoteko</Button>} />
      </div>

      {open === "form" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card-elevated p-6 space-y-4">
            <div>
              <h3 className="text-lg">1. Prilagodite obrazec</h3>
              <p className="text-sm text-muted-foreground mt-1">Predogled se osvežuje sproti.</p>
            </div>
            <div className="space-y-1.5"><Label>Naslov</Label><Input value={cfg.lead_form_title || ""} onChange={(e) => setCfg({ ...cfg, lead_form_title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Besedilo gumba</Label><Input value={cfg.lead_form_button_text || ""} onChange={(e) => setCfg({ ...cfg, lead_form_button_text: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Barva</Label>
                <div className="flex gap-2"><input type="color" value={cfg.lead_form_primary_color || "#f84214"} onChange={(e) => setCfg({ ...cfg, lead_form_primary_color: e.target.value })} className="h-9 w-12 rounded-md border cursor-pointer p-1" /><Input value={cfg.lead_form_primary_color || ""} onChange={(e) => setCfg({ ...cfg, lead_form_primary_color: e.target.value })} /></div>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Sporočilo po oddaji</Label><Input value={cfg.lead_form_success_message || ""} onChange={(e) => setCfg({ ...cfg, lead_form_success_message: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Besedilo soglasja</Label><Textarea value={cfg.lead_form_consent_text || ""} onChange={(e) => setCfg({ ...cfg, lead_form_consent_text: e.target.value })} className="h-16 text-xs" /></div>
            <div className="flex gap-5 text-sm">
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={!!cfg.lead_form_show_phone} onCheckedChange={(v) => setCfg({ ...cfg, lead_form_show_phone: !!v })} /> Telefon</label>
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={!!cfg.lead_form_show_service} onCheckedChange={(v) => setCfg({ ...cfg, lead_form_show_service: !!v })} /> Izbira storitve</label>
            </div>
            <Button className="btn-brand" onClick={() => save.mutate(cfg)} disabled={save.isPending}>{save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Shrani obrazec</Button>

            <div className="pt-4 border-t space-y-2">
              <h3 className="text-lg">2. Vstavite na spletno stran</h3>
              <p className="text-sm text-muted-foreground">Kodo pošljite svojemu spletnemu skrbniku ali jo prilepite v HTML blok (WordPress: blok »Prilagojen HTML«).</p>
              <div className="relative">
                <pre className="bg-muted/60 rounded-xl p-3 pr-24 text-[11px] font-mono whitespace-pre-wrap break-all">{embedCode}</pre>
                <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={copy}>{copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}{copied ? "Kopirano" : "Kopiraj"}</Button>
              </div>
            </div>
            <div className="pt-4 border-t flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">3. Preizkusite, kako bo videti odgovor stranki.</p>
              <Button variant="outline" onClick={testLead} disabled={sendingTest}>{sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Testno povpraševanje</Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Tako bo obrazec videti na vaši strani</p>
            <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-3">
              <h3 className="text-lg font-bold text-gray-900">{cfg.lead_form_title}</h3>
              {["Ime *", "E-pošta *", cfg.lead_form_show_phone && "Telefon", cfg.lead_form_show_service && "Storitev"].filter(Boolean).map((f) => (
                <div key={f}><p className="text-xs font-medium text-gray-600 mb-1">{f}</p><div className="h-9 rounded-md border border-gray-200 bg-gray-50" /></div>
              ))}
              <div><p className="text-xs font-medium text-gray-600 mb-1">Sporočilo *</p><div className="h-20 rounded-md border border-gray-200 bg-gray-50" /></div>
              <p className="text-xs text-gray-500 flex gap-2"><span className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0 mt-0.5" />{cfg.lead_form_consent_text}</p>
              <div className="h-10 rounded-md text-white text-sm font-medium flex items-center justify-center" style={{ backgroundColor: cfg.lead_form_primary_color }}>{cfg.lead_form_button_text}</div>
            </div>
          </div>
        </div>
      )}

      {user?.role === "admin" && (
        <div>
          <button className="text-xs text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => setOpen(open === "webhook" ? null : "webhook")}><Webhook className="w-3.5 h-3.5" /> Webhook in API (samo skrbnik)</button>
          {open === "webhook" && <div className="mt-3"><WebhookTab /></div>}
        </div>
      )}
    </div>
  );
}
