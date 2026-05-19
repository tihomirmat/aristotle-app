import React from "react";
import { useBusiness } from "@/lib/business-context";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ExternalLink, Mail, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function Ocene() {
  const { business } = useBusiness();

  const { data: drafts = [] } = useQuery({
    queryKey: ["ocene-drafts", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id }),
    enabled: !!business?.id,
  });

  const reviewDrafts = drafts.filter(d => d.pillar === "review_request");
  const sent = reviewDrafts.filter(d => d.status === "sent").length;
  const pending = reviewDrafts.filter(d => d.status === "pending").length;
  const approved = reviewDrafts.filter(d => d.status === "approved").length;

  const recentSent = reviewDrafts
    .filter(d => d.status === "sent" && d.sent_at)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ocene & napotitve</h1>
        <p className="text-muted-foreground mt-1">Avtomatske prošnje za Google ocene in napotitve.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Google ocene kartica */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold">Google ocene</h3>
          </div>
          {business?.google_review_link ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Vaša povezava za ocene je nastavljena.</p>
              <a href={business.google_review_link} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> Odpri Google ocene
                </Button>
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Dodajte Google oceno povezavo v nastavitvah.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/nastavitve">Nastavitve →</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Statistika */}
        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Statistika</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{sent}</p>
              <p className="text-xs text-muted-foreground mt-1">Poslanih</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">{pending}</p>
              <p className="text-xs text-muted-foreground mt-1">Čaka odobritev</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-500">{approved}</p>
              <p className="text-xs text-muted-foreground mt-1">Odobrenih</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nedavno poslane prošnje */}
      {recentSent.length > 0 ? (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Nedavno poslane prošnje za ocene</h3>
          </div>
          <div className="divide-y">
            {recentSent.map(d => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{d.subject || "Prošnja za oceno"}</p>
                    <p className="text-xs text-muted-foreground">{d.sent_at ? format(new Date(d.sent_at), "d. M. yyyy HH:mm") : "—"}</p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Poslano</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border border-dashed rounded-xl p-8 text-center">
          <Star className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Avtomatske prošnje za ocene</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Ko bo AI poslal prošnjo za oceno stranki, se bo prikazala tukaj.
            Pojdite v <strong>Prejeto</strong> za pregled sporočil.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/prejeto">Odpri Prejeto</Link>
          </Button>
        </div>
      )}

      {/* Napotitve */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-2">Napotitve</h3>
        <p className="text-sm text-muted-foreground">
          AI samodejno pošlje prošnjo za napotitev zadovoljnim strankam po zaključeni storitvi.
          Prošnje najdete v razdelku{" "}
          <Link to="/prejeto" className="text-primary hover:underline">Prejeto</Link>.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-violet-500">
              {drafts.filter(d => d.pillar === "referral_ask" && d.status === "sent").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Napotitev poslanih</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">
              {drafts.filter(d => d.pillar === "referral_ask" && d.status === "pending").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Čaka odobritev</p>
          </div>
        </div>
      </div>
    </div>
  );
}