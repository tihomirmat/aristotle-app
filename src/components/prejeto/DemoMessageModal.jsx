import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Bot } from "lucide-react";

const DEMO = {
  pillar: "reactivation",
  subject: "Pogrešamo vas, Jana! 🌟",
  body: `Pozdravljeni Jana,

opazili smo, da vas že nekaj časa ni bilo pri nas. Upamo, da ste dobro!

Ker cenimo vsako stranko, smo za vas pripravili posebno ponudbo: 20% popust na naslednjo obisk.

Rezervirajte termin tukaj: https://primer.si/rezervacija

Veselimo se vašega obiska!

Lep pozdrav,
Studio Fit`,
};

export default function DemoMessageModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Primer AI sporočila</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="bg-muted/40 rounded-xl p-4 border">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="outline" className="text-xs">Reaktivacija</Badge>
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-pošta
              </Badge>
              <span className="text-sm font-medium">→ Jana Novak</span>
            </div>
            <p className="text-sm font-semibold mb-2">{DEMO.subject}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{DEMO.body}</p>
          </div>
          <div className="bg-accent/50 rounded-xl p-4 border border-accent">
            <div className="flex items-start gap-2">
              <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold mb-1">Kako AI deluje?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI analizira vsako stranko — zadnji obisk, storitve, preference — in samodejno sestavi personalizirano sporočilo. 
                  Sporočilo se pojavi tukaj v pregledu, kjer ga vi odobrite ali uredite pred pošiljanjem. 
                  Nič se ne pošlje brez vaše potrditve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}