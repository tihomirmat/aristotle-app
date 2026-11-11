import React from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Mail, Megaphone, Calendar, FileText, MessageSquare, Star, ClipboardList, UserRound, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { featureOn } from "@/lib/features";
import { cnt, W } from "@/lib/crm";
import SendingMailboxes from "@/components/kampanje/SendingMailboxes";
import InvoiceInbox, { invoiceAddressOf } from "@/components/racuni/InvoiceInbox";

// »Povezave«: vse, kar aplikacijo poveže z zunanjim svetom, na enem mestu — stanje + kje se uredi.
export function useSendingMailboxes(business) {
  return useQuery({ queryKey: ["sending-mailboxes", business?.id], queryFn: () => base44.entities.SendingMailbox.filter({ business_id: business.id }), enabled: !!business?.id });
}

export default function ConnectionsOverview({ business }) {
  const { data: mailboxes = [] } = useSendingMailboxes(business);
  const mbError = mailboxes.some((m) => m.status === "error");
  const rows = [
    { icon: Mail, title: "Vaš e-poštni predal", ok: !!business?.imap_enabled && !business?.imap_last_error, warn: !!business?.imap_last_error,
      state: business?.imap_enabled ? (business?.imap_last_error || `Povezan: ${business?.imap_user}`) : "Ni povezan — AI ne vidi povpraševanj iz pošte", href: "#predal", cta: business?.imap_enabled ? "Uredi" : "Poveži" },
    { feature: "campaigns", icon: Megaphone, title: "Naslovi za e-poštne kampanje", ok: mailboxes.length > 0 && !mbError, warn: mbError,
      state: mailboxes.length ? `${cnt(mailboxes.length, W.naslov)}: ${mailboxes.map((m) => m.email).join(", ")}${mbError ? " — napaka pri enem" : ""}` : "Ni povezan — kampanje pošiljajte z ločenega naslova", href: "#kampanje-naslovi", cta: mailboxes.length ? "Uredi" : "Poveži" },
    { icon: Calendar, title: "Google Koledar", ok: !!business?.google_calendar_connected,
      state: business?.google_calendar_connected ? `Povezan: ${business?.google_calendar_email || "Google račun"}` : "Ni povezan — asistent ne vidi vaših terminov", to: "/nastavitve?tab=termini", cta: business?.google_calendar_connected ? "Uredi" : "Poveži" },
    { feature: "invoices", icon: FileText, title: "Naslov za račune", ok: !!business?.imap_enabled,
      state: business?.imap_enabled ? invoiceAddressOf(business) : "Na voljo, ko povežete e-poštni predal", href: "#racuni-naslov", cta: "Uredi" },
    { feature: "invoices", icon: UserRound, title: "Računovodja", ok: !!business?.accountant_email && !!business?.invoice_enabled,
      state: business?.accountant_email ? `${business.accountant_email}${business.invoice_enabled ? " — dobi račune 1. v mesecu" : " — pošiljanje izključeno"}` : "Ni vpisan", to: "/racuni", cta: business?.accountant_email ? "Uredi" : "Vpiši" },
    { feature: "chat", icon: MessageSquare, title: "Klepet na vaši spletni strani", ok: !!business?.chat_installed_url,
      state: business?.chat_installed_url ? `Nameščen: ${String(business.chat_installed_url).replace(/^https?:\/\//, "")}` : "Še ni na vaši spletni strani", to: "/klepet", cta: business?.chat_installed_url ? "Odpri" : "Namesti" },
    { icon: ClipboardList, title: "Obrazec na spletni strani in uvoz strank", ok: null, state: "Povpraševanja z obrazca pridejo med Stranke", to: "/nastavitve?tab=viri", cta: "Odpri" },
    { feature: "reviews", icon: Star, title: "Povezava za Google ocene", ok: !!business?.google_review_link,
      state: business?.google_review_link ? "Vpisana" : "Ni vpisana — prošnje za oceno ne morejo iti", to: "/ocene", cta: business?.google_review_link ? "Odpri" : "Dodaj" },
  ].filter((r) => !r.feature || featureOn(business, r.feature));
  const done = rows.filter((r) => r.ok === true).length; const total = rows.filter((r) => r.ok !== null).length;
  const go = (id) => document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b flex items-center gap-3">
        <h3 className="text-[15px] font-semibold">Vse povezave</h3>
        <span className="text-xs text-muted-foreground">urejeno {done} od {total}</span>
      </div>
      <ul className="divide-y">
        {rows.map((r) => {
          const inner = (
            <>
              <r.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium w-64 shrink-0 truncate">{r.title}</span>
              <span className={`text-xs flex-1 min-w-0 truncate inline-flex items-center gap-1.5 ${r.warn ? "text-red-600" : r.ok ? "text-emerald-700" : r.ok === null ? "text-muted-foreground" : "text-amber-700"}`}>
                {r.warn ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : r.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : r.ok === null ? null : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}<span className="truncate">{r.state}</span>
              </span>
              <span className="text-sm text-primary font-medium whitespace-nowrap inline-flex items-center gap-0.5">{r.cta}<ChevronRight className="w-4 h-4" /></span>
            </>
          );
          const cls = "w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 text-left";
          return <li key={r.title}>{r.to ? <Link to={r.to} className={cls}>{inner}</Link> : <button type="button" onClick={() => go(r.href)} className={cls}>{inner}</button>}</li>;
        })}
      </ul>
    </div>
  );
}

// Kartici, ki jih stran Povezave pokaže pod pregledom (naslovi za kampanje, naslov za račune).
export function CampaignMailboxesCard({ business }) {
  const { data: mailboxes = [] } = useSendingMailboxes(business);
  const qc = useQueryClient();
  if (!featureOn(business, "campaigns")) return null;
  return <div id="kampanje-naslovi" className="scroll-mt-24"><SendingMailboxes business={business} mailboxes={mailboxes} onChanged={() => qc.invalidateQueries({ queryKey: ["sending-mailboxes"] })} /></div>;
}
export function InvoiceAddressCard({ business }) {
  const qc = useQueryClient();
  if (!business?.imap_enabled || !featureOn(business, "invoices")) return null;
  return <div id="racuni-naslov" className="scroll-mt-24"><InvoiceInbox business={business} onSaved={() => qc.invalidateQueries({ queryKey: ["business"] })} /></div>;
}
