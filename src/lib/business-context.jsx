import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ["business", user?.email],
    queryFn: () => base44.entities.Business.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  const business = [...businesses].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0] || null;

  return (
    <BusinessContext.Provider value={{ business, user, isLoading }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}