import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import LandingPage from './pages/LandingPage';
import Home from './pages/Home';
import UnlockBike from './pages/UnlockBike';
import ActiveRide from './pages/ActiveRide';
import RideSummary from './pages/RideSummary';
import RideHistory from './pages/RideHistory';
import Disputes from './pages/Disputes';
import PaymentMethods from './pages/PaymentMethods';
import Subscriptions from './pages/Subscriptions';
import AdminLayout from './pages/admin/AdminLayout';
import FleetOverview from './pages/admin/FleetOverview';
import StationManagement from './pages/admin/StationManagement';
import BikeManagement from './pages/admin/BikeManagement';
import UserManagement from './pages/admin/UserManagement';
import DisputeManagement from './pages/admin/DisputeManagement';
import Analytics from './pages/admin/Analytics';
import Alerts from './pages/admin/Alerts';

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

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
