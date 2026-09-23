import React from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogOut } from "lucide-react";

export default function TrialExpiredModal({ business }) {
  const location = useLocation();
  if (!business || business.subscription_status !== "past_due") return null;

  // Na strani Nastavitve (kjer je Naročnina) in v admin delu ne blokiramo — sicer stranka ne more izbrati modulov,
  // admin pa ne more aktivirati naročil, če je njegovo lastno podjetje v stanju past_due.
  if (location.pathname.startsWith("/nastavitve") || location.pathname.startsWith("/admin")) {
    return (
      <div className="sticky top-0 z-[60] bg-red-50 border-b border-red-200 text-red-800 text-sm px-6 py-2.5 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Vaše preizkusno obdobje je končano. Izberite module v zavihku <Link to="/nastavitve?tab=billing" className="underline font-medium">Naročnina</Link>, da nadaljujete.</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Vaše preizkusno obdobje je končano</h2>
          <p className="text-muted-foreground">
            Vaši podatki so varni. Izberite module za nadaljevanje.
          </p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <Button size="lg" asChild className="w-full">
            <Link to="/nastavitve?tab=billing">Izberi module</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            onClick={() => base44.auth.logout("/")}
          >
            <LogOut className="w-4 h-4" /> Odjava
          </Button>
        </div>
      </div>
    </div>
  );
}