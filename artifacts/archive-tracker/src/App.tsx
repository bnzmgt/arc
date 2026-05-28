import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import DashboardPage from "@/pages/dashboard";
import BoxesPage from "@/pages/boxes";
import BoxNewPage from "@/pages/box-new";
import BoxDetailPage from "@/pages/box-detail";
import ScanPage from "@/pages/scan";
import RolesPage from "@/pages/roles";
import TeamPage from "@/pages/team";
import SettingsPage from "@/pages/settings";
import ScannerSimulatorPage from "@/pages/scanner-simulator";
import LabelPrintPage from "@/pages/label-print";
import ActivityLogPage from "@/pages/activity-log";
import LoginPage from "@/pages/login";
import AdminAccountsPage from "@/pages/admin-accounts";
import AcquisitionsPage from "@/pages/acquisitions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/boxes");
    }
  }, [loading, isAdmin, navigate]);

  if (loading) return null;
  if (!isAdmin) return null;

  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate("/boxes");
    }
  }, [loading, isSuperAdmin, navigate]);

  if (loading) return null;
  if (!isSuperAdmin) return null;

  return <>{children}</>;
}

function SmartRedirect() {
  return <Redirect to="/dashboard" />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes — no auth required */}
      <Route path="/login" component={LoginPage} />
      <Route path="/scan/:ticketCode" component={ScanPage} />
      <Route path="/label/:ticketCode" component={LabelPrintPage} />
      <Route path="/q/:ticketCode" component={({ params }: { params?: { ticketCode?: string } }) => {
        const code = params?.ticketCode ?? "";
        if (code) window.location.replace(`${import.meta.env.BASE_URL}scan/${code}`);
        return null;
      }} />

      {/* Protected routes */}
      <Route path="/" component={() => (
        <RequireAuth><SmartRedirect /></RequireAuth>
      )} />
      <Route path="/dashboard" component={() => (
        <RequireAuth><Layout><DashboardPage /></Layout></RequireAuth>
      )} />
      <Route path="/boxes/new" component={() => (
        <RequireAuth><RequireAdmin><Layout><BoxNewPage /></Layout></RequireAdmin></RequireAuth>
      )} />
      <Route path="/boxes/:id" component={() => (
        <RequireAuth><Layout><BoxDetailPage /></Layout></RequireAuth>
      )} />
      <Route path="/boxes" component={() => (
        <RequireAuth><Layout><BoxesPage /></Layout></RequireAuth>
      )} />
      <Route path="/roles" component={() => (
        <RequireAuth><RequireAdmin><Layout><RolesPage /></Layout></RequireAdmin></RequireAuth>
      )} />
      <Route path="/team" component={() => (
        <RequireAuth><RequireAdmin><Layout><TeamPage /></Layout></RequireAdmin></RequireAuth>
      )} />
      <Route path="/settings" component={() => (
        <RequireAuth><Layout><SettingsPage /></Layout></RequireAuth>
      )} />
      <Route path="/scanner-simulator" component={() => (
        <RequireAuth><Layout><ScannerSimulatorPage /></Layout></RequireAuth>
      )} />
      <Route path="/acquisitions" component={() => (
        <RequireAuth><RequireAdmin><Layout><AcquisitionsPage /></Layout></RequireAdmin></RequireAuth>
      )} />
      <Route path="/activity-log" component={() => (
        <RequireAuth><Layout><ActivityLogPage /></Layout></RequireAuth>
      )} />
      <Route path="/admin-accounts" component={() => (
        <RequireAuth><RequireSuperAdmin><Layout><AdminAccountsPage /></Layout></RequireSuperAdmin></RequireAuth>
      )} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
