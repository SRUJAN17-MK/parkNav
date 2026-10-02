/**
 * SmartPark - route table and auth guard.
 */

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AppShell from './components/AppShell.jsx';
import { Loading } from './components/ui.jsx';
import { ParkingProvider } from './services/parking.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { useAuth } from './services/auth.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SearchPage from './pages/SearchPage.jsx';
import MapPage from './pages/MapPage.jsx';
import NavigationPage from './pages/NavigationPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import CameraPage from './pages/CameraPage.jsx';

function Protected({ children }) {
  const { isAuthenticated, checking } = useAuth();
  const location = useLocation();

  if (checking) return <Loading label="Restoring your session" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <Protected>
              <ParkingProvider>
                <AppShell />
              </ParkingProvider>
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/navigate" element={<NavigationPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/camera" element={<CameraPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ToastProvider>
  );
}
