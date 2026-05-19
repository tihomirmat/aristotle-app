import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Code2, Smartphone, Globe, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

export default function EmbedTab({ business }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [widgetForm, setWidgetForm] = useState({
    widget_primary_color: "#10b981",
    widget_welcome_message: "Pozdravljeni! Z veseljem vam pomagamo. Kako vam lahko pomagam?",
    widget_position: "bottom-right",
    widget_title: "",
  });

  useEffect(() => {
    if (business) {
      setWidgetForm({
        widget_primary_color: business.widget_primary_color || "#10b981",
        widget_welcome_message: business.widget_welcome_message || "Pozdravljeni! Z veseljem vam pomagamo. Kako vam lahko pomagam?",
        widget_position: business.widget_position || "bottom-right",
        widget_title: business.widget_title || business.name || "",
      });
    }
  }, [business]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success("Nastavitve widgeta shranjene");
    },
  });

  const color = widgetForm.widget_primary_color;
  const title = widgetForm.widget_title || business?.name || "Pomočnik";
  const position = widgetForm.widget_position || "bottom-right";
  const welcome = widgetForm.widget_welcome_message;

  const embedCode = `<!-- Aristotle Chatbot Widget -->
<script>
  window.ARISTOTLE_CONFIG = {
    businessId: "${business?.id || 'VAŠ_BUSINESS_ID'}",
    primaryColor: "${color}",
    welcomeMessage: "${welcome}",
    position: "${position}",
    title: "${title}"
  };
</script>
<script src="https://aristotle-smart-growth.base44.app/chatbot-widget.js" defer></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Koda kopirana v odložišče");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
      {/* LEFT: Settings */}
      <div className="space-y-5">
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm">Prilagoditev widgeta</h3>

          <div className="space-y-1.5">
            <Label>Barva widgeta</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={widgetForm.widget_primary_color}
                onChange={(e) => setWidgetForm({ ...widgetForm, widget_primary_color: e.target.value })}
                className="h-9 w-16 rounded-md border border-input cursor-pointer p-1"
              />
              <Input
                value={widgetForm.widget_primary_color}
                onChange={(e) => setWidgetForm({ ...widgetForm, widget_primary_color: e.target.value })}
                placeholder="#10b981"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Naslov widgeta</Label>
            <Input
              value={widgetForm.widget_title}
              onChange={(e) => setWidgetForm({ ...widgetForm, widget_title: e.target.value })}
              placeholder={business?.name || "Pomočnik"}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Pozdravno sporočilo</Label>
              <span className="text-xs text-muted-foreground">{widgetForm.widget_welcome_message.length}/200</span>
            </div>
            <Textarea
              value={widgetForm.widget_welcome_message}
              onChange={(e) => setWidgetForm({ ...widgetForm, widget_welcome_message: e.target.value.slice(0, 200) })}
              className="h-20 resize-none text-sm"
              placeholder="Pozdravljeni! Kako vam lahko pomagam?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Pozicija</Label>
            <Select value={widgetForm.widget_position} onValueChange={(v) => setWidgetForm({ ...widgetForm, widget_position: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">Spodaj desno</SelectItem>
                <SelectItem value="bottom-left">Spodaj levo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate(widgetForm)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Posodobi embed code
          </Button>
        </div>

        {/* Embed code */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">Embed koda</h3>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">Kopirajte na spletno stran</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Prilepite tik pred <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag vaše spletne strani.
          </p>
          <div className="relative">
            <pre className="bg-muted/60 rounded-lg p-3 text-xs font-mono overflow-x-auto leading-relaxed text-foreground whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <Button size="sm" variant="outline" className="absolute top-2 right-2 gap-1.5 text-xs" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Kopirano!" : "Kopiraj"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">CMS sistemi</span>
            </div>
            <p className="text-xs text-muted-foreground">WordPress, Wix, Squarespace — dodajte v Custom HTML/Scripts.</p>
          </div>
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Mobilno</span>
            </div>
            <p className="text-xs text-muted-foreground">Widget se samodejno prilagodi mobilnim napravam.</p>
          </div>
        </div>
      </div>

      {/* RIGHT: Live Preview */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Predogled widgeta</p>
        <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl border h-[480px] overflow-hidden">
          {/* Fake website bg */}
          <div className="p-6 space-y-3 opacity-40">
            <div className="h-3 bg-slate-400 rounded w-3/4" />
            <div className="h-3 bg-slate-300 rounded w-1/2" />
            <div className="h-3 bg-slate-300 rounded w-2/3" />
            <div className="h-16 bg-slate-300 rounded mt-4" />
            <div className="h-3 bg-slate-300 rounded w-1/3" />
          </div>

          {/* Chat window preview */}
          <div
            className={`absolute bottom-20 ${position === 'bottom-right' ? 'right-4' : 'left-4'} w-64 bg-white rounded-2xl shadow-2xl border overflow-hidden`}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: color }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white text-xs font-semibold truncate max-w-[120px]">{title}</span>
              </div>
              <X className="w-3.5 h-3.5 text-white/80" />
            </div>
            {/* Message */}
            <div className="p-3">
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
                <p className="text-xs text-gray-700 leading-relaxed">{welcome}</p>
              </div>
              <div className="mt-3 flex gap-1">
                <div className="flex-1 h-7 bg-gray-100 rounded-full" />
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                  <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* FAB */}
          <div
            className={`absolute bottom-4 ${position === 'bottom-right' ? 'right-4' : 'left-4'} w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer`}
            style={{ backgroundColor: color }}
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}