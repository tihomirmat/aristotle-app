import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, UserPlus, Loader2, Users, ChevronDown, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import CustomerImportModal from "@/components/stranke/CustomerImportModal";
import GenerateDraftButton from "@/components/stranke/GenerateDraftButton";

const STATUS_LABELS = { new: "Novo", contacted: "Kontaktiran/a", replied: "Odgovoril/a", converted: "Pretvorjen/a", unsubscribed: "Odjavljen/a" };
const STATUS_COLORS = { new: "bg-blue-100 text-blue-700", contacted: "bg-amber-100 text-amber-700", replied: "bg-emerald-100 text-emerald-700", converted: "bg-violet-100 text-violet-700", unsubscribed: "bg-gray-100 text-gray-500" };
const SOURCE_LABELS = { form: "Obrazec", import: "Uvoz", chatbot: "Klepet", manual: "Ročno" };

export default function Stranke() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "", status: "new", source: "manual", notes: "", consent_email: false });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create({ ...data, business_id: business.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", business?.id] });
      setShowAdd(false);
      setNewLead({ name: "", email: "", phone: "", status: "new", source: "manual", notes: "", consent_email: false });
      toast.success("Stranka dodana");
    },
  });

  const filtered = leads.filter((l) => {
    const matchSearch = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stranke</h1>
          <p className="text-muted-foreground mt-1">Vaše stranke in potencialne stranke.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Akcije <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowImport(true)}>
                <Upload className="w-4 h-4 mr-2" /> Uvozi CSV
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="w-4 h-4 mr-2" /> Izvozi CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Dodaj stranko
          </Button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Iskanje po imenu, e-pošti, telefonu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-medium text-muted-foreground">Ni najdenih strank.</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">Dodajte stranko ročno ali uvozite CSV.</p>
          <div className="flex gap-2">
            <Button onClick={() => setShowAdd(true)}><UserPlus className="w-4 h-4 mr-2" /> Dodaj stranko</Button>
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" /> Uvozi CSV</Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ime</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">E-pošta</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Telefon</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Vir</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Zadnji stik</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{lead.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.email || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{lead.phone || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant="outline" className="text-xs">{SOURCE_LABELS[lead.source] || lead.source}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {lead.last_contacted_at ? format(new Date(lead.last_contacted_at), "d. M. yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <GenerateDraftButton lead={lead} businessId={business?.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerImportModal open={showImport} onOpenChange={setShowImport} />

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj stranko</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2"><Label>Ime *</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} placeholder="Ime in priimek" /></div>
            <div className="space-y-2"><Label>E-pošta</Label><Input value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} placeholder="ime@primer.si" /></div>
            <div className="space-y-2"><Label>Telefon</Label><Input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+386 40 123 456" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newLead.status} onValueChange={(v) => setNewLead({ ...newLead, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vir</Label>
                <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opombe</Label>
              <Textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Interne opombe..." className="h-20" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="consent" checked={newLead.consent_email} onChange={(e) => setNewLead({ ...newLead, consent_email: e.target.checked })} className="rounded" />
              <Label htmlFor="consent" className="text-sm cursor-pointer">Stranka je dala soglasje za e-pošto</Label>
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate(newLead)} disabled={!newLead.name || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Shrani stranko
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}