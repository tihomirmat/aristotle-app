import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background font-inter">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`transition-all duration-300 min-h-screen ${collapsed ? "ml-[68px]" : "ml-[240px]"}`}>
        <div className="p-6 md:p-8 max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}