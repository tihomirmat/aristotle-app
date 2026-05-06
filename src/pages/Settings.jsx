import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Save, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const [bizForm, setBizForm] = useState({
    business_name: "",
    business_type: "other",
    phone_number: "",
    default_offer: "",
  });
  const [adminForm, setAdminForm] = useState({
    n8n_webhook_url: "",
    default_sender_phone: "",
    default_sender_email: "",
    notes: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });
  const isAdmin = user?.role === "admin";

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.BusinessSettings.list(),
  });

  const { data: appConfigs = [] } = useQuery({
    queryKey: ["appConfig"],
    queryFn: () => base44.entities.AppConfig.list(),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (settings.length > 0) {
      const s = settings[0];
      setBizForm({
        business_name: s.business_name || "",
        business_type: s.business_type || "other",
        phone_number: s.phone_number || "",
        default_offer: s.default_offer || "",
      });
    }
  }, [settings]);

  useEffect(() => {
    if (appConfigs.length > 0) {
      const c = appConfigs[0];
      setAdminForm({
        n8n_webhook_url: c.n8n_webhook_url || "",
        default_sender_phone: c.default_sender_phone || "",
        default_sender_email: c.default_sender_email || "",
        notes: c.notes || "",
      });
    }
  }, [appConfigs]);

  const saveBizMutation = useMutation({
    mutationFn: async (data) => {
      if (settings.length > 0) {
        return base44.entities.BusinessSettings.update(settings[0].id, data);
      }
      return base44.entities.BusinessSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Business settings saved" });
    },
  });

  const saveAdminMutation = useMutation({
    mutationFn: async (data) => {
      if (appConfigs.length > 0) {
        return base44.entities.AppConfig.update(appConfigs[0].id, data);
      }
      return base44.entities.AppConfig.create({ config_key: "global", ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appConfig"] });
      toast({ title: "Admin settings saved" });
    },
  });

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
        <p className="text-muted-foreground mt-1">Configure your business details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Info — visible to everyone */}
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
                value={bizForm.business_name}
                onChange={(e) => setBizForm({ ...bizForm, business_name: e.target.value })}
                placeholder="Your Business Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select value={bizForm.business_type} onValueChange={(v) => setBizForm({ ...bizForm, business_type: v })}>
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
                value={bizForm.phone_number}
                onChange={(e) => setBizForm({ ...bizForm, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Default Reactivation Offer</Label>
              <Input
                value={bizForm.default_offer}
                onChange={(e) => setBizForm({ ...bizForm, default_offer: e.target.value })}
                placeholder="e.g., 20% off your next visit"
              />
            </div>
            <div className="pt-2">
              <Button onClick={() => saveBizMutation.mutate(bizForm)} disabled={saveBizMutation.isPending}>
                {saveBizMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Settings — only visible to admins */}
        {isAdmin && (
          <Card className="border-0 shadow-sm border-l-4 border-l-violet-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-violet-500" />
                Admin Settings
                <span className="text-xs font-normal text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full ml-1">
                  Agency Only
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>n8n Webhook URL</Label>
                <Input
                  value={adminForm.n8n_webhook_url}
                  onChange={(e) => setAdminForm({ ...adminForm, n8n_webhook_url: e.target.value })}
                  placeholder="https://n8n.example.com/webhook/..."
                />
                <p className="text-xs text-muted-foreground">
                  All campaigns POST to this central URL. Managed by agency only.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Default Sender Phone (Twilio)</Label>
                <Input
                  value={adminForm.default_sender_phone}
                  onChange={(e) => setAdminForm({ ...adminForm, default_sender_phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Sender Email (SendGrid)</Label>
                <Input
                  value={adminForm.default_sender_email}
                  onChange={(e) => setAdminForm({ ...adminForm, default_sender_email: e.target.value })}
                  placeholder="noreply@youragency.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  value={adminForm.notes}
                  onChange={(e) => setAdminForm({ ...adminForm, notes: e.target.value })}
                  placeholder="Internal notes about this configuration..."
                  className="h-20"
                />
              </div>
              <Button
                onClick={() => saveAdminMutation.mutate(adminForm)}
                disabled={saveAdminMutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {saveAdminMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Admin Settings
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}