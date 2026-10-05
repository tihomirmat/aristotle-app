import React, { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Mail, Phone, Building2, Send, ListPlus, PhoneCall, FileSignature, Loader2, ChevronDown, MoreHorizontal, Trash2, CalendarCheck, Megaphone, Plus, FileText, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { STAGES, STAGE, SOURCES, CAMPAIGN_GOALS, fmtDate, fmtDateTime, eur, initials, ago } from "@/lib/crm";
import Timeline from "@/components/crm/Timeline";
import TaskRow from "@/components/crm/TaskRow";
import TasksPanel from "@/components/crm/TasksPanel";
import { TaskDialog, LogActivityDialog, SendEmailDialog, useCrmInvalidate } from "@/components/crm/CrmDialogs";
import GenerateDraftButton from "@/components/stranke/GenerateDraftButton";
import ReplyReview from "@/components/crm/ReplyReview";

const ENROLL_STATUS = { active: "Teče", completed: "Končano", stopped_replied: "Ustavljeno — odgovoril", stopped_unsubscribed: "Ustavljeno — odjava", stopped_manual: "Ustavljeno ročno" };

// Polje, ki se shrani ob izhodu (brez gumba Shrani).
function Field({ label, value, onSave, type = "text", placeholder }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input key={String(value ?? "")} type={type} defaultValue={value ?? ""} placeholder={placeholder || "—"}
        className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2"
        onBlur={(e) => { const v = type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value; if (String(v ?? "") !== String(value ?? "")) onSave(v); }} />
    </div>
  );
}

