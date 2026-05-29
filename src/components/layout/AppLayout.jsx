import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import TrialExpiredModal from "@/components/TrialExpiredModal";
import { useBusiness } from "@/lib/business-context";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { business } = useBusiness();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background font-inter">
      <TrialExpiredModal business={business} />
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`transition-all duration-300 min-h-screen ${collapsed ? "ml-[68px]" : "ml-[240px]"}`}>
        {/* Sticky header */}
        <div className={`sticky top-0 z-40 flex justify-end items-center px-6 md:px-8 h-14 bg-background/80 backdrop-blur-sm border-b border-border`}>
          <UserMenu />
        </div>
        <div className="p-6 md:p-8 max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}