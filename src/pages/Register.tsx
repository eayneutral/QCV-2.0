import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      
      // Compute AES key
      await login(data.user, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
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
