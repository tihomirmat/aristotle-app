import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Send, Phone, Users, StickyNote, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { generateDraft } from "@/functions/generateDraft";
import { fnError } from "@/lib/fn-error";
import { TASK_TYPES, PRIORITY, logActivity } from "@/lib/crm";

const CRM_KEYS = ["activities", "tasks", "leads", "drafts-all", "drafts", "companies", "drafts-sidebar", "tasks-sidebar", "bookings", "offers", "enrollments", "campaigns", "leads-new-sidebar"];
export const useCrmInvalidate = () => {
  const qc = useQueryClient();
  return () => CRM_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
};

const localInput = (d) => format(d, "yyyy-MM-dd'T'HH:mm");

// ─── Opravilo (nova ali urejanje) ─────────────────────────────────────────────
export function TaskDialog({ open, onOpenChange, task, leadId, companyId, leads = [], companies = [] }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const empty = () => ({ title: "", description: "", type: "followup", priority: "normal", due_at: localInput(addDays(new Date().setHours(9, 0, 0, 0), 1)), lead_id: leadId || "", company_id: companyId || "" });
  const [f, setF] = useState(empty());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(task ? { ...empty(), ...task, due_at: task.due_at ? localInput(new Date(task.due_at)) : "" } : empty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const save = async () => {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      const data = {
        title: f.title.trim(), description: f.description || "", type: f.type, priority: f.priority,
        due_at: f.due_at ? new Date(f.due_at).toISOString() : null,
        lead_id: f.lead_id || null, company_id: f.company_id || null,
      };
      if (task?.id) await base44.entities.Task.update(task.id, data);
      else await base44.entities.Task.create({ ...data, business_id: business.id, status: "open", source: "manual", owner_email: business.owner_email || business.created_by });
      invalidate();
      toast.success(task?.id ? "Opravilo posodobljeno." : "Opravilo dodano.");
      onOpenChange(false);
    } catch (e) { toast.error(fnError(e)); } finally { setSaving(false); }
  };

  const quick = [["Danes", 0], ["Jutri", 1], ["Čez 3 dni", 3], ["Čez teden", 7]];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{task?.id ? "Uredi opravilo" : "Novo opravilo"}</DialogTitle><DialogDescription>Kaj morate narediti in do kdaj. Opomnik dobite v dnevnem povzetku.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Kaj je treba narediti *</Label><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Npr. Pokliči glede ponudbe" /></div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TASK_TYPES).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setF({ ...f, type: k })} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${f.type === k ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}><t.icon className="w-3 h-3" />{t.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rok</Label>
              <Input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} />
              <div className="flex flex-wrap gap-1">{quick.map(([l, d]) => <button key={l} type="button" onClick={() => setF({ ...f, due_at: localInput(addDays(new Date().setHours(9, 0, 0, 0), d)) })} className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/70">{l}</button>)}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Pomembnost</Label>
              <div className="flex flex-col gap-1">
                {Object.entries(PRIORITY).map(([k, p]) => <button key={k} type="button" onClick={() => setF({ ...f, priority: k })} className={`text-xs px-2.5 py-1 rounded-md border text-left ${f.priority === k ? "ring-2 ring-primary/40 " + p.cls : "hover:bg-muted"}`}>{p.label}</button>)}
              </div>
            </div>
          </div>
          {!leadId && leads.length > 0 && (
            <div className="space-y-1.5"><Label>Stranka</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={f.lead_id || ""} onChange={(e) => setF({ ...f, lead_id: e.target.value })}>
                <option value="">— brez —</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select></div>
          )}
          {!companyId && !leadId && companies.length > 0 && (
            <div className="space-y-1.5"><Label>Podjetje</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={f.company_id || ""} onChange={(e) => setF({ ...f, company_id: e.target.value })}>
                <option value="">— brez —</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          )}
          <div className="space-y-1.5"><Label>Podrobnosti</Label><Textarea value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} className="h-20" /></div>
          <Button className="w-full btn-brand" onClick={save} disabled={!f.title.trim() || saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani opravilo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Zabeleži klic / sestanek / opombo ───────────────────────────────────────
const LOG_TYPES = [
  { key: "call", label: "Klic", icon: Phone, ph: "O čem sta se pogovarjala? Kaj je naslednji korak?" },
  { key: "meeting", label: "Sestanek", icon: Users, ph: "Kaj ste se dogovorili?" },
  { key: "note", label: "Opomba", icon: StickyNote, ph: "Karkoli si želite zapomniti o stranki" },
  { key: "sms", label: "SMS / sporočilo", icon: Smartphone, ph: "Kaj ste si napisali?" },
];
export function LogActivityDialog({ open, onOpenChange, lead, companyId, defaultType = "call" }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [type, setType] = useState(defaultType);
  const [content, setContent] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setType(defaultType); setContent(""); setFollowUp(false); } }, [open, defaultType]);
  const T = LOG_TYPES.find((t) => t.key === type) || LOG_TYPES[0];

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await logActivity(business, {
        lead_id: lead?.id || null, company_id: companyId || lead?.company_id || null, type,
        direction: type === "note" ? "internal" : "outbound", subject: T.label, content: content.trim(),
      });
      if (followUp) {
        await base44.entities.Task.create({ business_id: business.id, owner_email: business.owner_email || business.created_by, title: `Ponovni stik${lead ? ": " + lead.name : ""}`, type: "followup", priority: "normal", status: "open", source: "manual", lead_id: lead?.id || null, company_id: companyId || lead?.company_id || null, due_at: addDays(new Date().setHours(9, 0, 0, 0), 3).toISOString(), description: content.trim().slice(0, 300) });
      }
      invalidate();
      toast.success("Zabeleženo na časovnici.");
      onOpenChange(false);
    } catch (e) { toast.error(fnError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Zabeleži{lead ? ` — ${lead.name}` : ""}</DialogTitle><DialogDescription>Zapis se pokaže na časovnici stranke. AI ga upošteva pri naslednjem sporočilu.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {LOG_TYPES.map((t) => <button key={t.key} type="button" onClick={() => setType(t.key)} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${type === t.key ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}><t.icon className="w-3 h-3" />{t.label}</button>)}
          </div>
          <Textarea autoFocus value={content} onChange={(e) => setContent(e.target.value)} className="h-32" placeholder={T.ph} />
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />Opomni me na ponovni stik čez 3 dni</label>
          <Button className="w-full btn-brand" onClick={save} disabled={!content.trim() || saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pošlji e-pošto (ročno ali AI osnutek) ───────────────────────────────────
export function SendEmailDialog({ open, onOpenChange, lead }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const [instruction, setInstruction] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (open) { setInstruction(""); setSubject(""); setBody(""); setDraftId(null); } }, [open]);

  const aiWrite = async () => {
    setAiLoading(true);
    try {
      const res = await generateDraft({ business_id: business.id, lead_id: lead.id, pillar: "manual", instruction });
      if (res.data?.error) throw new Error(res.data.error);
      const d = res.data?.draft;
      if (d) { setSubject(d.subject || ""); setBody(d.body || ""); setDraftId(d.id); }
    } catch (e) { toast.error(fnError(e)); } finally { setAiLoading(false); }
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      let id = draftId;
      if (id) await base44.entities.DraftMessage.update(id, { subject, body });
      else {
        const d = await base44.entities.DraftMessage.create({ business_id: business.id, lead_id: lead.id, pillar: "manual", channel: "email", subject, body, status: "pending", owner_email: business.owner_email || business.created_by, ai_reasoning: "Napisano ročno v CRM." });
        id = d.id;
      }
      await base44.entities.DraftMessage.update(id, { status: "approved" });
      invalidate();
      toast.success(`Sporočilo za ${lead.name} se pošilja.`);
      onOpenChange(false);
    } catch (e) { toast.error(fnError(e)); } finally { setSending(false); }
  };

  const noEmail = !lead?.email;
  const noConsent = lead && lead.email && lead.consent_email === false;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nova e-pošta — {lead?.name}</DialogTitle><DialogDescription>{lead?.email || "Stranka nima e-naslova."} Pošlje se z vašega e-naslova, podpis doda sistem.</DialogDescription></DialogHeader>
        {noEmail ? <p className="text-sm text-muted-foreground">Najprej dodajte e-naslov stranke v podatkih.</p> : (
          <div className="space-y-3">
            {noConsent && <p className="text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">Stranka ni označena, da se strinja s prejemanjem e-pošte — sporočilo ne bo poslano. Če vam je pisala sama, to označite v podatkih stranke.</p>}
            <div className="rounded-xl border bg-accent/40 p-3 space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" />Naj AI napiše (v vašem glasu, glede na zgodovino)</Label>
              <div className="flex gap-2">
                <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Npr. vprašaj, ali je ponudba ustrezna, in predlagaj klic ta teden" onKeyDown={(e) => e.key === "Enter" && !aiLoading && aiWrite()} />
                <Button variant="outline" onClick={aiWrite} disabled={aiLoading}>{aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Napiši"}</Button>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Zadeva</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Sporočilo</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} className="h-56 text-sm" placeholder="Spoštovani ..." /></div>
            <Button className="w-full btn-brand" onClick={send} disabled={!subject.trim() || !body.trim() || sending}>{sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Pošlji</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
