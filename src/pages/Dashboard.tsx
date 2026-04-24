import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { encryptData, decryptData, deriveKey } from '../lib/crypto';
import { Plus, Key, Eye, EyeOff, Save, Trash2, Camera, Upload, LogOut, Code, Palette, QrCode, Copy, Check, Edit2, Fingerprint, Image as ImageIcon, ChevronDown, ChevronUp, Download, FileText, AlertTriangle, CreditCard, Shield, User, History } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { QRCodeSVG } from 'qrcode.react';
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
  const [tags, setTags] = useState('');
  const [secretData, setSecretData] = useState('');
  
  // Structured form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCustomFields, setFormCustomFields] = useState<{key:string, value:string}[]>([]);
  const [formMode, setFormMode] = useState<'structured'|'raw'>('structured');

  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    if (appError) {
      const timer = setTimeout(() => setAppError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [appError]);


  const CATEGORIES = [
    { value: 'API_KEY', label: 'API Key' },
    { value: 'PASSWORD', label: 'Password' },
    { value: 'NOTE', label: 'Secure Note' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'SOFTWARE_LICENSE', label: 'Software License' },
    { value: 'MEMBERSHIP', label: 'Membership' }
  ];

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkTags, setBulkTags] = useState("");

  const toggleSelect = (id: string) => setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    if (!confirm("Are you sure you want to delete selected items?")) return;
    try {
      await fetch('/api/vault/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems })
      });
      setSelectedItems([]);
      fetchItems();
    } catch(e) {
      console.error(e);
    }
  };

  const handleBulkUpdate = async () => {
    try {
      await fetch('/api/vault/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems, category: bulkCategory, addTags: bulkTags })
      });
      setShowBulkEdit(false);
      setSelectedItems([]);
      fetchItems();
    } catch(e) {
      console.error(e);
    }
  };

  // Inactivity auto-lock
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      // Auto-lock after 5 minutes (300,000 ms)
      timeout = setTimeout(() => {
        if (useAuthStore.getState().encryptionKey) {
          useAuthStore.getState().setEncryptionKey(null);
        }
      }, 300000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, []);

  useEffect(() => {
    fetchItems();
  }, [encryptionKey]);

  const fetchItems = async () => {
    if (!encryptionKey) return;
    try {
      const res = await fetch('/api/vault');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Network error');

      // Decrypt all items
      const decryptedItems = await Promise.all(data.vaults.map(async (item: VaultItem) => {
        try {
           const decrypted = await decryptData(item.encryptedData, encryptionKey);
           return { ...item, decryptedData: decrypted, decryptionFailed: false };
        } catch(e) {
           console.error(`[Decryption Error] Failed to decrypt asset #${item.id} (${item.title}):`, e);
           setAppError(`Decryption failed for asset: ${item.title}`);
           return { ...item, decryptedData: "Encrypted Payload (Locked)", decryptionFailed: true };
        }
      }));
      setItems(decryptedItems);
    } catch (e: any) {
      console.error(e);
      setAppError(`Fetch failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();

    let finalData = secretData;
    if (formMode === 'structured') {
      const obj = {
        _qcv_schema: '1.0',
        username: formUsername,
        password: formPassword,
        url: formUrl,
        notes: formNotes,
        custom: formCustomFields
      };
      finalData = JSON.stringify(obj);
    }

    if (!encryptionKey || !title || (!finalData && formMode === 'raw')) return;
    
    setLoading(true);
    try {
      const encrypted = await encryptData(finalData, encryptionKey);
      
      if (editingId) {
        await fetch(`/api/vault/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, category, tags: tags, encryptedData: encrypted
          })
        });
      } else {
        await fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title, category, tags: tags, encryptedData: encrypted
          })
        });
      }
      
      setShowAdd(false);
      setEditingId(null);
      setTitle('');
      setSecretData('');
      setFormUsername('');
      setFormPassword('');
      setFormUrl('');
      setFormNotes('');
      setFormCustomFields([]);
      setFormMode('structured');
      setTags('');

      fetchItems();
      setAppError(null);
    } catch(e: any) {
      console.error(e);
      setAppError(`Failed to save: ${e.message}`);
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      fetchItems();
    } catch (e: any) {
      console.error(e);
      setAppError(`Delete failed: ${e.message}`);
      setLoading(false);
    }
  };

  const handleEdit = (item: VaultItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setTags(item.tags || '');

    try {
      const parsed = JSON.parse(item.decryptedData || '');
      if (parsed?._qcv_schema) {
         setFormMode('structured');
         setFormUsername(parsed.username || '');
         setFormPassword(parsed.password || '');
         setFormUrl(parsed.url || '');
         setFormNotes(parsed.notes || '');
         setFormCustomFields(parsed.custom || []);
         setSecretData('');
      } else {
         setFormMode('raw');
         setSecretData(item.decryptedData || '');
      }
    } catch {
       setFormMode('raw');
       setSecretData(item.decryptedData || '');
    }

    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      if (file.type.startsWith('image/')) {
        const result = await Tesseract.recognize(file, 'eng');
        const text = result.data.text.trim();
        if (formMode === 'structured') setFormNotes(prev => prev + (prev ? '\n' : '') + text);
        else setSecretData(prev => prev + (prev ? '\n' : '') + text);
        if (!title) setTitle('OCR Extracted');
      } else if (file.name.endsWith('.env') || file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.yml') || file.name.endsWith('.yaml') || file.name.endsWith('.txt')) {
        const text = await file.text();
        if (formMode === 'structured') setFormNotes(prev => prev + (prev ? '\n' : '') + text);
        else setSecretData(prev => prev + (prev ? '\n' : '') + text);
        if(!title) setTitle('File Import');
      } else {
        // Send to backend extractor
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/vault/extract-file', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok) {
           if (formMode === 'structured') setFormNotes(prev => prev + (prev ? '\n' : '') + data.text);
           else setSecretData(prev => prev + (prev ? '\n' : '') + data.text);
           if (!title) setTitle('File Extract: ' + file.name);
        } else {
           throw new Error(data.error);
        }
      }
    } catch (err: any) {
      console.error("File Processing Failed", err);
      setAppError(`Processing Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEnvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    if(imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
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
      
      setAppError("Biometric device registered successfully");
    } catch(e: any) {
      setAppError("Biometric registration failed: " + e.message);
    } finally {
      setRegisteringBiometric(false);
    }
  };

  const handleExportVault = () => {
    // Generate secure backup of encrypted items directly (Zero trust context preserved)
    const exportData = items.map(i => ({
      title: i.title,
      category: i.category,
      tags: i.tags,
      encryptedData: i.encryptedData
    }));
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qcv_vault_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        setLoading(true);
        for (const item of parsed) {
          if (item.title && item.encryptedData && item.category) {
            await fetch('/api/vault', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.title,
                category: item.category,
                tags: item.tags || '',
                encryptedData: item.encryptedData
              })
            });
          }
        }
        await fetchItems();
        setAppError('Vault imported successfully!');
      } else {
        throw new Error("Invalid format");
      }
    } catch(err: any) {
      setAppError(`Import failed: ${err.message || 'Invalid backup file format'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !unlockPassword) return;
    setUnlocking(true);
    try {
      const key = await deriveKey(unlockPassword, user.email);
      useAuthStore.getState().setEncryptionKey(key);
      setUnlockPassword('');
    } catch(e: any) {
      setAppError("Failed to unlock. Incorrect Master Password or corrupted data.");
    } finally {
      setUnlocking(false);
    }
  };

  if (!encryptionKey && user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 mt-[60px]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-8 rounded-2xl w-full max-w-md text-center">
          <Key size={48} className="mx-auto text-yellow-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4 font-mono text-white">VAULT LOCKED</h2>
          <p className="text-sm text-gray-300 mb-6">
            Your vault is locked due to inactivity or missing key. Please enter your Master Password to decrypt your vault.
          </p>
          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            <input 
              type="password" 
              placeholder="Master Password" 
              className="w-full p-4 bg-black/40 border border-white/10 rounded-xl focus:border-[var(--glow-color)] outline-none"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={unlocking} className="w-full py-3 rounded-lg bg-[var(--glow-color)] hover:opacity-80 transition-opacity font-bold text-black disabled:opacity-50">
              {unlocking ? 'Decrypting...' : 'Unlock Vault'}
            </button>
            <button type="button" onClick={() => { logout(); window.location.href='/login'; }} className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all font-bold mt-2">
              Logout
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const THEMES = [
    { id: 'neon-blue', name: 'Neon Blue', background: 'linear-gradient(135deg, #020024 0%, #090979 35%, #00d4ff 100%)' },
    { id: 'cyber-purple', name: 'Cyber Purple', background: 'radial-gradient(circle at top right, #3b0764, #000000)' },
    { id: 'emerald-matrix', name: 'Emerald Matrix', background: 'linear-gradient(to bottom right, #064e3b, #000000)' },
    { id: 'sunset-gradient', name: 'Sunset Gradient', background: 'linear-gradient(45deg, #7f1d1d, #c2410c, #000000)' },
    { id: 'quantum-prism', name: 'Quantum Prism', background: 'linear-gradient(270deg, #1e1b4b, #312e81, #0f172a, #000000)' },
    { id: 'cosmic-void', name: 'Cosmic Void', background: 'radial-gradient(circle at bottom center, #2e0854, #000510)' }
  ];

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full relative">
      <AnimatePresence>
        {appError && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -50 }} 
            className="fixed top-4 right-4 z-50 bg-red-500/20 backdrop-blur-md border border-red-500 max-w-sm w-full p-4 rounded-lg shadow-lg flex items-start gap-3"
          >
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <div className="flex-1 text-sm text-red-200 font-medium">
              {appError}
            </div>
            <button onClick={() => setAppError(null)} className="text-red-400 hover:text-white transition-colors">
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex justify-between items-center mb-8 glass-panel p-4 rounded-2xl">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-tight">QCV Nexus</h1>
          <p className="text-sm text-gray-400">Agent: {user?.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowBiometricModal(true)} className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-xs hidden sm:block font-bold">
            Register Biometric Device
          </button>
          <button onClick={() => setShowThemePanel(!showThemePanel)} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <Palette size={20} />
          </button>
          <button onClick={() => { logout(); window.location.href='/'; }} className="p-2 hover:bg-red-500/20 text-red-300 rounded-full transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showBiometricModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="glass-panel p-8 rounded-2xl max-w-sm w-full flex flex-col items-center border-[var(--glow-color)]">
               <Fingerprint size={48} className="text-[var(--glow-color)] mb-4 animate-pulse" />
               <h3 className="text-xl font-bold font-mono mb-2">Passwordless Login</h3>
               <p className="text-sm text-gray-400 text-center mb-6">
                 Register your device's biometric sensor (Touch ID, Face ID, Windows Hello) or a hardware token to enable secure passwordless login.
               </p>
               <div className="w-full space-y-3">
                 <button onClick={handleRegisterBiometric} disabled={registeringBiometric} className="w-full py-3 bg-white/10 text-white rounded-lg font-bold border border-[var(--glow-color)] hover:bg-white/20 transition-all flex justify-center items-center gap-2">
                   {registeringBiometric ? <span className="animate-pulse">Waiting for sensor...</span> : "Start Registration"}
                 </button>
                 <button onClick={() => setShowBiometricModal(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-lg font-bold transition-all text-sm">
                   Cancel
                 </button>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showThemePanel && (
          <motion.div initial={{opacity:0, y:-10, scale: 0.95}} animate={{opacity:1, y:0, scale: 1}} exit={{opacity:0, y:-10, scale: 0.95}} className="glass-panel p-6 mb-6 rounded-2xl">
            <h3 className="text-sm font-bold text-gray-300 mb-4 font-mono tracking-wider">SELECT AESTHETIC</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {THEMES.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setTheme(t.id as any)} 
                  className={`group relative flex flex-col items-center gap-2 p-2 rounded-xl border transition-all duration-300 ${theme === t.id ? 'border-[var(--glow-color)] bg-white/10 shadow-[0_0_20px_var(--glow-color)] text-white' : 'border-white/5 hover:border-white/20 hover:bg-white/5 text-gray-400'}`}
                >
                  <div 
                    className="w-full h-16 rounded-lg shadow-inner flex items-center justify-center transition-transform duration-300 group-hover:scale-105" 
                    style={{ background: t.background, backgroundSize: t.id === 'quantum-prism' ? '400% 400%' : 'auto' }}
                  >
                    {theme === t.id && <Check size={20} className="text-white drop-shadow-md" />}
                  </div>
                  <span className="text-xs font-bold tracking-wide whitespace-nowrap">{t.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold font-mono">ENCRYPTED ASSETS</h2>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-white/5 hover:bg-white/10 transition-all rounded-lg flex items-center gap-2 font-bold backdrop-blur-md cursor-pointer border border-white/10" title="Import Vault Backup relative to your key">
            <Upload size={18} /> Import
            <input type="file" className="hidden" accept=".json" onChange={handleImportVault} />
          </label>
          <button onClick={handleExportVault} className="px-4 py-2 bg-white/5 hover:bg-white/10 transition-all rounded-lg flex items-center gap-2 font-bold backdrop-blur-md border border-white/10" title="Export Secure Encrypted Vault JSON">
            <Download size={18} /> Export
          </button>
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
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
            <form onSubmit={handleAdd} className="glass-panel p-6 rounded-2xl space-y-4 border-[var(--glow-color)]">
              <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                <h3 className="font-bold text-lg">{editingId ? 'Edit Asset' : 'New Encrypted Asset'}</h3>
                <div className="flex gap-2 bg-black/40 p-1 rounded-lg">
                  <button type="button" onClick={() => setFormMode('structured')} className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${formMode === 'structured' ? 'bg-[var(--glow-color)] text-black' : 'hover:bg-white/10'}`}>Structured</button>
                  <button type="button" onClick={() => setFormMode('raw')} className={`px-4 py-1.5 rounded text-sm font-bold transition-all ${formMode === 'raw' ? 'bg-[var(--glow-color)] text-black' : 'hover:bg-white/10'}`}>Raw Text</button>
                </div>
              </div>
              
              <div className="flex gap-4">
                <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Asset Title (e.g. Prod DB)" className="flex-1 p-3 rounded-lg bg-black/40 border border-white/5 focus:border-[var(--glow-color)] outline-none transition-all" />
                <select value={category} onChange={e=>setCategory(e.target.value)} className="p-3 rounded-lg w-48 bg-black/40 border border-white/5 outline-none focus:border-[var(--glow-color)] transition-all">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-black text-white">{c.label}</option>)}
                </select>
              </div>

              {formMode === 'structured' ? (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1">USERNAME</label>
                      <input value={formUsername} onChange={e=>setFormUsername(e.target.value)} className="w-full p-3 rounded-lg bg-black/40 border border-white/5 focus:border-[var(--glow-color)] outline-none transition-all" placeholder="admin, ops, etc." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1">PASSWORD / TOKEN</label>
                      <div className="relative">
                        <input type="password" value={formPassword} onChange={e=>setFormPassword(e.target.value)} className="w-full p-3 rounded-lg bg-black/40 border border-white/5 focus:border-[var(--glow-color)] outline-none transition-all pr-10 font-mono text-sm" placeholder="••••••••" />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 mb-1">LOGIN URL / CONNECTION STRING</label>
                      <input value={formUrl} onChange={e=>setFormUrl(e.target.value)} className="w-full p-3 rounded-lg bg-black/40 border border-white/5 focus:border-[var(--glow-color)] outline-none transition-all font-mono text-sm" placeholder="https://" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-400">ADDITIONAL CUSTOM FIELDS</label>
                      <button type="button" onClick={() => setFormCustomFields([...formCustomFields, {key:'', value:''}])} className="text-xs text-[var(--glow-color)] hover:underline">+ Add Field</button>
                    </div>
                    {formCustomFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center">
                        <input value={field.key} onChange={e => {
                          const nf = [...formCustomFields];
                          nf[idx].key = e.target.value;
                          setFormCustomFields(nf);
                        }} placeholder="Key" className="w-1/3 p-2 rounded-lg bg-black/40 border border-white/5 focus:border-[var(--glow-color)] outline-none transition-all text-sm font-mono" />
                        <input value={field.value} onChange={e => {
                          const nf = [...formCustomFields];
                          nf[idx].value = e.target.value;
                          setFormCustomFields(nf);
                        }} placeholder="Value" className="flex-1 p-2 rounded-lg bg-black/40 border border-white/5 focus:border-[var(--glow-color)] outline-none transition-all text-sm font-mono" />
                        <button type="button" onClick={() => setFormCustomFields(formCustomFields.filter((_, i) => i !== idx))} className="p-2 text-red-500 hover:bg-red-500/20 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-400 mb-1">SECURE NOTES / FILE EXTRACTS</label>
                    <textarea value={formNotes} onChange={e=>setFormNotes(e.target.value)} onDragOver={handleDragOver} onDrop={handleDrop} placeholder="Paste secret data here or drag & drop an image/.env/pdf/docx to extract content..." className="w-full p-4 pt-12 rounded-lg min-h-[160px] font-mono text-sm border-2 border-white/5 focus:border-[var(--glow-color)] outline-none transition-all resize-y" />
                    <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-dashed border-transparent transition-all peer-dragover:border-[var(--glow-color)] peer-dragover:bg-white/5"></div>
                    
                    <div className="absolute top-8 right-2 flex gap-2 z-10">
                      <button type="button" onClick={() => setShowQRScanner(true)} className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-lg cursor-pointer transition-all border border-white/10 text-xs font-bold" title="Scan QR Code via Camera">
                        <QrCode size={14} className="text-purple-400" /> <span className="hidden sm:inline">Scan QR</span>
                      </button>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-lg cursor-pointer transition-all border border-white/10 text-xs font-bold" title="Extract text via OCR from Image">
                        <ImageIcon size={14} className="text-orange-400" /> <span className="hidden sm:inline">Image OCR</span>
                        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageOCR} />
                      </label>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-lg cursor-pointer transition-all border border-white/10 text-xs font-bold" title="Upload document (.pdf, .docx, .env, .txt)">
                        <Upload size={14} className="text-blue-400" /> <span className="hidden sm:inline">Extract File</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".env,text/plain,.json,.md,.csv,.pdf,.docx,.xlsx" onChange={handleEnvUpload} />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <textarea required value={secretData} onChange={e=>setSecretData(e.target.value)} onDragOver={handleDragOver} onDrop={handleDrop} placeholder="Paste raw secret data here or drag & drop files to extract..." className="w-full p-4 pt-12 rounded-lg min-h-[160px] font-mono text-sm border-2 border-white/5 focus:border-[var(--glow-color)] outline-none transition-all resize-y" />
                  <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-dashed border-transparent transition-all peer-dragover:border-[var(--glow-color)] peer-dragover:bg-white/5"></div>
                  
                  <div className="absolute top-2 right-2 flex gap-2 z-10">
                    <button type="button" onClick={() => setShowQRScanner(true)} className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-lg cursor-pointer transition-all border border-white/10 text-xs font-bold" title="Scan QR Code via Camera">
                      <QrCode size={14} className="text-purple-400" /> <span className="hidden sm:inline">Scan QR</span>
                    </button>
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-lg cursor-pointer transition-all border border-white/10 text-xs font-bold" title="Extract text via OCR from Image">
                      <ImageIcon size={14} className="text-orange-400" /> <span className="hidden sm:inline">Image OCR</span>
                      <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageOCR} />
                    </label>
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-black/50 hover:bg-black/80 rounded-lg cursor-pointer transition-all border border-white/10 text-xs font-bold" title="Upload document (.pdf, .docx, .env, .txt)">
                      <Upload size={14} className="text-blue-400" /> <span className="hidden sm:inline">Extract File</span>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".env,text/plain,.json,.md,.csv,.pdf,.docx,.xlsx" onChange={handleEnvUpload} />
                    </label>
                  </div>
                </div>
              )}

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

      <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10 w-full glass-panel p-4 rounded-xl items-center">
        <input 
          type="text" 
          placeholder="Search encrypted assets..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 p-3 bg-black/40 border border-white/10 rounded-lg focus:border-[var(--glow-color)] outline-none transition-all w-full"
        />
        <select 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value)}
          className="p-3 bg-black/40 border border-white/10 rounded-lg outline-none transition-all w-full sm:w-48 appearance-none"
        >
          <option value="ALL" className="bg-black text-white">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-black text-white">{c.label}</option>)}
        </select>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10 w-full bg-[var(--glow-color)]/20 border border-[var(--glow-color)] p-4 rounded-xl items-center">
          <span className="font-bold text-[var(--glow-color)] font-mono">{selectedItems.length} items selected</span>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            <button onClick={() => setShowBulkEdit(true)} className="px-4 py-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-all text-sm font-bold whitespace-nowrap">Edit Tags/Category</button>
            <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-black rounded-lg transition-all text-sm font-bold whitespace-nowrap">Delete Selected</button>
            <button onClick={() => setSelectedItems([])} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-sm whitespace-nowrap">Cancel</button>
          </div>
        </div>
      )}

      {showBulkEdit && (
        <div className="fixed inset-0 min-h-screen bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowBulkEdit(false)}>
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 font-mono text-[var(--glow-color)]">Bulk Edit ({selectedItems.length} items)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">NEW CATEGORY (Optional)</label>
                <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg p-3 outline-none focus:border-[var(--glow-color)] appearance-none">
                  <option value="" className="bg-black text-white">Leave unchanged</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-black text-white">{c.label}</option>)}
                </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-gray-400 mb-1">ADD TAGS (Comma separated)</label>
                 <input type="text" value={bulkTags} onChange={(e) => setBulkTags(e.target.value)} placeholder="e.g. archived, legacy" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm outline-none focus:border-[var(--glow-color)] transition-all"/>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end gap-3">
              <button onClick={() => setShowBulkEdit(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-all">Cancel</button>
              <button onClick={handleBulkUpdate} className="px-6 py-2 bg-[var(--glow-color)] text-black hover:brightness-110 rounded-lg font-bold transition-all shadow-[0_0_15px_var(--glow-color)]">Apply Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && items.length === 0 ? (
           <div className="col-span-full py-12 text-center text-gray-400 animate-pulse font-mono tracking-widest">DECRYPTING ASSETS...</div>
        ) : items.filter(item => {
           const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.tags.toLowerCase().includes(searchQuery.toLowerCase());
           const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
           return matchesSearch && matchesCategory;
        }).map((item, i) => (
          <VaultItemCard 
            key={item.id} 
            item={item} 
            index={i} 
            onEdit={() => handleEdit(item)} 
            onDelete={() => handleDelete(item.id)} 
            isSelected={selectedItems.includes(item.id)}
            onSelect={() => toggleSelect(item.id)}
          />
        ))}
        {!loading && items.length > 0 && items.filter(item => {
           const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.tags.toLowerCase().includes(searchQuery.toLowerCase());
           const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
           return matchesSearch && matchesCategory;
        }).length === 0 && (
           <div className="col-span-full py-12 text-center text-gray-500 font-mono">No matching assets found</div>
        )}
      </div>
    </div>
  );
}

function VaultItemCard({ item, index, onEdit, onDelete, isSelected, onSelect }: { item: VaultItem, index: number, onEdit: () => void, onDelete: () => void, isSelected?: boolean, onSelect?: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [decryptedHistory, setDecryptedHistory] = useState<Record<string, string>>({});

  // Auto-hide when collapsing
  useEffect(() => {
    if (!expanded) {
      setShow(false);
      setShowQR(false);
    }
  }, [expanded]);

  const loadHistory = async () => {
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/vault/${item.id}/versions`);
      const data = await res.json();
      if (res.ok && data.versions) {
        setVersions(data.versions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDecryptVersion = async (version: any) => {
    if (decryptedHistory[version.id]) return;
    try {
      const key = useAuthStore.getState().encryptionKey;
      if (!key) throw new Error("No key");
      const decrypted = await decryptData(version.encryptedData, key);
      setDecryptedHistory(prev => ({ ...prev, [version.id]: decrypted }));
    } catch (e) {
      setDecryptedHistory(prev => ({ ...prev, [version.id]: "Failed to decrypt" }));
    }
  };

  const handleRevert = async (version: any) => {
    try {
      const decrypted = decryptedHistory[version.id];
      if (!decrypted || decrypted === "Failed to decrypt") {
         alert("Please decrypt the version first by clicking on it before reverting.");
         return;
      }
      // Re-encrypt it or just send it to edit
      // It's simpler to ask the user to copy past or we can trigger api update.
      // Easiest: Call the PUT api directly to update data.
      const key = useAuthStore.getState().encryptionKey;
      if (!key) return;
      const reEncrypted = await encryptData(decrypted, key);
      const res = await fetch(`/api/vault/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          category: item.category,
          tags: item.tags,
          encryptedData: reEncrypted
        })
      });
      if (res.ok) {
        alert("Reverted successfully! Please refresh or the dashboard will reload automatically.");
        window.location.reload();
      }
    } catch(e: any) {
      alert("Failed to revert: " + e.message);
    }
  };

  const handleCopy = () => {
    if(item.decryptedData) {
      navigator.clipboard.writeText(item.decryptedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  let structuredData: any = null;
  try {
     const parsed = JSON.parse(item.decryptedData || '');
     if (parsed?._qcv_schema) structuredData = parsed;
  } catch {}

  const getMaskedString = (len: number) => "•".repeat(Math.min(len, 24));

  const getSnippet = () => {
     if(item.decryptionFailed) return "••••••••••••••••••••••••";
     if(!item.decryptedData) return "";
     
     if (structuredData) {
       if (structuredData.username) return show ? structuredData.username : getMaskedString(8);
       return show ? "Structured Data" : "••••••••";
     }

     if (item.category === 'PASSWORD') {
       // Passwords are never shown unmasked in snippet view
       return getMaskedString(item.decryptedData.length);
     }
     
     if(!show) {
        // Mask other items by default
        return getMaskedString(item.decryptedData.length);
     }
     
     // Shown snippet for non-passwords
     const data = item.decryptedData;
     return data.substring(0, 16) + (data.length > 16 ? "..." : "");
  };

  const showRevealToggle = true; // Always allow revealing structured data UI

  const renderStructuredData = () => {
    if (!structuredData) return null;
    return (
      <div className="space-y-3 mt-2 text-sm">
        {structuredData.username && (
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold tracking-wider">USERNAME</span>
            <span className="font-mono text-white break-all">{structuredData.username}</span>
          </div>
        )}
        {structuredData.password && (
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold tracking-wider">PASSWORD</span>
            <span className="font-mono text-[var(--glow-color)] break-all">{show ? structuredData.password : "••••••••••••"}</span>
          </div>
        )}
        {structuredData.url && (
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-bold tracking-wider">URL</span>
            <a href={structuredData.url.startsWith('http') ? structuredData.url : `https://${structuredData.url}`} target="_blank" className="font-mono text-blue-400 hover:underline break-all">{structuredData.url}</a>
          </div>
        )}
        {structuredData.custom && structuredData.custom.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {structuredData.custom.map((c: any, i: number) => (
               <div key={i} className="flex gap-2">
                 <span className="text-gray-400 font-bold border-r border-white/10 pr-2">{c.key}:</span>
                 <span className="font-mono text-white break-all">{show ? c.value : "••••"}</span>
               </div>
            ))}
          </div>
        )}
        {structuredData.notes && (
          <div className="flex flex-col mt-3 border-t border-white/5 pt-2">
            <span className="text-[10px] text-gray-500 font-bold tracking-wider mb-1">NOTES / RAW</span>
            <span className="font-mono text-gray-300 break-all whitespace-pre-wrap text-xs">{show ? structuredData.notes : "••••••••"}</span>
          </div>
        )}
      </div>
    );
  };

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'PASSWORD': return <Key size={16} className="text-yellow-400" />;
      case 'API_KEY': return <Code size={16} className="text-blue-400" />;
      case 'NOTE': return <FileText size={16} className="text-green-400" />;
      case 'CREDIT_CARD': return <CreditCard size={16} className="text-orange-400" />;
      case 'SOFTWARE_LICENSE': return <Shield size={16} className="text-purple-400" />;
      case 'MEMBERSHIP': return <User size={16} className="text-pink-400" />;
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, boxShadow: "0 25px 30px -12px rgba(0,0,0,0.5)" }}
      className={`glass-panel p-5 pl-12 rounded-2xl flex flex-col group relative overflow-hidden transition-all ${isSelected ? 'border-[var(--glow-color)] bg-[var(--glow-color)]/10' : ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--glow-color)] to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl pointer-events-none"></div>

      <div className={`absolute top-5 left-4 z-20 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); onSelect && onSelect(); }} 
          className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-[var(--glow-color)] border-[var(--glow-color)] text-black' : 'border-white/30 hover:border-white/60'}`}
        >
          {isSelected && <Check size={14} />}
        </button>
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 bg-black/95 z-30 flex flex-col items-center justify-center p-4 rounded-2xl backdrop-blur-md">
          <p className="text-white text-sm mb-4 text-center font-bold">Purge this asset permanently?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all">Cancel</button>
            <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="px-4 py-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-xs text-white font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]">Confirm Purge</button>
          </div>
        </div>
      )}

      {showQR && item.decryptedData && (
        <div className="fixed inset-0 min-h-screen bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="glass-panel p-8 rounded-2xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-6 font-mono border-b border-white/10 pb-2 w-full text-center">Scan to Import</h3>
            <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)]">
               <QRCodeSVG value={item.decryptedData} size={200} level="H" includeMargin={false} />
            </div>
            <button onClick={() => setShowQR(false)} className="mt-8 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-all">Close</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-4 z-10">
        <div className="flex gap-3">
          <div className="mt-1 p-2 bg-white/5 rounded-lg border border-white/10">
            {getCategoryIcon()}
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">{item.title}</h3>
            <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">{item.category}</span>
          </div>
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
          {expanded && show ? (structuredData ? renderStructuredData() : item.decryptedData) : getSnippet()}
        </div>
        
        <div className={`absolute right-2 flex flex-col gap-1 transition-all ${expanded ? 'top-2 opacity-100' : 'top-2 opacity-0 group-hover/secret:opacity-100'}`}>
          {showRevealToggle && (
            <button onClick={() => setShow(!show)} className="p-1.5 hover:bg-white/20 rounded" title={show ? "Hide Secret" : "Show Secret"}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          {!item.decryptionFailed && (
            <button onClick={() => setShowQR(true)} className="p-1.5 hover:bg-white/20 rounded disabled:opacity-50" title="Show QR Code">
              <QrCode size={14} />
            </button>
          )}
          {!item.decryptionFailed && (
            <button onClick={handleCopy} className="p-1.5 hover:bg-white/20 rounded disabled:opacity-50" title="Copy to Clipboard" disabled={copied}>
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          )}
          {!item.decryptionFailed && (
            <button onClick={loadHistory} className="p-1.5 hover:bg-white/20 rounded disabled:opacity-50" title="Version History">
              <History size={14} />
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

      {showHistory && (
        <div className="fixed inset-0 min-h-screen bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="glass-panel max-w-2xl w-full p-6 rounded-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 font-mono flex items-center gap-2">
              <History size={20} className="text-[var(--glow-color)]" /> Version History
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {loadingHistory ? (
                 <div className="text-gray-400 font-mono animate-pulse">Loading history...</div>
              ) : versions.length === 0 ? (
                 <div className="text-gray-500 font-mono">No previous versions found.</div>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="bg-black/40 border border-white/10 rounded-xl p-4 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400 font-mono">Version from {new Date(v.createdAt).toLocaleString()}</span>
                      {decryptedHistory[v.id] && decryptedHistory[v.id] !== "Failed to decrypt" && (
                         <button onClick={() => handleRevert(v)} className="text-xs bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-black px-3 py-1 rounded transition-all font-bold">
                           Revert to this
                         </button>
                      )}
                    </div>
                    {decryptedHistory[v.id] ? (
                       <pre className="text-sm font-mono text-gray-300 break-all whitespace-pre-wrap mt-2">{decryptedHistory[v.id]}</pre>
                    ) : (
                       <button onClick={() => handleDecryptVersion(v)} className="text-sm text-[var(--glow-color)] hover:underline mt-2">
                         Click to decrypt this version
                       </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button onClick={() => setShowHistory(false)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
