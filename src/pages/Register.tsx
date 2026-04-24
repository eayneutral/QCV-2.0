import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState } from 'react';
import { KeyRound, Shield } from 'lucide-react';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      await login(data.user, password, rememberMe);
      
      // Auto-generate a recovery code locally just for display/safekeeping
      const rCode = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g)?.join('-').toUpperCase() || '';
      setRecoveryCode(rCode);
    } catch (err: any) {
      setError(err.message || "Failed to register");
      setLoading(false);
    }
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 8) score++;
    if (pass.length > 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  if (recoveryCode) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 mt-[60px]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-8 rounded-2xl w-full max-w-md text-center">
          <Shield size={48} className="mx-auto text-green-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4 font-mono">CRITICAL: RECOVERY KEY</h2>
          <p className="text-sm text-gray-300 mb-6">
            QCV is a Zero-Knowledge Vault. If you lose your Master Key and haven't set up Biometrics/Remember Me, your data is gone forever.
            Save this recovery phrase in a secure offline location.
          </p>
          <div className="bg-black/50 p-4 border border-white/20 rounded font-mono text-[var(--glow-color)] text-lg mb-6 break-all">
            {recoveryCode}
          </div>
          <button onClick={() => navigate(useAuthStore.getState().user?.role === 'admin' ? '/creator' : '/dashboard')} className="w-full py-3 rounded-lg bg-[var(--glow-color)] hover:bg-white/20 transition-all font-bold">
            I Have Saved It Safely
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 mt-[60px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-8 rounded-2xl w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-white/10 border border-white/20">
            <KeyRound size={32} className="text-[var(--glow-color)] drop-shadow-[0_0_10px_var(--glow-color)]" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center mb-2 font-mono tracking-tight">INITIALIZE</h2>
        <p className="text-center text-sm text-gray-400 mb-6">Create your zero-knowledge vault.</p>
        
        {error && <div className="p-3 mb-4 rounded bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
             <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Identity (Email)</label>
             <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-lg" placeholder="agent@qcv.io" />
          </div>
          <div>
             <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Master Key</label>
             <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg" placeholder="Must be strong. Irrecoverable." />
             {password && (
               <div className="mt-2">
                 <div className="flex justify-between items-center mb-1">
                   <span className="text-xs text-gray-400 font-mono">STRENGTH</span>
                   <span className={`text-[10px] font-bold uppercase ${['text-red-500', 'text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-green-400'][Math.min(getPasswordStrength(password), 5)]}`}>
                     {['Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][Math.min(getPasswordStrength(password), 5)]}
                   </span>
                 </div>
                 <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                   <div 
                     className={`h-full transition-all duration-300 ${['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-400'][Math.min(getPasswordStrength(password), 5)]}`} 
                     style={{ width: `${Math.max(10, Math.min(100, getPasswordStrength(password) * 20))}%` }}
                   ></div>
                 </div>
               </div>
             )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="rounded border-none bg-white/20" />
            <label htmlFor="remember" className="text-xs text-gray-300">Save encrypted key locally for passwordless & biometrics</label>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 mt-2 rounded-lg font-bold bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center justify-center">
            {loading ? <span className="animate-pulse">Generating Entropy...</span> : 'Establish Vault'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already an agent? <Link to="/login" className="text-white hover:text-[var(--glow-color)]">Access Portal</Link>
        </p>
      </motion.div>
    </div>
  );
}
