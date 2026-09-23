import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: businesses = [], isLoading: bizLoading, isError: bizError, refetch } = useQuery({
    queryKey: ["business", user?.email],
    queryFn: async () => {
      // Match both legacy (created_by) and new (owner_email) ownership attribution.
      // Business.owner_email + RLS (owner_email) sta bila dodana 23. 9. 2026 — brez tega novi uporabniki (service-role create) niso videli svojega podjetja.
      const [byCreator, byOwner] = await Promise.all([
        base44.entities.Business.filter({ created_by: user?.email }),
        base44.entities.Business.filter({ owner_email: user?.email }),
      ]);
      const seen = new Set();
      return [...byCreator, ...byOwner]
        .filter((b) => !b.is_demo)
        .filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
    },
    enabled: !!user,
    retry: 2,
  });

  const isLoading = userLoading || (!!user && bizLoading);

  // Pick the oldest business for deterministic selection
  const business = [...businesses].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0] || null;

  // noBusinessYet: user is loaded but has no business → needs onboarding (NE ob napaki pri nalaganju)
  const noBusinessYet = !isLoading && !!user && !bizError && businesses.length === 0;

  return (
    <BusinessContext.Provider value={{ business, user, isLoading, noBusinessYet, loadError: !!bizError, refetch }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}