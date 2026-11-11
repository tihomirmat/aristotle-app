import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Mail, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2, AlertCircle, ChevronDown, Gauge } from "lucide-react";
import { toast } from "sonner";
import { connectMailbox } from "@/functions/connectMailbox";
import { fnError } from "@/lib/fn-error";
import { cnt, W, fmtDateTime } from "@/lib/crm";

// Enako kot shared/campaignMail.js
const WARMUP_DAYS = 14;
export const autoLimit = (mb) => (!mb?.first_send_at || Date.now() - new Date(mb.first_send_at).getTime() < WARMUP_DAYS * 86400000 ? 20 : 50);
export const dailyLimit = (mb) => (Number(mb?.daily_limit_manual) > 0 ? Number(mb.daily_limit_manual) : autoLimit(mb));
const todayLj = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana" }).format(new Date());
export const sentToday = (mb) => (mb?.sent_date === todayLj() ? Number(mb.sent_today) || 0 : 0);

function ConnectForm({ business, onDone, onCancel, first }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(business?.smtp_from_name || business?.name || "");
  const [advanced, setAdvanced] = useState(false);
  const [adv, setAdv] = useState({ imap_host: "", smtp_host: "", smtp_port: "" });
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try {
      const payload = { business_id: business.id, target: "campaign", action: "connect", email, password, from_name: fromName };
      if (advanced) Object.entries(adv).forEach(([k, v]) => { if (v) payload[k] = v; });
      const res = await connectMailbox(payload);
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      if (d.warning) toast.warning(d.warning, { duration: 9000 }); else toast.success("Predal je povezan. Kampanje lahko pošiljajo z njega.");
      onDone();
    } catch (e) {
      toast.error(fnError(e));
      if (/ročno/i.test(fnError(e))) setAdvanced(true);
    } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      {first && <p className="text-sm">Vpišite naslov, ki ste ga odprli posebej za kampanje (npr. <strong>novice@vase-podjetje.si</strong>), in njegovo geslo. Strežnike najdemo sami.</p>}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>E-naslov za kampanje</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="novice@vase-podjetje.si" autoComplete="off" /></div>
        <div className="space-y-1.5"><Label>Geslo tega naslova</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <div className="space-y-1.5"><Label>Ime pošiljatelja</Label><Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="npr. Janez iz Podjetja d.o.o." /></div>
      </div>
      <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} /> Ročna nastavitev strežnika (samo, če samodejno ne najdemo)
      </button>
      {advanced && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Strežnik za branje</Label><Input value={adv.imap_host} onChange={(e) => setAdv({ ...adv, imap_host: e.target.value })} placeholder="mail.domena.si" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Strežnik za pošiljanje</Label><Input value={adv.smtp_host} onChange={(e) => setAdv({ ...adv, smtp_host: e.target.value })} placeholder="mail.domena.si" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Vrata za pošiljanje</Label><Input value={adv.smtp_port} onChange={(e) => setAdv({ ...adv, smtp_port: e.target.value })} placeholder="587" /></div>
        </div>
      )}
      <div className="flex gap-2 items-center flex-wrap">
        <Button className="btn-brand" onClick={connect} disabled={busy || !email || !password}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}{busy ? "Preverjam …" : "Poveži predal"}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Prekliči</Button>}
        <p className="text-xs text-muted-foreground">Odbita sporočila in odgovore beremo iz tega predala, zato potrebujemo tudi branje.</p>
      </div>
    </div>
  );
}

