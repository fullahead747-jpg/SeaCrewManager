import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/auth-context";
import { ThemeProvider } from "./contexts/theme-context";
import { ExtractedRecordsProvider } from "./contexts/extracted-records-context";
import AppLayout from "@/components/layout/app-layout";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense, lazy } from "react";
import Loading from "@/components/ui/loading";

// Lazy load auth pages
const LoginPage = lazy(() => import("@/pages/auth/login-page"));
const RegisterPage = lazy(() => import("@/pages/auth/register-page"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/reset-password"));

// Lazy load app pages
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CrewManagement = lazy(() => import("@/pages/crew-management"));
const FleetManagement = lazy(() => import("@/pages/fleet-management"));
const Scheduling = lazy(() => import("@/pages/scheduling"));
const StatusHistory = lazy(() => import("@/pages/status-history"));
const CaptainLite = lazy(() => import("@/pages/captain-lite"));
const CrewDocumentsSplitView = lazy(() => import("@/pages/crew-documents-split-view"));
const Settings = lazy(() => import("@/pages/settings"));
const Notifications = lazy(() => import("@/pages/notifications"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  if (!user) {
    return <Redirect to="/auth/login" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<Loading />}>
        <Switch>
          {/* Auth Pages */}
          <Route path="/auth/login" component={LoginPage} />
          <Route path="/auth/register" component={RegisterPage} />
          <Route path="/auth/forgot-password" component={ForgotPasswordPage} />
          <Route path="/auth/reset-password" component={ResetPasswordPage} />

          {/* Protected App Pages */}
          <Route path="/admin">
            <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/dashboard">
            <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/crew">
            <ProtectedRoute><AppLayout><CrewManagement /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/fleet">
            <ProtectedRoute><AppLayout><FleetManagement /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/scheduling">
            <ProtectedRoute><AppLayout><Scheduling /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/documents">
            <ProtectedRoute><AppLayout><CrewDocumentsSplitView /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/status-history">
            <ProtectedRoute><AppLayout><StatusHistory /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/settings">
            <ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/notifications">
            <ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>
          </Route>
          <Route path="/captain">
            <ProtectedRoute><CaptainLite /></ProtectedRoute>
          </Route>

          {/* Default Route */}
          <Route path="/">
            <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
          </Route>

          {/* Fallback */}
          <Route path="/:rest*">
            <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
          </Route>
        </Switch>
      </Suspense>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <ExtractedRecordsProvider>
              <div className="min-h-screen bg-background font-sans antialiased text-foreground">
                <Toaster />
                <Router />
              </div>
            </ExtractedRecordsProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
