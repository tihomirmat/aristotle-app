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
import Pridobivanje from '@/pages/Pridobivanje';
import Racuni from '@/pages/Racuni';
import Ponudbe from '@/pages/Ponudbe';
import PonudbeSkener from '@/pages/PonudbeSkener';
import PonudbeNova from '@/pages/PonudbeNova';
import PonudbeTemplate from '@/pages/PonudbeTemplate';
import PonudbeNastavitve from '@/pages/PonudbeNastavitve';
import { Navigate } from 'react-router-dom';

// Admin strani so dostopne samo uporabnikom z vlogo admin (prej: samo skrite v meniju, URL je bil odprt)
const AdminOnly = ({ children }) => {
  const { user } = useBusiness();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { business, isLoading, noBusinessYet, loadError, refetch } = useBusiness();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError && !business) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-bold">Podatkov trenutno ni mogoče naložiti</h2>
          <p className="text-sm text-muted-foreground">Preverite internetno povezavo in poskusite znova. Če težava vztraja, nam pišite.</p>
          <button onClick={() => refetch?.()} className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Poskusi znova</button>
        </div>
      </div>
    );
  }

  // No business at all (new user) or onboarding not finished → always go to onboarding
  if (noBusinessYet || (business && !business.onboarding_complete)) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
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
        <Route path="/pridobivanje" element={<Pridobivanje />} />
        <Route path="/racuni" element={<Racuni />} />
        <Route path="/ponudbe" element={<Ponudbe />} />
        <Route path="/ponudbe/skener" element={<PonudbeSkener />} />
        <Route path="/ponudbe/nova" element={<PonudbeNova />} />
        <Route path="/ponudbe/templati/:id" element={<PonudbeTemplate />} />
        <Route path="/ponudbe/nastavitve" element={<PonudbeNastavitve />} />
        <Route path="/admin/businesses" element={<AdminOnly><AdminBusinesses /></AdminOnly>} />
        <Route path="/admin/usage" element={<AdminOnly><AdminUsage /></AdminOnly>} />
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