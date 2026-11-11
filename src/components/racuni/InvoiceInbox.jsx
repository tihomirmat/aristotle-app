import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Forward, ListChecks, Pencil, Loader2, HelpCircle, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { fnError } from "@/lib/fn-error";

export const invoiceAddressOf = (b) => b?.invoice_address || (b?.imap_user && b.imap_user.includes("@") ? b.imap_user.replace("@", "+racuni@") : "");

// Kako računi pridejo v aplikacijo: ena kompaktna vrstica (naslov za račune + Kopiraj).
// Navodila, dobavitelji in drug naslov so skriti za gumbi — odprejo se samo, ko jih kdo rabi.
export default function InvoiceInbox({ business, onSaved }) {
  const address = invoiceAddressOf(business);
  const [copied, setCopied] = useState(false);
  const [senders, setSenders] = useState(business?.invoice_senders || "");
  const [addr, setAddr] = useState(address);
  const [open, setOpen] = useState(null); // help | senders | addr
  const [saving, setSaving] = useState(null);
  useEffect(() => { setSenders(business?.invoice_senders || ""); setAddr(invoiceAddressOf(business)); }, [business?.invoice_senders, business?.invoice_address, business?.imap_user]);

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const copy = () => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const save = async (patch, what) => {
    setSaving(what);
    try { await base44.entities.Business.update(business.id, patch); toast.success("Shranjeno."); onSaved?.(); setOpen(null); }
    catch (e) { toast.error(fnError(e)); } finally { setSaving(null); }
  };
  const saveAddr = () => {
    const v = addr.trim().toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error("Vpišite veljaven e-naslov."); return; }
    save({ invoice_address: v === (business.imap_user || "").replace("@", "+racuni@") ? "" : v }, "addr");
  };
  const lines = senders.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const savedCount = String(business?.invoice_senders || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;
  const linkBtn = (k, Icon, label) => (
    <button onClick={() => toggle(k)} className={`text-sm inline-flex items-center gap-1.5 hover:text-foreground ${open === k ? "text-foreground font-medium" : "text-muted-foreground"}`}>
      <Icon className="w-4 h-4" />{label}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${open === k ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <div className="card-elevated px-5 py-3.5">
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <span className="text-sm font-medium inline-flex items-center gap-2"><Forward className="w-4 h-4 text-primary" />Naslov za račune:</span>
        <code className="text-sm font-semibold bg-muted px-2.5 py-1 rounded-md break-all">{address}</code>
        <Button size="sm" variant="outline" className="h-8" onClick={copy}>{copied ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}{copied ? "Kopirano" : "Kopiraj"}</Button>
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {linkBtn("help", HelpCircle, "Kako ga uporabim?")}
          {linkBtn("senders", ListChecks, savedCount ? `Dobavitelji (${savedCount})` : "Dobavitelji")}
          {linkBtn("addr", Pencil, "Drug naslov")}
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t relative">
          <button onClick={() => setOpen(null)} className="absolute right-0 top-3 text-muted-foreground hover:text-foreground" title="Zapri"><X className="w-4 h-4" /></button>
          {open === "help" && (
            <div className="text-sm text-muted-foreground space-y-1.5 pr-6">
              <p><strong className="text-foreground">Dobaviteljem</strong> (Telekom, Elektro …) ga sporočite kot naslov za račune, <strong className="text-foreground">dodajte ga v kopijo (Cc)</strong> ali nanj <strong className="text-foreground">posredujte</strong> račun, ki ste ga dobili — tudi s telefona.</p>
              <p className="text-xs">Račun mora biti v priponki (PDF ali fotografija) in se tu pojavi v nekaj minutah.</p>
            </div>
          )}
          {open === "senders" && (
            <div className="space-y-2 pr-6 max-w-2xl">
              <p className="text-sm text-muted-foreground">E-naslovi ali domene, s katerih prihajajo računi — eno na vrstico. Pošto z njih (s prilogo) vedno shranimo kot račun. Ostale račune AI prepozna sam.</p>
              <Textarea value={senders} onChange={(e) => setSenders(e.target.value)} className="h-24 text-sm" placeholder={"racuni@telekom.si\n@elektro-ljubljana.si\nneoserv.si"} />
              <Button size="sm" className="btn-brand" onClick={() => save({ invoice_senders: lines.join("\n") }, "senders")} disabled={saving === "senders" || senders === (business?.invoice_senders || "")}>{saving === "senders" && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Shrani</Button>
            </div>
          )}
          {open === "addr" && (
            <div className="space-y-2 pr-6 max-w-2xl">
              <p className="text-sm text-muted-foreground">Če vam ponudnik pošte ne dostavi naslova z »+racuni«, v nastavitvah pošte ustvarite preusmeritev (npr. racuni@vase-podjetje.si → {business?.imap_user}) in jo vpišite tukaj. Prazno = privzeti naslov.</p>
              <div className="flex gap-2 max-w-md"><Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="racuni@vase-podjetje.si" /><Button size="sm" className="btn-brand h-10" onClick={saveAddr} disabled={saving === "addr"}>{saving === "addr" && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Shrani</Button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
