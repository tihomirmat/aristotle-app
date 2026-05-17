import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { BusinessProvider, useBusiness } from '@/lib/business-context';

import AppLayout from '@/components/layout/AppLayout';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Prejeto from '@/pages/Prejeto';
import Stranke from '@/pages/Stranke';
import Klepet from '@/pages/Klepet';
import Asistent from '@/pages/Asistent';
import Ocene from '@/pages/Ocene';
import Nastavitve from '@/pages/Nastavitve';
import AdminBusinesses from '@/pages/admin/Businesses';
import AdminUsage from '@/pages/admin/Usage';

const AppRoutes = () => {
  const { business, isLoading } = useBusiness();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (business && !business.onboarding_complete) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  if (!business) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/prejeto" element={<Prejeto />} />
        <Route path="/stranke" element={<Stranke />} />
        <Route path="/klepet" element={<Klepet />} />
        <Route path="/asistent" element={<Asistent />} />
        <Route path="/ocene" element={<Ocene />} />
        <Route path="/nastavitve" element={<Nastavitve />} />
        <Route path="/admin/businesses" element={<AdminBusinesses />} />
        <Route path="/admin/usage" element={<AdminUsage />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <BusinessProvider>
      <AppRoutes />
    </BusinessProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;