import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { Send, Info, BellRing } from "lucide-react";
import { toast } from "sonner";

// Samodejno pošiljanje po vrsti sporočila (privzeto vse čaka na odobritev) + kratek dnevni povzetek po e-pošti.
const TYPES = [
  { key: "email_inquiry", label: "Odgovor na povpraševanje iz e-pošte", hint: "Ko AI v vašem predalu najde novo povpraševanje." },
  { key: "web_form_lead", label: "Odgovor na povpraševanje z obrazca", hint: "Obrazec na vaši spletni strani." },
  { key: "chatbot_handoff", label: "Odgovor po spletnem klepetu", hint: "Ko obiskovalec v klepetu pusti kontakt." },
  { key: "booking_proposal", label: "Predlog terminov", hint: "Prosti termini iz vašega koledarja." },
  { key: "review_request", label: "Prošnja za Google oceno", hint: "Ko stranko premaknete v fazo Stranka." },
  { key: "reactivation", label: "Vabilo stari stranki", hint: "Posamično vabilo iz strani stranke." },
];

export default function AutoSendCard({ business, isTrialing }) {
  const qc = useQueryClient();
  const auto = business?.auto_send || {};
  const save = async (patch, msg) => {
    try {
      await base44.entities.Business.update(business.id, { ...patch, draft_mode: true });
      qc.invalidateQueries({ queryKey: ["business"] });
      if (msg) toast.success(msg);
    } catch (e) { toast.error(e.message); }
  };
  const setType = (k, v) => save({ auto_send: { ...auto, [k]: v } }, v ? "To vrsto sporočil bo AI poslal sam." : "To vrsto sporočil boste najprej odobrili.");
  const hours = Array.from({ length: 15 }, (_, i) => i + 5);

  return (
    <div className="space-y-5">
      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><Send className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-lg">Kaj AI pošlje sam</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Privzeto vsako sporočilo počaka v »Za odobritev«. Za vrste, ki jim zaupate, vklopite samodejno pošiljanje. AI pošlje sam samo sporočila, ki jih oceni kot dobra (7/10 ali več); ostala vseeno počakajo na vas.</p>
          </div>
        </div>
        {isTrialing && <p className="mt-4 text-xs rounded-lg bg-muted px-3 py-2 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" />Samodejno pošiljanje je na voljo po aktivaciji naročnine. Med preizkusom vse počaka na vašo odobritev.</p>}
        <div className="mt-4 divide-y border rounded-xl">
          {TYPES.map((t) => (
            <label key={t.key} className={`flex items-center justify-between gap-4 px-4 py-3 ${isTrialing ? "opacity-50" : "cursor-pointer"}`}>
              <div><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-muted-foreground">{t.hint}</p></div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground w-20 text-right">{auto[t.key] ? "pošlje sam" : "odobrim jaz"}</span>
                <Switch checked={!!auto[t.key]} disabled={isTrialing} onCheckedChange={(v) => setType(t.key, v)} />
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Kampanje imajo svojo nastavitev pri vsaki kampanji.</p>
      </div>

      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0"><BellRing className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="text-lg">Jutranji povzetek po e-pošti</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Vsak delovni dan kratko sporočilo: kaj čaka na odobritev, katera opravila so danes, novi kontakti in današnji termini. Brez nepotrebnega.</p>
          </div>
          <Switch checked={business?.daily_digest_enabled !== false} onCheckedChange={(v) => save({ daily_digest_enabled: v }, v ? "Povzetek vklopljen." : "Povzetek izklopljen.")} />
        </div>
        {business?.daily_digest_enabled !== false && (
          <div className="flex items-center gap-2 mt-4 text-sm">
            <span className="text-muted-foreground">Pošlji ob</span>
            <select className="h-8 rounded-md border bg-background px-2" value={business?.daily_digest_hour ?? 7} onChange={(e) => save({ daily_digest_hour: Number(e.target.value) }, "Ura shranjena.")}>
              {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
            <span className="text-muted-foreground">na {business?.owner_email || business?.created_by}</span>
          </div>
        )}
      </div>
    </div>
  );
}
