import React, { useState } from "react";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Plus, Trash2, Globe, GripVertical } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_BASE_URL = "https://api.base44.com/api/apps/69fb8760fa0b118b8a291e26/functions";

const DEFAULT_FIELDS = [
  { id: "name", label: "Ime in priimek", placeholder: "Ime in priimek *", type: "text", required: true, fixed: true, enabled: true },
  { id: "email", label: "E-pošta", placeholder: "E-poštni naslov *", type: "email", required: true, fixed: true, enabled: true },
  { id: "phone", label: "Telefon", placeholder: "Telefon", type: "tel", required: false, fixed: false, enabled: true },
  { id: "message", label: "Sporočilo", placeholder: "Sporočilo (opcijsko)", type: "textarea", required: false, fixed: false, enabled: true },
];

export default function EmbedFormBuilder() {
  const { business } = useBusiness();
  const [copied, setCopied] = useState(false);

  // Style config
  const [style, setStyle] = useState({
    primaryColor: business?.lead_form_primary_color || "#6366f1",
    bgColor: "#ffffff",
    textColor: "#111111",
    borderColor: "#e2e8f0",
    borderRadius: "8",
    fontFamily: "system-ui, sans-serif",
    padding: "24",
    inputBg: "#f8fafc",
    buttonTextColor: "#ffffff",
    shadow: true,
  });

  // Form text config
  const [formText, setFormText] = useState({
    title: business?.lead_form_title || "Pošljite povpraševanje",
    buttonText: business?.lead_form_button_text || "Pošlji povpraševanje",
    successMessage: business?.lead_form_success_message || "Hvala! Kontaktirali vas bomo v najkrajšem možnem času.",
  });

  // Fields config
  const [fields, setFields] = useState(DEFAULT_FIELDS);

  const webhookUrl = `${FUNCTION_BASE_URL}/leadWebhook`;

  const updateField = (id, key, value) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const addCustomField = () => {
    const id = `custom_${Date.now()}`;
    setFields([...fields, { id, label: "Novo polje", placeholder: "Vnesite vrednost", type: "text", required: false, fixed: false, enabled: true, custom: true }]);
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
  };

  // Build the fields HTML string for embed script
  const fieldsHtml = fields
    .filter(f => f.enabled)
    .map(f => {
      if (f.type === "textarea") return `    '<textarea name="${f.id}" placeholder="${f.placeholder}"${f.required ? ' required' : ''}></textarea>',`;
      return `    '<input type="${f.type}" name="${f.id}" placeholder="${f.placeholder}"${f.required ? ' required' : ''} />',`;
    })
    .join("\n");

  // Build data collection for submit
  const dataFields = fields
    .filter(f => f.enabled && !f.fixed)
    .map(f => `    if (form.${f.id}) data.${f.id} = form.${f.id}.value.trim();`)
    .join("\n");

  const rr = style.borderRadius;
  const pad = style.padding;
  const shadow = style.shadow ? "0 2px 16px rgba(0,0,0,0.08)" : "none";

  const embedScript = `<!-- Aristotle Lead Forma -->
<div id="aristotle-lead-form"></div>
<script>
(function() {
  var config = {
    businessId: "${business?.id || "VAŠ_BUSINESS_ID"}",
    webhookUrl: "${webhookUrl}",
    title: "${formText.title}",
    buttonText: "${formText.buttonText}",
    successMessage: "${formText.successMessage}",
  };

  var style = document.createElement('style');
  style.textContent = [
    '#aristotle-lead-form { font-family: ${style.fontFamily}; max-width: 480px; }',
    '#aristotle-lead-form form { display: flex; flex-direction: column; gap: 12px; padding: ${pad}px; background: ${style.bgColor}; border-radius: ${rr}px; box-shadow: ${shadow}; }',
    '#aristotle-lead-form h3 { margin: 0 0 4px 0; font-size: 1.1rem; color: ${style.textColor}; }',
    '#aristotle-lead-form input, #aristotle-lead-form textarea { width: 100%; padding: 10px 12px; border: 1px solid ${style.borderColor}; border-radius: ${rr}px; font-size: 14px; background: ${style.inputBg}; color: ${style.textColor}; box-sizing: border-box; outline: none; transition: border 0.2s; font-family: inherit; }',
    '#aristotle-lead-form input:focus, #aristotle-lead-form textarea:focus { border-color: ${style.primaryColor}; }',
    '#aristotle-lead-form textarea { height: 80px; resize: vertical; }',
    '#aristotle-lead-form button[type=submit] { padding: 11px; background: ${style.primaryColor}; color: ${style.buttonTextColor}; border: none; border-radius: ${rr}px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; font-family: inherit; }',
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
${fieldsHtml}
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
${dataFields}

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

  const handleCopy = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Embed koda kopirana!");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT: Style + Fields config */}
        <div className="xl:col-span-2 space-y-5">

          {/* Besedila */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm">Besedila forme</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Naslov</Label>
                <Input value={formText.title} onChange={e => setFormText({ ...formText, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Besedilo gumba</Label>
                <Input value={formText.buttonText} onChange={e => setFormText({ ...formText, buttonText: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Sporočilo po oddaji</Label>
                <Input value={formText.successMessage} onChange={e => setFormText({ ...formText, successMessage: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Stiliziranje */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm">CSS stiliziranje</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Primarna barva (gumb, fokus)</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={style.primaryColor} onChange={e => setStyle({ ...style, primaryColor: e.target.value })} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                  <Input value={style.primaryColor} onChange={e => setStyle({ ...style, primaryColor: e.target.value })} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ozadje forme</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={style.bgColor} onChange={e => setStyle({ ...style, bgColor: e.target.value })} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                  <Input value={style.bgColor} onChange={e => setStyle({ ...style, bgColor: e.target.value })} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Barva besedila</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={style.textColor} onChange={e => setStyle({ ...style, textColor: e.target.value })} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                  <Input value={style.textColor} onChange={e => setStyle({ ...style, textColor: e.target.value })} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Barva rob polj</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={style.borderColor} onChange={e => setStyle({ ...style, borderColor: e.target.value })} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                  <Input value={style.borderColor} onChange={e => setStyle({ ...style, borderColor: e.target.value })} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ozadje polj (input)</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={style.inputBg} onChange={e => setStyle({ ...style, inputBg: e.target.value })} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                  <Input value={style.inputBg} onChange={e => setStyle({ ...style, inputBg: e.target.value })} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Barva besedila gumba</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={style.buttonTextColor} onChange={e => setStyle({ ...style, buttonTextColor: e.target.value })} className="w-9 h-9 rounded border cursor-pointer p-0.5" />
                  <Input value={style.buttonTextColor} onChange={e => setStyle({ ...style, buttonTextColor: e.target.value })} className="text-xs font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Zaobljenost robov (px)</Label>
                <Input type="number" min="0" max="32" value={style.borderRadius} onChange={e => setStyle({ ...style, borderRadius: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notranji odmik (px)</Label>
                <Input type="number" min="8" max="48" value={style.padding} onChange={e => setStyle({ ...style, padding: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pisava (font-family)</Label>
                <Input value={style.fontFamily} onChange={e => setStyle({ ...style, fontFamily: e.target.value })} className="text-xs" placeholder="system-ui, sans-serif" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={style.shadow} onCheckedChange={v => setStyle({ ...style, shadow: v })} />
              <Label className="text-sm cursor-pointer" onClick={() => setStyle({ ...style, shadow: !style.shadow })}>Senca pod formo</Label>
            </div>
          </div>

          {/* Polja */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Polja forme</h3>
              <Button size="sm" variant="outline" onClick={addCustomField} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Dodaj polje
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.id} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={field.label}
                      onChange={e => updateField(field.id, "label", e.target.value)}
                      placeholder="Oznaka polja"
                      className="text-xs h-8"
                      disabled={field.fixed}
                    />
                    <Input
                      value={field.placeholder}
                      onChange={e => updateField(field.id, "placeholder", e.target.value)}
                      placeholder="Placeholder besedilo"
                      className="text-xs h-8"
                    />
                    <div className="flex items-center gap-2">
                      {!field.fixed && (
                        <select
                          value={field.type}
                          onChange={e => updateField(field.id, "type", e.target.value)}
                          className="h-8 rounded-md border border-input bg-transparent text-xs px-2 flex-1"
                        >
                          <option value="text">Besedilo</option>
                          <option value="email">E-pošta</option>
                          <option value="tel">Telefon</option>
                          <option value="number">Številka</option>
                          <option value="textarea">Dolgo besedilo</option>
                        </select>
                      )}
                      {field.fixed && <span className="text-xs text-muted-foreground flex-1">Obvezno</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!field.fixed && (
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={v => updateField(field.id, "enabled", v)}
                        className="scale-75"
                      />
                    )}
                    {field.custom && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeField(field.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Live preview + koda */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Predogled forme</p>
            <div
              className="rounded-xl p-6 space-y-3"
              style={{
                background: style.bgColor,
                boxShadow: style.shadow ? "0 2px 16px rgba(0,0,0,0.08)" : "none",
                borderRadius: `${style.borderRadius}px`,
                fontFamily: style.fontFamily,
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 className="font-bold text-base" style={{ color: style.textColor }}>{formText.title || "Forma"}</h3>
              {fields.filter(f => f.enabled).map(f => (
                <div key={f.id}>
                  {f.type === "textarea" ? (
                    <div
                      className="w-full h-16 px-3 py-2 text-xs"
                      style={{
                        border: `1px solid ${style.borderColor}`,
                        borderRadius: `${style.borderRadius}px`,
                        background: style.inputBg,
                        color: `${style.textColor}88`,
                      }}
                    >
                      {f.placeholder}
                    </div>
                  ) : (
                    <div
                      className="w-full h-9 px-3 flex items-center text-xs"
                      style={{
                        border: `1px solid ${style.borderColor}`,
                        borderRadius: `${style.borderRadius}px`,
                        background: style.inputBg,
                        color: `${style.textColor}88`,
                      }}
                    >
                      {f.placeholder}
                    </div>
                  )}
                </div>
              ))}
              <button
                className="w-full py-2.5 text-sm font-semibold rounded-lg"
                style={{
                  background: style.primaryColor,
                  color: style.buttonTextColor,
                  borderRadius: `${style.borderRadius}px`,
                  border: "none",
                }}
              >
                {formText.buttonText || "Pošlji"}
              </button>
            </div>
          </div>

          {/* Embed koda */}
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Embed koda</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Kopirano!" : "Kopiraj"}
              </Button>
            </div>
            <pre className="bg-muted/60 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
              {embedScript.slice(0, 400)}...
            </pre>
            <p className="text-xs text-muted-foreground mt-2">Prilepite celotno kodo na spletno stran. Klik "Kopiraj" skopira celoten script.</p>
          </div>
        </div>
      </div>
    </div>
  );
}