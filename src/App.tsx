import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './firebase';
import { getUserProfile } from './services/userService';
import { useUserStore } from './store/userStore';
import { startSyncListener } from './services/syncService';
import { useGoogleMapsLoader } from './hooks/useGoogleMapsLoader';

import Layout from './components/layout/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';

import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import ProfileEdit from './pages/ProfileEdit';
import NearMe from './pages/NearMe';
import NavigationPage from './pages/NavigationPage';
import JourneyPlanner from './pages/JourneyPlanner';
import ReportAnomaly from './pages/ReportAnomaly';
import AnomalyDashboard from './pages/AnomalyDashboard';
import AnomalyDetail from './pages/AnomalyDetail';
import ReportHistory from './pages/ReportHistory';
import ResponderLogin from './pages/responder/ResponderLogin';
import ResponderDashboard from './pages/responder/ResponderDashboard';
import ResponderDetail from './pages/responder/ResponderDetail';

import './styles/globals.css';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUserStore();
  if (isLoading) return <LoadingSpinner size={40} text="Loading ROADSOS…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireResponder({ children }: { children: React.ReactNode }) {
  const responder = localStorage.getItem('roadsos-responder');
  if (!responder) return <Navigate to="/responder/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { setUser, setLoading } = useUserStore();

  // Load Google Maps API ONCE at app level with the unified loader
  const { isLoaded } = useGoogleMapsLoader();

  useEffect(() => {
    startSyncListener();
    const unsub = onAuthStateChanged(auth, async (fireUser) => {
      if (fireUser) {
        const profile = await getUserProfile(fireUser.uid);
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [setUser, setLoading]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111420', color: '#f1f5f9',
            border: '1px solid #252a3d', fontSize: '0.85rem', borderRadius: '10px',
          },
        }}
      />
      <Routes>
        {/* Responder Portal */}
        <Route path="/responder/login" element={<ResponderLogin />} />
        <Route path="/responder/dashboard" element={<RequireResponder><ResponderDashboard /></RequireResponder>} />
        <Route path="/responder/incident/:id" element={<RequireResponder><ResponderDetail /></RequireResponder>} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Main App */}
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/edit" element={<ProfileEdit />} />
          <Route path="nearme" element={<NearMe />} />
          <Route path="navigation" element={<NavigationPage />} />
          <Route path="journey" element={<JourneyPlanner />} />
          <Route path="report" element={<ReportAnomaly />} />
          <Route path="dashboard" element={<AnomalyDashboard />} />
          <Route path="incident/:id" element={<AnomalyDetail />} />
          <Route path="report-history" element={<ReportHistory />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
