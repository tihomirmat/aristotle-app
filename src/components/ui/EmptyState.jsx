import React from "react";
import { Button } from "@/components/ui/button";

/**
 * Reusable empty state / status card.
 * Props: icon (Lucide element), title, description, action (optional { label, onClick, href })
 */
export default function EmptyState({ icon: Icon, title, description, action, variant = "default" }) {
  const bg = variant === "warning"
    ? "bg-amber-50 border-amber-200"
    : variant === "error"
    ? "bg-red-50 border-red-200"
    : "bg-card";

  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center border rounded-xl ${bg} px-6`}>
      {Icon && <Icon className="w-10 h-10 text-muted-foreground/40 mb-4" />}
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <a href={action.href}>
              <Button size="sm" variant={variant === "warning" ? "default" : "outline"}>{action.label}</Button>
            </a>
          ) : (
            <Button size="sm" onClick={action.onClick} variant={variant === "warning" ? "default" : "outline"}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}