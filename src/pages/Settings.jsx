import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const [form, setForm] = useState({
    business_name: "",
    business_type: "other",
    webhook_url: "",
    phone_number: "",
    default_offer: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.BusinessSettings.list(),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const s = settings[0];
      setForm({
        business_name: s.business_name || "",
        business_type: s.business_type || "other",
        webhook_url: s.webhook_url || "",
        phone_number: s.phone_number || "",
        default_offer: s.default_offer || "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (settings.length > 0) {
        return base44.entities.BusinessSettings.update(settings[0].id, data);
      }
      return base44.entities.BusinessSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Settings saved" });
    },
  });

  const handleSave = () => saveMutation.mutate(form);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your business and integrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              Business Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="Your Business Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gym">Gym / Fitness</SelectItem>
                  <SelectItem value="dentist">Dentist</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="salon">Salon / Barbershop</SelectItem>
                  <SelectItem value="spa">Spa / Wellness</SelectItem>
                  <SelectItem value="chiropractor">Chiropractor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Default Reactivation Offer</Label>
              <Input
                value={form.default_offer}
                onChange={(e) => setForm({ ...form, default_offer: e.target.value })}
                placeholder="e.g., 20% off your next visit"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>n8n Webhook URL</Label>
              <Input
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="https://your-n8n.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">
                Campaigns will POST to this URL when triggered. Connect n8n to send SMS/email.
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}