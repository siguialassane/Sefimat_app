import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, AuthProvider, DataProvider } from "@/contexts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  PublicRegistration,
  Login,
  Dashboard,
  RegistrationManagement,
  InPersonRegistration,
  BadgeManagement,
  Exports,
  FinanceDashboard,
  PaymentValidation,
  PaymentList,
  PaymentSummary,
  PresidentRegistration,
  PresidentPayments,
} from "@/pages";
import { AdminLayout, FinanceLayout, PresidentLayout } from "@/components/layout";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Navigate to="/inscription" replace />} />
              <Route path="/inscription" element={<PublicRegistration />} />
              <Route path="/login" element={<Login />} />

              {/* President de Section Routes (Public - Lien unique) */}
              <Route path="/president/:lienUnique" element={<PresidentLayout />}>
                <Route index element={<Navigate to="inscription" replace />} />
                <Route path="inscription" element={<PresidentRegistration />} />
                <Route path="paiements" element={<PresidentPayments />} />
              </Route>

              {/* Admin Routes (Cellule Secrétariat) */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="inscriptions" element={<RegistrationManagement />} />
                <Route path="inscription-presentielle" element={<InPersonRegistration />} />
                <Route path="badges" element={<BadgeManagement />} />
                <Route path="exports" element={<Exports />} />
              </Route>

              {/* Finance Routes (Cellule Financier) */}
              <Route path="/finance" element={
                <ProtectedRoute>
                  <FinanceLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/finance/dashboard" replace />} />
                <Route path="dashboard" element={<FinanceDashboard />} />
                <Route path="validation" element={<PaymentValidation />} />
                <Route path="liste" element={<PaymentList />} />
                <Route path="synthese" element={<PaymentSummary />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/inscription" replace />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
