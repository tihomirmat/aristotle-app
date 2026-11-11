import { useEffect, useRef, useState } from "react";
import { voice } from "@/functions/voice";

// Glas (ElevenLabs prek funkcije `voice`): snemanje → slovensko besedilo, branje odgovora na glas.
const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(blob); });
const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
};

export function useVoice(businessId) {
  const [enabled, setEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false); // prepis ali branje v teku
  const [speaking, setSpeaking] = useState(false);
  const rec = useRef(null);
  const chunks = useRef([]);
  const audio = useRef(null);

  useEffect(() => {
    if (!businessId) return;
    voice({ business_id: businessId, action: "status" }).then((r) => setEnabled(!!(r?.data ?? r)?.enabled)).catch(() => setEnabled(false));
  }, [businessId]);

  // start() → posluša; stop() vrne prepisano besedilo
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data?.size && chunks.current.push(e.data);
    r.start();
    rec.current = r;
    // varovalo: največ 60 s snemanja
    setTimeout(() => { if (rec.current === r && r.state === "recording") r.requestData?.(); }, 60000);
    setRecording(true);
  };
  const stop = () => new Promise((resolve, reject) => {
    const r = rec.current;
    if (!r) return resolve("");
    r.onstop = async () => {
      r.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setBusy(true);
      try {
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        const res = await voice({ business_id: businessId, action: "transcribe", audio: await blobToB64(blob), mime: blob.type });
        const d = res?.data ?? res;
        if (d?.error) throw new Error(d.error);
        resolve(d.text || "");
      } catch (e) { reject(e); } finally { setBusy(false); rec.current = null; }
    };
    r.stop();
  });
  const say = async (text) => {
    try {
      setSpeaking(true);
      const res = await voice({ business_id: businessId, action: "speak", text });
      const d = res?.data ?? res;
      if (d?.error || !d?.audio) throw new Error(d?.error || "Branje ni uspelo.");
      audio.current?.pause();
      const a = new Audio(`data:audio/mpeg;base64,${d.audio}`);
      audio.current = a;
      a.onended = () => setSpeaking(false);
      await a.play();
    } catch (e) { setSpeaking(false); throw e; }
  };
  const silence = () => { audio.current?.pause(); setSpeaking(false); };
  return { enabled, recording, busy, speaking, start, stop, say, silence, supported: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined" };
}
