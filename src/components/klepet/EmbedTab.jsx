import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Code2, Smartphone, Globe } from "lucide-react";

export default function EmbedTab({ business }) {
  const [copied, setCopied] = useState(false);

  const embedCode = `<!-- Studio Fit Chatbot Widget -->
<script>
  window.SF_CHATBOT_BUSINESS_ID = "${business?.id || 'VAŠ_BUSINESS_ID'}";
  window.SF_CHATBOT_NAME = "${business?.name || 'Pomočnik'}";
  window.SF_CHATBOT_COLOR = "#5B4AE8";
</script>
<script src="https://cdn.yourapp.com/chatbot-widget.js" async></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Code2 className="w-4 h-4 text-primary" />
          <h3 className="font-medium text-sm">Embed koda</h3>
          <Badge className="bg-primary/10 text-primary border-0 text-xs">Kopirajte na vašo spletno stran</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Prilepite naslednjo kodo tik pred zapiralni <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag vaše spletne strani.
        </p>
        <div className="relative">
          <pre className="bg-muted/60 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed text-foreground whitespace-pre-wrap break-all">
            {embedCode}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Kopirano!" : "Kopiraj"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Spletna stran</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dodajte kodo v <strong>WordPress</strong>, <strong>Wix</strong>, <strong>Squarespace</strong> ali kateri koli drug CMS sistem v razdelek za custom HTML/Scripts.
          </p>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">Mobilna prilagoditev</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Widget se samodejno prilagodi mobilnim napravam in se prikaže kot ikona v kotu zaslona.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-800">
          <strong>Opomba:</strong> Widget bo aktiven po namestitvi kode. Pogovori se bodo samodejno shranjevali v razdelek "Pogovori". 
          Za prilagoditev barv, pozdravn sporočil in vedenja se obrnite na podporo.
        </p>
      </div>
    </div>
  );
}