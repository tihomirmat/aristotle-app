import React, { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Pencil, UserPlus, ListPlus, PhoneCall, FileSignature, Loader2, Plus, FileText, ExternalLink, Trash2, Hash, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { STAGE, fmtDate, eur, initials, ago } from "@/lib/crm";
import Timeline from "@/components/crm/Timeline";
import TaskRow from "@/components/crm/TaskRow";
import TasksPanel from "@/components/crm/TasksPanel";
import { TaskDialog, LogActivityDialog, useCrmInvalidate } from "@/components/crm/CrmDialogs";
import { CompanyDialog } from "@/pages/Podjetja";

export default function PodjetjeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const bid = business?.id;
  const [tab, setTab] = useState("timeline");
  const [dlg, setDlg] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [person, setPerson] = useState({ name: "", email: "", phone: "", position: "" });

  const { data: company, isLoading } = useQuery({ queryKey: ["companies", "one", id], queryFn: () => base44.entities.Company.filter({ id }).then((r) => r[0] || null), enabled: !!id });
  const { data: contacts = [] } = useQuery({ queryKey: ["leads", bid, "company", id], queryFn: () => base44.entities.Lead.filter({ business_id: bid, company_id: id }), enabled: !!bid });
  const { data: allActs = [] } = useQuery({ queryKey: ["activities", bid], queryFn: () => base44.entities.Activity.filter({ business_id: bid }), enabled: !!bid });
  const { data: allTasks = [] } = useQuery({ queryKey: ["tasks", bid, "all"], queryFn: () => base44.entities.Task.filter({ business_id: bid }), enabled: !!bid });
  const { data: allOffers = [] } = useQuery({ queryKey: ["offers", bid], queryFn: () => base44.entities.OfferGeneration.filter({ business_id: bid }), enabled: !!bid });

  const contactIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);
  const leadsById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c])), [contacts]);
  const mine = (x) => x.company_id === id || contactIds.has(x.lead_id);
  const activities = allActs.filter(mine);
  const tasks = allTasks.filter(mine);
  const offers = allOffers.filter(mine);
  const openTasks = tasks.filter((t) => t.status === "open").sort((a, b) => new Date(a.due_at || "2999") - new Date(b.due_at || "2999"));
  const doneTasks = tasks.filter((t) => t.status === "done");
  const totalValue = Number(company?.value) || contacts.reduce((s, l) => s + (Number(l.value) || 0), 0);

  const addPerson = async () => {
    if (!person.name.trim()) return;
    try {
      await base44.entities.Lead.create({ ...person, name: person.name.trim(), business_id: bid, company_id: id, owner_email: business.owner_email || business.created_by, source: "manual", status: "new", consent_email: true });
      invalidate(); setDlg(null); setPerson({ name: "", email: "", phone: "", position: "" }); toast.success("Oseba dodana.");
    } catch (e) { toast.error(e.message); }
  };
  const remove = async () => {
    await Promise.all(contacts.map((c) => base44.entities.Lead.update(c.id, { company_id: null })));
    await base44.entities.Company.delete(id);
    invalidate(); toast.success("Podjetje izbrisano."); navigate("/podjetja");
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!company) return <div className="card-elevated p-10 text-center"><h2 className="text-xl">Podjetja ni mogoče najti</h2><Button asChild variant="outline" className="mt-4"><Link to="/podjetja">Nazaj</Link></Button></div>;

  const offerLink = `/ponudbe/nova?company=${company.id}${contacts[0] ? `&lead=${contacts[0].id}` : ""}&client=${encodeURIComponent(company.name)}`;
  const TABS = [["timeline", "Časovnica", activities.length], ["people", "Kontaktne osebe", contacts.length], ["offers", "Ponudbe", offers.length]];
  const info = [[Mail, company.email, company.email && `mailto:${company.email}`], [Phone, company.phone, company.phone && `tel:${company.phone}`], [Globe, company.website, company.website && (company.website.startsWith("http") ? company.website : `https://${company.website}`)], [MapPin, company.address], [Hash, company.tax_id], [Briefcase, company.industry]].filter(([, v]) => v);

  return (
    <div className="space-y-5">
      <Link to="/podjetja" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Vsa podjetja</Link>

      <div className="card-elevated p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(231,88%,30%)] to-[hsl(262,94%,25%)] text-white font-display font-bold text-lg flex items-center justify-center shrink-0">{initials(company.name)}</div>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl leading-tight">{company.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{contacts.length} {contacts.length === 1 ? "kontaktna oseba" : "kontaktnih oseb"}{totalValue ? ` · vrednost ${eur(totalValue)}` : ""} · dodano {fmtDate(company.created_date)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDlg("edit")}><Pencil className="w-4 h-4 mr-2" />Uredi</Button>
            <Button variant="ghost" size="icon" onClick={() => setDlg("delete")} title="Izbriši"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t">
          <Button className="btn-brand" onClick={() => setDlg("person")}><UserPlus className="w-4 h-4 mr-2" />Dodaj osebo</Button>
          <Button variant="outline" onClick={() => setDlg("log")}><PhoneCall className="w-4 h-4 mr-2" />Zabeleži klic</Button>
          <Button variant="outline" onClick={() => { setEditTask(null); setDlg("task"); }}><ListPlus className="w-4 h-4 mr-2" />Novo opravilo</Button>
          <Button variant="outline" asChild><Link to={offerLink}><FileSignature className="w-4 h-4 mr-2" />Pripravi ponudbo</Link></Button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="card-elevated min-w-0">
          <div className="flex gap-1 border-b px-3 overflow-x-auto">
            {TABS.map(([k, l, n]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}{n > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>}</button>)}
          </div>
          <div className="p-5">
            {tab === "timeline" && <Timeline activities={activities} leadsById={leadsById} emptyText="Tu se bo pokazala komunikacija z vsemi osebami v tem podjetju." />}
            {tab === "people" && (
              <div className="divide-y">
                {contacts.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Dodajte prvo kontaktno osebo.</p>}
                {contacts.map((c) => {
                  const st = STAGE[c.status] || STAGE.new;
                  return (
                    <Link key={c.id} to={`/stranke/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg">
                      <div className="w-9 h-9 rounded-full bg-accent text-primary text-xs font-bold flex items-center justify-center">{initials(c.name)}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium">{c.name}{c.position && <span className="text-muted-foreground font-normal"> · {c.position}</span>}</p><p className="text-xs text-muted-foreground truncate">{c.email || c.phone || "—"}</p></div>
                      <span className="text-xs inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}</span>
                      <span className="text-xs text-muted-foreground w-24 text-right hidden sm:block">{ago(c.last_inbound_at || c.created_date)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            {tab === "offers" && (
              <div className="space-y-2">
                {offers.length === 0 ? <div className="text-center py-6"><p className="text-sm text-muted-foreground">Za to podjetje še ni ponudb.</p><Button asChild className="btn-brand mt-3"><Link to={offerLink}>Pripravi ponudbo</Link></Button></div>
                  : offers.map((o) => (
                    <div key={o.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{o.client_name || "Ponudba"}{o.amount ? ` · ${eur(o.amount)}` : ""}</p><p className="text-xs text-muted-foreground">{fmtDate(o.created_date)}</p></div>
                      {o.output_pdf_url && <Button size="sm" variant="outline" asChild><a href={o.output_pdf_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1" />PDF</a></Button>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 order-first md:order-none">
          <TasksPanel tasks={tasks} companyId={company.id} leadsById={leadsById} onEdit={(x) => { setEditTask(x); setDlg("task"); }} onAddDetailed={() => { setEditTask(null); setDlg("task"); }} />
          <div className="card-elevated p-4">
            <p className="text-sm font-semibold mb-2">Podatki</p>
            {info.length === 0 ? <button onClick={() => setDlg("edit")} className="text-xs text-primary">Dodajte podatke podjetja →</button> : (
              <div className="space-y-2 text-sm">
                {info.map(([Icon, v, href], i) => <div key={i} className="flex items-start gap-2"><Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />{href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="hover:text-primary break-all">{v}</a> : <span className="break-words">{v}</span>}</div>)}
              </div>
            )}
            {company.notes && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t whitespace-pre-wrap">{company.notes}</p>}
          </div>
        </div>
      </div>

      <CompanyDialog open={dlg === "edit"} onOpenChange={(o) => !o && setDlg(null)} company={company} />
      <LogActivityDialog open={dlg === "log"} onOpenChange={(o) => !o && setDlg(null)} companyId={company.id} />
      <TaskDialog open={dlg === "task"} onOpenChange={(o) => !o && setDlg(null)} task={editTask} companyId={company.id} leads={contacts} />
      <Dialog open={dlg === "person"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova kontaktna oseba — {company.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Ime in priimek *</Label><Input autoFocus value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Funkcija</Label><Input value={person.position} onChange={(e) => setPerson({ ...person, position: e.target.value })} placeholder="Npr. direktor, nabava" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>E-pošta</Label><Input value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Telefon</Label><Input value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} /></div>
            </div>
            <Button className="w-full btn-brand" onClick={addPerson} disabled={!person.name.trim()}>Dodaj osebo</Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={dlg === "delete"} onOpenChange={(o) => !o && setDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Izbrišem podjetje {company.name}?</AlertDialogTitle><AlertDialogDescription>Kontaktne osebe ostanejo med strankami, le brez podjetja.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Prekliči</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={remove}>Izbriši</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
