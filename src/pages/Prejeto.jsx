import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, X, Pencil, Mail, Loader2, Inbox, Send, Clock, Globe, MessageSquare, Star, RotateCcw, CalendarDays, Bot, ShieldCheck, ThumbsUp, ThumbsDown, Megaphone, PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import StatusBanner from "@/components/ui/StatusBanner";
import { format } from "date-fns";
import GenerateDraftButton from "@/components/prejeto/GenerateDraftButton";
import { Link } from "react-router-dom";

// Zakaj je sporočilo nastalo — v jeziku stranke, ne v žargonu modulov.
const REASONS = {
  web_form_lead: { label: "Novo povpraševanje", why: "Stranka je izpolnila spletni obrazec. AI je pripravil prvi odgovor.", icon: Globe, color: "bg-emerald-100 text-emerald-700" },
  chatbot_handoff: { label: "Iz spletnega klepeta", why: "Stranka je v klepetu pustila kontakt. AI je pripravil nadaljevanje.", icon: MessageSquare, color: "bg-violet-100 text-violet-700" },
  reactivation: { label: "Stara stranka", why: "S to stranko niste bili v stiku 30 dni ali več. AI jo vljudno povabi nazaj.", icon: RotateCcw, color: "bg-blue-100 text-blue-700" },
  review_request: { label: "Prošnja za oceno", why: "Storitev je zaključena. AI prosi stranko za Google oceno.", icon: Star, color: "bg-amber-100 text-amber-700" },
  review_response: { label: "Odgovor na oceno", why: "Stranka je pustila oceno. AI je pripravil odgovor.", icon: Star, color: "bg-amber-100 text-amber-700" },
  referral_ask: { label: "Prošnja za priporočilo", why: "Zadovoljna stranka. AI jo prosi, da vas priporoči naprej.", icon: Star, color: "bg-amber-100 text-amber-700" },
  booking_proposal: { label: "Predlog termina", why: "Stranka želi termin. AI je iz koledarja izbral proste termine.", icon: CalendarDays, color: "bg-rose-100 text-rose-700" },
  booking_confirmation: { label: "Potrditev termina", why: "Termin je potrjen. AI je pripravil potrditev.", icon: CalendarDays, color: "bg-rose-100 text-rose-700" },
  assistant_action: { label: "Predlog asistenta", why: "Asistent je predlagal to sporočilo.", icon: Bot, color: "bg-slate-100 text-slate-700" },
  campaign: { label: "Kampanja", why: "Sporočilo iz vaše kampanje. Ko stranka odgovori, se kampanja zanjo ustavi.", icon: Megaphone, color: "bg-orange-100 text-orange-700" },
  manual: { label: "Vaše sporočilo", why: "Sporočilo ste pripravili na strani stranke.", icon: PenLine, color: "bg-slate-100 text-slate-700" },
};
const reasonFor = (p) => REASONS[p] || { label: p || "Sporočilo", why: "AI je pripravil to sporočilo.", icon: Mail, color: "bg-slate-100 text-slate-700" };

const TABS = [
  { key: "pending", label: "Čaka na vas" },
  { key: "sent", label: "Poslano" },
  { key: "skipped", label: "Zavrnjeno" },
];

