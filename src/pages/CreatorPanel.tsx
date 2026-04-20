import { motion } from "framer-motion";
import { Users, Database, Activity, Shield, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";

interface AdminMetrics {
  totalUsers: number;
  totalVaults: number;
  userPlans: { subscriptionPlan: string; _count: { id: number } }[];
  recentLogs: { id: string; action: string; ip: string; timestamp: string; user: { email: string } }[];
}

export function CreatorPanel() {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(res => res.json())
      .then(data => {
        if(data.error) setError(data.error);
        else setMetrics(data);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 mt-20">
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center max-w-md text-center border-red-500/30">
          <AlertTriangle size={48} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold font-mono text-red-100 mb-2">ACCESS DENIED</h2>
          <p className="text-gray-400 text-sm">You do not have creator/admin privileges to view this sector.</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full relative pt-[80px]">
      <header className="mb-8">
        <h1 className="text-3xl font-mono font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-400 inline-block">
          CREATOR OVERSEER PANEL
        </h1>
        <p className="text-sm text-gray-400 mt-2">System metrics, audit logs, and global distribution overrides.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="glass-panel p-6 rounded-2xl border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={64}/></div>
          <p className="text-gray-400 text-sm font-bold tracking-widest mb-2">TOTAL AGENTS</p>
          <p className="text-4xl font-mono font-bold text-white">{metrics.totalUsers}</p>
        </motion.div>
        
        <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} transition={{delay: 0.1}} className="glass-panel p-6 rounded-2xl border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Database size={64}/></div>
          <p className="text-gray-400 text-sm font-bold tracking-widest mb-2">ENCRYPTED VAULTS</p>
          <p className="text-4xl font-mono font-bold text-white">{metrics.totalVaults}</p>
        </motion.div>

        <div className="glass-panel p-6 rounded-2xl border-white/5 col-span-1 lg:col-span-2">
          <p className="text-gray-400 text-sm font-bold tracking-widest mb-4">SUBSCRIPTION DISTRIBUTION</p>
          <div className="flex gap-4 h-16 w-full items-end">
             {metrics.userPlans.map((plan, i) => {
               const percentage = ((plan._count.id / metrics.totalUsers) * 100).toFixed(0);
               return (
                 <motion.div 
                   key={plan.subscriptionPlan} 
                   initial={{height: 0}} animate={{height: `${percentage}%`}} transition={{delay: 0.2 + (i*0.1)}}
                   className="flex-1 bg-gradient-to-t from-orange-500/20 to-orange-400/80 rounded-t-lg relative group flex items-end justify-center pb-2"
                   title={`${plan.subscriptionPlan.toUpperCase()}: ${plan._count.id} Users`}
                 >
                   <span className="text-xs font-mono font-bold text-white opacity-0 group-hover:opacity-100 absolute -top-6 transition-opacity">{percentage}%</span>
                   <span className="text-[10px] font-bold text-black uppercase">{plan.subscriptionPlan.substring(0,3)}</span>
                 </motion.div>
               );
             })}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
        <div className="p-4 bg-black/40 border-b border-white/5 flex items-center gap-2">
          <Activity size={18} className="text-orange-400" />
          <h3 className="font-bold font-mono tracking-widest">SYSTEM AUDIT LOGS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-4 font-normal tracking-wide">TIMESTAMP</th>
                <th className="p-4 font-normal tracking-wide">AGENT</th>
                <th className="p-4 font-normal tracking-wide">ACTION</th>
                <th className="p-4 font-normal tracking-wide">IP SEC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {metrics.recentLogs.map(log => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-4">{log.user.email}</td>
                  <td className="p-4 font-mono text-orange-200">{log.action}</td>
                  <td className="p-4 font-mono text-gray-500">{log.ip || '0.0.0.0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