function LimitDialog({ mb, open, onOpenChange, onSaved }) {
  const auto = autoLimit(mb);
  const [mode, setMode] = useState(Number(mb?.daily_limit_manual) > 0 ? "manual" : "auto");
  const [value, setValue] = useState(Number(mb?.daily_limit_manual) || auto);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (open) { setMode(Number(mb?.daily_limit_manual) > 0 ? "manual" : "auto"); setValue(Number(mb?.daily_limit_manual) || auto); setAck(false); } }, [open]);
  const risky = mode === "manual" && Number(value) > auto;
  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.SendingMailbox.update(mb.id, { daily_limit_manual: mode === "manual" ? Math.max(1, Math.min(500, Number(value) || auto)) : null });
      toast.success("Meja shranjena."); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Koliko sporočil na dan z naslova {mb?.email}?</DialogTitle><DialogDescription>Sporočila se pošiljajo od ponedeljka do petka med 8. in 17. uro, enakomerno čez dan.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <label className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${mode === "auto" ? "border-primary ring-2 ring-primary/20" : ""}`}>
            <input type="radio" checked={mode === "auto"} onChange={() => setMode("auto")} className="mt-1" />
            <div><p className="text-sm font-medium">Samodejno (priporočeno)</p><p className="text-xs text-muted-foreground">Prva 2 tedna največ 20 na dan, nato največ 50. Tako ponudniki e-pošte postopno spoznajo vaš naslov. Zdaj: {auto} na dan.</p></div>
          </label>
          <label className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${mode === "manual" ? "border-primary ring-2 ring-primary/20" : ""}`}>
            <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} className="mt-1" />
            <div className="flex-1"><p className="text-sm font-medium">Sam določim</p>
              <div className="flex items-center gap-2 mt-2"><Input type="number" min={1} max={500} value={value} onChange={(e) => { setValue(e.target.value); setMode("manual"); }} className="h-8 w-24" /><span className="text-sm text-muted-foreground">sporočil na dan</span></div>
            </div>
          </label>
          {risky && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Tega ne priporočamo, če …</p>
              <p>… s tega naslova ali z vaše domene v preteklosti niste redno pošiljali približno toliko e-pošte. Nov naslov, ki nenadoma pošlje veliko sporočil, Gmail, Outlook in drugi ponudniki označijo kot sumljiv: sporočila pristanejo med neželeno pošto, domena pa lahko pride na črni seznam — to vpliva tudi na vašo običajno pošto.</p>
              <label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" /><span>Razumem. S tega naslova že redno pošiljam toliko sporočil.</span></label>
            </div>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button><Button className="btn-brand" onClick={save} disabled={saving || (risky && !ack)}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// »Predali za pošiljanje«: privzeto en ločen naslov za kampanje, mogoče jih je dodati več.
export default function SendingMailboxes({ business, mailboxes, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [limitFor, setLimitFor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const remove = async (mb) => {
    if (!window.confirm(`Odstranim predal ${mb.email}? Kampanje z njega ne bodo več pošiljale.`)) return;
    setRemoving(mb.id);
    try {
      const res = await connectMailbox({ business_id: business.id, action: "remove_campaign_mailbox", mailbox_id: mb.id });
      const d = res?.data ?? res; if (d?.error) throw new Error(d.error);
      toast.success("Predal odstranjen."); onChanged();
    } catch (e) { toast.error(fnError(e)); } finally { setRemoving(null); }
  };
  return (
    <div className="card-elevated p-5 space-y-4 h-full">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />Naslov, s katerega pošiljate</h3>
        <p className="text-sm text-muted-foreground mt-1">Kampanje pošiljajte z ločenega naslova (npr. novice@vase-podjetje.si). Če kdo sporočilo označi kot neželeno, vaš glavni naslov ostane varen.</p>
      </div>
      {mailboxes.length === 0 ? <ConnectForm business={business} first onDone={() => { onChanged(); }} /> : (
        <div className="space-y-2">
          {mailboxes.map((mb) => {
            const lim = dailyLimit(mb); const st = sentToday(mb);
            return (
              <div key={mb.id} className="rounded-xl border p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {mb.status === "error" ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}{mb.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mb.status === "error" || mb.last_error ? <span className="text-red-600">{mb.last_error || "Napaka pri pošiljanju."}</span>
                      : <>Danes poslano {st} od {lim} · {Number(mb.daily_limit_manual) > 0 ? "meja ročno nastavljena" : mb.first_send_at ? (autoLimit(mb) === 20 ? "uvajanje (prva 2 tedna)" : "polna meja") : "še ni pošiljal"}{mb.last_checked_at ? ` · predal preverjen ${fmtDateTime(mb.last_checked_at)}` : ""}</>}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setLimitFor(mb)}><Gauge className="w-4 h-4 mr-1.5" />{lim} na dan</Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600" onClick={() => remove(mb)} disabled={removing === mb.id}>{removing === mb.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</Button>
              </div>
            );
          })}
          {adding ? <ConnectForm business={business} onDone={() => { setAdding(false); onChanged(); }} onCancel={() => setAdding(false)} />
            : <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-1.5" />Dodaj še en naslov</Button>}
          {mailboxes.length > 1 && <p className="text-xs text-muted-foreground">Kampanja izmenično pošilja z vseh izbranih naslovov ({cnt(mailboxes.length, W.naslov)}); vsaka oseba dobi vsa sporočila z istega naslova.</p>}
        </div>
      )}
      {limitFor && <LimitDialog mb={limitFor} open={!!limitFor} onOpenChange={(o) => !o && setLimitFor(null)} onSaved={onChanged} />}
    </div>
  );
}
