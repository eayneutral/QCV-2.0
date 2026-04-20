import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';
import { Lock, Fingerprint, Mail } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const magicToken = searchParams.get('magic_token');

  useEffect(() => {
    if (magicToken) {
      handleMagicTokenLogin(magicToken);
    }
  }, [magicToken]);

  const handleMagicTokenLogin = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/magic-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // We explicitly bypass the password here and attempt to derive from local storage JWK
      await login(data.user);
      navigate('/dashboard');
    } catch(err: any) {
      setError(err.message || "Invalid Magic Link");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkRequest = async () => {
    if (!email) return setError("Enter your email to request a magic link");
    setLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message); // In real app, "check your email"
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    if (!email) return setError("Enter your email for biometric login");
    setLoading(true);
    try {
      const optRes = await fetch('/api/auth/webauthn/auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error);

      const asseResp = await startAuthentication({ optionsJSON: options });
      
      const vRes = await fetch('/api/auth/webauthn/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, body: asseResp })
      });
      const vData = await vRes.json();
      if (!vRes.ok) throw new Error(vData.error);
      
      await login(vData.user);
      navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || "Biometric login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      await login(data.user, password, rememberMe);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 mt-[60px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-8 rounded-2xl w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-white/10 border border-white/20">
            <Lock size={32} className="text-[var(--glow-color)] drop-shadow-[0_0_10px_var(--glow-color)]" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center mb-6 font-mono tracking-tight">VAULT ACCESS</h2>
        
        {error && <div className="p-3 mb-4 rounded bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
             <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Identity (Email)</label>
             <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-lg" placeholder="agent@qcv.io" />
          </div>
          <div>
             <div className="flex justify-between items-center mb-1">
               <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Master Key</label>
               <button type="button" onClick={() => alert('Password reset module. You would lose vault access unless you have a recovery code.')} className="text-xs text-[var(--glow-color)] hover:underline">Forgot?</button>
             </div>
             <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg" placeholder="••••••••" />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="rounded border-none bg-white/20" />
            <label htmlFor="remember" className="text-xs text-gray-300">Remember encrypted key locally (Passwordless Ready)</label>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 mt-4 rounded-lg font-bold bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center justify-center gap-2">
            {loading ? <span className="animate-pulse">Decrypting Path...</span> : 'Unlock Vault'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-xs text-gray-500 font-mono tracking-widest">OR</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <div className="space-y-3">
          <button type="button" onClick={handleWebAuthnLogin} disabled={loading} className="w-full py-3 rounded-lg bg-[var(--glow-color)] hover:bg-white/20 transition-all flex items-center justify-center gap-2 font-bold backdrop-blur">
            <Fingerprint size={18} /> Biometric Unlock
          </button>
          
          <button type="button" onClick={handleMagicLinkRequest} disabled={loading} className="w-full py-3 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center gap-2 text-sm text-gray-300">
            <Mail size={18} /> Send Magic Link
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          New to the Nexus? <Link to="/register" className="text-white hover:text-[var(--glow-color)]">Initialize here</Link>
        </p>
      </motion.div>
    </div>
  );
}
