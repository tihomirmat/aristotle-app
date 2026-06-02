import React, { useState } from "react";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Globe, Zap, BookOpen, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import EmbedFormBuilder from "./EmbedFormBuilder";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const FUNCTION_BASE_URL = "https://api.base44.com/api/apps/69fb8760fa0b118b8a291e26/functions";

const STEPS = [
  {
    num: "1",
    title: "Pridobite webhook URL",
    desc: "Kopirajte webhook URL spodaj. Ta URL je vaša unikatna vstopna točka za sprejemanje leadov.",
  },
  {
    num: "2",
    title: "Pošljite POST request",
    desc: "Na webhook URL pošljite POST request z JSON telesom. Obvezni polji sta name in email, business_id pa je že vgrajen v kodo spodaj.",
  },
  {
    num: "3",
    title: "Lead se ustvari v sistemu",
    desc: "Sistem samodejno ustvari Lead zapis, preveri podvojene vnose (po emailu) in sproži AI generiranje prvega osebnega sporočila.",
  },
  {
    num: "4",
    title: "Odobrite in pošljite",
    desc: "AI draft pristane v razdelku Prejeto. Ga preglejte, po potrebi uredite in z enim klikom pošljete na email stranke.",
  },
];

export default function WebhookTab() {
  const { business } = useBusiness();
  const [copied, setCopied] = useState(null);

  const webhookUrl = `${FUNCTION_BASE_URL}/leadWebhook`;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Kopirano!");
  };

  const webhookExample = `fetch("${webhookUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    business_id: "${business?.id || "VAŠ_BUSINESS_ID"}",
    name: "Ime Priimek",        // obvezno
    email: "stranka@email.si",  // obvezno
    phone: "+386 40 123 456",   // opcijsko
    message: "Zanima me vaša storitev", // opcijsko
    source: "form"              // opcijsko (privzeto: "form")
  })
})
.then(r => r.json())
.then(res => {
  if (res.success) {
    console.log("Lead ustvarjen:", res.lead_id);
  }
});`;

  const phpExample = `<?php
$data = [
  'business_id' => '${business?.id || "VAŠ_BUSINESS_ID"}',
  'name'  => $_POST['name'],
  'email' => $_POST['email'],
  'phone' => $_POST['phone'] ?? '',
  'source' => 'form',
];
$ch = curl_init('${webhookUrl}');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);
// $response['success'] === true če je uspelo
?>`;

  const zapierExample = `// Zapier: "Webhooks by Zapier" → POST
// URL: ${webhookUrl}
// Payload Type: JSON
// Data:
{
  "business_id": "${business?.id || "VAŠ_BUSINESS_ID"}",
  "name": "{{contact_name}}",
  "email": "{{contact_email}}",
  "phone": "{{contact_phone}}",
  "source": "zapier"
}`;

  const responseExample = `// Uspešen odgovor (HTTP 200):
{ "success": true, "lead_id": "abc123" }

// Podvojen email (HTTP 200 — ne vrne napake):
{ "success": true, "lead_id": "abc123", "duplicate": true }

// Napaka (HTTP 400 / 500):
{ "error": "name and email are required" }`;

  return (
    <div className="space-y-6 max-w-4xl">
      <Tabs defaultValue="navodila">
        <TabsList>
          <TabsTrigger value="navodila" className="gap-2">
            <BookOpen className="w-4 h-4" /> Navodila za integracijo
          </TabsTrigger>
          <TabsTrigger value="embed" className="gap-2">
            <Globe className="w-4 h-4" /> Embed forma (vizualni gradnik)
          </TabsTrigger>
        </TabsList>

        {/* ── NAVODILA ── */}
        <TabsContent value="navodila" className="space-y-6 mt-5">

          {/* Webhook URL */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Webhook URL</h3>
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Aktiven</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Pošljite POST request na ta URL iz kateregakoli sistema.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/50" />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl, "url")} className="shrink-0 gap-1.5">
                {copied === "url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Kopiraj
              </Button>
            </div>
          </div>

          {/* Koraki */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Kako deluje integracija</h3>
            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <div key={step.num} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{step.num}</div>
                  <div className="flex-1 pb-3 border-b last:border-0">
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Parametri */}
          <div className="bg-card border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Parametri zahteve</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left pb-2 pr-4">Polje</th>
                  <th className="text-left pb-2 pr-4">Tip</th>
                  <th className="text-left pb-2 pr-4">Zahtevano</th>
                  <th className="text-left pb-2">Opis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {[
                  ["business_id", "string", "Da", `Vaš ID: ${business?.id?.slice(0,12) || "…"}…`],
                  ["name", "string", "Da", "Ime in priimek stranke"],
                  ["email", "string", "Da", "Email naslov (preveri podvojene)"],
                  ["phone", "string", "Ne", "Telefonska številka"],
                  ["message", "string", "Ne", "Sporočilo/povpraševanje stranke"],
                  ["source", "string", "Ne", 'Vir leada. Privzeto: "form"'],
                ].map(([field, type, req, desc]) => (
                  <tr key={field}>
                    <td className="py-2 pr-4 font-mono text-primary">{field}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{type}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={req === "Da" ? "default" : "secondary"} className="text-xs">{req}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Primeri kode */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-5">
            <h3 className="font-semibold">Primeri kode</h3>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">JavaScript / Fetch</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => copyToClipboard(webhookExample, "js")}>
                  {copied === "js" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Kopiraj
                </Button>
              </div>
              <pre className="bg-muted/60 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">{webhookExample}</pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PHP / cURL</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => copyToClipboard(phpExample, "php")}>
                  {copied === "php" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Kopiraj
                </Button>
              </div>
              <pre className="bg-muted/60 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">{phpExample}</pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zapier / Make konfiguracija</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => copyToClipboard(zapierExample, "zapier")}>
                  {copied === "zapier" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Kopiraj
                </Button>
              </div>
              <pre className="bg-muted/60 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">{zapierExample}</pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Odgovor strežnika (Response)</span>
              </div>
              <pre className="bg-muted/60 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">{responseExample}</pre>
            </div>
          </div>

          {/* Opozorilo CORS */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">CORS — klic iz brskalnika</p>
              <p className="text-amber-700 text-xs mt-1">Webhook podpira CORS, tako da ga lahko kličete direktno iz JavaScript-a na spletni strani. Za serverski klic (PHP, Node.js) CORS ni potreben.</p>
            </div>
          </div>
        </TabsContent>

        {/* ── EMBED FORMA ── */}
        <TabsContent value="embed" className="mt-5">
          <EmbedFormBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}