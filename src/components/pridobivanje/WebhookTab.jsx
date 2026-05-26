import React, { useState } from "react";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Code, Globe, Zap } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_BASE_URL = "https://api.base44.com/api/apps/69fb8760fa0b118b8a291e26/functions";

export default function WebhookTab() {
  const { business } = useBusiness();
  const [copied, setCopied] = useState(null);
  const [formColor, setFormColor] = useState(business?.lead_form_primary_color || "#6366f1");

  const webhookUrl = `${FUNCTION_BASE_URL}/leadWebhook`;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Kopirano!");
  };

  const webhookExample = `// Primer POST klica (fetch)
fetch("${webhookUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    business_id: "${business?.id || "VAŠ_BUSINESS_ID"}",
    name: "Ime Priimek",
    email: "stranka@email.si",
    phone: "+386 40 123 456",  // opcijsko
    message: "Zanima me vaša storitev", // opcijsko
    source: "form"
  })
});`;

  const embedScript = `<!-- Aristotle Lead Forma -->
<div id="aristotle-lead-form"></div>
<script>
(function() {
  var config = {
    businessId: "${business?.id || "VAŠ_BUSINESS_ID"}",
    webhookUrl: "${webhookUrl}",
    primaryColor: "${formColor}",
    title: "${business?.lead_form_title || "Pošljite povpraševanje"}",
    buttonText: "${business?.lead_form_button_text || "Pošlji povpraševanje"}",
    successMessage: "${business?.lead_form_success_message || "Hvala! Kontaktirali vas bomo v najkrajšem možnem času."}",
    showPhone: ${business?.lead_form_show_phone !== false ? "true" : "false"},
    showMessage: true
  };

  var style = document.createElement('style');
  style.textContent = [
    '#aristotle-lead-form { font-family: system-ui, sans-serif; max-width: 480px; }',
    '#aristotle-lead-form form { display: flex; flex-direction: column; gap: 12px; padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }',
    '#aristotle-lead-form h3 { margin: 0 0 4px 0; font-size: 1.1rem; color: #111; }',
    '#aristotle-lead-form input, #aristotle-lead-form textarea { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border 0.2s; }',
    '#aristotle-lead-form input:focus, #aristotle-lead-form textarea:focus { border-color: ' + config.primaryColor + '; }',
    '#aristotle-lead-form textarea { height: 80px; resize: vertical; }',
    '#aristotle-lead-form button[type=submit] { padding: 11px; background: ' + config.primaryColor + '; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }',
    '#aristotle-lead-form button[type=submit]:hover { opacity: 0.88; }',
    '#aristotle-lead-form button[type=submit]:disabled { opacity: 0.5; cursor: not-allowed; }',
    '#aristotle-lead-form .success { text-align: center; padding: 24px; color: #16a34a; font-weight: 600; }',
    '#aristotle-lead-form .error-msg { color: #dc2626; font-size: 13px; }',
  ].join('');
  document.head.appendChild(style);

  var container = document.getElementById('aristotle-lead-form');
  if (!container) return;

  var form = document.createElement('form');
  form.innerHTML = [
    '<h3>' + config.title + '</h3>',
    '<input type="text" name="name" placeholder="Ime in priimek *" required />',
    '<input type="email" name="email" placeholder="E-poštni naslov *" required />',
    config.showPhone ? '<input type="tel" name="phone" placeholder="Telefon" />' : '',
    config.showMessage ? '<textarea name="message" placeholder="Sporočilo (opcijsko)"></textarea>' : '',
    '<button type="submit">' + config.buttonText + '</button>',
    '<div class="error-msg" id="arist-error"></div>',
  ].join('');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]');
    var errEl = document.getElementById('arist-error');
    btn.disabled = true;
    btn.textContent = 'Pošiljam...';
    errEl.textContent = '';

    var data = {
      business_id: config.businessId,
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      source: 'form',
    };
    if (config.showPhone && form.phone) data.phone = form.phone.value.trim();
    if (config.showMessage && form.message) data.message = form.message.value.trim();

    fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.success) {
        container.innerHTML = '<div class="success">✓ ' + config.successMessage + '</div>';
      } else {
        errEl.textContent = res.error || 'Napaka pri pošiljanju.';
        btn.disabled = false;
        btn.textContent = config.buttonText;
      }
    })
    .catch(function() {
      errEl.textContent = 'Napaka pri povezavi. Prosimo poskusite znova.';
      btn.disabled = false;
      btn.textContent = config.buttonText;
    });
  });

  container.appendChild(form);
})();
</script>`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Webhook URL */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Webhook URL</h3>
          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Aktiven</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Pošljite POST request na ta URL iz kateregakoli sistema (spletna stran, Zapier, Make, itd.).
        </p>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/50" />
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl, "url")} className="shrink-0 gap-1.5">
            {copied === "url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Kopiraj
          </Button>
        </div>
      </div>

      {/* Webhook primer */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Primer integracije (JavaScript)</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookExample, "example")} className="gap-1.5">
            {copied === "example" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Kopiraj
          </Button>
        </div>
        <pre className="bg-muted/60 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
          {webhookExample}
        </pre>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div><span className="font-medium text-foreground">Zahtevano:</span> business_id, name, email</div>
          <div><span className="font-medium text-foreground">Opcijsko:</span> phone, message, source</div>
        </div>
      </div>

      {/* Embed forma */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Embed forma za spletno stran</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(embedScript, "embed")} className="gap-1.5">
            {copied === "embed" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Kopiraj kodo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Prilepite to kodo kamorkoli na vašo spletno stran. Forma se avtomatično naloži in pošlje leade direktno v sistem.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <Label className="text-sm shrink-0">Barva forme:</Label>
          <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border" />
          <span className="text-xs text-muted-foreground font-mono">{formColor}</span>
        </div>
        <pre className="bg-muted/60 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64">
          {embedScript}
        </pre>
      </div>

      {/* Navodila */}
      <div className="bg-accent/50 border border-accent rounded-xl p-4 text-sm space-y-1">
        <p className="font-semibold text-accent-foreground">Kako deluje po prejemu leada:</p>
        <p className="text-muted-foreground">1. Webhook ustvari nov Lead zapis v sistemu</p>
        <p className="text-muted-foreground">2. AI samodejno generira osebno sporočilo (draft)</p>
        <p className="text-muted-foreground">3. Draft pristane v <strong>Prejeto</strong> za vašo odobritev</p>
        <p className="text-muted-foreground">4. Po odobritvi se pošlje na email stranke</p>
      </div>
    </div>
  );
}