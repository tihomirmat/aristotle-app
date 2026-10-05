import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Loader2, CheckCircle2, AlertCircle, RefreshCw, Unplug, ChevronDown, Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import { connectMailbox } from "@/functions/connectMailbox";
import { syncInbox } from "@/functions/syncInbox";
import { fnError } from "@/lib/fn-error";
import { format } from "date-fns";

// »Vaš e-poštni predal«: en e-naslov + geslo. Strežnike najdemo sami.
// Branje (IMAP) → povpraševanja iz pošte postanejo stranke. Pošiljanje (SMTP) → odgovori gredo z vašega naslova.
export default function MailboxCard({ business }) {
  const queryClient = useQueryClient();
  const connectedRead = !!business?.imap_enabled && !!business?.imap_host;
  const connectedSend = business?.email_provider === "smtp" && !!business?.smtp_host && !!business?.smtp_user;
  const connected = connectedRead || connectedSend;

  const [email, setEmail] = useState(business?.smtp_from_email || business?.imap_user || "");
  const [password, setPassword] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [adv, setAdv] = useState({ imap_host: "", imap_port: "", smtp_host: "", smtp_port: "" });
  const [busy, setBusy] = useState(null); // connect | sync | disconnect
  const [rules, setRules] = useState(business?.inquiry_rules || "");
  const [editing, setEditing] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["business"] });

  const handleConnect = async () => {
    setBusy("connect");
    try {
      const payload = { business_id: business.id, action: "connect", email, password };
      if (advanced) Object.entries(adv).forEach(([k, v]) => { if (v) payload[k] = v; });
      const res = await connectMailbox(payload);
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success(data.warning || "Poštni predal je povezan. Berem pošto zadnjih 7 dni …");
      setPassword(""); setEditing(false);
      refresh();
      setTimeout(refresh, 20000);
    } catch (e) {
      toast.error(fnError(e));
      if (/samodejno|ročno/i.test(fnError(e))) setAdvanced(true);
    } finally { setBusy(null); }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      const res = await syncInbox({ business_id: business.id });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success(data.new_leads > 0
        ? `Našli smo ${data.new_leads} ${data.new_leads === 1 ? "novo povpraševanje" : data.new_leads < 5 ? "nova povpraševanja" : "novih povpraševanj"}. Odgovori čakajo v Stranke → Čaka na vaš odgovor.`
        : `Prebranih ${data.scanned} novih sporočil, novih povpraševanj ni.`);
      refresh();
      ["leads", "leads_all", "drafts-all", "drafts"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    } catch (e) { toast.error(fnError(e)); } finally { setBusy(null); }
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      const res = await connectMailbox({ business_id: business.id, action: "disconnect" });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success("Poštni predal je odklopljen.");
      refresh();
    } catch (e) { toast.error(fnError(e)); } finally { setBusy(null); }
  };

  const saveRules = async () => {
    await base44.entities.Business.update(business.id, { inquiry_rules: rules });
    toast.success("Pravila shranjena.");
    refresh();
  };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="p-6 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-[hsl(41,100%,53%)] flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg">Vaš e-poštni predal</h3>
            {connected
              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3.5 h-3.5" /> Povezano</span>
              : <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">Ni povezano</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            AI bere vašo pošto in sam prepozna povpraševanja (tudi obvestila spletnih obrazcev). Nove stranke doda med <strong>Stranke</strong>,
            odgovore pa pošlje z vašega naslova, ko jih odobrite.
          </p>
        </div>
      </div>

      {connected && !editing ? (
        <div className="px-6 pb-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Inbox className="w-3.5 h-3.5" /> Branje pošte</p>
              {connectedRead ? (
                <>
                  <p className="text-sm font-medium mt-1">{business.imap_user}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {business.imap_last_error
                      ? <span className="text-red-600">{business.imap_last_error}</span>
                      : business.imap_last_sync_at ? `Zadnjič prebrano ${format(new Date(business.imap_last_sync_at), "d. M. HH:mm")} · samodejno vsakih 10 min` : "Prvo branje v teku …"}
                  </p>
                </>
              ) : <p className="text-sm text-amber-700 mt-1">Ni nastavljeno</p>}
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Pošiljanje</p>
              {connectedSend ? (
                <>
                  <p className="text-sm font-medium mt-1">{business.smtp_from_name ? `${business.smtp_from_name} · ` : ""}{business.smtp_from_email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{business.email_last_health_check_status === "error" ? <span className="text-red-600">{business.email_last_health_check_error}</span> : "Odgovori gredo z vašega naslova."}</p>
                </>
              ) : <p className="text-sm text-amber-700 mt-1">Ni nastavljeno — pošilja AI Aristotle v vašem imenu</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {connectedRead && (
              <Button variant="outline" onClick={handleSync} disabled={!!busy}>
                {busy === "sync" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Preberi pošto zdaj
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(true)}>Spremeni geslo ali naslov</Button>
            <Button variant="ghost" className="text-muted-foreground ml-auto" onClick={handleDisconnect} disabled={!!busy}>
              {busy === "disconnect" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unplug className="w-4 h-4 mr-2" />} Odklopi
            </Button>
          </div>

          {connectedRead && (
            <div className="rounded-xl bg-muted/40 p-4 space-y-2">
              <Label className="text-sm">Vedno obravnavaj kot povpraševanje (neobvezno)</Label>
              <p className="text-xs text-muted-foreground">Če obrazec na vaši spletni strani pošilja z znanega naslova ali z vedno isto zadevo, jo vpišite — eno na vrstico. AI drugače prepozna sam.</p>
              <Textarea value={rules} onChange={(e) => setRules(e.target.value)} className="h-20 bg-background" placeholder={"wordpress@vase-podjetje.si\nNovo povpraševanje"} />
              <Button size="sm" variant="outline" onClick={saveRules}>Shrani pravila</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-6 pb-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>E-naslov podjetja</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@vase-podjetje.si" autoComplete="off" /></div>
            <div className="space-y-1.5"><Label>Geslo e-pošte</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="geslo, s katerim se prijavite v pošto" autoComplete="new-password" /></div>
          </div>
          <button type="button" onClick={() => setAdvanced((v) => !v)} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advanced ? "rotate-180" : ""}`} /> Ročna nastavitev strežnika (samo, če samodejno ne najdemo)
          </button>
          {advanced && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs">Strežnik za branje</Label><Input value={adv.imap_host} onChange={(e) => setAdv({ ...adv, imap_host: e.target.value })} placeholder="mail.domena.si" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Vrata</Label><Input value={adv.imap_port} onChange={(e) => setAdv({ ...adv, imap_port: e.target.value })} placeholder="993" /></div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1"><Label className="text-xs">Strežnik za pošiljanje</Label><Input value={adv.smtp_host} onChange={(e) => setAdv({ ...adv, smtp_host: e.target.value })} placeholder="mail.domena.si" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Vrata</Label><Input value={adv.smtp_port} onChange={(e) => setAdv({ ...adv, smtp_port: e.target.value })} placeholder="587" /></div>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <Button className="btn-brand" onClick={handleConnect} disabled={!!busy || !email || !password}>
              {busy === "connect" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              {busy === "connect" ? "Iščem strežnik in preverjam …" : "Poveži predal"}
            </Button>
            {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Prekliči</Button>}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Gmail in Outlook.com naslovi za zdaj niso podprti.</p>
          </div>
        </div>
      )}
    </div>
  );
}
