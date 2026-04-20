import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { encryptData, decryptData } from '../lib/crypto';
import { Plus, Key, Eye, EyeOff, Save, Trash2, Camera, Upload, LogOut, Code, Palette, QrCode, Copy, Check, Edit2, Fingerprint, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { useThemeStore } from '../store/themeStore';
import { QRScanner } from '../components/QRScanner';

interface VaultItem {
  id: string;
  title: string;
  category: string;
  tags: string;
  encryptedData: string;
  decryptedData?: string; // Client side only
  decryptionFailed?: boolean;
}

export function Dashboard() {
  const { user, encryptionKey, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [registeringBiometric, setRegisteringBiometric] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Item State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('API_KEY');
  const [secretData, setSecretData] = useState('');

  useEffect(() => {
    fetchItems();
  }, [encryptionKey]);

  const fetchItems = async () => {
    if (!encryptionKey) return;
    try {
      const res = await fetch('/api/vault');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Decrypt all items
      const decryptedItems = await Promise.all(data.vaults.map(async (item: VaultItem) => {
        try {
           const decrypted = await decryptData(item.encryptedData, encryptionKey);
           return { ...item, decryptedData: decrypted, decryptionFailed: false };
        } catch(e) {
           console.error(`[Decryption Error] Failed to decrypt asset #${item.id} (${item.title}):`, e);
           return { ...item, decryptedData: "Encrypted Payload (Locked)", decryptionFailed: true };
        }
      }));
      setItems(decryptedItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!encryptionKey || !title || !secretData) return;
    
    setLoading(true);
    try {
      const encrypted = await encryptData(secretData, encryptionKey);
      
      if (editingId) {
        await fetch(`/api/vault/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, category, tags: '', encryptedData: encrypted
          })
        });
      } else {
        await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, category, tags: '', encryptedData: encrypted
          })
        });
      }
      
      setShowAdd(false);
      setEditingId(null);
      setTitle('');
      setSecretData('');
      fetchItems();
    } catch(e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    await fetch(`/api/vault/${id}`, { method: 'DELETE' });
    fetchItems();
  };

  const handleEdit = (item: VaultItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setSecretData(item.decryptedData || '');
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleEnvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.env') || file.type === 'text/plain') {
      const text = await file.text();
      setSecretData(prev => prev + (prev ? '\n' : '') + text);
      if(!title) setTitle('Env File Import');
    }
  };

  const handleImageOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setLoading(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      setSecretData(prev => prev + (prev ? '\n' : '') + result.data.text.trim());
      if(!title) setTitle('OCR Extracted');
    } catch (err) {
      console.error("OCR Failed", err);
      alert("Failed to extract text from image.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBiometric = async () => {
    setRegisteringBiometric(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/auth/webauthn/register-options', { method: 'POST' });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error);

      const attResp = await startRegistration({ optionsJSON: options });
      
      const vRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attResp)
      });
      const vData = await vRes.json();
      if (!vRes.ok) throw new Error(vData.error);
      
      alert("Biometric device registered successfully");
    } catch(e: any) {
      alert("Biometric registration failed: " + e.message);
    } finally {
      setRegisteringBiometric(false);
    }
  };

  if (!encryptionKey && user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 mt-[60px]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-8 rounded-2xl w-full max-w-md text-center">
          <Key size={48} className="mx-auto text-yellow-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4 font-mono text-white">VAULT LOCKED</h2>
          <p className="text-sm text-gray-300 mb-6">
            You authenticated without your Master Key (e.g. Magic Link on a new device). To decrypt your vault, you must provide your Master Key.
          </p>
          <button onClick={() => { logout(); window.location.href='/login'; }} className="w-full py-3 rounded-lg bg-[var(--glow-color)] hover:bg-white/20 transition-all font-bold">
            Logout and Re-enter Key
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full relative">
      <header className="flex justify-between items-center mb-8 glass-panel p-4 rounded-2xl">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-tight">QCV Nexus</h1>
          <p className="text-sm text-gray-400">Agent: {user?.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleRegisterBiometric} disabled={registeringBiometric} className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-xs hidden sm:block font-bold">
            {registeringBiometric ? 'Registering...' : 'Register Biometric Device'}
          </button>
          <button onClick={() => setShowThemePanel(!showThemePanel)} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <Palette size={20} />
          </button>
          <button onClick={() => { logout(); window.location.href='/'; }} className="p-2 hover:bg-red-500/20 text-red-300 rounded-full transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {showThemePanel && (
        <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="glass-panel p-4 mb-4 rounded-xl flex gap-4 overflow-x-auto">
          {['neon-blue', 'cyber-purple', 'emerald-matrix', 'sunset-gradient', 'quantum-prism', 'cosmic-void'].map(t => (
            <button key={t} onClick={() => setTheme(t as any)} className={`px-4 py-2 rounded-lg whitespace-nowrap border ${theme === t ? 'border-[var(--glow-color)] bg-white/10' : 'border-white/10'}`}>
              {t.replace('-', ' ')}
            </button>
          ))}
        </motion.div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold font-mono">ENCRYPTED ASSETS</h2>
        <button onClick={() => {
          if (showAdd && !editingId) {
             setShowAdd(false);
          } else {
             setShowAdd(true);
             setEditingId(null);
             setTitle('');
             setSecretData('');
          }
        }} className="px-4 py-2 bg-[var(--glow-color)] hover:bg-white/20 transition-all rounded-lg flex items-center gap-2 font-bold backdrop-blur-md">
          <Plus size={18} /> New Asset
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
            <form onSubmit={handleAdd} className="glass-panel p-6 rounded-2xl space-y-4 border-[var(--glow-color)]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">{editingId ? 'Edit Asset' : 'New Encrypted Asset'}</h3>
              </div>
              <div className="flex gap-4">
                <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Asset Title" className="flex-1 p-3 rounded-lg" />
                <select value={category} onChange={e=>setCategory(e.target.value)} className="p-3 rounded-lg w-40">
                  <option value="API_KEY">API Key</option>
                  <option value="PASSWORD">Password</option>
                  <option value="NOTE">Secure Note</option>
                </select>
              </div>
              
              <div className="relative">
                <textarea required value={secretData} onChange={e=>setSecretData(e.target.value)} placeholder="Paste secret data here..." className="w-full p-4 rounded-lg min-h-[120px] font-mono text-sm" />
                
                <div className="absolute top-2 right-2 flex gap-2">
                  <button type="button" onClick={() => setShowQRScanner(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-all" title="Scan QR Code via Camera">
                    <QrCode size={16} />
                  </button>
                  <label className="p-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-all" title="Extract text via OCR from Image">
                    <ImageIcon size={16} />
                    <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageOCR} />
                  </label>
                  <label className="p-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-all" title="Upload .env or text file">
                    <Upload size={16} />
                    <input type="file" ref={fileInputRef} className="hidden" accept=".env,text/plain" onChange={handleEnvUpload} />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); setTitle(''); setSecretData(''); }} className="px-4 py-2 hover:bg-white/10 rounded-lg">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-[var(--glow-color)] rounded-lg font-bold flex items-center gap-2">
                  <Save size={16} /> {editingId ? 'Update & Encrypt' : 'Encrypt & Store'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {showQRScanner && (
        <QRScanner 
          onClose={() => setShowQRScanner(false)} 
          onScan={(data) => {
            setSecretData(prev => prev ? prev + '\n' + data : data);
            setTitle(prev => prev || 'QR Upload');
            setShowQRScanner(false);
          }} 
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && items.length === 0 ? (
           <div className="col-span-full py-12 text-center text-gray-400 animate-pulse font-mono tracking-widest">DECRYPTING ASSETS...</div>
        ) : items.map((item, i) => (
          <VaultItemCard key={item.id} item={item} index={i} onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item.id)} />
        ))}
      </div>
    </div>
  );
}

function VaultItemCard({ item, index, onEdit, onDelete }: { item: VaultItem, index: number, onEdit: () => void, onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    if(item.decryptedData) {
      navigator.clipboard.writeText(item.decryptedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSnippet = () => {
     if(item.decryptionFailed) return "••••••••••••••••••••••••";
     if(!item.decryptedData) return "";
     if(!show) return "••••••••••••••••••••••••";
     const data = item.decryptedData;
     return data.substring(0, 16) + (data.length > 16 ? "..." : "");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, boxShadow: "0 25px 30px -12px rgba(0,0,0,0.5)" }}
      className="glass-panel p-5 rounded-2xl flex flex-col group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--glow-color)] to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl pointer-events-none"></div>

      {confirmDelete && (
        <div className="absolute inset-0 bg-black/95 z-30 flex flex-col items-center justify-center p-4 rounded-2xl backdrop-blur-md">
          <p className="text-white text-sm mb-4 text-center font-bold">Purge this asset permanently?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all">Cancel</button>
            <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="px-4 py-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-xs text-white font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]">Confirm Purge</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="font-bold text-lg">{item.title}</h3>
          <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300 inline-block mt-1">{item.category}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={onEdit} className="text-gray-500 hover:text-white p-1 transition-all" title="Edit Asset">
            <Edit2 size={16} />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="text-gray-500 hover:text-red-400 p-1 transition-all" title="Delete Asset">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={`relative mt-auto z-10 bg-black/40 rounded-lg p-3 group/secret border ${item.decryptionFailed ? 'border-red-500/50' : 'border-white/5'} transition-all duration-300`}>
        <div className={`font-mono text-sm break-all pr-8 ${expanded ? 'h-auto max-h-[300px] overflow-y-auto' : 'h-10 overflow-hidden'} ${item.decryptionFailed && show ? 'text-red-400 font-bold' : ''}`}>
          {expanded && show ? item.decryptedData : getSnippet()}
        </div>
        
        <div className={`absolute right-2 flex flex-col gap-1 transition-all ${expanded ? 'top-2 opacity-100' : 'top-2 opacity-0 group-hover/secret:opacity-100'}`}>
          <button onClick={() => setShow(!show)} className="p-1.5 hover:bg-white/20 rounded" title={show ? "Hide Secret" : "Show Secret"}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {!item.decryptionFailed && (
            <button onClick={handleCopy} className="p-1.5 hover:bg-white/20 rounded disabled:opacity-50" title="Copy to Clipboard" disabled={copied}>
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          )}
        </div>
        
        {!item.decryptionFailed && item.decryptedData && item.decryptedData.length > 16 && (
           <button 
             onClick={() => setExpanded(!expanded)} 
             className="absolute bottom-1 right-2 p-1 text-gray-500 hover:text-white transition-all z-20"
             title={expanded ? "Collapse" : "Expand"}
           >
             {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
           </button>
        )}

        <AnimatePresence>
          {copied && (
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-2 right-12 text-xs text-green-400 font-bold bg-green-500/20 px-2 py-0.5 rounded z-20"
            >
              COPIED!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
