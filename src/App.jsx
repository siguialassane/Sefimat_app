import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts";
import { AdminLayout } from "@/components/layout";
import {
  PublicRegistration,
  Login,
  Dashboard,
  RegistrationManagement,
  InPersonRegistration,
  Exports,
} from "@/pages";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/inscription" replace />} />
          <Route path="/inscription" element={<PublicRegistration />} />
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="inscriptions" element={<RegistrationManagement />} />
            <Route path="inscription-presentielle" element={<InPersonRegistration />} />
            <Route path="exports" element={<Exports />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/inscription" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
