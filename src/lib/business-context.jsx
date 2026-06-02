import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: businesses = [], isLoading: bizLoading } = useQuery({
    queryKey: ["business", user?.email],
    queryFn: () => base44.entities.Business.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  const isLoading = userLoading || (!!user && bizLoading);

  // Pick the oldest business for deterministic selection
  const business = [...businesses].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0] || null;

  // noBusinessYet: user is loaded but has no business → needs onboarding
  const noBusinessYet = !isLoading && !!user && businesses.length === 0;

  return (
    <BusinessContext.Provider value={{ business, user, isLoading, noBusinessYet }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}