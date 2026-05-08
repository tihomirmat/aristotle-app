import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Users, MessageSquare, Bot,
  Star, Settings, ChevronLeft, ChevronRight, Zap,
  Building2, BarChart3
} from "lucide-react";
import { useBusiness } from "@/lib/business-context";

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const ctx = useBusiness();
  const business = ctx?.business;
  const user = ctx?.user;
  const isAdmin = user?.role === "admin";
  const plan = business?.plan || "starter";
  const PLAN_ORDER = ["free", "starter", "growth", "scale"];
  const planGte = (min) => PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(min);

  const navItems = [
    { path: "/", label: "Pregled", icon: LayoutDashboard, show: true },
    { path: "/prejeto", label: "Prejeto", icon: Inbox, show: true },
    { path: "/stranke", label: "Stranke", icon: Users, show: true },
    { path: "/klepet", label: "Klepetalni pomočnik", icon: MessageSquare, show: business?.pillar_chatbot },
    { path: "/asistent", label: "Asistent", icon: Bot, show: business?.pillar_assistant && planGte("growth") },
    { path: "/ocene", label: "Ocene", icon: Star, show: business?.pillar_reviews },
    { path: "/nastavitve", label: "Nastavitve", icon: Settings, show: true },
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
        {navItems.filter((i) => i.show).map((item) => {
          const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"}`}>
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
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
    </aside>
  );
}