export default function StrankaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [tab, setTab] = useState("timeline");
  const [dlg, setDlg] = useState(null); // 'email' | 'task' | 'log' | 'note' | 'delete'
  const [editTask, setEditTask] = useState(null);
  const bid = business?.id;

  const { data: lead, isLoading } = useQuery({ queryKey: ["leads", "one", id], queryFn: () => base44.entities.Lead.filter({ id }).then((r) => r[0] || null), enabled: !!id });
  const q = (key, entity, filter) => useQuery({ queryKey: [key, bid, "lead", id], queryFn: () => base44.entities[entity].filter(filter), enabled: !!bid && !!id });
  const { data: activities = [] } = q("activities", "Activity", { business_id: bid, lead_id: id });
  const { data: tasks = [] } = q("tasks", "Task", { business_id: bid, lead_id: id });
  const { data: drafts = [] } = q("drafts-all", "DraftMessage", { business_id: bid, lead_id: id });
  const { data: bookings = [] } = q("bookings", "ConfirmedBooking", { business_id: bid, lead_id: id });
  const { data: offers = [] } = q("offers", "OfferGeneration", { business_id: bid, lead_id: id });
  const { data: enrollments = [] } = q("enrollments", "CampaignEnrollment", { business_id: bid, lead_id: id });
  const { data: companies = [] } = useQuery({ queryKey: ["companies", bid], queryFn: () => base44.entities.Company.filter({ business_id: bid }), enabled: !!bid });
  const { data: campaigns = [] } = useQuery({ queryKey: ["campaigns", bid], queryFn: () => base44.entities.Campaign.filter({ business_id: bid }), enabled: !!bid });

  const company = companies.find((c) => c.id === lead?.company_id);
  const pending = drafts.filter((d) => ["pending", "flagged_for_review"].includes(d.status));
  const openTasks = tasks.filter((t) => t.status === "open").sort((a, b) => new Date(a.due_at || "2999") - new Date(b.due_at || "2999"));
  const doneTasks = tasks.filter((t) => t.status === "done").sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));
  const campaignsById = useMemo(() => Object.fromEntries(campaigns.map((c) => [c.id, c])), [campaigns]);
  const activeCampaigns = campaigns.filter((c) => c.status === "active" && !enrollments.some((e) => e.campaign_id === c.id));

  const save = async (data) => {
    try { await base44.entities.Lead.update(lead.id, data); invalidate(); } catch (e) { toast.error(e.message); }
  };
  const setStage = async (st) => { await save({ status: st }); toast.success(`Faza: ${STAGE[st].label}`); };
  const enroll = async (c) => {
    try {
      await base44.entities.CampaignEnrollment.create({ business_id: bid, owner_email: business.owner_email || business.created_by, campaign_id: c.id, lead_id: lead.id, current_step: 0, status: "active", next_send_at: new Date().toISOString() });
      invalidate(); toast.success(`Dodano v kampanjo »${c.name}«.`);
    } catch (e) { toast.error(e.message); }
  };
  const stopEnroll = async (e) => { await base44.entities.CampaignEnrollment.update(e.id, { status: "stopped_manual" }); invalidate(); };
  const remove = async () => {
    await base44.entities.Lead.delete(lead.id);
    invalidate(); toast.success("Stranka izbrisana."); navigate("/stranke");
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!lead) return (
    <div className="card-elevated p-10 text-center"><h2 className="text-xl">Stranke ni mogoče najti</h2><Button asChild variant="outline" className="mt-4"><Link to="/stranke">Nazaj na stranke</Link></Button></div>
  );

  const S = SOURCES[lead.source] || SOURCES.manual;
  const st = STAGE[lead.status] || STAGE.new;
  const TABS = [["timeline", "Časovnica", activities.length], ["offers", "Ponudbe", offers.length], ["bookings", "Termini", bookings.length]];

  return (
    <div className="space-y-5">
      <Link to="/stranke" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Vse stranke</Link>

      {/* Glava */}
      <div className="card-elevated p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[hsl(41,100%,53%)] text-white font-display font-bold text-lg flex items-center justify-center shrink-0">{initials(lead.name)}</div>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl leading-tight">{lead.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
              {(lead.position || company) && <span className="inline-flex items-center gap-1.5"><Building2 className="w-4 h-4" />{lead.position}{lead.position && company ? " · " : ""}{company && <Link to={`/podjetja/${company.id}`} className="hover:text-foreground underline-offset-2 hover:underline">{company.name}</Link>}</span>}
              {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="w-4 h-4" />{lead.email}</a>}
              {lead.phone && <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="w-4 h-4" />{lead.phone}</a>}
              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${S.cls}`}><S.icon className="w-3 h-3" />{S.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}<ChevronDown className="w-3.5 h-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {STAGES.map((s) => <DropdownMenuItem key={s.key} onClick={() => setStage(s.key)} className="gap-2"><span className={`w-2 h-2 rounded-full ${s.dot}`} /><span className="flex-1">{s.label}</span><span className="text-[11px] text-muted-foreground">{s.hint}</span></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuItem className="text-red-600" onClick={() => setDlg("delete")}><Trash2 className="w-4 h-4 mr-2" />Izbriši stranko</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Akcije */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t">
          <Button className="btn-brand" onClick={() => setDlg("email")}><Send className="w-4 h-4 mr-2" />Pošlji e-pošto</Button>
          <Button variant="outline" onClick={() => setDlg("log")}><PhoneCall className="w-4 h-4 mr-2" />Zabeleži klic</Button>
          <Button variant="outline" onClick={() => { setEditTask(null); setDlg("task"); }}><ListPlus className="w-4 h-4 mr-2" />Novo opravilo</Button>
          <Button variant="outline" asChild><Link to={`/ponudbe/nova?lead=${lead.id}${company ? `&company=${company.id}` : ""}&client=${encodeURIComponent(company?.name || lead.name)}`}><FileSignature className="w-4 h-4 mr-2" />Pripravi ponudbo</Link></Button>
          <GenerateDraftButton lead={lead} businessId={bid} />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="space-y-4">
          {pending.map((d) => <ReplyReview key={d.id} draft={d} lead={lead} activities={activities} />)}
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px] gap-5 items-start">
        {/* Levo: zavihki */}
        <div className="card-elevated min-w-0">
          <div className="flex gap-1 border-b px-3 overflow-x-auto">
            {TABS.map(([k, l, n]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}{n > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>}</button>
            ))}
          </div>
          <div className="p-5">
            {tab === "timeline" && <Timeline activities={activities} emptyText="Tu se bodo pokazala vsa sporočila, klici, opombe in spremembe." />}

            {tab === "offers" && (
              <div className="space-y-2">
                {offers.length === 0 ? (
                  <div className="text-center py-6"><FileSignature className="w-10 h-10 mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">Za to stranko še ni ponudb.</p>
                    <Button asChild className="btn-brand mt-3"><Link to={`/ponudbe/nova?lead=${lead.id}${company ? `&company=${company.id}` : ""}&client=${encodeURIComponent(company?.name || lead.name)}`}>Pripravi ponudbo</Link></Button></div>
                ) : offers.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{o.client_name || "Ponudba"}{o.amount ? ` · ${eur(o.amount)}` : ""}</p><p className="text-xs text-muted-foreground">{fmtDate(o.created_date)} · {{ draft: "Pripravljena", sent: "Poslana", accepted: "Sprejeta", rejected: "Zavrnjena" }[o.offer_status || "draft"]}</p></div>
                    {o.output_pdf_url && <Button size="sm" variant="outline" asChild><a href={o.output_pdf_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1" />PDF</a></Button>}
                  </div>
                ))}
              </div>
            )}

            {tab === "bookings" && (
              <div className="space-y-2">
                {bookings.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Ni dogovorjenih terminov. Ko stranka potrdi termin, se pokaže tukaj in v vašem Google Koledarju.</p>
                  : bookings.sort((a, b) => new Date(b.booked_at) - new Date(a.booked_at)).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <CalendarCheck className="w-5 h-5 text-violet-600" />
                      <div className="flex-1"><p className="text-sm font-medium">{fmtDateTime(b.booked_at)}{b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}</p><p className="text-xs text-muted-foreground">{b.notes || ({ confirmed: "Potrjen", cancelled: "Odpovedan", completed: "Opravljen" }[b.status] || "")}</p></div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Desno: opravila (vedno vidna), podatki, opombe, kampanje */}
        <div className="space-y-4 order-first md:order-none">
          <TasksPanel tasks={tasks} leadId={lead.id} companyId={lead.company_id} onEdit={(x) => { setEditTask(x); setDlg("task"); }} onAddDetailed={() => { setEditTask(null); setDlg("task"); }} />
          <div className="card-elevated p-4 space-y-1">
            <p className="text-sm font-semibold mb-2">Podatki</p>
            <Field label="Ime" value={lead.name} onSave={(v) => v && save({ name: v })} />
            <Field label="E-pošta" value={lead.email} onSave={(v) => save({ email: v })} type="email" />
            <Field label="Telefon" value={lead.phone} onSave={(v) => save({ phone: v })} />
            <Field label="Funkcija" value={lead.position} onSave={(v) => save({ position: v })} placeholder="Npr. direktor" />
            <div className="grid grid-cols-[96px_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">Podjetje</span>
              <select className="h-8 rounded-md border border-transparent hover:border-border bg-transparent px-1.5 text-sm" value={lead.company_id || ""} onChange={(e) => save({ company_id: e.target.value || null })}>
                <option value="">— zasebna oseba —</option>{companies.sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="Vrednost €" value={lead.value} onSave={(v) => save({ value: v })} type="number" placeholder="Ocenjena vrednost posla" />
            <Field label="Naslov" value={lead.address} onSave={(v) => save({ address: v })} />
            <label className="flex items-center gap-2 text-xs pt-2 cursor-pointer"><input type="checkbox" checked={lead.consent_email !== false} onChange={(e) => save({ consent_email: e.target.checked })} />Strinja se s prejemanjem e-pošte</label>
            <p className="text-[11px] text-muted-foreground pt-2">Dodano {fmtDate(lead.created_date)} · zadnji stik {lead.last_contacted_at ? ago(lead.last_contacted_at) : "še ni bilo"}</p>
          </div>

          <div className="card-elevated p-4">
            <p className="text-sm font-semibold mb-1">Opombe</p>
            <Textarea key={lead.id + (lead.updated_date || "")} defaultValue={lead.notes || ""} className="h-28 text-sm" placeholder="Kaj želi, posebnosti, dogovori …" onBlur={(e) => e.target.value !== (lead.notes || "") && save({ notes: e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />AI opombe upošteva pri pisanju sporočil.</p>
          </div>

          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold">Kampanje</p>
              {activeCampaigns.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button className="text-xs text-primary inline-flex items-center gap-1"><Plus className="w-3 h-3" />Dodaj v kampanjo</button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">{activeCampaigns.map((c) => <DropdownMenuItem key={c.id} onClick={() => enroll(c)}>{c.name}</DropdownMenuItem>)}</DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {enrollments.length === 0 ? <p className="text-xs text-muted-foreground">Stranka ni v nobeni kampanji. <Link to="/kampanje" className="text-primary">Kampanje →</Link></p> : enrollments.map((e) => {
              const c = campaignsById[e.campaign_id];
              return (
                <div key={e.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <Megaphone className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0"><p className="truncate">{c?.name || "Kampanja"}</p><p className="text-[11px] text-muted-foreground">{ENROLL_STATUS[e.status]}{e.status === "active" ? ` · korak ${(e.current_step || 0) + 1} od ${c?.steps?.length || "?"}` : ""}{c ? ` · ${CAMPAIGN_GOALS[c.goal]?.label || ""}` : ""}</p></div>
                  {e.status === "active" && <button onClick={() => stopEnroll(e)} className="text-[11px] text-muted-foreground hover:text-red-600">Ustavi</button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SendEmailDialog open={dlg === "email"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} />
      <LogActivityDialog open={dlg === "log"} onOpenChange={(o) => !o && setDlg(null)} lead={lead} />
      <TaskDialog open={dlg === "task"} onOpenChange={(o) => !o && setDlg(null)} task={editTask} leadId={lead.id} companyId={lead.company_id} />
      <AlertDialog open={dlg === "delete"} onOpenChange={(o) => !o && setDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Izbrišem stranko {lead.name}?</AlertDialogTitle><AlertDialogDescription>Stranka bo odstranjena s seznama. Tega ni mogoče razveljaviti.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Prekliči</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={remove}>Izbriši</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
