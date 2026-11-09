import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Send, RotateCcw } from "lucide-react";

const RESPOND_URL = "https://aristotle-smart-growth.base44.app/api/functions/chatbotRespond";

// Pravi klepet (isti AI kot na spletni strani), da lastnik takoj vidi, kako odgovarja.
// `ask` = { text, n }: vprašanje, poslano od zunaj (gumbi s primeri vprašanj).
export default function ChatPreview({ business, color = "#f84214", title, welcome, ask, locked, height = 520 }) {
  const first = [{ role: "assistant", content: welcome || "Pozdravljeni! Kako vam lahko pomagam?" }];
  const [msgs, setMsgs] = useState(first);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState(null);
  const boxRef = useRef(null);
  useEffect(() => { setMsgs((m) => (m.length <= 1 ? first : m)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [welcome]);
  useEffect(() => { const b = boxRef.current; if (b) b.scrollTop = b.scrollHeight; }, [msgs]);

  const send = async (forced) => {
    const text = String(forced ?? input).trim();
    if (!text || busy || locked) return;
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "…", typing: true }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch(RESPOND_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business_id: business.id, visitor_id: "lastnik_preizkus", conversation_id: convId, message: text }) });
      const d = await r.json();
      if (d.conversation_id) setConvId(d.conversation_id);
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: d.response || d.error || "Ni odgovora." }]);
    } catch { setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "Povezava ni uspela. Poskusite znova." }]); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (ask?.text) send(ask.text); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ask?.n]);

  return (
    <div className="rounded-3xl border shadow-xl overflow-hidden bg-white flex flex-col relative" style={{ height }}>
      <div className="px-4 py-3.5 flex items-center gap-3 text-white" style={{ backgroundColor: color }}>
        <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{title || business?.name || "Pomočnik"}</p><p className="text-[11px] text-white/80">Odgovarja takoj</p></div>
        <button onClick={() => { setMsgs(first); setConvId(null); }} className="text-white/80 hover:text-white" title="Začni znova"><RotateCcw className="w-4 h-4" /></button>
      </div>
      <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "ml-auto text-white rounded-br-md" : "bg-white border rounded-bl-md text-slate-800"} ${m.typing ? "animate-pulse" : ""}`} style={m.role === "user" ? { backgroundColor: color } : undefined}>{m.content}</div>
        ))}
      </div>
      <div className="p-2.5 border-t flex gap-2 bg-white">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Napišite vprašanje …" className="h-10 rounded-full px-4" disabled={locked} />
        <Button className="h-10 w-10 p-0 rounded-full text-white shrink-0" style={{ backgroundColor: color }} onClick={() => send()} disabled={busy || !input.trim() || locked}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
      </div>
      {locked && <div className="absolute inset-x-0 bottom-0 top-[64px] bg-white/85 flex items-center justify-center p-8 text-center"><p className="text-sm font-medium text-slate-600">Ko klepet prebere vašo spletno stran, ga boste tukaj lahko preizkusili.</p></div>}
    </div>
  );
}
