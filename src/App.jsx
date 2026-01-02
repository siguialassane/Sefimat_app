import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, AuthProvider } from "@/contexts";
import { AdminLayout } from "@/components/layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/inscription" replace />} />
          <Route path="/inscription" element={<PublicRegistration />} />
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
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
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
