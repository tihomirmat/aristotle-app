import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Users, MessageSquare, Bot,
  Star, Settings, ChevronLeft, ChevronRight, Zap,
  Building2, BarChart3, Lock, FileText
} from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { hasModule } from "@/lib/entitlements";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = useBusiness();
  const business = ctx?.business;
  const user = ctx?.user;
  const isAdmin = user?.role === "admin";
  const [lockedDialog, setLockedDialog] = useState(null); // { label, desc }

  const { data: pendingDrafts = [] } = useQuery({
    queryKey: ["drafts-sidebar", business?.id],
    queryFn: () => base44.entities.DraftMessage.filter({ business_id: business.id, status: "pending" }),
    enabled: !!business?.id,
    refetchInterval: 60000,
  });
  const pendingCount = pendingDrafts.length;

  const navItems = [
    { path: "/", label: "Pregled", icon: LayoutDashboard, locked: false },
    { path: "/prejeto", label: "Prejeto", icon: Inbox, locked: false, badge: pendingCount > 0 ? pendingCount : null },
    { path: "/stranke", label: "Stranke", icon: Users, locked: false },
    { path: "/klepet", label: "Klepetalni pomočnik", icon: MessageSquare, locked: !hasModule(business, "pillar_chatbot"), lockDesc: "Aktivirajte klepetalni pomočnik v Pregledu." },
    { path: "/asistent", label: "Asistent", icon: Bot, locked: !hasModule(business, "pillar_assistant"), lockDesc: "Aktivirajte osebni asistent v Pregledu." },
    { path: "/ocene", label: "Ocene & napotitve", icon: Star, locked: !hasModule(business, "pillar_reviews"), lockDesc: "Aktivirajte module za ocene v Pregledu." },
    { path: "/racuni", label: "Računi", icon: FileText, locked: false },
    { path: "/nastavitve", label: "Nastavitve", icon: Settings, locked: false },
  ];

  const adminItems = [
    { path: "/admin/businesses", label: "Businesses", icon: Building2 },
    { path: "/admin/usage", label: "Usage", icon: BarChart3 },
  ];

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50 ${collapsed ? "w-[68px]" : "w-[240px]"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && <span className="font-bold text-sm text-white tracking-tight whitespace-nowrap">AI Aristotle</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          if (item.locked) {
            return (
              <button
                key={item.path}
                onClick={() => setLockedDialog({ label: item.label, desc: item.lockDesc, path: item.path })}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-sidebar-foreground/50 hover:bg-sidebar-accent/30 w-full text-left opacity-50"
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="whitespace-nowrap flex-1">{item.label}</span>}
                {!collapsed && <Lock className="w-3 h-3 shrink-0" />}
              </button>
            );
          }
          return (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"}`}>
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
              {!collapsed && <span className="whitespace-nowrap flex-1">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            {!collapsed && <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 px-3 pt-4 pb-1">Admin</p>}
            {collapsed && <div className="border-t border-sidebar-border my-2" />}
            {adminItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"}`}>
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)} className="mx-2 mb-4 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Locked pillar dialog */}
      {lockedDialog && (
        <Dialog open={!!lockedDialog} onOpenChange={() => setLockedDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ta funkcionalnost ni aktivirana</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-1">{lockedDialog.desc}</p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => { setLockedDialog(null); navigate("/"); }}>Aktiviraj v Pregledu</Button>
              <Button variant="outline" onClick={() => setLockedDialog(null)}>Zapri</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </aside>
  );
}