import { motion } from "framer-motion";
import { Check, Shield, Zap, Box, Fingerprint, Banknote, Users, Activity, Crown } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useState, useEffect } from "react";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    color: "from-blue-500/20 to-blue-900/40",
    glow: "rgba(59, 130, 246, 0.4)",
    features: [
      "Up to 50 Credentials",
      "AES-256-GCM Encryption",
      "Basic Device Sync",
      "Standard WebAuthn"
    ],
    icon: <Box size={24} className="text-blue-400" />
  },
  {
    id: "pro",
    name: "Pro",
    price: "12",
    popular: true,
    color: "from-purple-500/30 to-purple-900/50",
    glow: "rgba(168, 85, 247, 0.6)",
    features: [
      "Unlimited Credentials",
      "OCR Content Extraction",
      "Secret Sharing (Time-bombed)",
      "Dark Web Breach Checks",
      "Priority API Access"
    ],
    icon: <Zap size={24} className="text-purple-400" />
  },
  {
    id: "team",
    name: "Team",
    price: "49",
    color: "from-emerald-500/20 to-emerald-900/40",
    glow: "rgba(16, 185, 129, 0.4)",
    features: [
      "Up to 10 Seats",
      "Shared Group Vaults",
      "Role-based Access Control",
      "Audit Logging",
      "Slack/Teams Integration"
    ],
    icon: <Users size={24} className="text-emerald-400" />
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    color: "from-orange-500/20 to-orange-900/40",
    glow: "rgba(249, 115, 22, 0.4)",
    features: [
      "Single Sign-On (SAML/OIDC)",
      "Quantum-Resilient Ready",
      "Dedicated HSM/KMS Integrations",
      "On-Premise Deployment Options",
      "24/7 SLA Support"
    ],
    icon: <Crown size={24} className="text-orange-400" />
  }
];

export function Pricing() {
  const { user } = useAuthStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");

  useEffect(() => {
    if (user) {
      // Fetch user's current plan
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
           if(data.user?.subscriptionPlan) setCurrentPlan(data.user.subscriptionPlan);
        }).catch(err => console.error(err));
    }
  }, [user]);

  const handleUpgrade = async (planId: string) => {
    if (!user) return window.location.href = '/login';
    if (planId === currentPlan) return;

    setLoadingId(planId);
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json();
      if(data.success) {
        setCurrentPlan(planId);
        alert(`Successfully upgraded to ${planId.toUpperCase()} tier!`);
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert("Upgrade failed: " + e.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full relative z-10 pt-[80px]">
      <header className="text-center mb-16">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-mono font-bold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400"
        >
          QUANTUM CREDENTIALS PRICING
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto"
        >
          Zero trust, post-quantum cryptography plans tailored for individuals, distributed teams, and high-security enterprises.
        </motion.p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {TIERS.map((tier, idx) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className={`glass-panel rounded-3xl p-6 relative flex flex-col group overflow-hidden border transition-all duration-500`}
            style={{ borderColor: currentPlan === tier.id ? tier.glow : "rgba(255,255,255,0.1)" }}
            whileHover={{ scale: 1.02, boxShadow: `0 20px 40px -10px ${tier.glow}` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${tier.color} opacity-20 pointer-events-none`}></div>
            
            {tier.popular && (
              <div className="absolute top-0 right-8 bg-purple-500 text-xs font-bold px-3 py-1 rounded-b-lg shadow-[0_0_10px_rgba(168,85,247,0.8)] z-10">
                MOST POPULAR
              </div>
            )}

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-3 bg-black/40 rounded-xl backdrop-blur-md border border-white/5">
                {tier.icon}
              </div>
              <h2 className="text-xl font-bold font-mono tracking-widest uppercase">{tier.name}</h2>
            </div>

            <div className="mb-8 relative z-10">
              <span className="text-4xl font-bold tracking-tighter text-white">
                {tier.price === 'Custom' ? '' : '$'}{tier.price}
              </span>
              {tier.price !== 'Custom' && <span className="text-gray-400 ml-2">/ month</span>}
            </div>

            <button 
              onClick={() => handleUpgrade(tier.id)}
              disabled={loadingId === tier.id || currentPlan === tier.id}
              className={`w-full py-3 mb-8 rounded-xl font-bold transition-all relative z-10 disabled:opacity-50 overflow-hidden`}
              style={{ 
                background: currentPlan === tier.id ? tier.glow : 'rgba(255,255,255,0.05)',
                border: `1px solid ${tier.glow}`
              }}
            >
              {loadingId === tier.id ? 'Processing...' : (currentPlan === tier.id ? 'CURRENT PLAN' : 'SELECT PLAN')}
            </button>

            <div className="space-y-4 relative z-10 mt-auto">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Features</h4>
              {tier.features.map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check size={16} className="mt-0.5 text-green-400 shrink-0" />
                  <span className="text-sm text-gray-300">{feat}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
