import React from "react";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function Ocene() {
  const { business } = useBusiness();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ocene & napotitve</h1>
        <p className="text-muted-foreground mt-1">Avtomatske prošnje za Google ocene in napotitve.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                <Link to="/nastavitve">Nastavitve</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-2">Statistika</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-500">—</p>
              <p className="text-xs text-muted-foreground mt-1">Prošenj poslanih</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-500">—</p>
              <p className="text-xs text-muted-foreground mt-1">Novih ocen</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-muted/30 border border-dashed rounded-xl p-8 text-center">
        <Star className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">Avtomatske prošnje za ocene</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Ko bo AI poslal prošnjo za oceno stranki, se bo prikazala tukaj za potrditev.
          Pojdite v <strong>Prejeto</strong> za pregled sporočil.
        </p>
        <Button className="mt-4" asChild>
          <Link to="/prejeto">Odpri Prejeto</Link>
        </Button>
      </div>
    </div>
  );
}