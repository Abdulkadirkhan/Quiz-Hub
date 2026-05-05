import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminLobby from "@/pages/AdminLobby";
import AdminGame from "@/pages/AdminGame";
import PlayerJoin from "@/pages/PlayerJoin";
import SpectatorView from "@/pages/SpectatorView";
import QuestionsPage from "@/pages/QuestionsPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminLobby} />
      <Route path="/admin/game/:sessionId" component={AdminGame} />
      <Route path="/admin/questions" component={QuestionsPage} />
      <Route path="/join/:sessionId/:teamId" component={PlayerJoin} />
      <Route path="/watch/:sessionId" component={SpectatorView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
