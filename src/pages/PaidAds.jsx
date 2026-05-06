import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Lock } from "lucide-react";

export default function PaidAds() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">AI Paid Ads with Lead Nurturing</h1>
        <p className="text-muted-foreground mt-1">AI-optimized ad campaigns with automated follow-up.</p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            AI-generated ad copy, automated audience targeting, and lead nurturing sequences
            that turn ad clicks into paying customers.
          </p>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Pillar 5 — launching soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}