import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Package, Download, Upload, Loader2, Send, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { sendMonthlyInvoicePackage } from "@/functions/sendMonthlyInvoicePackage";

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("sl-SI", { month: "long", year: "numeric" });
}

const STATUS_COLORS = {
  captured: "bg-blue-100 text-blue-700",
  packaged: "bg-yellow-100 text-yellow-700",
  sent: "bg-emerald-100 text-emerald-700",
};

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/tiff", "image/webp", "image/gif"];

export default function Racuni() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [monthFilter, setMonthFilter] = useState("all");
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]); // { name, progress }
  const [sendingPackage, setSendingPackage] = useState(false);
  const fileInputRef = useRef(null);

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices", business?.id],
    queryFn: () => base44.entities.Invoice.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const { data: packages = [], isLoading: loadingPackages } = useQuery({
    queryKey: ["invoice-packages", business?.id],
    queryFn: () => base44.entities.InvoicePackage.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const months = [...new Set(invoices.map(inv => monthKey(inv.received_date || inv.created_date)))].sort().reverse();

  const filtered = monthFilter === "all"
    ? [...invoices].sort((a, b) => new Date(b.received_date || b.created_date) - new Date(a.received_date || a.created_date))
    : invoices
        .filter(inv => monthKey(inv.received_date || inv.created_date) === monthFilter)
        .sort((a, b) => new Date(b.received_date || b.created_date) - new Date(a.received_date || a.created_date));

  const sortedPackages = [...packages].sort((a, b) =>
    (b.period_year * 100 + b.period_month) - (a.period_year * 100 + a.period_month)
  );

  const deleteInvoice = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices", business?.id] }),
  });

  const uploadFiles = useCallback(async (files) => {
    if (!business?.id) return;
    const allowed = Array.from(files).filter(f =>
      ALLOWED_TYPES.some(t => f.type.startsWith(t.split("/")[0]) && f.name.match(/\.(pdf|png|jpe?g|tiff?|webp|gif)$/i))
    );
    if (allowed.length === 0) {
      toast.error("Izberite PDF ali slikovne datoteke.");
      return;
    }

    setUploadingFiles(allowed.map(f => ({ name: f.name })));

    const now = new Date().toISOString();
    let successCount = 0;

    for (const file of allowed) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.Invoice.create({
          business_id: business.id,
          source_email_from: "manual upload",
          subject: file.name,
          received_date: now,
          file_url,
          file_name: file.name,
          status: "captured",
        });
        successCount++;
      } catch (e) {
        toast.error(`Napaka pri nalaganju ${file.name}: ${e.message}`);
      }
    }

    setUploadingFiles([]);
    if (successCount > 0) {
      toast.success(`${successCount} ${successCount === 1 ? "račun dodan" : "računov dodanih"}`);
      queryClient.invalidateQueries({ queryKey: ["invoices", business?.id] });
    }
  }, [business?.id, queryClient]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const handleSendPackageNow = async () => {
    if (!business?.id) return;
    if (!business?.accountant_email) {
      toast.error("Najprej nastavite e-naslov računovodje v Nastavitvah → Računi.");
      return;
    }
    setSendingPackage(true);
    try {
      const res = await sendMonthlyInvoicePackage({ business_id: business.id });
      const result = res?.data?.results?.[0];
      if (result?.sent) {
        toast.success(`Paket poslan računovodji (${result.invoice_count} računov).`);
        queryClient.invalidateQueries({ queryKey: ["invoices", business?.id] });
        queryClient.invalidateQueries({ queryKey: ["invoice-packages", business?.id] });
      } else if (result?.skipped) {
        toast.info(`Ni računov za pošiljanje: ${result.reason}`);
      } else {
        toast.error("Napaka pri pošiljanju paketa.");
      }
    } catch (e) {
      toast.error("Napaka: " + e.message);
    }
    setSendingPackage(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Računi</h1>
          <p className="text-muted-foreground mt-1">Prejeti računi dobaviteljev in mesečni paketi za računovodjo.</p>
        </div>
        {business?.invoice_enabled && (
          <Button variant="outline" onClick={handleSendPackageNow} disabled={sendingPackage} className="gap-2 shrink-0">
            {sendingPackage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Pošlji paket zdaj
          </Button>
        )}
      </div>

      {/* Manual upload */}
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Upload className="w-4 h-4 text-primary" /> Dodaj račune</h2>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-accent/30" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp,.gif"
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
          {uploadingFiles.length > 0 ? (
            <div className="space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Nalagam {uploadingFiles.length} {uploadingFiles.length === 1 ? "datoteko" : "datoteke"}…</p>
              {uploadingFiles.map((f, i) => (
                <p key={i} className="text-xs text-muted-foreground">{f.name}</p>
              ))}
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-sm">Povlecite PDF-je ali slike sem</p>
              <p className="text-xs text-muted-foreground mt-1">ali kliknite za izbiro datotek · PDF, PNG, JPG, TIFF, WEBP</p>
            </>
          )}
        </div>
      </div>

      {/* Invoice list */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Prejeti računi</h2>
          {months.length > 0 && (
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Filtriraj mesec" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi meseci</SelectItem>
                {months.map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {loadingInvoices ? (
          <div className="text-sm text-muted-foreground py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center border rounded-xl bg-card">
            <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium">Ni računov.</p>
            <p className="mt-1">Naložite datoteke zgoraj ali nastavite posredovanje e-pošte v Nastavitvah.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vir</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datoteka</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate" title={inv.source_email_from}>
                      {inv.source_email_from || "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-xs" title={inv.file_name}>{inv.file_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {inv.received_date ? format(new Date(inv.received_date), "d. M. yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[inv.status] || ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                      {inv.file_url && (
                        <a href={inv.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 px-2"><Download className="w-3.5 h-3.5" /></Button>
                        </a>
                      )}
                      {inv.status === "captured" && (
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteInvoice.mutate(inv.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Package history */}
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-4"><Package className="w-4 h-4 text-primary" /> Mesečni paketi računovodje</h2>
        {loadingPackages ? (
          <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : sortedPackages.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-xl bg-card">
            Še ni poslanih paketov. Paket se pošlje samodejno 1. v mesecu ali ročno z gumbom zgoraj.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPackages.map(pkg => (
              <div key={pkg.id} className="bg-card border rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium">
                    {new Date(pkg.period_year, pkg.period_month - 1, 1).toLocaleString("sl-SI", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pkg.invoice_count} računov · {pkg.accountant_email} · {pkg.sent_at ? format(new Date(pkg.sent_at), "d. M. yyyy HH:mm") : "—"}
                  </p>
                </div>
                {pkg.zip_file_url && (
                  <a href={pkg.zip_file_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-2 shrink-0">
                      <Download className="w-4 h-4" /> Prenesi ZIP
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}