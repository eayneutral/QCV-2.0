import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Key, Zap } from 'lucide-react';

export function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="mb-8 relative w-48 h-48 mx-auto">
           {/* Fallback CSS Logo if image not provided */}
           <div className="absolute inset-0 rounded-full border-4 border-[var(--glow-color)] animate-ping opacity-20"></div>
           <div className="absolute inset-4 rounded-full border-2 border-white/50 animate-spin" style={{ animationDuration: '10s' }}></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <Shield size={64} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
           </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-4 font-mono tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 drop-shadow-[0_0_20px_var(--glow-color)]">
          QUANTUM<br/>CREDENTIALS VAULT
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 font-light mb-10 max-w-2xl mx-auto">
          Zero-knowledge, quantum-ready credential management platform powered by EAY Quantum Technology.
        </p>
      </motion.div>

      <motion.div 
        className="flex flex-col sm:flex-row gap-4 justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Link to="/register" className="glass-panel px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-all text-white border-white/20 hover:border-[var(--glow-color)] hover:shadow-[0_0_30px_var(--glow-color)] flex items-center gap-2">
          <Key size={20} /> Initialize Vault
        </Link>
        <Link to="/login" className="px-8 py-4 rounded-full font-bold text-lg hover:bg-white/10 transition-all border border-transparent hover:border-white/20 flex items-center gap-2">
          <Zap size={20} /> Access Portal
        </Link>
      </motion.div>
    </div>
  );
}
