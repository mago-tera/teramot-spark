import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Projects from "./pages/Projects";
import CampaignsPage from "./pages/CampaignsPage";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(240 15% 6%)" }}>
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.email?.endsWith("@teramot.com")) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AuthGuard><Projects /></AuthGuard>} />
          <Route path="/project/:projectId" element={<AuthGuard><CampaignsPage /></AuthGuard>} />
          <Route path="/project/:projectId/campaign/new" element={<AuthGuard><Index /></AuthGuard>} />
          <Route path="/project/:projectId/campaign/:id" element={<AuthGuard><Index /></AuthGuard>} />
          {/* Legacy routes redirect */}
          <Route path="/campaign/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
