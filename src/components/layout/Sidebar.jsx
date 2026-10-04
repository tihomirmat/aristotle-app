import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Users, MessageSquare, Bot,
  Star, Settings, ChevronLeft, ChevronRight,
  Building2, BarChart3, Lock, FileText, FileSignature, Globe, Rocket
} from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Stranska vrstica v barvah Spletnosti: globoka modra z vesoljskim gradientom, oranžen aktivni indikator.
export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = useBusiness();
  const business = ctx?.business;
  const user = ctx?.user;
  const isAdmin = user?.role === "admin";
  const [lockedDialog, setLockedDialog] = useState(null);

  const { data: pendingDrafts = [] } = useQuery({
    queryKey: ["drafts-sidebar", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id, status: "pending" }),
    enabled: !!business?.id,
    refetchInterval: 60000,
  });
  const pendingCount = pendingDrafts.length;
  const { data: newLeads = [] } = useQuery({
    queryKey: ["leads-new-sidebar", business?.id],
    queryFn: () => base44.entities.Lead.filter({ business_id: business.id, status: "new" }),
    enabled: !!business?.id,
    refetchInterval: 60000,
  });
  const newLeadsCount = newLeads.length;

  const groups = [
    {
      title: "Vsak dan",
      items: [
        { path: "/", label: "Pregled", icon: LayoutDashboard },
        { path: "/prejeto", label: "Za odobritev", icon: Inbox, badge: pendingCount > 0 ? pendingCount : null },
        { path: "/asistent", label: "Asistent", icon: Bot, locked: !hasModule(business, "pillar_assistant"), lockDesc: "Dnevni pregled nalog in termini." },
      ],
    },
    {
      title: "Stranke",
      items: [
        { path: "/stranke", label: "Stranke", icon: Users, badge: newLeadsCount > 0 ? newLeadsCount : null },
        { path: "/klepet", label: "Spletni klepet", icon: MessageSquare, locked: !hasModule(business, "pillar_chatbot"), lockDesc: "AI klepet na vaši spletni strani, ki odgovarja 24/7." },
        { path: "/ocene", label: "Google ocene", icon: Star, locked: !hasModule(business, "pillar_reviews"), lockDesc: "Samodejne prošnje za Google ocene in priporočila." },
      ],
    },
    {
      title: "Dokumenti",
      items: [
        { path: "/ponudbe", label: "Ponudbe", icon: FileSignature, locked: !hasModule(business, "pillar_offers"), lockDesc: "Priprava ponudb v PDF v nekaj minutah." },
        { path: "/racuni", label: "Računi", icon: FileText },
      ],
    },
  ];

  const adminItems = [
    { path: "/admin/businesses", label: "Podjetja", icon: Building2 },
    { path: "/admin/usage", label: "Poraba", icon: BarChart3 },
  ];

  const isActivePath = (path) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));

  const NavItem = ({ item }) => {
    const isActive = isActivePath(item.path);
    const base = "group relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-150";
    if (item.locked) {
      return (
        <button
          onClick={() => setLockedDialog({ label: item.label, desc: item.lockDesc })}
          className={`${base} w-full text-left text-sidebar-foreground/45 hover:text-sidebar-foreground/70 hover:bg-white/5`}
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="whitespace-nowrap flex-1">{item.label}</span>}
          {!collapsed && <Lock className="w-3 h-3 shrink-0 opacity-70" />}
        </button>
      );
    }
    return (
      <Link to={item.path} title={collapsed ? item.label : undefined}
        className={`${base} ${isActive ? "bg-white/10 text-white" : "text-sidebar-foreground hover:bg-white/5 hover:text-white"}`}>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sidebar-primary" />}
        <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : "group-hover:text-white"}`} />
        {!collapsed && <span className="whitespace-nowrap flex-1">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="bg-sidebar-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
        {collapsed && item.badge && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sidebar-primary" />}
      </Link>
    );
  };

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-space bg-space-stars text-sidebar-foreground flex flex-col transition-all duration-300 z-50 ${collapsed ? "w-[72px]" : "w-[248px]"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(13,94%,55%)] to-[hsl(41,100%,53%)] flex items-center justify-center shrink-0 shadow-[0_6px_16px_-6px_hsl(13_94%_52%/.8)]">
          <Rocket className="w-[18px] h-[18px] text-white" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display font-bold text-[15px] text-white tracking-tight">AI Aristotle</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">by Spletnost</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-3 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title} className="space-y-0.5">
            {!collapsed && <p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40 px-3 pb-1.5">{g.title}</p>}
            {collapsed && <div className="border-t border-white/10 mx-2 mb-2" />}
            {g.items.map((item) => <NavItem key={item.path} item={item} />)}
          </div>
        ))}

        <div className="space-y-0.5">
          {!collapsed && <p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40 px-3 pb-1.5">Vaš račun</p>}
          {collapsed && <div className="border-t border-white/10 mx-2 mb-2" />}
          <NavItem item={{ path: "/nastavitve", label: "Nastavitve", icon: Settings }} />
        </div>

        {isAdmin && (
          <div className="space-y-0.5">
            {!collapsed && <p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40 px-3 pb-1.5">Skrbnik</p>}
            {collapsed && <div className="border-t border-white/10 mx-2 mb-2" />}
            {adminItems.map((item) => <NavItem key={item.path} item={item} />)}
          </div>
        )}
      </nav>

      {/* Naročnina + collapse */}
      <div className="px-3 pb-3 space-y-2 shrink-0">
        {!collapsed && business?.subscription_status === "trialing" && (
          <Link to="/nastavitve?tab=billing" className="block rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors">
            <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Preizkus</p>
            <p className="text-sm text-white font-medium mt-0.5">
              {business?.trial_ends_at ? `Še ${Math.max(0, Math.ceil((new Date(business.trial_ends_at) - new Date()) / 86400000))} dni` : "Aktiven"}
            </p>
          </Link>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-white/5 transition-colors text-sidebar-foreground/70">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {lockedDialog && (
        <Dialog open={!!lockedDialog} onOpenChange={() => setLockedDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lockedDialog.label}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-1">{lockedDialog.desc} Ta modul v vaši naročnini ni vključen.</p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => { setLockedDialog(null); navigate("/nastavitve?tab=billing"); }}>Poglej naročnino</Button>
              <Button variant="outline" onClick={() => setLockedDialog(null)}>Zapri</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </aside>
  );
}
