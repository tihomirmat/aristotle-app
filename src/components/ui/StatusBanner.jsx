import React from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline status/warning banner.
 * variant: "warning" | "error" | "info"
 */
export default function StatusBanner({ variant = "warning", message, action }) {
  const styles = {
    warning: { bg: "bg-amber-50 border-amber-200 text-amber-800", Icon: AlertTriangle },
    error: { bg: "bg-red-50 border-red-200 text-red-800", Icon: XCircle },
    info: { bg: "bg-blue-50 border-blue-200 text-blue-800", Icon: Info },
  };
  const { bg, Icon } = styles[variant] || styles.info;

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 mb-4 ${bg}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {action && (
        <Button size="sm" variant="ghost" className="shrink-0 -my-1 h-7 px-2 text-xs" onClick={action.onClick} asChild={!!action.href}>
          {action.href ? <a href={action.href}>{action.label}</a> : action.label}
        </Button>
      )}
    </div>
  );
}