import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, AuthProvider, DataProvider } from "@/contexts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster, notify } from "@/components/ui/toast";
import { AdminLayout, FinanceLayout, PresidentLayout, ScientifiqueLayout } from "@/components/layout";

const PublicRegistration = lazy(() => import("@/pages/PublicRegistration").then((module) => ({ default: module.PublicRegistration })));
const Login = lazy(() => import("@/pages/Login").then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const RegistrationManagement = lazy(() => import("@/pages/RegistrationManagement").then((module) => ({ default: module.RegistrationManagement })));
const InPersonRegistration = lazy(() => import("@/pages/InPersonRegistration").then((module) => ({ default: module.InPersonRegistration })));
const BadgeManagement = lazy(() => import("@/pages/BadgeManagement").then((module) => ({ default: module.BadgeManagement })));
const Exports = lazy(() => import("@/pages/Exports").then((module) => ({ default: module.Exports })));
const ConfigDortoirs = lazy(() => import("@/pages/ConfigDortoirs").then((module) => ({ default: module.ConfigDortoirs })));
const FinanceDashboard = lazy(() => import("@/pages/finance/FinanceDashboard").then((module) => ({ default: module.FinanceDashboard })));
const PaymentValidation = lazy(() => import("@/pages/finance/PaymentValidation").then((module) => ({ default: module.PaymentValidation })));
const PaymentList = lazy(() => import("@/pages/finance/PaymentList").then((module) => ({ default: module.PaymentList })));
const PaymentSummary = lazy(() => import("@/pages/finance/PaymentSummary").then((module) => ({ default: module.PaymentSummary })));
const PresidentRegistration = lazy(() => import("@/pages/president/PresidentRegistration").then((module) => ({ default: module.PresidentRegistration })));
const PresidentPayments = lazy(() => import("@/pages/president/PresidentPayments").then((module) => ({ default: module.PresidentPayments })));
const ScientifiqueDashboard = lazy(() => import("@/pages/scientifique/ScientifiqueDashboard").then((module) => ({ default: module.ScientifiqueDashboard })));
const TestEntree = lazy(() => import("@/pages/scientifique/TestEntree").then((module) => ({ default: module.TestEntree })));
const GestionNotes = lazy(() => import("@/pages/scientifique/GestionNotes").then((module) => ({ default: module.GestionNotes })));
const ListeClasses = lazy(() => import("@/pages/scientifique/ListeClasses").then((module) => ({ default: module.ListeClasses })));
const ConfigClasses = lazy(() => import("@/pages/scientifique/ConfigClasses").then((module) => ({ default: module.ConfigClasses })));
const GestionBulletins = lazy(() => import("@/pages/scientifique/GestionBulletins").then((module) => ({ default: module.default })));

function App() {
  useEffect(() => {
    const nativeAlert = window.alert;

    window.alert = (message) => {
      notify.warning(String(message), {
        title: "Notification",
        duration: 5000,
      });
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Toaster defaultPosition="bottom-center" />
            <Suspense
              fallback={
                <div className="min-h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
                  <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
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
                  <Route path="config-dortoirs" element={<ConfigDortoirs />} />
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

                {/* Scientifique Routes (Cellule Scientifique) */}
                <Route path="/scientifique" element={
                  <ProtectedRoute>
                    <ScientifiqueLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/scientifique/dashboard" replace />} />
                  <Route path="dashboard" element={<ScientifiqueDashboard />} />
                  <Route path="test-entree" element={<TestEntree />} />
                  <Route path="notes" element={<GestionNotes />} />
                  <Route path="classes" element={<ListeClasses />} />
                  <Route path="bulletins" element={<GestionBulletins />} />
                  <Route path="config" element={<ConfigClasses />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/inscription" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
