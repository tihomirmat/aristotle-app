import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Upload, Loader2, Send, Trash2, Mail, CheckCircle2, UserRound, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { sendMonthlyInvoicePackage } from "@/functions/sendMonthlyInvoicePackage";
import { fnError } from "@/lib/fn-error";
import { cnt, W } from "@/lib/crm";
import { HelperHeader } from "@/components/pomocniki/HelperKit";
import InvoiceInbox, { invoiceAddressOf } from "@/components/racuni/InvoiceInbox";

const monthKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleString("sl-SI", { month: "long", year: "numeric" }); };
const money = (n) => (typeof n === "number" ? new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR" }).format(n) : "—");
const dateOf = (inv) => inv.received_date || inv.created_date;

const STATUS = {
  captured: { label: "Čaka na pošiljanje", cls: "bg-amber-100 text-amber-800" },
  packaged: { label: "Pripravljen za pošiljanje", cls: "bg-blue-100 text-blue-700" },
  sent: { label: "Poslan računovodji", cls: "bg-emerald-100 text-emerald-700" },
};
const sourceOf = (inv) => (inv.source === "email" ? "Iz e-pošte" : inv.source === "forward" ? "Posredovan po e-pošti" : inv.source_email_from && inv.source_email_from !== "manual upload" && !inv.source ? "Posredovan po e-pošti" : "Dodali ste sami");
const supplierOf = (inv) => inv.supplier_name || (inv.source_email_from && inv.source_email_from !== "manual upload" ? inv.source_email_from : "") || inv.file_name || "Račun";
const FILE_RE = /\.(pdf|png|jpe?g|tiff?|webp|gif)$/i;

function StepCard({ n, done, icon: Icon, title, state, children }) {
  return (
    <div className="card-elevated p-5 flex flex-col">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-emerald-100 text-emerald-700" : "bg-primary text-white"}`}>{done ? <CheckCircle2 className="w-5 h-5" /> : n}</span>
        <p className="font-semibold flex-1">{title}</p>
        <Icon className="w-5 h-5 text-muted-foreground/50" />
      </div>
      <p className={`text-sm mt-2 ${done ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>{state}</p>
      <div className="mt-4 flex-1 flex flex-col justify-end">{children}</div>
    </div>
  );
}

export default function Racuni() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [monthFilter, setMonthFilter] = useState("all");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [accEmail, setAccEmail] = useState("");
  const [savingAcc, setSavingAcc] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { setAccEmail(business?.accountant_email || ""); }, [business?.accountant_email]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", business?.id],
    queryFn: () => base44.entities.Invoice.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const { data: packages = [] } = useQuery({
    queryKey: ["invoice-packages", business?.id],
    queryFn: () => base44.entities.InvoicePackage.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const mailOn = !!business?.imap_enabled;
  const accOn = !!business?.accountant_email && !!business?.invoice_enabled;
  const allSet = mailOn && accOn;
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = monthKey(prev);
  const thisKey = monthKey(now);
  const waitingPrev = invoices.filter((i) => i.status === "captured" && monthKey(dateOf(i)) === prevKey);
  const thisMonth = invoices.filter((i) => monthKey(dateOf(i)) === thisKey);
  const thisSum = thisMonth.reduce((s, i) => s + (typeof i.amount === "number" ? i.amount : 0), 0);

  const months = [...new Set(invoices.map((i) => monthKey(dateOf(i))))].sort().reverse();
  const filtered = invoices.filter((i) => monthFilter === "all" || monthKey(dateOf(i)) === monthFilter).sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a)));
  const sortedPackages = [...packages].sort((a, b) => (b.period_year * 100 + b.period_month) - (a.period_year * 100 + a.period_month));

  const refreshBusiness = () => queryClient.invalidateQueries({ queryKey: ["business"] });
  const deleteInvoice = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices", business?.id] }); toast.success("Račun izbrisan."); },
  });

  const saveAccountant = async () => {
    const email = accEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Vpišite veljaven e-naslov računovodje."); return; }
    setSavingAcc(true);
    try { await base44.entities.Business.update(business.id, { accountant_email: email, invoice_enabled: true }); refreshBusiness(); toast.success("Shranjeno. Račune pošljemo vsakega 1. v mesecu."); }
    catch (e) { toast.error(fnError(e)); } finally { setSavingAcc(false); }
  };
  const toggleAuto = async (v) => {
    try { await base44.entities.Business.update(business.id, { invoice_enabled: v }); refreshBusiness(); toast.success(v ? "Mesečno pošiljanje je vključeno." : "Mesečno pošiljanje je izključeno."); }
    catch (e) { toast.error(fnError(e)); }
  };

  const uploadFiles = useCallback(async (files) => {
    if (!business?.id) return;
    const allowed = Array.from(files || []).filter((f) => FILE_RE.test(f.name));
    if (!allowed.length) { toast.error("Izberite PDF ali sliko računa."); return; }
    setUploading(allowed.length);
    const nowIso = new Date().toISOString();
    let ok = 0;
    for (const file of allowed) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.Invoice.create({ business_id: business.id, source: "upload", source_email_from: "manual upload", subject: file.name, received_date: nowIso, file_url, file_name: file.name, status: "captured", owner_email: business.owner_email || business.created_by });
        ok++;
      } catch (e) { toast.error(`${file.name}: ${fnError(e)}`); }
    }
    setUploading(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (ok) { toast.success(ok === 1 ? "Račun je dodan." : `Dodano: ${cnt(ok, W.racun)}.`); queryClient.invalidateQueries({ queryKey: ["invoices", business?.id] }); }
  }, [business, queryClient]);

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await sendMonthlyInvoicePackage({ business_id: business.id });
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      const r = d?.results?.[0];
      if (r?.sent) {
        toast.success(`Poslano računovodji: ${cnt(r.invoice_count, W.racun)}.`);
        queryClient.invalidateQueries({ queryKey: ["invoices", business?.id] });
        queryClient.invalidateQueries({ queryKey: ["invoice-packages", business?.id] });
      } else if (r?.skipped) {
        toast.info(r.reason === "package already sent for period" ? `Računi za ${monthLabel(prevKey)} so bili že poslani.` : r.reason === "no accountant_email" ? "Najprej vpišite e-naslov računovodje." : `Za ${monthLabel(prevKey)} ni računov, ki bi čakali na pošiljanje.`);
      } else toast.error(r?.error || "Pošiljanje ni uspelo.");
    } catch (e) { toast.error(fnError(e)); } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <HelperHeader icon={FileText} tone="green" title="Računi za računovodjo" subtitle="Račune dobaviteljev zberemo na enem mestu in jih enkrat na mesec pošljemo vašemu računovodji."
        ok={accOn} statusLabel={accOn ? "Deluje samodejno" : "Vpišite računovodjo"}>
        {allSet && !showSetup && <Button className="btn-brand gap-2" onClick={() => fileInputRef.current?.click()} disabled={uploading > 0}>{uploading > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Dodaj račun</Button>}
      </HelperHeader>

      <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp,.gif" className="hidden" onChange={(e) => uploadFiles(e.target.files)} />

      {/* Nastavitev: dokler ni vse urejeno, trije koraki; potem ena vrstica s stanjem */}
      {!(allSet && !showSetup) && (
        <div className="grid md:grid-cols-3 gap-3">
        <StepCard n={1} done={mailOn} icon={Mail} title="Računi iz e-pošte" state={mailOn ? `Vključeno. Račune, ki pridejo na ${business?.imap_user || "vaš predal"}, shranimo sami.` : "Ni povezano. Povežite predal in račune iz pošte bomo shranjevali sami."}>
          {mailOn
            ? <p className="text-xs text-muted-foreground">Predal preverimo vsakih 10 minut. Shranimo račune v priponki (PDF). Naslov za posredovanje računov je spodaj.</p>
            : <Link to="/nastavitve?tab=integracije"><Button className="btn-brand w-full gap-2">Poveži e-poštni predal<ArrowRight className="w-4 h-4" /></Button></Link>}
        </StepCard>

        <StepCard n={2} done={invoices.some((i) => sourceOf(i) === "Dodali ste sami")} icon={Upload} title="Računi na papirju ali v datoteki" state="Fotografirajte račun ali izberite PDF. Dodate jih lahko več hkrati.">
          <Button variant={mailOn ? "default" : "outline"} className={`w-full gap-2 ${mailOn ? "btn-brand" : ""}`} onClick={() => fileInputRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{uploading > 0 ? `Dodajam ${uploading} …` : "Dodaj račun"}
          </Button>
        </StepCard>

        <StepCard n={3} done={accOn} icon={UserRound} title="Vaš računovodja" state={accOn ? `Vsakega 1. v mesecu pošljemo račune prejšnjega meseca na ${business.accountant_email}.` : business?.accountant_email ? "Mesečno pošiljanje je izključeno." : "Vpišite e-naslov računovodje in računi bodo šli k njemu sami."}>
          <div className="flex gap-2">
            <Input type="email" value={accEmail} onChange={(e) => setAccEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAccountant()} placeholder="racunovodja@primer.si" />
            <Button className={accEmail.trim() !== (business?.accountant_email || "") ? "btn-brand" : ""} variant={accEmail.trim() !== (business?.accountant_email || "") ? "default" : "outline"} onClick={saveAccountant} disabled={savingAcc || !accEmail.trim()}>{savingAcc ? <Loader2 className="w-4 h-4 animate-spin" /> : "Shrani"}</Button>
          </div>
          {business?.accountant_email && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground mt-3 cursor-pointer"><Switch checked={!!business.invoice_enabled} onCheckedChange={toggleAuto} />Pošlji samodejno vsakega 1. v mesecu</label>
          )}
        </StepCard>
      </div>
      )}

      <div className="grid xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)] gap-6 items-start">
        {/* Seznam računov */}
        <div
          className={`card-elevated p-5 transition-colors ${dragOver ? "ring-2 ring-primary bg-accent/30" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="text-lg">Prejeti računi</h2>
              <p className="text-sm text-muted-foreground">Ta mesec: {cnt(thisMonth.length, W.racun)}{thisSum > 0 ? `, skupaj ${money(thisSum)}` : ""}</p>
            </div>
            {months.length > 1 && (
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Vsi meseci</SelectItem>{months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>

          {isLoading ? <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
            : filtered.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed py-12 px-6 text-center">
                <FileText className="w-9 h-9 mx-auto text-muted-foreground/40" />
                <p className="font-medium mt-3">Tu še ni nobenega računa</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{mailOn ? "Ko dobavitelj pošlje račun na vaš e-naslov, se pojavi tukaj. Račun lahko dodate tudi sami." : "Začnite s korakom 1 zgoraj. Račun v datoteki lahko tudi povlečete sem."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="px-2 py-2 font-medium">Dobavitelj</th><th className="px-2 py-2 font-medium text-right">Znesek</th><th className="px-2 py-2 font-medium">Datum</th><th className="px-2 py-2 font-medium hidden md:table-cell">Kako je prišel</th><th className="px-2 py-2 font-medium">Stanje</th><th className="px-2 py-2" />
                  </tr></thead>
                  <tbody className="divide-y">
                    {filtered.map((inv) => {
                      const St = STATUS[inv.status] || STATUS.captured;
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="px-2 py-3 max-w-[280px]"><p className="font-medium truncate">{supplierOf(inv)}</p>{inv.subject && inv.subject !== inv.file_name && <p className="text-xs text-muted-foreground truncate">{inv.subject}</p>}</td>
                          <td className="px-2 py-3 text-right font-medium whitespace-nowrap">{money(inv.amount)}</td>
                          <td className="px-2 py-3 text-muted-foreground whitespace-nowrap">{dateOf(inv) ? format(new Date(inv.invoice_date || dateOf(inv)), "d. M. yyyy") : "—"}</td>
                          <td className="px-2 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">{sourceOf(inv)}</td>
                          <td className="px-2 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${St.cls}`}>{St.label}</span></td>
                          <td className="px-2 py-3"><div className="flex items-center justify-end gap-1">
                            {inv.file_url && <a href={inv.file_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-8 gap-1.5"><Download className="w-3.5 h-3.5" />Odpri</Button></a>}
                            {inv.status === "captured" && <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-red-600" title="Izbriši račun" onClick={() => { if (window.confirm(`Izbrišem račun »${supplierOf(inv)}«?`)) deleteInvoice.mutate(inv.id); }}><Trash2 className="w-4 h-4" /></Button>}
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* Desno (1/4): kako računi pridejo + pošiljanje računovodji */}
        <div className="space-y-4 xl:sticky xl:top-20">
          {allSet && !showSetup && (
            <div className="card-elevated p-4 space-y-2 text-sm">
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Račune iz pošte <strong className="break-all">{business?.imap_user}</strong> shranimo sami.</span></p>
              <p className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Vsakega 1. v mesecu jih dobi <strong className="break-all">{business?.accountant_email}</strong>.</span></p>
              <button className="text-primary font-medium text-sm" onClick={() => setShowSetup(true)}>Spremeni</button>
            </div>
          )}
          {mailOn && <InvoiceInbox compact business={business} onSaved={refreshBusiness} />}
          <div className="card-elevated p-5">
            <h2 className="text-lg">Pošiljanje računovodji</h2>
            <p className="text-sm text-muted-foreground mt-1">{waitingPrev.length === 0 ? `Za ${monthLabel(prevKey)} ni računov, ki bi čakali na pošiljanje.` : `Za ${monthLabel(prevKey)} čaka na pošiljanje: ${cnt(waitingPrev.length, W.racun)}.`}</p>
            <Button className="btn-brand w-full mt-4 gap-2" onClick={sendNow} disabled={sending || !accOn || waitingPrev.length === 0}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Pošlji račune za {monthLabel(prevKey)} zdaj
            </Button>
            {!accOn && <p className="text-xs text-muted-foreground mt-2">Najprej vpišite e-naslov računovodje (korak 3 zgoraj).</p>}
            {accOn && <p className="text-xs text-muted-foreground mt-2">Sicer jih pošljemo sami 1. v mesecu. Računi tekočega meseca gredo naslednji mesec.</p>}
          </div>

          <div className="card-elevated p-5">
            <h3 className="font-semibold">Že poslano</h3>
            {sortedPackages.length === 0 ? <p className="text-sm text-muted-foreground mt-2">Računovodji še ni bilo poslano nič.</p> : (
              <div className="divide-y mt-2">
                {sortedPackages.map((p) => (
                  <div key={p.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm capitalize">{monthLabel(`${p.period_year}-${String(p.period_month).padStart(2, "0")}`)}</p>
                      <p className="text-xs text-muted-foreground truncate">{cnt(p.invoice_count, W.racun)} · {p.accountant_email}{p.sent_at ? ` · ${format(new Date(p.sent_at), "d. M. yyyy")}` : ""}</p>
                    </div>
                    {p.zip_file_url && <a href={p.zip_file_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="gap-1.5 shrink-0"><Download className="w-3.5 h-3.5" />Prenesi</Button></a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
