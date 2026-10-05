import React, { useState, useEffect } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import TrialExpiredModal from "@/components/TrialExpiredModal";
import { useBusiness } from "@/lib/business-context";
import { Search } from "lucide-react";

// Naslovi strani za zgornjo vrstico (brezhibno ujemanje z menijem)
const TITLES = [
  ["/stranke", "Stranke"], ["/podjetja", "Podjetja"], ["/opravila", "Opravila"], ["/kampanje", "Kampanje"],
  ["/klepet", "Spletni klepet"], ["/asistent", "Asistent"], ["/ocene", "Google ocene"],
  ["/ponudbe", "Ponudbe"], ["/racuni", "Računi"], ["/nastavitve", "Nastavitve"],
  ["/admin/businesses", "Podjetja"], ["/admin/usage", "Poraba"],
];
const titleFor = (p) => (p === "/" ? "Pregled" : (TITLES.find(([k]) => p.startsWith(k))?.[1] || ""));

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { business } = useBusiness();

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background font-inter">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`transition-all duration-300 min-h-screen ${collapsed ? "ml-[72px]" : "ml-[248px]"}`}>
        <TrialExpiredModal business={business} />
        <div className="sticky top-0 z-40 flex items-center gap-4 px-6 md:px-8 h-16 bg-background/85 backdrop-blur-md border-b border-border/70">
          <p className="font-display font-semibold text-sm text-muted-foreground">{business?.name || ""}<span className="mx-2 text-border">/</span><span className="text-foreground">{titleFor(location.pathname)}</span></p>
          <div className="ml-auto hidden md:flex items-center gap-2 bg-card border border-border rounded-xl px-3 h-9 w-64 text-sm text-muted-foreground">
            <Search className="w-4 h-4" />
            <input className="bg-transparent outline-none flex-1 placeholder:text-muted-foreground/70" placeholder="Išči stranke, ponudbe …" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) window.location.href = `/stranke?q=${encodeURIComponent(e.target.value.trim())}`; }} />
          </div>
          <UserMenu />
        </div>
        <div className="p-4 md:p-6 xl:p-8 w-full max-w-[1920px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
