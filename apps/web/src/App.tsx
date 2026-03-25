import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui/Spinner';

// Lazy-loaded page components
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Home = lazy(() => import('./pages/Home'));
const UnlockBike = lazy(() => import('./pages/UnlockBike'));
const ActiveRide = lazy(() => import('./pages/ActiveRide'));
const RideSummary = lazy(() => import('./pages/RideSummary'));
const RideHistory = lazy(() => import('./pages/RideHistory'));
const Disputes = lazy(() => import('./pages/Disputes'));
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));

// Admin pages — only loaded when admin navigates there
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const FleetOverview = lazy(() => import('./pages/admin/FleetOverview'));
const StationManagement = lazy(() => import('./pages/admin/StationManagement'));
const BikeManagement = lazy(() => import('./pages/admin/BikeManagement'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const DisputeManagement = lazy(() => import('./pages/admin/DisputeManagement'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const Alerts = lazy(() => import('./pages/admin/Alerts'));

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function PageSpinner() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Spinner className="h-10 w-10" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnly>
              <LandingPage />
            </PublicOnly>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <Register />
            </PublicOnly>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedPage>
              <Home />
            </ProtectedPage>
          }
        />
        <Route
          path="/unlock/:bikeId"
          element={
            <ProtectedPage>
              <UnlockBike />
            </ProtectedPage>
          }
        />
        <Route
          path="/ride/active"
          element={
            <ProtectedPage>
              <ActiveRide />
            </ProtectedPage>
          }
        />
        <Route
          path="/ride/:rideId/summary"
          element={
            <ProtectedPage>
              <RideSummary />
            </ProtectedPage>
          }
        />
        <Route
          path="/rides"
          element={
            <ProtectedPage>
              <RideHistory />
            </ProtectedPage>
          }
        />
        <Route
          path="/disputes"
          element={
            <ProtectedPage>
              <Disputes />
            </ProtectedPage>
          }
        />
        <Route
          path="/settings/payments"
          element={
            <ProtectedPage>
              <PaymentMethods />
            </ProtectedPage>
          }
        />
        <Route
          path="/settings/subscription"
          element={
            <ProtectedPage>
              <Subscriptions />
            </ProtectedPage>
          }
        />

        {/* Admin routes — AdminLayout handles its own RBAC */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FleetOverview />} />
          <Route path="stations" element={<StationManagement />} />
          <Route path="bikes" element={<BikeManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="disputes" element={<DisputeManagement />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="alerts" element={<Alerts />} />
        </Route>
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
