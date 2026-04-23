import { motion, AnimatePresence } from "framer-motion";
import { Users, Database, Activity, Shield, AlertTriangle, Trash2, Edit2, Image as ImageIcon, Check, Save } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../store/authStore";

interface AdminMetrics {
  totalUsers: number;
  totalVaults: number;
  userPlans: { subscriptionPlan: string; _count: { id: number } }[];
  recentLogs: { id: string; action: string; ip: string; timestamp: string; user: { email: string } }[];
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  subscriptionPlan: string;
  createdAt: string;
}

export function CreatorPanel() {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'metrics'|'users'|'branding'>('metrics');
  const [savingSettings, setSavingSettings] = useState(false);

  // New Role Form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [rolePerms, setRolePerms] = useState<string[]>([]);

  // Global Settings State
  const [globalLogo, setGlobalLogo] = useState('');
  const [globalFavicon, setGlobalFavicon] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#00d4ff');
  const [secondaryColor, setSecondaryColor] = useState('#090979');
  const [globalFont, setGlobalFont] = useState('Inter');
  const [globalGradient, setGlobalGradient] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const [mRes, uRes, sRes, rRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/admin/users'),
        fetch('/api/settings/global'),
        fetch('/api/admin/roles')
      ]);
      const mData = await mRes.json();
      const uData = await uRes.json();
      const sData = await sRes.json();
      const rData = await rRes.json();
      
      if(mData.error) setError(mData.error);
      else setMetrics(mData);
      if(uData.users) setUsers(uData.users);
      if(rData.roles) setRoles(rData.roles);
      if(sData.settings) {
        sData.settings.forEach((s: any) => {
          if(s.key === 'globalLogo') setGlobalLogo(s.value);
          if(s.key === 'globalFavicon') setGlobalFavicon(s.value);
          if(s.key === 'primaryColor') setPrimaryColor(s.value);
          if(s.key === 'secondaryColor') setSecondaryColor(s.value);
          if(s.key === 'globalFont') setGlobalFont(s.value);
          if(s.key === 'globalGradient') setGlobalGradient(s.value);
        });
      }
    } catch(e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateUser = async (id: string, role: string, plan: string) => {
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, subscriptionPlan: plan })
      });
      fetchData();
    } catch(e) {
      alert("Failed to update user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    try {
      await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      fetchData();
    } catch(e) {
      alert("Failed to delete user");
    }
  };

  const handleSaveRole = async () => {
    try {
      const url = editingRole ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles';
      const method = editingRole ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roleName, description: roleDesc, permissions: rolePerms })
      });
      setShowRoleForm(false);
      fetchData();
    } catch(e) {
      alert("Failed to save role");
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
      fetchData();
    } catch(e) {
      alert("Failed to delete role");
    }
  };

  const openRoleForm = (role: any = null) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleDesc(role.description || '');
      setRolePerms(JSON.parse(role.permissions || '[]'));
    } else {
      setEditingRole(null);
      setRoleName('');
      setRoleDesc('');
      setRolePerms([]);
    }
    setShowRoleForm(true);
  };

  const handleImageRead = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBrandSettings = async () => {
    setSavingSettings(true);
    try {
      const settings = [
        { key: 'globalLogo', value: globalLogo },
        { key: 'globalFavicon', value: globalFavicon },
        { key: 'primaryColor', value: primaryColor },
        { key: 'secondaryColor', value: secondaryColor },
        { key: 'globalFont', value: globalFont },
        { key: 'globalGradient', value: globalGradient },
      ];
      await fetch('/api/admin/settings/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      alert('Brand settings saved globally.');
      // Force reload to apply settings
      window.location.reload();
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

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
        <p className="text-sm text-gray-400 mt-2">System metrics, audit logs, user management, and global distribution overrides.</p>
      </header>

      <div className="flex gap-4 mb-8">
        <button onClick={() => setActiveTab('metrics')} className={`px-4 py-2 font-bold font-mono tracking-wider transition-all rounded-lg ${activeTab === 'metrics' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>METRICS</button>
        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 font-bold font-mono tracking-wider transition-all rounded-lg ${activeTab === 'users' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>AGENTS (USERS)</button>
        <button onClick={() => setActiveTab('branding')} className={`px-4 py-2 font-bold font-mono tracking-wider transition-all rounded-lg ${activeTab === 'branding' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>BRANDING ASSETS</button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'metrics' && (
          <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
              <div className="p-4 bg-black/40 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-orange-400" />
                  <h3 className="font-bold font-mono tracking-widest">CUSTOM ROLES</h3>
                </div>
                <button onClick={() => openRoleForm()} className="px-4 py-1 text-xs bg-orange-500/20 text-orange-400 font-bold rounded-lg hover:bg-orange-500 hover:text-black transition-all">
                  + Create Role
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400 mb-4 block">
                    <tr className="flex">
                      <th className="w-48 font-normal tracking-wide">ROLE NAME</th>
                      <th className="flex-1 font-normal tracking-wide">PERMISSIONS</th>
                      <th className="w-20 font-normal tracking-wide text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="flex flex-col gap-2">
                    {roles.map(r => (
                      <tr key={r.id} className="flex items-center glass-panel p-2 rounded-lg hover:border-white/20 transition-all border border-transparent">
                        <td className="w-48 px-4 font-mono text-orange-200">{r.name}</td>
                        <td className="flex-1 px-4 text-xs font-mono text-gray-400">{(JSON.parse(r.permissions||'[]')).join(', ') || 'None'}</td>
                        <td className="w-20 px-4 text-right flex gap-2 justify-end">
                          <button onClick={() => openRoleForm(r)} className="p-2 text-blue-400 hover:bg-blue-400/20 rounded transition-all">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteRole(r.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-all">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {roles.length === 0 && <div className="text-gray-500 p-4 font-mono text-center">No custom roles defined.</div>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
              <div className="p-4 bg-black/40 border-b border-white/5 flex items-center gap-2">
                <Users size={18} className="text-orange-400" />
                <h3 className="font-bold font-mono tracking-widest">AGENT MANAGEMENT</h3>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400 mb-4 block">
                    <tr className="flex">
                      <th className="flex-1 font-normal tracking-wide">EMAIL</th>
                      <th className="w-32 font-normal tracking-wide">ROLE</th>
                      <th className="w-32 font-normal tracking-wide">PLAN</th>
                      <th className="w-40 font-normal tracking-wide">JOIN DATE</th>
                      <th className="w-20 font-normal tracking-wide text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="flex flex-col gap-2">
                    {users.map(u => (
                      <tr key={u.id} className="flex items-center glass-panel p-2 rounded-lg hover:border-white/20 transition-all border border-transparent">
                        <td className="flex-1 px-4">{u.email}</td>
                        <td className="w-32 px-4">
                          <select 
                            value={u.role} 
                            onChange={(e) => handleUpdateUser(u.id, e.target.value, u.subscriptionPlan)}
                            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs outline-none"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                          </select>
                        </td>
                        <td className="w-32 px-4">
                          <select 
                            value={u.subscriptionPlan} 
                            onChange={(e) => handleUpdateUser(u.id, u.role, e.target.value)}
                            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs outline-none"
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="team">Team</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </td>
                        <td className="w-40 px-4 text-gray-500 font-mono text-xs">{new Date(u.createdAt).toISOString().split('T')[0]}</td>
                        <td className="w-20 px-4 text-right">
                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-all">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'branding' && (
          <motion.div key="branding" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="glass-panel p-8 rounded-2xl border-white/5 max-w-2xl">
               <h3 className="font-bold font-mono text-xl mb-2 flex items-center gap-2">
                 <ImageIcon className="text-orange-400" />
                 BRAND ASSETS
               </h3>
               <p className="text-gray-400 text-sm mb-8">Upload global branding constraints, company logos, and platform visual configurations here.</p>
               
               <div className="space-y-6">
                 <div>
                   <label className="block text-sm font-bold text-gray-300 mb-2">Upload Platform Logo</label>
                   <label className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-white/5 transition-all hover:border-orange-500/50 cursor-pointer overflow-hidden relative min-h-[160px]">
                      {globalLogo ? (
                         <img src={globalLogo} alt="Logo preview" className="absolute inset-0 w-full h-full object-contain p-4" />
                      ) : (
                         <>
                           <ImageIcon size={32} className="text-gray-500 mb-4" />
                           <span className="text-sm font-bold group-hover:text-white">Click to upload logo files (PNG, SVG)</span>
                         </>
                      )}
                      <input type="file" accept="image/*" className="hidden" tabIndex={-1} onChange={(e) => handleImageRead(e, setGlobalLogo)} />
                   </label>
                   {globalLogo && <button onClick={() => setGlobalLogo('')} className="text-xs text-red-500 mt-2 hover:underline">Remove Logo</button>}
                 </div>
                 
                 <div>
                   <label className="block text-sm font-bold text-gray-300 mb-2">Upload Global Favicon (ICO, PNG)</label>
                   <label className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-white/5 transition-all hover:border-orange-500/50 cursor-pointer overflow-hidden relative min-h-[160px]">
                      {globalFavicon ? (
                         <img src={globalFavicon} alt="Favicon preview" className="absolute inset-0 w-16 h-16 m-auto object-contain p-1 rounded" />
                      ) : (
                         <>
                           <ImageIcon size={32} className="text-gray-500 mb-4" />
                           <span className="text-sm font-bold group-hover:text-white">Click to upload favicon</span>
                         </>
                      )}
                      <input type="file" accept="image/*" className="hidden" tabIndex={-1} onChange={(e) => handleImageRead(e, setGlobalFavicon)} />
                   </label>
                   {globalFavicon && <button onClick={() => setGlobalFavicon('')} className="text-xs text-red-500 mt-2 hover:underline">Remove Favicon</button>}
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Global UI Primary Color</label>
                    <div className="flex gap-4 border border-white/10 rounded-lg p-3 bg-black/40">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="bg-transparent border-0 w-8 h-8 rounded shrink-0 cursor-pointer" />
                      <div className="flex-1 border-l border-white/10 pl-4 flex items-center">
                        <p className="text-xs text-gray-400 font-mono uppercase">{primaryColor} - Used for accent and glows</p>
                      </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Global UI Secondary Color</label>
                    <div className="flex gap-4 border border-white/10 rounded-lg p-3 bg-black/40">
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="bg-transparent border-0 w-8 h-8 rounded shrink-0 cursor-pointer" />
                      <div className="flex-1 border-l border-white/10 pl-4 flex items-center">
                        <p className="text-xs text-gray-400 font-mono uppercase">{secondaryColor} - Used for backgrounds and dark accents</p>
                      </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Global Background Gradient (CSS override)</label>
                    <input 
                       type="text" 
                       value={globalGradient}
                       onChange={e => setGlobalGradient(e.target.value)}
                       placeholder="e.g. linear-gradient(to right, #000, #333)" 
                       className="w-full bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm outline-none focus:border-orange-500/50 transition-all"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">Typography Setup</label>
                    <select 
                       value={globalFont}
                       onChange={e => setGlobalFont(e.target.value)}
                       className="w-full bg-black/40 border border-white/10 rounded-lg p-3 outline-none focus:border-orange-500/50 transition-all"
                    >
                       <option value="Inter">Inter (System Default)</option>
                       <option value="JetBrains Mono">JetBrains Mono</option>
                       <option value="Space Grotesk">Space Grotesk</option>
                       <option value="Playfair Display">Playfair Display</option>
                    </select>
                 </div>

               </div>
               
               <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                 <button onClick={handleSaveBrandSettings} disabled={savingSettings} className="px-6 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-lg transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] disabled:opacity-50 flex items-center gap-2">
                   {savingSettings ? <span className="animate-pulse">Saving...</span> : <><Save size={18} /> Save Brand Settings</>}
                 </button>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {showRoleForm && (
          <div className="fixed inset-0 min-h-screen bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowRoleForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel max-w-lg w-full p-6 rounded-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4 font-mono flex items-center gap-2">
                <Shield size={20} className="text-orange-400" /> {editingRole ? 'EDIT ROLE' : 'CREATE ROLE'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">ROLE NAME</label>
                  <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g. manager" className="w-full bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-sm outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">DESCRIPTION</label>
                  <input type="text" value={roleDesc} onChange={e => setRoleDesc(e.target.value)} placeholder="Role description..." className="w-full bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-sm outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">PERMISSIONS (Comma separated strings)</label>
                  <input type="text" value={rolePerms.join(', ')} onChange={e => setRolePerms(e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="vault:read, users:manage" className="w-full bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-sm outline-none focus:border-orange-500/50" />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end gap-3">
                <button onClick={() => setShowRoleForm(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg font-bold transition-all">Cancel</button>
                <button onClick={handleSaveRole} disabled={!roleName} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black rounded-lg font-bold transition-all disabled:opacity-50">Save Role</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
