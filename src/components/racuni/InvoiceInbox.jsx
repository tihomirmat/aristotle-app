import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Forward, ListChecks, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fnError } from "@/lib/fn-error";

export const invoiceAddressOf = (b) => b?.invoice_address || (b?.imap_user && b.imap_user.includes("@") ? b.imap_user.replace("@", "+racuni@") : "");

// Kako računi pridejo v aplikacijo: naslov za račune (pošlji / Cc / posreduj) in seznam dobaviteljev.
export default function InvoiceInbox({ business, onSaved }) {
  const address = invoiceAddressOf(business);
  const [copied, setCopied] = useState(false);
  const [senders, setSenders] = useState(business?.invoice_senders || "");
  const [editAddr, setEditAddr] = useState(false);
  const [addr, setAddr] = useState(address);
  const [saving, setSaving] = useState(null);
  useEffect(() => { setSenders(business?.invoice_senders || ""); setAddr(invoiceAddressOf(business)); }, [business?.invoice_senders, business?.invoice_address, business?.imap_user]);

  const copy = () => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const save = async (patch, what) => {
    setSaving(what);
    try { await base44.entities.Business.update(business.id, patch); toast.success("Shranjeno."); onSaved?.(); setEditAddr(false); }
    catch (e) { toast.error(fnError(e)); } finally { setSaving(null); }
  };
  const saveAddr = () => {
    const v = addr.trim().toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error("Vpišite veljaven e-naslov."); return; }
    save({ invoice_address: v === (business.imap_user || "").replace("@", "+racuni@") ? "" : v }, "addr");
  };
  const lines = senders.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="card-elevated p-5 grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <p className="font-semibold flex items-center gap-2"><Forward className="w-4 h-4 text-primary" />Naslov za račune</p>
        {editAddr ? (
          <div className="space-y-2">
            <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="racuni@vase-podjetje.si" />
            <p className="text-xs text-muted-foreground">Če vam ponudnik pošte ne dostavi naslova z »+racuni«, v nastavitvah pošte ustvarite preusmeritev (npr. racuni@vase-podjetje.si → {business?.imap_user}) in jo vpišite tukaj. Pustite prazno za privzeti naslov.</p>
            <div className="flex gap-2"><Button size="sm" className="btn-brand" onClick={saveAddr} disabled={saving === "addr"}>{saving === "addr" && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Shrani</Button><Button size="sm" variant="ghost" onClick={() => { setEditAddr(false); setAddr(address); }}>Prekliči</Button></div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-base font-semibold bg-muted px-3 py-1.5 rounded-lg break-all">{address}</code>
            <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}{copied ? "Kopirano" : "Kopiraj"}</Button>
            <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => setEditAddr(true)}><Pencil className="w-3 h-3" />Drug naslov</button>
          </div>
        )}
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li><strong className="text-foreground">Dobaviteljem</strong> (Telekom, Elektro, računovodja …) ga sporočite kot naslov, na katerega pošiljajo račune.</li>
          <li><strong className="text-foreground">V kopijo (Cc)</strong> ga dodajte, ko račun pošiljate ali naročate.</li>
          <li><strong className="text-foreground">Posredujte</strong> (Forward) nanj račun, ki ste ga dobili — tudi s telefona.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Račun mora biti v priponki (PDF ali fotografija). V aplikaciji se pojavi v nekaj minutah. Pošta pride v vaš predal {business?.imap_user} (pri nekaterih ponudnikih v mapo »racuni«).</p>
      </div>

      <div className="space-y-3">
        <p className="font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4 text-primary" />Dobavitelji, ki vedno pošiljajo račune</p>
        <p className="text-sm text-muted-foreground">Vpišite e-naslove ali domene, s katerih prihajajo računi — eno na vrstico. Pošto z njih (s prilogo) vedno shranimo kot račun. Ostale račune AI prepozna sam.</p>
        <Textarea value={senders} onChange={(e) => setSenders(e.target.value)} className="h-28 text-sm" placeholder={"racuni@telekom.si\n@elektro-ljubljana.si\nneoserv.si"} />
        <div className="flex items-center gap-3">
          <Button size="sm" variant={senders !== (business?.invoice_senders || "") ? "default" : "outline"} className={senders !== (business?.invoice_senders || "") ? "btn-brand" : ""} onClick={() => save({ invoice_senders: lines.join("\n") }, "senders")} disabled={saving === "senders" || senders === (business?.invoice_senders || "")}>{saving === "senders" && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Shrani dobavitelje</Button>
          {lines.length > 0 && <span className="text-xs text-muted-foreground">{lines.length} {lines.length === 1 ? "vnos" : lines.length === 2 ? "vnosa" : lines.length < 5 ? "vnosi" : "vnosov"}</span>}
        </div>
      </div>
    </div>
  );
}
