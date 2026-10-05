import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Code2, Loader2, MessageCircle, Send, CheckCircle2, XCircle, Search, RotateCcw, Globe } from "lucide-react";
import { toast } from "sonner";
import { checkChatInstall } from "@/functions/checkChatInstall";
import { fnError } from "@/lib/fn-error";

const WIDGET_URL = "https://aristotle-smart-growth.base44.app/api/functions/chatbotWidget";
const RESPOND_URL = "https://aristotle-smart-growth.base44.app/api/functions/chatbotRespond";

const PLATFORMS = [
  { key: "wp", label: "WordPress", steps: ["Namestite brezplačni vtičnik »WPCode« (Vtičniki → Dodaj nov → WPCode).", "Code Snippets → Header & Footer → polje »Footer« → prilepite kodo → Save.", "Če imate vtičnik za predpomnjenje (WP Rocket, LiteSpeed …), počistite predpomnilnik.", "Alternativa za temo Divi: Divi → Theme Options → Integration → »Add code to the < body >«."] },
  { key: "wix", label: "Wix", steps: ["Nastavitve → Custom Code → + Add Custom Code.", "Prilepite kodo, izberite »All pages« in mesto »Body - end«.", "Objavite stran (Publish)."] },
  { key: "shopify", label: "Shopify", steps: ["Online Store → Themes → … → Edit code.", "Odprite theme.liquid, kodo prilepite tik pred </body>.", "Shranite."] },
  { key: "other", label: "Drugo", steps: ["Kodo prilepite na vse strani tik pred zaključno oznako </body> (ali jo pošljite svojemu izdelovalcu strani).", "Po namestitvi kliknite »Preveri« spodaj."] },
];

// Preizkusni klepet: pravi odgovori AI (isti kot na spletni strani), da lastnik vidi, ali deluje.
function LiveTest({ business, color, title, welcome }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: welcome }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState(null);
  const endRef = useRef(null);
  useEffect(() => { setMsgs((m) => (m.length <= 1 ? [{ role: "assistant", content: welcome }] : m)); }, [welcome]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "…", typing: true }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch(RESPOND_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: business.id, visitor_id: "lastnik_preizkus", conversation_id: convId, message: text }) });
      const d = await r.json();
      if (d.conversation_id) setConvId(d.conversation_id);
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: d.response || d.error || "Ni odgovora." }]);
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "Povezava ni uspela." }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border shadow-lg overflow-hidden bg-white flex flex-col h-[520px]">
      <div className="px-4 py-3 flex items-center justify-between text-white" style={{ backgroundColor: color }}>
        <span className="font-semibold text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" />{title}</span>
        <button onClick={() => { setMsgs([{ role: "assistant", content: welcome }]); setConvId(null); }} className="text-white/80 hover:text-white" title="Začni znova"><RotateCcw className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "ml-auto text-white rounded-br-sm" : "bg-white border rounded-bl-sm"} ${m.typing ? "animate-pulse" : ""}`} style={m.role === "user" ? { backgroundColor: color } : undefined}>{m.content}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t flex gap-2 bg-white">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Vprašajte kot obiskovalec, npr. »Koliko stane …?«" className="h-9" />
        <Button size="sm" className="h-9 text-white" style={{ backgroundColor: color }} onClick={send} disabled={busy || !input.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
      </div>
    </div>
  );
}

export default function EmbedTab({ business }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState("wp");
  const [checkUrl, setCheckUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null);
  const [widgetForm, setWidgetForm] = useState({ widget_primary_color: "#f84214", widget_welcome_message: "Pozdravljeni! Kako vam lahko pomagam?", widget_position: "bottom-right", widget_title: "" });

  useEffect(() => {
    if (business) {
      setWidgetForm({
        widget_primary_color: business.widget_primary_color || "#f84214",
        widget_welcome_message: business.widget_welcome_message || "Pozdravljeni! Kako vam lahko pomagam?",
        widget_position: business.widget_position || "bottom-right",
        widget_title: business.widget_title || business.name || "",
      });
      setCheckUrl((u) => u || business.website || "");
    }
  }, [business]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["business"] }); toast.success("Shranjeno. Kopirajte kodo znova, če ste jo že namestili."); },
  });

  const color = widgetForm.widget_primary_color;
  const title = widgetForm.widget_title || business?.name || "Pomočnik";
  const position = widgetForm.widget_position || "bottom-right";
  const welcome = widgetForm.widget_welcome_message;

  const embedCode = `<!-- AI klepet -->
