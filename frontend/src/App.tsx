import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./store/auth";
import { AppShell } from "./components/AppShell";
import { Login } from "./pages/Login";
import { Cockpit } from "./pages/Cockpit";
import { Infrastructure } from "./pages/Infrastructure";
import { Services } from "./pages/Services";
import { Storage } from "./pages/Storage";
import { Network } from "./pages/Network";
import { HomeAssistant } from "./pages/HomeAssistant";
import { Monitoring } from "./pages/Monitoring";
import { Events } from "./pages/Events";
import { Administration } from "./pages/Administration";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Cockpit />} />
        <Route path="/infrastructure" element={<Infrastructure />} />
        <Route path="/services" element={<Services />} />
        <Route path="/storage" element={<Storage />} />
        <Route path="/network" element={<Network />} />
        <Route path="/home-assistant" element={<HomeAssistant />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/events" element={<Events />} />
        <Route path="/administration" element={<Administration />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
