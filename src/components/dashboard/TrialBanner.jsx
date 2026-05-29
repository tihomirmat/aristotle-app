import React from "react";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrialBanner({ business }) {
  if (!business || business.subscription_status !== "trialing") return null;

  const daysLeft = business.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(business.trial_ends_at), new Date()))
    : 0;
  const creditsLeft = Math.max(0, (business.trial_cost_cap_eur || 0.45) - (business.trial_cost_used_eur || 0));
  const sendsLeft = business.trial_sends_remaining ?? 20;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-900 font-medium">
          Preizkusno obdobje:{" "}
          <span className="font-bold">{daysLeft} {daysLeft === 1 ? "dan" : "dni"} preostalo</span>
          {" · "}
          <span className="font-bold">{creditsLeft.toFixed(2)} €</span> kreditov preostalo
          {" · "}
          <span className="font-bold">{sendsLeft}</span> pošiljanj preostalo
        </p>
      </div>
      <Button size="sm" asChild className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white">
        <Link to="/nastavitve?tab=billing">
          Aktiviraj naročnino <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </Button>
    </div>
  );
}