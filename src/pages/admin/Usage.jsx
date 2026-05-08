import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function AdminUsage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["usage-logs"],
    queryFn: () => base44.entities.UsageLog.list("-date", 200),
  });

  const totalCost = logs.reduce((sum, l) => sum + (l.cost_eur || 0), 0);
  const totalTokens = logs.reduce((sum, l) => sum + (l.input_tokens || 0) + (l.output_tokens || 0), 0);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usage Logs</h1>
        <p className="text-muted-foreground mt-1">Admin view — Anthropic token usage across all tenants</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Tokens</p>
          <p className="text-2xl font-bold mt-1">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-2xl font-bold mt-1">€{totalCost.toFixed(4)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Log Entries</p>
          <p className="text-2xl font-bold mt-1">{logs.length}</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Business</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pillar</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Model</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tokens In</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tokens Out</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost €</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No usage data yet.</td></tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{log.date}</td>
                <td className="px-4 py-3">{log.business_id?.slice(0, 8)}…</td>
                <td className="px-4 py-3">{log.pillar || "—"}</td>
                <td className="px-4 py-3">{log.model || "—"}</td>
                <td className="px-4 py-3 text-right">{(log.input_tokens || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{(log.output_tokens || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">€{(log.cost_eur || 0).toFixed(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}