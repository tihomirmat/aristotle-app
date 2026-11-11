import React, { useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ListChecks, Upload, Loader2, Trash2, Download, ShieldCheck, ChevronDown, ExternalLink, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { importContacts } from "@/functions/importContacts";
import { fnError } from "@/lib/fn-error";
import { cnt, W, fmtDate } from "@/lib/crm";

export const CONTACT_STATUS = {
  ok: { label: "V redu", cls: "bg-emerald-50 text-emerald-700" },
  risky: { label: "Tvegan", cls: "bg-amber-50 text-amber-800" },
  invalid: { label: "Neveljaven", cls: "bg-red-50 text-red-700" },
  bounced: { label: "Vrnjen (ne obstaja)", cls: "bg-red-50 text-red-700" },
  replied: { label: "Odgovoril", cls: "bg-blue-50 text-blue-700" },
  unsubscribed: { label: "Odjavljen", cls: "bg-slate-100 text-slate-600" },
};

// Spletne storitve za preverjanje naslovov (cene okvirne, preverjeno v spletnih primerjavah nov. 2026).
const VERIFIERS = [
  { name: "Bouncer", url: "https://www.usebouncer.com", note: "EU podjetje, podatki v EU" },
  { name: "MillionVerifier", url: "https://www.millionverifier.com", note: "najcenejši pri večjih seznamih" },
  { name: "ZeroBounce", url: "https://www.zerobounce.net", note: "dodatno ocenjuje tveganje" },
  { name: "NeverBounce", url: "https://neverbounce.com", note: "preprost uvoz CSV" },
];

export function VerifyHelp({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-muted/30">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 p-3 text-left text-sm font-medium">
        <ShieldCheck className="w-4 h-4 text-primary" />Kako seznam preverim, preden pošljem?<ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 text-sm space-y-2">
          <p className="text-muted-foreground">Ob uvozu sami izločimo napačno zapisane naslove in domene, ki ne sprejemajo pošte. Ali posamezen predal (npr. janez@firma.si) še obstaja, pa zanesljivo preverijo le specializirane storitve:</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>Pri seznamu kliknite <strong>Prenesi CSV</strong>.</li>
            <li>Datoteko naložite v eno od storitev spodaj in počakajte na rezultat.</li>
            <li>Prenesite samo »veljavne« (valid) naslove in jih uvozite kot nov seznam. Starega izbrišite.</li>
          </ol>
          <ul className="grid sm:grid-cols-2 gap-1.5 pt-1">
            {VERIFIERS.map((v) => (
              <li key={v.name}><a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{v.name}<ExternalLink className="w-3 h-3" /></a> <span className="text-muted-foreground">— {v.note}</span></li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Okvirno od 2 do 20 USD za 1.000 naslovov, odvisno od storitve in količine. Cene preverite pri ponudniku.</p>
        </div>
      )}
    </div>
  );
}

function ImportDialog({ business, open, onOpenChange, onDone }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const ref = useRef(null);
  React.useEffect(() => { if (open) { setName(""); setFile(null); setText(""); setResult(null); } }, [open]);
  const run = async () => {
    setBusy(true);
    try {
      let payload = { business_id: business.id, name: name.trim() || (file?.name || "Seznam naslovov").replace(/\.(xlsx|xls|csv|txt)$/i, ""), file_name: file?.name || "" };
      if (file) { const { file_url } = await base44.integrations.Core.UploadFile({ file }); payload.file_url = file_url; }
      else payload.text = text;
      const res = await importContacts(payload);
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      setResult(d); onDone();
    } catch (e) { toast.error(fnError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Uvozi seznam naslovov</DialogTitle><DialogDescription>Excel ali CSV s stolpcem e-naslovov. Če imate tudi ime, podjetje ali spletno stran, jih uporabimo v sporočilih.</DialogDescription></DialogHeader>
        {result ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-5 h-5 text-emerald-600" />Uvoženo: {cnt(result.added, W.naslov)}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border p-2"><p className="text-xl font-bold text-emerald-700">{result.counts.ok}</p><p className="text-[11px] text-muted-foreground">v redu (prejmejo sporočila)</p></div>
              <div className="rounded-xl border p-2"><p className="text-xl font-bold text-red-600">{result.counts.invalid + result.counts.risky}</p><p className="text-[11px] text-muted-foreground">izločeni (ne pošiljamo)</p></div>
              <div className="rounded-xl border p-2"><p className="text-xl font-bold">{result.counts.duplicate}</p><p className="text-[11px] text-muted-foreground">podvojeni</p></div>
            </div>
            {result.invalid_sample?.length > 0 && (
              <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
                {result.invalid_sample.map((x) => <p key={x.email}><span className="font-medium">{x.email}</span> — {x.note}</p>)}
              </div>
            )}
            {result.truncated && <p className="text-xs text-amber-700">Uvozili smo prvih 5.000 naslovov. Ostale uvozite v drugem seznamu.</p>}
            <VerifyHelp />
            <DialogFooter><Button className="btn-brand" onClick={() => onOpenChange(false)}>Končaj</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Ime seznama</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Gradbinci Ljubljana 2026" /></div>
            <button type="button" onClick={() => ref.current?.click()} className={`w-full rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/40 ${file ? "border-primary bg-accent/30" : ""}`}>
              <FileSpreadsheet className="w-8 h-8 mx-auto text-primary" />
              <p className="text-sm font-medium mt-2">{file ? file.name : "Izberite datoteko Excel ali CSV"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Prva vrstica naj ima naslove stolpcev (npr. E-pošta, Ime, Podjetje).</p>
              <input ref={ref} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setText(""); }} />
            </button>
            {!file && (
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">… ali prilepite naslove (vsak v svojo vrstico)</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-24 text-sm" placeholder={"Janez Novak <janez@firma.si>\ninfo@druga-firma.si"} /></div>
            )}
            <p className="text-xs text-muted-foreground">Pošiljajte samo naslovom, ki jim smete pisati (npr. poslovni naslovi podjetij z vabilom, ki se nanaša na njihovo dejavnost). Vsako sporočilo ima povezavo za odjavo.</p>
            <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button><Button className="btn-brand" onClick={run} disabled={busy || (!file && !text.trim())}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}{busy ? "Uvažam in preverjam …" : "Uvozi"}</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
function downloadCsv(list, contacts) {
  const rows = [["E-pošta", "Ime", "Podjetje", "Telefon", "Spletna stran", "Stanje", "Opomba"], ...contacts.map((c) => [c.email, c.name, c.company, c.phone, c.website, CONTACT_STATUS[c.status]?.label || c.status, c.check_note || c.bounce_reason || ""])];
  const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${list.name.replace(/[^\wĀ-ſ -]/g, "").trim() || "seznam"}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function ListSheet({ list, contacts, open, onOpenChange }) {
  const [filter, setFilter] = useState("all");
  const shown = contacts.filter((c) => filter === "all" || c.status === filter).slice(0, 500);
  const by = (s) => contacts.filter((c) => c.status === s).length;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="text-left"><SheetTitle className="font-display text-xl">{list?.name}</SheetTitle><SheetDescription>{cnt(contacts.length, W.naslov)} · uvoženo {fmtDate(list?.created_date)}</SheetDescription></SheetHeader>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {[["all", "Vsi", contacts.length], ...Object.entries(CONTACT_STATUS).map(([k, v]) => [k, v.label, by(k)])].filter(([, , n]) => n > 0).map(([k, l, n]) => (
            <button key={k} onClick={() => setFilter(k)} className={`text-xs px-2.5 py-1 rounded-full border ${filter === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}>{l} ({n})</button>
          ))}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadCsv(list, contacts)}><Download className="w-4 h-4 mr-1.5" />Prenesi CSV</Button>
        </div>
        <div className="mt-3 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="text-left p-2">E-naslov</th><th className="text-left p-2">Ime</th><th className="text-left p-2">Podjetje</th><th className="text-left p-2">Stanje</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="p-2 break-all">{c.email}</td><td className="p-2">{c.name || "—"}</td><td className="p-2">{c.company || "—"}</td>
                  <td className="p-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${CONTACT_STATUS[c.status]?.cls || ""}`}>{CONTACT_STATUS[c.status]?.label || c.status}</span>{(c.check_note || c.bounce_reason) && <p className="text-[11px] text-muted-foreground mt-1">{c.check_note || c.bounce_reason}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {contacts.length > 500 && <p className="text-xs text-muted-foreground p-2 border-t">Prikazanih je prvih 500. Vse dobite s »Prenesi CSV«.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// »Seznami naslovov«: vir naslovov za kampanje. Naslovi niso stranke, dokler ne odgovorijo.
export default function ContactLists({ business, lists, contacts, onChanged }) {
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const byList = useMemo(() => { const m = {}; contacts.forEach((c) => { (m[c.list_id] ||= []).push(c); }); return m; }, [contacts]);
  const remove = async (l) => {
    if (!window.confirm(`Izbrišem seznam »${l.name}« in vse njegove naslove? Kampanje jim ne bodo več pisale.`)) return;
    setDeleting(l.id);
    try { const res = await importContacts({ business_id: business.id, action: "delete", list_id: l.id }); const d = res?.data ?? res; if (d?.error) throw new Error(d.error); toast.success("Seznam izbrisan."); onChanged(); }
    catch (e) { toast.error(fnError(e)); } finally { setDeleting(null); }
  };
  return (
    <div className="card-elevated p-5 space-y-4 h-full">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4 text-primary" />Seznami naslovov</h3>
          <p className="text-sm text-muted-foreground mt-1">Komu pišete. Naslovi s seznama niso med vašimi strankami — ko kdo odgovori, ga dodamo med Stranke.</p>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1.5" />Uvozi seznam</Button>
      </div>
      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">Še nimate seznama. Uvozite Excel ali CSV z e-naslovi.</p>
      ) : (
        <div className="space-y-2">
          {lists.map((l) => {
            const cs = byList[l.id] || []; const n = (s) => cs.filter((c) => c.status === s).length;
            return (
              <div key={l.id} className="rounded-xl border p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cnt(cs.length, W.naslov)} · <span className="text-emerald-700">v redu: {n("ok")}</span>{n("invalid") + n("risky") > 0 && <> · <span className="text-red-600">izločeni: {n("invalid") + n("risky")}</span></>}{n("bounced") > 0 && <> · <span className="text-red-600">vrnjeni: {n("bounced")}</span></>}{n("replied") > 0 && <> · odgovorili: {n("replied")}</>}{n("unsubscribed") > 0 && <> · odjavljeni: {n("unsubscribed")}</>}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setView(l)}>Poglej naslove</Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600" onClick={() => remove(l)} disabled={deleting === l.id}>{deleting === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</Button>
              </div>
            );
          })}
        </div>
      )}
      <VerifyHelp />
      <ImportDialog business={business} open={importOpen} onOpenChange={setImportOpen} onDone={onChanged} />
      {view && <ListSheet list={view} contacts={byList[view.id] || []} open={!!view} onOpenChange={(o) => !o && setView(null)} />}
    </div>
  );
}
