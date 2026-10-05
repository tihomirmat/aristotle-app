// Skupne CRM konstante in pomočniki (faze, viri, vrste dogodkov, opravila, kampanje).
import { Mail, FileText, MessageSquare, Upload, PenLine, Phone, Users, StickyNote, CheckCircle2, FileSignature, CalendarCheck, Settings2, MailOpen, Send, Smartphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import { sl } from "date-fns/locale";

export const STAGES = [
  { key: "new", label: "Novo", hint: "Še niste odgovorili", dot: "bg-blue-500" },
  { key: "contacted", label: "Kontaktirano", hint: "Poslali ste odgovor", dot: "bg-amber-500" },
  { key: "replied", label: "Odgovorili so", hint: "Stranka je odpisala", dot: "bg-emerald-500" },
  { key: "booked", label: "Termin", hint: "Dogovorjen sestanek", dot: "bg-violet-500" },
  { key: "converted", label: "Stranka", hint: "Posel sklenjen", dot: "bg-primary" },
  { key: "lost", label: "Izgubljeno", hint: "Ni zanimanja", dot: "bg-slate-400" },
];
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.key, s]));
STAGE.unsubscribed = { key: "unsubscribed", label: "Odjavljen", hint: "Ne želi več prejemati e-pošte", dot: "bg-slate-300" };

export const SOURCES = {
  email: { label: "E-pošta", icon: Mail, cls: "text-primary bg-accent" },
  form: { label: "Obrazec", icon: FileText, cls: "text-emerald-700 bg-emerald-50" },
  chatbot: { label: "Klepet", icon: MessageSquare, cls: "text-violet-700 bg-violet-50" },
  import: { label: "Uvoz", icon: Upload, cls: "text-slate-700 bg-slate-100" },
  manual: { label: "Ročno", icon: PenLine, cls: "text-slate-700 bg-slate-100" },
};

export const ACTIVITY = {
  email_in: { label: "Prejeta e-pošta", icon: MailOpen, cls: "bg-blue-100 text-blue-700" },
  email_out: { label: "Poslana e-pošta", icon: Send, cls: "bg-orange-100 text-primary" },
  call: { label: "Klic", icon: Phone, cls: "bg-emerald-100 text-emerald-700" },
  meeting: { label: "Sestanek", icon: Users, cls: "bg-violet-100 text-violet-700" },
  note: { label: "Opomba", icon: StickyNote, cls: "bg-amber-100 text-amber-700" },
  sms: { label: "SMS", icon: Smartphone, cls: "bg-sky-100 text-sky-700" },
  chat: { label: "Klepet na strani", icon: MessageSquare, cls: "bg-violet-100 text-violet-700" },
  form: { label: "Obrazec na strani", icon: FileText, cls: "bg-emerald-100 text-emerald-700" },
  task_done: { label: "Opravljeno", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700" },
  offer: { label: "Ponudba", icon: FileSignature, cls: "bg-indigo-100 text-indigo-700" },
  booking: { label: "Termin", icon: CalendarCheck, cls: "bg-violet-100 text-violet-700" },
  system: { label: "Sprememba", icon: Settings2, cls: "bg-slate-100 text-slate-600" },
};

export const TASK_TYPES = {
  followup: { label: "Ponovni stik", icon: Send },
  call: { label: "Klic", icon: Phone },
  meeting: { label: "Sestanek", icon: Users },
  email: { label: "E-pošta", icon: Mail },
  task: { label: "Opravilo", icon: CheckCircle2 },
};
export const PRIORITY = {
  high: { label: "Nujno", cls: "bg-red-50 text-red-700 border-red-200" },
  normal: { label: "Običajno", cls: "bg-slate-50 text-slate-700 border-slate-200" },
  low: { label: "Ni nujno", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

export const CAMPAIGN_GOALS = {
  reactivation: { label: "Vrnite stare stranke", hint: "Strankam, ki se dolgo niso oglasile, pošlje prijazno sporočilo." },
  nurture: { label: "Ogrejte povpraševanja", hint: "Tistim, ki so povprašali, a se še niso odločili, pošlje nekaj koristnih sporočil." },
  newsletter: { label: "Redne novice", hint: "Vsem strankam pošlje novico ali akcijo." },
  acquisition: { label: "Pridobite nove stranke", hint: "Podjetjem, ki jih še ne poznate, pošlje predstavitev." },
  review: { label: "Prošnja za oceno", hint: "Zadovoljnim strankam pošlje prošnjo za Google oceno." },
};
export const CAMPAIGN_STATUS = {
  draft: { label: "Pripravlja se", cls: "bg-slate-100 text-slate-700" },
  active: { label: "Teče", cls: "bg-emerald-100 text-emerald-700" },
  paused: { label: "Ustavljena", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Končana", cls: "bg-slate-100 text-slate-500" },
};

export const ago = (d) => (d ? formatDistanceToNowStrict(new Date(d), { locale: sl, addSuffix: true }) : "");
export const fmtDate = (d, f = "d. M. yyyy") => (d ? format(new Date(d), f, { locale: sl }) : "—");
export const fmtDateTime = (d) => fmtDate(d, "d. M. yyyy, HH:mm");
export const firstLine = (s) => String(s || "").replace(/^\[[^\]]*\]\s*/, "").split("\n")[0].slice(0, 140);
export const eur = (n) => (n || n === 0 ? new Intl.NumberFormat("sl-SI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "—");
export const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export const dueLabel = (d) => {
  if (!d) return { text: "Brez roka", cls: "text-muted-foreground" };
  const dt = new Date(d);
  if (isPast(dt) && !isToday(dt)) return { text: `Zamuja · ${fmtDate(dt)}`, cls: "text-red-600 font-medium" };
  if (isToday(dt)) return { text: `Danes${dt.getHours() || dt.getMinutes() ? " ob " + format(dt, "HH:mm") : ""}`, cls: "text-primary font-medium" };
  if (isTomorrow(dt)) return { text: "Jutri", cls: "text-foreground" };
  return { text: fmtDate(dt, "EEE, d. M."), cls: "text-muted-foreground" };
};
export const taskBucket = (t) => {
  if (!t.due_at) return "later";
  const d = new Date(t.due_at);
  if (d < startOfDay(new Date())) return "overdue";
  if (isToday(d)) return "today";
  if (d - new Date() < 7 * 86400000) return "week";
  return "later";
};

export const logActivity = (business, data) =>
  base44.entities.Activity.create({
    business_id: business.id,
    owner_email: business.owner_email || business.created_by,
    occurred_at: new Date().toISOString(),
    direction: "internal",
    ...data,
  });
