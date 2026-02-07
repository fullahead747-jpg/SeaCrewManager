import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/auth-context";
import { ThemeProvider } from "./contexts/theme-context";
import { ExtractedRecordsProvider } from "./contexts/extracted-records-context";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import CrewManagement from "@/pages/crew-management";
import FleetManagement from "@/pages/fleet-management";
import Scheduling from "@/pages/scheduling";
import StatusHistory from "@/pages/status-history";
import CaptainLite from "@/pages/captain-lite";
import CrewDocumentsSplitView from "@/pages/crew-documents-split-view";
import AppLayout from "@/components/layout/app-layout";
import { motion, AnimatePresence } from "framer-motion";

function Router() {
  const [location] = useLocation();
  console.log("Current location:", location);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="min-h-screen w-full"
      >
        <Switch>
          {/* Dashboard and Management Pages (Wrapped in Layout) */}
          <Route path="/admin">
            <AppLayout><Dashboard /></AppLayout>
          </Route>
          <Route path="/dashboard">
            <AppLayout><Dashboard /></AppLayout>
          </Route>
          <Route path="/crew">
            <AppLayout><CrewManagement /></AppLayout>
          </Route>
          <Route path="/fleet">
            <AppLayout><FleetManagement /></AppLayout>
          </Route>
          <Route path="/scheduling">
            <AppLayout><Scheduling /></AppLayout>
          </Route>
          <Route path="/documents">
            <AppLayout><CrewDocumentsSplitView /></AppLayout>
          </Route>

          {/* Dashboard as Default Route */}
          <Route path="/">
            <AppLayout><Dashboard /></AppLayout>
          </Route>

          {/* Captain Assistant */}
          <Route path="/captain" component={CaptainLite} />

          {/* Status History */}
          <Route path="/status-history">
            <AppLayout><StatusHistory /></AppLayout>
          </Route>

          {/* Final Fallback - Dashboard */}
          <Route path="/:rest*">
            <AppLayout><Dashboard /></AppLayout>
          </Route>
        </Switch>
      </motion.div>
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
