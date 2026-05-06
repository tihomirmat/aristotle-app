import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Lock } from "lucide-react";

export default function LeadNurturing() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Website Lead Nurturing & Missed Call Text Back</h1>
        <p className="text-muted-foreground mt-1">Capture and nurture every lead automatically.</p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-sky-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Website chat widget, missed call text-back, and automated lead follow-up sequences
            to convert every visitor into a customer.
          </p>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Pillar 3 — launching soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}