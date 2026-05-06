import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Star,
  Globe,
  GraduationCap,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap
} from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/reactivation", label: "Database Reactivation", icon: Database },
  { path: "/reviews", label: "AI Reviews & Referrals", icon: Star },
  { path: "/leads", label: "Lead Nurturing", icon: Globe },
  { path: "/sales-coach", label: "Sales Grader", icon: GraduationCap },
  { path: "/paid-ads", label: "AI Paid Ads", icon: Megaphone },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 z-50 ${
        collapsed ? "w-[68px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-inter font-bold text-base text-white tracking-tight whitespace-nowrap">
            AI Aristotle
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mb-4 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}