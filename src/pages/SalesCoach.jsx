import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Lock } from "lucide-react";

export default function SalesCoach() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">AI Sales Grader & Role-Play Coach</h1>
        <p className="text-muted-foreground mt-1">Train your team with AI-powered call analysis.</p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-violet-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Upload call recordings, get AI-graded scorecards, and practice with an AI role-play coach
            to sharpen your team's sales skills.
          </p>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Pillar 4 — launching soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}