export default function Prejeto() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [tab, setTab] = useState("pending");
  const [exampleDlg, setExampleDlg] = useState(null); // { msg, kind: 'good'|'bad', why }
  const [savingExample, setSavingExample] = useState(false);

  // Sporočilo shrani kot primer za glas znamke (največ 5; nov zamenja najstarejšega).
  const saveExample = async () => {
    const { msg, kind, why } = exampleDlg;
    if (kind === "bad" && !why.trim()) { toast.error("Na kratko napišite, kaj je narobe — po tem se AI ravna."); return; }
    setSavingExample(true);
    try {
      const key = kind === "good" ? "example_good_messages" : "example_bad_messages";
      const fresh = (await base44.entities.Business.filter({ id: business.id }))[0] || business;
      const item = kind === "good" ? { subject: msg.subject || "", body: msg.body || "", why_good: why.trim() } : { subject: msg.subject || "", body: msg.body || "", why_bad: why.trim() };
      const list = [...(fresh[key] || []).filter((x) => x.body !== item.body), item].slice(-5);
      await base44.entities.Business.update(business.id, { [key]: list });
      queryClient.invalidateQueries({ queryKey: ["business"] });
      toast.success(kind === "good" ? "Shranjeno kot dober primer. AI se bo po njem zgledoval." : "Shranjeno kot slab primer. AI se bo takim sporočilom izogibal.");
      setExampleDlg(null);
    } catch (e) { toast.error(e.message); } finally { setSavingExample(false); }
  };
  const ExampleButtons = ({ msg }) => (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="ghost" className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50" title="AI naj piše tako kot v tem sporočilu" onClick={() => setExampleDlg({ msg, kind: "good", why: "" })}><ThumbsUp className="w-4 h-4 mr-1" /> Dober primer</Button>
      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" title="AI naj se takemu pisanju izogiba" onClick={() => setExampleDlg({ msg, kind: "bad", why: "" })}><ThumbsDown className="w-4 h-4 mr-1" /> Slab primer</Button>
    </span>
  );

  const { data: allDrafts = [], isLoading } = useQuery({
    queryKey: ["drafts-all", business?.id],
    queryFn: async () => {
      const all = await base44.entities.DraftMessage.filter({ business_id: business.id });
      return all.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    },
    enabled: !!business?.id,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });
  const leadsMap = Object.fromEntries(leads.map((l) => [l.id, l]));

  const pending = allDrafts.filter((d) => d.status === "pending" || d.status === "flagged_for_review");
  const sent = allDrafts.filter((d) => d.status === "sent" || d.status === "approved");
  const skipped = allDrafts.filter((d) => d.status === "skipped" || d.status === "failed");
  const lists = { pending, sent, skipped };
  const drafts = lists[tab];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DraftMessage.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts-all", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["drafts-sidebar", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["drafts", business?.id] });
    },
  });

  const approve = (msg) => updateMutation.mutate({ id: msg.id, data: { status: "approved" } });
  const skip = (msg) => updateMutation.mutate({ id: msg.id, data: { status: "skipped" } });
  const saveEdit = (msg) => { updateMutation.mutate({ id: msg.id, data: { ...editForm, status: "approved" } }); setEditing(null); };
  const startEdit = (msg) => { setEditing(msg.id); setEditForm({ subject: msg.subject || "", body: msg.body || "" }); };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const trialSendsOut = business?.subscription_status === "trialing" && (business?.trial_sends_remaining ?? 20) <= 0;
  const smtpIncomplete = business?.email_provider === "smtp" && !(business?.smtp_host && business?.smtp_user);
  const fromAddress = business?.smtp_from_email || business?.gmail_email || business?.outlook_email || null;
  const autoMode = business?.draft_mode === false;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Za odobritev</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            AI pripravi sporočila vašim strankam. Nič se ne pošlje, dokler ne kliknete <strong>Odobri in pošlji</strong>.
            {autoMode && " Samodejno pošiljanje je vklopljeno: sporočila z visoko oceno kakovosti gredo brez vas."}
          </p>
        </div>
        <GenerateDraftButton />
      </div>

      {trialSendsOut && (
        <StatusBanner variant="warning" message="Porabili ste vse brezplačne pošiljke preizkusa. Odobritev bo shranjena, sporočila pa bodo poslana po aktivaciji naročnine." action={{ label: "Aktiviraj", href: "/nastavitve?tab=billing" }} />
      )}
      {smtpIncomplete && (
        <StatusBanner variant="warning" message="Pošiljanje z vašega naslova še ni nastavljeno. Do takrat sporočila pošilja AI Aristotle v vašem imenu." action={{ label: "Nastavi", href: "/nastavitve?tab=integracije" }} />
      )}

      <div className="flex gap-1 mb-5 border-b">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label} <span className="ml-1 text-xs text-muted-foreground">{lists[t.key].length}</span>
          </button>
        ))}
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-4" />
          {tab === "pending" ? (
            <>
              <p className="font-medium">Trenutno ni ničesar za odobritev.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Sporočila se tukaj pojavijo samodejno, ko nova stranka izpolni <Link to="/pridobivanje" className="underline">spletni obrazec</Link>,
                pusti kontakt v <Link to="/klepet" className="underline">spletnem klepetu</Link>, ko zaključite storitev (prošnja za oceno)
                ali ko na Pregledu zaženete <Link to="/" className="underline">vračanje starih strank</Link>.
              </p>
            </>
          ) : tab === "sent" ? (
            <p className="font-medium text-muted-foreground">Še ni poslanih sporočil.</p>
          ) : (
            <p className="font-medium text-muted-foreground">Ni zavrnjenih sporočil.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {drafts.map((msg) => {
            const lead = leadsMap[msg.lead_id];
            const isEditing = editing === msg.id;
            const r = reasonFor(msg.pillar);
            const RIcon = r.icon;
            const lowQuality = msg.status === "flagged_for_review";

            return (
              <div key={msg.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${r.color}`}>
                    <RIcon className="w-3.5 h-3.5" /> {r.label}
                  </span>
                  <span className="text-sm">
                    Za: <strong>{lead?.name || "neznana stranka"}</strong>
                    {lead?.email && <span className="text-muted-foreground"> · {lead.email}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {msg.created_date ? format(new Date(msg.created_date), "d. M. yyyy HH:mm") : ""}
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-3">{r.why}</p>
                  {lowQuality && (
                    <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2 mb-3 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Preverjanje kakovosti je dalo oceno {msg.quality_score ?? "?"}/10. Pred pošiljanjem ga preberite ali uredite.{msg.reviewer_notes ? ` Opomba: ${msg.reviewer_notes}` : ""}</span>
                    </p>
                  )}

                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Zadeva</Label>
                        <Input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Vsebina</Label>
                        <Textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} className="h-48" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(msg)} disabled={updateMutation.isPending}>
                          <Send className="w-4 h-4 mr-1" /> Shrani in pošlji
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Prekliči</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {msg.subject && <p className="text-sm font-semibold mb-2">{msg.subject}</p>}
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                      {tab === "pending" ? (
                        <div className="flex items-center gap-2 mt-5 flex-wrap">
                          <Button size="sm" onClick={() => approve(msg)} disabled={updateMutation.isPending}>
                            <Send className="w-4 h-4 mr-1" /> Odobri in pošlji
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => startEdit(msg)}>
                            <Pencil className="w-4 h-4 mr-1" /> Uredi
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => skip(msg)} disabled={updateMutation.isPending}>
                            <X className="w-4 h-4 mr-1" /> Ne pošlji
                          </Button>
                          <span className="ml-auto"><ExampleButtons msg={msg} /></span>
                          <span className="w-full text-xs text-muted-foreground">
                            Pošlje se na {lead?.email || "e-naslov stranke"}{fromAddress ? ` z naslova ${fromAddress}` : ""}.
                          </span>
                        </div>
                      ) : (
                        <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                          {msg.status === "sent" && <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Poslano {msg.sent_at ? format(new Date(msg.sent_at), "d. M. yyyy HH:mm") : ""}</>}
                          {msg.status === "approved" && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Odobreno, pošiljanje v teku</>}
                          {msg.status === "skipped" && <><X className="w-3.5 h-3.5" /> Niste poslali</>}
                          {msg.status === "failed" && <><X className="w-3.5 h-3.5 text-red-600" /> Pošiljanje ni uspelo{msg.reviewer_notes ? `: ${msg.reviewer_notes}` : ""}</>}
                          <span className="ml-auto"><ExampleButtons msg={msg} /></span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!exampleDlg} onOpenChange={(o) => !o && setExampleDlg(null)}>
        <DialogContent className="max-w-xl">
          {exampleDlg && (<>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{exampleDlg.kind === "good" ? <><ThumbsUp className="w-5 h-5 text-emerald-600" /> Shrani kot dober primer</> : <><ThumbsDown className="w-5 h-5 text-red-600" /> Shrani kot slab primer</>}</DialogTitle>
              <DialogDescription>{exampleDlg.kind === "good" ? "AI se bo pri novih sporočilih zgledoval po tem." : "AI se bo takemu pisanju izogibal."} Primere vidite in urejate v Nastavitve → Glas znamke.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto">
              <p className="text-sm font-medium">{exampleDlg.msg.subject}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{exampleDlg.msg.body}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{exampleDlg.kind === "good" ? "Kaj vam je všeč? (neobvezno)" : "Kaj je narobe?"}</Label>
              <Input autoFocus value={exampleDlg.why} onChange={(e) => setExampleDlg({ ...exampleDlg, why: e.target.value })} placeholder={exampleDlg.kind === "good" ? "Npr. kratko, osebno, jasen naslednji korak" : "Npr. preveč formalno, predolgo, obljublja popust"} onKeyDown={(e) => e.key === "Enter" && saveExample()} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setExampleDlg(null)}>Prekliči</Button>
              <Button className="btn-brand" onClick={saveExample} disabled={savingExample}>{savingExample && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani primer</Button>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
