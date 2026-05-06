import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function CampaignBuilder({ customerCount, segmentFilter, webhookUrl }) {
  const [campaign, setCampaign] = useState({
    name: "",
    type: "both",
    sms_message: "",
    email_subject: "",
    email_body: "",
    scheduled_date: "",
  });
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Campaign.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campaign created", description: "Your reactivation campaign has been scheduled." });
      setCampaign({
        name: "",
        type: "both",
        sms_message: "",
        email_subject: "",
        email_body: "",
        scheduled_date: "",
      });
    },
  });

  const handleAIGenerate = async () => {
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a customer reactivation campaign for a local business. 
      The campaign targets ${customerCount} customers who haven't visited recently.
      Generate a compelling SMS message (max 160 chars) and email (subject + body) that offers them an incentive to come back.
      Be friendly, personal, and create urgency. Use {name} as placeholder for customer name.`,
      response_json_schema: {
        type: "object",
        properties: {
          sms_message: { type: "string", description: "SMS text, max 160 chars" },
          email_subject: { type: "string" },
          email_body: { type: "string", description: "Email body in plain text" },
          campaign_name: { type: "string", description: "Suggested campaign name" },
        },
      },
    });
    setCampaign((prev) => ({
      ...prev,
      name: result.campaign_name || prev.name,
      sms_message: result.sms_message || "",
      email_subject: result.email_subject || "",
      email_body: result.email_body || "",
    }));
    setGenerating(false);
  };

  const handleCreate = () => {
    if (!campaign.name) return;
    createMutation.mutate({
      ...campaign,
      segment_filter: segmentFilter,
      total_recipients: customerCount,
      webhook_url: webhookUrl || "",
      status: campaign.scheduled_date ? "scheduled" : "draft",
    });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Create Reactivation Campaign</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAIGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            AI Generate
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Targeting {customerCount} customer{customerCount !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input
              placeholder="e.g., Win-Back May 2025"
              value={campaign.name}
              onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={campaign.type} onValueChange={(v) => setCampaign({ ...campaign, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS Only</SelectItem>
                <SelectItem value="email">Email Only</SelectItem>
                <SelectItem value="both">SMS + Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(campaign.type === "sms" || campaign.type === "both") && (
          <div className="space-y-2">
            <Label>SMS Message</Label>
            <Textarea
              placeholder="Hey {name}, we miss you! Come back for 20% off..."
              value={campaign.sms_message}
              onChange={(e) => setCampaign({ ...campaign, sms_message: e.target.value })}
              className="h-20"
            />
            <p className="text-xs text-muted-foreground">{campaign.sms_message.length}/160 characters</p>
          </div>
        )}

        {(campaign.type === "email" || campaign.type === "both") && (
          <>
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                placeholder="We've been thinking of you..."
                value={campaign.email_subject}
                onChange={(e) => setCampaign({ ...campaign, email_subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body</Label>
              <Textarea
                placeholder="Dear {name},\n\nWe noticed it's been a while..."
                value={campaign.email_body}
                onChange={(e) => setCampaign({ ...campaign, email_body: e.target.value })}
                className="h-32"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Schedule Send</Label>
          <Input
            type="datetime-local"
            value={campaign.scheduled_date}
            onChange={(e) => setCampaign({ ...campaign, scheduled_date: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Leave empty to save as draft</p>
        </div>

        <Button
          className="w-full"
          onClick={handleCreate}
          disabled={!campaign.name || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {campaign.scheduled_date ? "Schedule Campaign" : "Save as Draft"}
        </Button>
      </CardContent>
    </Card>
  );
}