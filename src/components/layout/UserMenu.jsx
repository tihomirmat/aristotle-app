import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, User, HelpCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

function getInitials(email) {
  if (!email) return "?";
  return email[0].toUpperCase();
}

export default function UserMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => base44.auth.logout("/");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
        style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
      >
        {getInitials(user?.email)}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold truncate">{user?.full_name || "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <div className="py-1">
            <Link
              to="/nastavitve"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors"
            >
              <User className="w-4 h-4 text-muted-foreground" /> Moj profil
            </Link>
            <button
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors w-full text-left"
              onClick={() => setOpen(false)}
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground" /> Pomoč
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" /> Odjava
            </button>
          </div>
        </div>
      )}
    </div>
  );
}