<script>
  window.ARISTOTLE_CONFIG = {
    businessId: ${JSON.stringify(business?.id || "")},
    primaryColor: ${JSON.stringify(color)},
    welcomeMessage: ${JSON.stringify(welcome || "")},
    position: ${JSON.stringify(position)},
    title: ${JSON.stringify(title)}
  };
</script>
<script src="${WIDGET_URL}" defer></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Koda kopirana.");
  };
  const runCheck = async () => {
    setChecking(true); setCheck(null);
    try {
      const res = await checkChatInstall({ business_id: business.id, url: checkUrl });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      setCheck(d);
    } catch (e) { toast.error(fnError(e)); } finally { setChecking(false); }
  };
  const P = PLATFORMS.find((p) => p.key === platform);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
      <div className="space-y-5 min-w-0">
        {/* 1. Namestitev */}
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span><h3 className="font-semibold">Kopirajte kodo</h3></div>
          <div className="relative">
            <pre className="bg-muted/60 rounded-lg p-3 pr-28 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-56">{embedCode}</pre>
            <Button size="sm" className="absolute top-2 right-2 gap-1.5 btn-brand" onClick={handleCopy}>{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Kopirano" : "Kopiraj kodo"}</Button>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span><h3 className="font-semibold">Prilepite jo na svojo spletno stran</h3></div>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => <button key={p.key} onClick={() => setPlatform(p.key)} className={`text-xs px-3 py-1.5 rounded-full border ${platform === p.key ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{p.label}</button>)}
          </div>
          <ol className="space-y-2">
            {P.steps.map((s, i) => <li key={i} className="flex gap-2 text-sm"><span className="text-muted-foreground font-medium w-4 shrink-0">{i + 1}.</span><span>{s}</span></li>)}
          </ol>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</span><h3 className="font-semibold">Preverite, ali je nameščeno</h3></div>
          <div className="flex gap-2">
            <div className="relative flex-1"><Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={checkUrl} onChange={(e) => setCheckUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runCheck()} placeholder="www.vasa-stran.si" className="pl-9" /></div>
            <Button variant="outline" onClick={runCheck} disabled={checking || !checkUrl.trim()}>{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-1.5" />Preveri</>}</Button>
          </div>
          {check && (
            <div className={`rounded-lg border p-3 text-sm flex gap-2 ${check.installed ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
              {check.installed ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
              <div><p className="font-medium">{check.installed ? "Nameščeno" : "Ni nameščeno"} — {check.url}</p><p className="mt-0.5">{check.message}</p></div>
            </div>
          )}
        </div>

        {/* Videz */}
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold">Videz klepeta</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Barva</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setWidgetForm({ ...widgetForm, widget_primary_color: e.target.value })} className="h-9 w-14 rounded-md border cursor-pointer p-1" />
                <Input value={color} onChange={(e) => setWidgetForm({ ...widgetForm, widget_primary_color: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Naslov</Label><Input value={widgetForm.widget_title} onChange={(e) => setWidgetForm({ ...widgetForm, widget_title: e.target.value })} placeholder={business?.name || "Pomočnik"} /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between"><Label>Pozdravno sporočilo</Label><span className="text-xs text-muted-foreground">{welcome.length}/200</span></div>
              <Textarea value={welcome} onChange={(e) => setWidgetForm({ ...widgetForm, widget_welcome_message: e.target.value.slice(0, 200) })} className="h-20 resize-none text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Položaj gumba</Label>
              <Select value={position} onValueChange={(v) => setWidgetForm({ ...widgetForm, widget_position: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bottom-right">Spodaj desno</SelectItem><SelectItem value="bottom-left">Spodaj levo</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button className="w-full btn-brand" onClick={() => saveMutation.mutate(widgetForm)} disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani videz</Button></div>
          </div>
          <p className="text-xs text-muted-foreground">Po spremembi videza kodo kopirajte in prilepite znova.</p>
        </div>
      </div>

      {/* Desno: pravi preizkus */}
      <div className="space-y-2 xl:sticky xl:top-20">
        <p className="text-sm font-semibold">Preizkusite klepet zdaj</p>
        <p className="text-xs text-muted-foreground">To je pravi AI z vašo bazo znanja — enako bodo odgovori videti na vaši spletni strani.</p>
        {business && <LiveTest business={business} color={color} title={title} welcome={welcome} />}
      </div>
    </div>
  );
}
