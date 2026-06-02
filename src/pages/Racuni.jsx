import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Package, Download, Inbox, Copy, Check } from "lucide-react";
import { format } from "date-fns";

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

export default function Racuni() {
  const { business } = useBusiness();
  const [monthFilter, setMonthFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  const inboundAddress = business?.invoice_inbound_token
    ? `inv-${business.invoice_inbound_token}@mail.base44.app`
    : null;

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

  // Build month options from captured invoices
  const months = [...new Set(invoices.map(inv => monthKey(inv.received_date || inv.created_date)))].sort().reverse();

  const filtered = monthFilter === "all"
    ? invoices
    : invoices.filter(inv => monthKey(inv.received_date || inv.created_date) === monthFilter);

  const sortedPackages = [...packages].sort((a, b) =>
    (b.period_year * 100 + b.period_month) - (a.period_year * 100 + a.period_month)
  );

  const handleCopy = () => {
    if (inboundAddress) {
      navigator.clipboard.writeText(inboundAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Računi</h1>
        <p className="text-muted-foreground mt-1">Prejeti računi dobaviteljev in mesečni paketi za računovodjo.</p>
      </div>

      {/* Inbound address */}
      {inboundAddress && (
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold mb-1 flex items-center gap-2"><Inbox className="w-4 h-4 text-primary" /> Naslov za posredovanje računov</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Nastavite pravilo za posredovanje ali povejte dobaviteljem, naj CC-jajo ta naslov, ko vam pošiljajo račun.
          </p>
          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-4 py-2.5 text-sm font-mono">
            <span className="flex-1 break-all">{inboundAddress}</span>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Captured invoices */}
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
          <div className="text-sm text-muted-foreground py-8 text-center">Nalagam...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center border rounded-xl bg-card">
            <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium">Ni prejetih računov.</p>
            <p className="mt-1">Posredujte e-pošto z računom na zgornji naslov.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pošiljatelj</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Zadeva</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datoteka</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{inv.source_email_from || "—"}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{inv.subject || "—"}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-xs">{inv.file_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {inv.received_date ? format(new Date(inv.received_date), "d. M. yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[inv.status] || ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.file_url && (
                        <a href={inv.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 px-2"><Download className="w-3.5 h-3.5" /></Button>
                        </a>
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
          <div className="text-sm text-muted-foreground py-4 text-center">Nalagam...</div>
        ) : sortedPackages.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-xl bg-card">
            Še ni poslanih paketov. Paket se pošlje samodejno 1. v mesecu.
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
                    {pkg.invoice_count} računov · Računovodja: {pkg.accountant_email} · Poslano {pkg.sent_at ? format(new Date(pkg.sent_at), "d. M. yyyy HH:mm") : "—"}
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