import React from "react";
import { Card } from "@/components/ui/card";

export default function KpiCard({ label, value, icon: Icon, color, trend }) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {trend && (
              <p className={`text-xs mt-1 font-medium ${trend > 0 ? "text-green-600" : "text-red-500"}`}>
                {trend > 0 ? "+" : ""}{trend}% vs last month
              </p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </Card>
  );
}