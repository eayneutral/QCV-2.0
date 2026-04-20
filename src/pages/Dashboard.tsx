import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { encryptData, decryptData } from '../lib/crypto';
import { Plus, Key, Eye, EyeOff, Save, Trash2, Camera, Upload, LogOut, Code, Palette, QrCode } from 'lucide-react';
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
}

export function Dashboard() {
  const { user, encryptionKey, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

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
           return { ...item, decryptedData: decrypted };
        } catch(e) {
           return { ...item, decryptedData: "DECRYPTION FAILED - INVALID KEY" };
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
      await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, category, tags: '', encryptedData: encrypted
        })
      });
      setShowAdd(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.env')) {
      const text = await file.text();
      setSecretData(prev => prev + '\n' + text);
      setTitle('Env File Import');
    } else if (file.type.startsWith('image/')) {
      // OCR processing
      setLoading(true);
      try {
        const result = await Tesseract.recognize(file, 'eng');
        setSecretData(prev => prev + '\n' + result.data.text);
        setTitle('OCR Extracted');
      } catch (err) {
        console.error("OCR Failed", err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full relative">
      <header className="flex justify-between items-center mb-8 glass-panel p-4 rounded-2xl">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-tight">QCV Nexus</h1>
          <p className="text-sm text-gray-400">Agent: {user?.email}</p>
        </div>
        <div className="flex items-center gap-4">
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
          {['neon-blue', 'cyber-purple', 'emerald-matrix', 'sunset-gradient', 'quantum-prism'].map(t => (
            <button key={t} onClick={() => setTheme(t as any)} className={`px-4 py-2 rounded-lg whitespace-nowrap border ${theme === t ? 'border-[var(--glow-color)] bg-white/10' : 'border-white/10'}`}>
              {t.replace('-', ' ')}
            </button>
          ))}
        </motion.div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold font-mono">ENCRYPTED ASSETS</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-[var(--glow-color)] hover:bg-white/20 transition-all rounded-lg flex items-center gap-2 font-bold backdrop-blur-md">
          <Plus size={18} /> New Asset
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
            <form onSubmit={handleAdd} className="glass-panel p-6 rounded-2xl space-y-4 border-[var(--glow-color)]">
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
                  <label className="p-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-all" title="Upload Image for OCR or .env file">
                    <Upload size={16} />
                    <input type="file" className="hidden" accept="image/*,.env" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-[var(--glow-color)] rounded-lg font-bold flex items-center gap-2">
                  <Save size={16} /> Encrypt & Store
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
          <VaultItemCard key={item.id} item={item} index={i} onDelete={() => handleDelete(item.id)} />
        ))}
      </div>
    </div>
  );
}

function VaultItemCard({ item, index, onDelete }: { item: VaultItem, index: number, onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if(item.decryptedData) {
      navigator.clipboard.writeText(item.decryptedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, boxShadow: "0 25px 30px -12px rgba(0,0,0,0.5)" }}
      className="glass-panel p-5 rounded-2xl flex flex-col group relative overflow-hidden"
    >
      {/* Animated gradient border on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--glow-color)] to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl pointer-events-none"></div>

      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="font-bold text-lg">{item.title}</h3>
          <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300 inline-block mt-1">{item.category}</span>
        </div>
        <button onClick={onDelete} className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="relative mt-auto z-10 bg-black/40 rounded-lg p-3 group/secret border border-white/5">
        <div className="font-mono text-sm break-all pr-8 h-10 overflow-hidden">
          {show ? item.decryptedData : "••••••••••••••••••••••••"}
        </div>
        
        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover/secret:opacity-100 transition-all">
          <button onClick={() => setShow(!show)} className="p-1.5 hover:bg-white/20 rounded">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={handleCopy} className="p-1.5 hover:bg-white/20 rounded">
            <Code size={14} className={copied ? "text-green-400" : ""} />
          </button>
        </div>
        
        {copied && <span className="absolute bottom-2 right-2 text-xs text-green-400 font-bold animate-bounce">COPIED</span>}
      </div>
    </motion.div>
  );
}
