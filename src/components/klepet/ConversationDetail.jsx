import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";

export default function ConversationDetail({ conversation, onClose }) {
  if (!conversation) return null;

  return (
    <Dialog open={!!conversation} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Pogovor</span>
            {conversation.escalated && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Eskaliran</Badge>}
            {conversation.converted && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Pretvorjen</Badge>}
          </DialogTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
            <span>{conversation.visitor_email || conversation.visitor_id || "Neznan obiskovalec"}</span>
            {conversation.started_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(conversation.started_at), "d. M. yyyy HH:mm")}
              </span>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 mt-2 pr-1">
          {(conversation.messages || []).length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Ni sporočil.</p>
          )}
          {(conversation.messages || []).map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              }`}>
                {msg.content}
                {msg.timestamp && (
                  <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.timestamp), "HH:mm")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {conversation.escalation_reason && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{conversation.escalation_reason}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}