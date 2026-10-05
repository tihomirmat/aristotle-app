import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, Plus, Search, Loader2, Globe, Users } from "lucide-react";
import { toast } from "sonner";
import { eur, ago, initials } from "@/lib/crm";
import { useCrmInvalidate } from "@/components/crm/CrmDialogs";

// Podjetja (B2B stranke): vsako ima kontaktne osebe, časovnico, opravila in ponudbe.
export function CompanyDialog({ open, onOpenChange, company, onSaved }) {
  const { business } = useBusiness();
  const invalidate = useCrmInvalidate();
  const empty = { name: "", email: "", phone: "", website: "", address: "", tax_id: "", industry: "", notes: "", value: "" };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (open) setF(company ? { ...empty, ...company, value: company.value ?? "" } : empty); /* eslint-disable-next-line */ }, [open, company?.id]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    try {
      const data = { name: f.name.trim(), email: f.email, phone: f.phone, website: f.website, address: f.address, tax_id: f.tax_id, industry: f.industry, notes: f.notes, value: f.value === "" ? null : Number(f.value) };
      const res = company?.id ? await base44.entities.Company.update(company.id, data) : await base44.entities.Company.create({ ...data, business_id: business.id, owner_email: business.owner_email || business.created_by });
      invalidate(); toast.success(company?.id ? "Podjetje posodobljeno." : "Podjetje dodano.");
      onOpenChange(false); onSaved?.(res);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{company?.id ? "Uredi podjetje" : "Dodaj podjetje"}</DialogTitle><DialogDescription>Podjetje je lahko vaša stranka ali podjetje, ki ga želite pridobiti.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Naziv *</Label><Input autoFocus value={f.name} onChange={set("name")} placeholder="Podjetje d.o.o." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>E-pošta</Label><Input value={f.email || ""} onChange={set("email")} /></div>
            <div className="space-y-1.5"><Label>Telefon</Label><Input value={f.phone || ""} onChange={set("phone")} /></div>
            <div className="space-y-1.5"><Label>Spletna stran</Label><Input value={f.website || ""} onChange={set("website")} placeholder="www.primer.si" /></div>
            <div className="space-y-1.5"><Label>Davčna številka</Label><Input value={f.tax_id || ""} onChange={set("tax_id")} placeholder="SI12345678" /></div>
            <div className="space-y-1.5"><Label>Dejavnost</Label><Input value={f.industry || ""} onChange={set("industry")} placeholder="Npr. gradbeništvo" /></div>
            <div className="space-y-1.5"><Label>Vrednost posla (€)</Label><Input type="number" value={f.value} onChange={set("value")} /></div>
          </div>
          <div className="space-y-1.5"><Label>Naslov</Label><Input value={f.address || ""} onChange={set("address")} /></div>
          <div className="space-y-1.5"><Label>Opombe</Label><Textarea value={f.notes || ""} onChange={set("notes")} className="h-20" /></div>
          <Button className="w-full btn-brand" onClick={save} disabled={!f.name.trim() || saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shrani</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Podjetja() {
  const { business } = useBusiness();
  const navigate = useNavigate();
  const bid = business?.id;
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { data: companies = [], isLoading } = useQuery({ queryKey: ["companies", bid], queryFn: () => base44.entities.Company.filter({ business_id: bid }), enabled: !!bid });
  const { data: leads = [] } = useQuery({ queryKey: ["leads", bid], queryFn: () => base44.entities.Lead.filter({ business_id: bid }), enabled: !!bid });
  const { data: activities = [] } = useQuery({ queryKey: ["activities", bid], queryFn: () => base44.entities.Activity.filter({ business_id: bid }), enabled: !!bid });

  const stats = useMemo(() => {
    const m = {};
    companies.forEach((c) => { m[c.id] = { contacts: 0, last: c.created_date, value: Number(c.value) || 0 }; });
    const leadCompany = {};
    leads.forEach((l) => { if (l.company_id && m[l.company_id]) { m[l.company_id].contacts++; leadCompany[l.id] = l.company_id; if (!companies.find((c) => c.id === l.company_id)?.value) m[l.company_id].value += Number(l.value) || 0; } });
    activities.forEach((a) => {
      const cid = a.company_id || leadCompany[a.lead_id];
      if (cid && m[cid]) { const t = a.occurred_at || a.created_date; if (new Date(t) > new Date(m[cid].last)) m[cid].last = t; }
    });
    return m;
  }, [companies, leads, activities]);

  const q = search.trim().toLowerCase();
  const list = companies.filter((c) => !q || [c.name, c.email, c.industry, c.tax_id].some((v) => String(v || "").toLowerCase().includes(q)))
    .sort((a, b) => new Date(stats[b.id]?.last || 0) - new Date(stats[a.id]?.last || 0));

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1>Podjetja</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">Podjetja, s katerimi poslujete ali jih želite pridobiti. Vsako ima kontaktne osebe, zgodovino sporočil, opravila in ponudbe.</p>
        </div>
        <Button className="btn-brand" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Dodaj podjetje</Button>
      </div>

      <div className="flex gap-1 border-b">
        <Link to="/stranke" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent -mb-px text-muted-foreground hover:text-foreground">Stranke ({leads.length})</Link>
        <Link to="/stranke?tab=viri" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent -mb-px text-muted-foreground hover:text-foreground">Od kod pridejo stranke</Link>
        <span className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-primary">Podjetja ({companies.length})</span>
      </div>

      {companies.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <h2 className="text-xl mt-4">Še nimate podjetij</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Če poslujete s podjetji, jih dodajte tukaj in jim pripnite kontaktne osebe. Zasebne stranke so v zavihku Stranke.</p>
          <Button className="btn-brand mt-5" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Dodaj podjetje</Button>
        </div>
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Išči po nazivu, dejavnosti, davčni" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((c) => {
              const s = stats[c.id] || {};
              return (
                <button key={c.id} onClick={() => navigate(`/podjetja/${c.id}`)} className="card-elevated p-4 text-left hover:shadow-md hover:border-primary/40 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(231,88%,30%)]/10 text-[hsl(231,88%,30%)] font-display font-bold flex items-center justify-center shrink-0">{initials(c.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.industry || c.email || "—"}</p>
                    </div>
                    {s.value > 0 && <span className="text-sm font-semibold">{eur(s.value)}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.contacts || 0} {s.contacts === 1 ? "oseba" : "oseb"}</span>
                    {c.website && <span className="inline-flex items-center gap-1 truncate"><Globe className="w-3.5 h-3.5" />{c.website.replace(/^https?:\/\//, "")}</span>}
                    <span className="ml-auto">{ago(s.last)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      <CompanyDialog open={showAdd} onOpenChange={setShowAdd} onSaved={(c) => c?.id && navigate(`/podjetja/${c.id}`)} />
    </div>
  );
}
