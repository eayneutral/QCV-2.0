import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Pricing } from './pages/Pricing';
import { CreatorPanel } from './pages/CreatorPanel';
import { QuantumParticles } from './components/QuantumParticles';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const theme = useThemeStore(state => state.theme);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  // Global Navigation layout would ideally wrap routes, but adding absolute nav for Pricing/Admin links here
  return (
    <Router>
      <div className="min-h-screen relative overflow-hidden flex flex-col">
        <QuantumParticles />
        
        {/* Global floating nav block for new pages */}
        <div className="absolute top-4 left-4 z-50 flex gap-4">
          <a href="/dashboard" className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold backdrop-blur-md transition-colors border border-white/5">Vault</a>
          <a href="/pricing" className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold backdrop-blur-md transition-colors border border-white/5">Upgrade</a>
          {useAuthStore.getState().user?.role === 'admin' && (
             <a href="/creator" className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 rounded-full text-xs font-bold backdrop-blur-md transition-colors border border-orange-500/20">Overseer</a>
          )}
        </div>

        <div className="z-10 flex-1 flex flex-col pt-12">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/creator" element={<CreatorPanel />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
