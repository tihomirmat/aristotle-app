import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// Ikona z razlago ob prehodu z miško (in aria-label za bralnike zaslona).
export default function IconHint({ label, children, side = "top" }) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="bg-slate-700 text-white max-w-[260px]">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
