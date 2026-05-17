import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, CheckCircle, AlertCircle, CreditCard, Mail, Calendar, User, FlaskConical, Trash2, RotateCcw } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { seedDemoData } from "@/functions/seedDemoData";
import { clearDemoData } from "@/functions/clearDemoData";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const INDUSTRY_LABELS = { gym: "Fitnes / Gym", dental_medspa: "Zobozdravstvo / Med Spa", home_services: "Domače storitve", restaurant: "Restavracija / Café", salon_barber: "Salon / Frizerstvo", auto: "Avto storitve", other: "Drugo" };
const PLAN_LABELS = { free: "Brezplačno", starter: "Starter", growth: "Growth", scale: "Scale" };
const PLAN_COLORS = { free: "bg-gray-100 text-gray-600", starter: "bg-blue-100 text-blue-700", growth: "bg-violet-100 text-violet-700", scale: "bg-amber-100 text-amber-700" };

export default function Nastavitve() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "profil";

  const [form, setForm] = useState({
    name: "", industry_template: "other", phone: "", address: "", website: "",
    hours: "", services: "", current_offer: "", google_review_link: "",
  });
  const [savedForm, setSavedForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [bookingForm, setBookingForm] = useState({
    booking_enabled: false, booking_auto_mode: false,
    booking_hours_start: "09:00", booking_hours_end: "17:00",
    booking_buffer_minutes: 15, booking_default_duration_minutes: 60,
    booking_max_advance_days: 30, booking_min_advance_hours: 4,
    booking_proposals_count: 3, booking_response_window_hours: 24,
  });

  useEffect(() => {
    if (business) {
      const initial = {
        name: business.name || "",
        industry_template: business.industry_template || "other",
        phone: business.phone || "",
        address: business.address || "",
        website: business.website || "",
        hours: business.hours || "",
        services: business.services || "",
        current_offer: business.current_offer || "",
        google_review_link: business.google_review_link || "",
      };
      setForm(initial);
      setSavedForm(initial);
      setBookingForm({
        booking_enabled: business.booking_enabled || false,
        booking_auto_mode: business.booking_auto_mode || false,
        booking_hours_start: business.booking_hours_start || "09:00",
        booking_hours_end: business.booking_hours_end || "17:00",
        booking_buffer_minutes: business.booking_buffer_minutes || 15,
        booking_default_duration_minutes: business.booking_default_duration_minutes || 60,
        booking_max_advance_days: business.booking_max_advance_days || 30,
        booking_min_advance_hours: business.booking_min_advance_hours || 4,
        booking_proposals_count: business.booking_proposals_count || 3,
        booking_response_window_hours: business.booking_response_window_hours || 24,
      });
    }
  }, [business]);

  const PHONE_RE = /^(\+386|0)[1-9][0-9]{7,8}$/;
  const URL_RE = /^https?:\/\/.+/;

  const isDirty = savedForm && JSON.stringify(form) !== JSON.stringify(savedForm);

  const validateProfile = () => {
    const errors = {};
    if (form.phone && !PHONE_RE.test(form.phone.replace(/\s/g, ""))) errors.phone = "Neveljavna telefonska številka (npr. +38640123456)";
    if (form.website && !URL_RE.test(form.website)) errors.website = "Vnesite veljaven URL (npr. https://www.primer.si)";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Business.update(business.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
      setSavedForm({ ...form });
      setFormErrors({});
      sonnerToast.success("Profil je posodobljen.");
    },
  });

  const isHealthOk = business?.email_last_health_check_status === "ok";
  const [demoLoading, setDemoLoading] = useState(null); // 'seed' | 'clear' | null

  const handleSeedDemo = async () => {
    setDemoLoading('seed');
    await seedDemoData({ business_id: business.id });
    setDemoLoading(null);
    toast({ title: "Demo podatki ustvarjeni" });
    navigate("/");
  };

  const handleClearDemo = async () => {
    setDemoLoading('clear');
    await clearDemoData({ business_id: business.id });
    setDemoLoading(null);
    toast({ title: "Demo podatki počiščeni" });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nastavitve</h1>
        <p className="text-muted-foreground mt-1">Upravljajte profil, integracije in naročnino.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="profil" className="gap-2"><User className="w-4 h-4" /> Profil</TabsTrigger>
          <TabsTrigger value="integracije" className="gap-2"><Mail className="w-4 h-4" /> Integracije</TabsTrigger>
          <TabsTrigger value="termini" className="gap-2"><Calendar className="w-4 h-4" /> Termini</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><CreditCard className="w-4 h-4" /> Naročnina</TabsTrigger>
        </TabsList>

        {/* PROFIL */}
        <TabsContent value="profil">
          <div className="max-w-lg space-y-4 pb-24">
            <div className="space-y-2"><Label>Ime podjetja *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Panoga</Label>
              <Select value={form.industry_template} onValueChange={(v) => setForm({ ...form, industry_template: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INDUSTRY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+386 40 123 456" className={formErrors.phone ? "border-destructive" : ""} />
              {formErrors.phone && <p className="text-xs text-destructive">{formErrors.phone}</p>}
            </div>
            <div className="space-y-2"><Label>Naslov</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ulica 1, Ljubljana" /></div>
            <div className="space-y-2">
              <Label>Spletna stran</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://www.primer.si" className={formErrors.website ? "border-destructive" : ""} />
              {formErrors.website && <p className="text-xs text-destructive">{formErrors.website}</p>}
            </div>
            <div className="space-y-2"><Label>Delovni čas</Label><Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="Pon–Pet 8:00–18:00" /></div>
            <div className="space-y-2"><Label>Storitve</Label><Textarea value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="Navedite vaše storitve..." className="h-24" /></div>
            <div className="space-y-2"><Label>Trenutna ponudba</Label><Input value={form.current_offer} onChange={(e) => setForm({ ...form, current_offer: e.target.value })} placeholder="Npr. 20% popust za nove stranke" /></div>
            <div className="space-y-2"><Label>Povezava za Google ocene</Label><Input value={form.google_review_link} onChange={(e) => setForm({ ...form, google_review_link: e.target.value })} placeholder="https://g.page/r/..." /></div>

            {/* STICKY SAVE BAR */}
            {isDirty && (
              <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Imate neshranjene spremembe</span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={saveMutation.isPending} onClick={() => { setForm({ ...savedForm }); setFormErrors({}); }}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Razveljavi
                  </Button>
                  <Button disabled={saveMutation.isPending} onClick={() => { if (validateProfile()) saveMutation.mutate(form); }}>
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Shrani spremembe
                  </Button>
                </div>
              </div>
            )}

            {/* DEMO PODATKI */}
            <div className="border rounded-xl p-5 bg-card shadow-sm mt-6">
              <h3 className="font-semibold mb-1">Demo podatki</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Napolnite aplikacijo z primernimi demo podatki za predstavitev ali testiranje. Vse demo zapise lahko kasneje s pritiskom enega gumba popolnoma zbrišete.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSeedDemo} disabled={!!demoLoading} className="gap-2">
                  {demoLoading === 'seed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                  Napolni demo podatke
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!!demoLoading} variant="destructive" className="gap-2">
                      {demoLoading === 'clear' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Počisti demo podatke
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ali ste prepričani?</AlertDialogTitle>
                      <AlertDialogDescription>
                        To bo trajno zbrisalo vse demo zapise (stranke, sporočila, termine, znanje baze itd.) kjer je <strong>is_demo = true</strong>. Tega dejanja ni mogoče razveljaviti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Prekliči</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearDemo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Da, zbriši vse
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* INTEGRACIJE */}
        <TabsContent value="integracije">
          <div className="max-w-lg space-y-4">
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">E-poštna integracija</h3>
                {business?.email_last_health_check_status && (
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${isHealthOk ? "text-emerald-600" : "text-red-500"}`}>
                    {isHealthOk ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {isHealthOk ? "Deluje" : "Napaka"}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Ponudnik e-pošte</Label>
                  <Select value={business?.email_provider || ""} onValueChange={(v) => saveMutation.mutate({ email_provider: v })}>
                    <SelectTrigger><SelectValue placeholder="Izberite ponudnika" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                      <SelectItem value="smtp">SMTP (lastni strežnik)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {business?.email_provider === "smtp" && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>SMTP gostitelj</Label><Input placeholder="mail.primer.si" defaultValue={business?.smtp_host || ""} onBlur={(e) => saveMutation.mutate({ smtp_host: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Vrata</Label><Input type="number" placeholder="587" defaultValue={business?.smtp_port || ""} onBlur={(e) => saveMutation.mutate({ smtp_port: parseInt(e.target.value) })} /></div>
                    </div>
                    <div className="space-y-2"><Label>Uporabniško ime</Label><Input defaultValue={business?.smtp_user || ""} onBlur={(e) => saveMutation.mutate({ smtp_user: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Geslo</Label><Input type="password" defaultValue={business?.smtp_pass || ""} onBlur={(e) => saveMutation.mutate({ smtp_pass: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Pošiljateljev e-naslov</Label><Input placeholder="info@primer.si" defaultValue={business?.smtp_from_email || ""} onBlur={(e) => saveMutation.mutate({ smtp_from_email: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Ime pošiljatelja</Label><Input placeholder="Studio Fit" defaultValue={business?.smtp_from_name || ""} onBlur={(e) => saveMutation.mutate({ smtp_from_name: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Šifriranje</Label>
                      <Select defaultValue={business?.smtp_encryption || "starttls"} onValueChange={(v) => saveMutation.mutate({ smtp_encryption: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starttls">STARTTLS</SelectItem>
                          <SelectItem value="ssl_tls">SSL/TLS</SelectItem>
                          <SelectItem value="none">Brez</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {(business?.email_provider === "gmail" || business?.email_provider === "outlook") && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    {business.gmail_email || business.outlook_email
                      ? <span className="text-emerald-600 font-medium">✓ Povezano: {business.gmail_email || business.outlook_email}</span>
                      : "OAuth avtorizacija je na voljo prek agencijske nadzorne plošče."}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Google Koledar</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Za upravljanje terminov z asistentom.</p>
                </div>
                {business?.google_calendar_connected
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Povezano</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">Ni povezano</Badge>}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TERMINI */}
        <TabsContent value="termini">
          <div className="max-w-lg space-y-4">
            <div className="flex items-center justify-between bg-card border rounded-xl p-4 shadow-sm">
              <div>
                <p className="font-medium">Aktiviraj rezervacije</p>
                <p className="text-sm text-muted-foreground">Dovoli AI asistentu predlagati termine.</p>
              </div>
              <Switch checked={bookingForm.booking_enabled} onCheckedChange={(v) => setBookingForm({ ...bookingForm, booking_enabled: v })} />
            </div>
            {bookingForm.booking_enabled && (
              <>
                <div className="flex items-center justify-between bg-card border rounded-xl p-4 shadow-sm">
                  <div>
                    <p className="font-medium">Samodejni način</p>
                    <p className="text-sm text-muted-foreground">Asistent potrdi termine brez vašega pregleda.</p>
                  </div>
                  <Switch checked={bookingForm.booking_auto_mode} onCheckedChange={(v) => setBookingForm({ ...bookingForm, booking_auto_mode: v })} />
                </div>
                <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="font-semibold">Delovni čas terminov</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Začetek</Label><Input type="time" value={bookingForm.booking_hours_start} onChange={(e) => setBookingForm({ ...bookingForm, booking_hours_start: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Konec</Label><Input type="time" value={bookingForm.booking_hours_end} onChange={(e) => setBookingForm({ ...bookingForm, booking_hours_end: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Vmesni čas (min)</Label><Input type="number" value={bookingForm.booking_buffer_minutes} onChange={(e) => setBookingForm({ ...bookingForm, booking_buffer_minutes: parseInt(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Trajanje (min)</Label><Input type="number" value={bookingForm.booking_default_duration_minutes} onChange={(e) => setBookingForm({ ...bookingForm, booking_default_duration_minutes: parseInt(e.target.value) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Max. vnaprej (dni)</Label><Input type="number" value={bookingForm.booking_max_advance_days} onChange={(e) => setBookingForm({ ...bookingForm, booking_max_advance_days: parseInt(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Min. vnaprej (ure)</Label><Input type="number" value={bookingForm.booking_min_advance_hours} onChange={(e) => setBookingForm({ ...bookingForm, booking_min_advance_hours: parseInt(e.target.value) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Št. predlogov</Label><Input type="number" value={bookingForm.booking_proposals_count} onChange={(e) => setBookingForm({ ...bookingForm, booking_proposals_count: parseInt(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Odzivno okno (ure)</Label><Input type="number" value={bookingForm.booking_response_window_hours} onChange={(e) => setBookingForm({ ...bookingForm, booking_response_window_hours: parseInt(e.target.value) })} /></div>
                  </div>
                </div>
              </>
            )}
            <Button onClick={() => saveMutation.mutate(bookingForm)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Shrani nastavitve terminov
            </Button>
          </div>
        </TabsContent>

        {/* BILLING */}
        <TabsContent value="billing">
          <div className="max-w-lg space-y-4">
            <div className="bg-card border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-3">Trenutni načrt</h3>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${PLAN_COLORS[business?.plan] || "bg-gray-100 text-gray-600"}`}>
                  {PLAN_LABELS[business?.plan] || "—"}
                </span>
                <span className={`text-sm ${business?.subscription_status === "active" ? "text-emerald-600" : "text-amber-600"}`}>
                  {business?.subscription_status === "active" ? "Aktivna naročnina" : business?.subscription_status === "trialing" ? "Preizkusno obdobje" : "Neaktivno"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { plan: "starter", price: "49 €/mes", features: ["Reaktivacija, ocene, lead nurturing", "Do 500 strank", "E-poštno pošiljanje"] },
                { plan: "growth", price: "99 €/mes", features: ["Vse iz Starter", "Osebni AI asistent", "Rezervacije terminov"] },
                { plan: "scale", price: "199 €/mes", features: ["Vse iz Growth", "Tedenski digest", "Neomejene stranke"] },
              ].map((p) => (
                <div key={p.plan} className={`border rounded-xl p-4 ${business?.plan === p.plan ? "border-primary bg-accent" : "bg-card"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold capitalize">{PLAN_LABELS[p.plan]}</span>
                    <span className="font-semibold">{p.price}</span>
                  </div>
                  <ul className="space-y-1">
                    {p.features.map((f, i) => <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">✓ {f}</li>)}
                  </ul>
                  {business?.plan !== p.plan && (
                    <Button size="sm" variant="outline" className="mt-3 w-full">Nadgradi na {PLAN_LABELS[p.plan]}</Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}