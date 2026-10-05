import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GraduationCap, Plus, Trash2, Loader2, Pencil, Check, X, Repeat } from "lucide-react";
import { toast } from "sonner";
import { aiLearn } from "@/functions/aiLearn";
import { fnError } from "@/lib/fn-error";
import { ago } from "@/lib/crm";

const SOURCE = {
  edit: "iz vašega popravka",
  skip: "iz zavrnjenega sporočila",
  bad_example: "iz slabega primera",
  good_example: "iz dobrega primera",
  manual: "dodali ste ročno",
  chat_correction: "iz popravka klepeta",
};
const APPLIES = { all: "Povsod", emails: "Samo e-pošta", chat: "Samo klepet" };

// »Kaj se je AI naučil«: pravila, ki nastanejo samodejno iz vaših popravkov in zavrnitev. Veljajo za vsa nova sporočila in klepet.
export default function AiLessonsCard({ business }) {
  const qc = useQueryClient();
  const bid = business?.id;
  const [newRule, setNewRule] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["ai-lessons", bid],
    queryFn: () => base44.entities.AiLesson.filter({ business_id: bid }),
    enabled: !!bid,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-lessons", bid] });
  const sorted = [...lessons].sort((a, b) => (b.active !== false) - (a.active !== false) || (b.times_seen || 1) - (a.times_seen || 1) || new Date(b.created_date) - new Date(a.created_date));

  const add = async () => {
    if (!newRule.trim()) return;
    setAdding(true);
    try {
      const res = await aiLearn({ business_id: bid, kind: "manual", reason: newRule.trim() });
      if (res?.data?.error) throw new Error(res.data.error);
      setNewRule(""); refresh(); toast.success("Pravilo dodano. AI ga upošteva od zdaj naprej.");
    } catch (e) { toast.error(fnError(e)); } finally { setAdding(false); }
  };
  const update = async (l, data) => { try { await base44.entities.AiLesson.update(l.id, data); refresh(); } catch (e) { toast.error(e.message); } };
  const remove = async (l) => { try { await base44.entities.AiLesson.delete(l.id); refresh(); toast("Pravilo odstranjeno."); } catch (e) { toast.error(e.message); } };

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><GraduationCap className="w-5 h-5" /></div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">Kaj se je AI naučil <span className="text-sm font-normal text-muted-foreground">{lessons.filter((l) => l.active !== false).length} pravil</span></h3>
          <p className="text-sm text-muted-foreground mt-0.5">Ko popravite predlagan odgovor, ga zavrnete z razlogom ali označite slab primer, AI iz tega sam zapiše pravilo in ga odslej upošteva pri vseh sporočilih in v spletnem klepetu. Ista napaka se ne ponovi — če se, pravilo dobi večjo težo. Pravila lahko uredite, izklopite ali dodate svoje.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Dodajte svoje pravilo, npr. »V prvem odgovoru ne navajaj cen, predlagaj klic.«" />
        <Button onClick={add} disabled={adding || !newRule.trim()} className="btn-brand shrink-0">{adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Dodaj</>}</Button>
      </div>

      {isLoading ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-5 text-center">Še ni naučenih pravil. Nastanejo sama, ko popravite ali zavrnete predlagan odgovor pri strankah.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {sorted.map((l) => (
              <div key={l.id} className={`rounded-lg border p-3 flex items-start gap-3 ${l.active === false ? "opacity-50 bg-muted/30" : "bg-background"}`}>
                <div className="flex-1 min-w-0">
                  {editId === l.id ? (
                    <div className="flex gap-1.5">
                      <Input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} className="h-8 text-sm" onKeyDown={(e) => { if (e.key === "Enter") { update(l, { rule: editText.trim() }); setEditId(null); } }} />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { update(l, { rule: editText.trim() }); setEditId(null); }}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : <p className="text-sm font-medium leading-snug">{l.rule}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                    <span>{SOURCE[l.source] || "pravilo"}</span>
                    {(l.times_seen || 1) > 1 && <span className="inline-flex items-center gap-1 text-primary font-medium"><Repeat className="w-3 h-3" />ponovilo se je {l.times_seen}×</span>}
                    <select value={l.applies_to || "all"} onChange={(e) => update(l, { applies_to: e.target.value })} className="bg-transparent border rounded px-1 py-0.5">
                      {Object.entries(APPLIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <span>{ago(l.last_seen_at || l.created_date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={l.active !== false} onCheckedChange={(v) => update(l, { active: v })} title={l.active !== false ? "Izklopi" : "Vklopi"} />
                  <button onClick={() => { setEditId(l.id); setEditText(l.rule); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Uredi"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(l)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600" title="Odstrani"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
