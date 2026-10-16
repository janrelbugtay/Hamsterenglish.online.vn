import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Link as LinkIcon, Upload, Image as ImageIcon } from 'lucide-react';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mediaUrl: string) => void;
}

type Tab = 'giphy' | 'upload' | 'photos' | 'link';

export function MediaPickerModal({ isOpen, onClose, onSelect }: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('photos');
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setError("");
      setLinkUrl("");
      setActiveTab('photos');
    } else {
      // Auto-load starter photos
      searchPhotos('yoga poses animals');
    }
  }, [isOpen]);

  const searchPhotos = async (searchQuery?: string) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    setIsLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/photo-search?q=${encodeURIComponent(q || 'yoga')}`);
      const data = await res.json().catch(() => ({}));
      if (data.results) {
        setResults(data.results);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch photos");
    } finally {
      setIsLoading(false);
    }
  };

  const searchGiphy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/giphy-search?q=${encodeURIComponent(query || 'yoga')}`);
      const data = await res.json().catch(() => ({}));
      if (data.data) {
        setResults(data.data.map((item: any) => ({
          id: item.id,
          url: item.images?.fixed_height?.url || item.images?.original?.url,
          thumb: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url,
          title: item.title
        })));
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch GIFs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkUrl.trim()) {
      onSelect(linkUrl.trim());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("File is too large. Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onSelect(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <ImageIcon size={20} className="text-teal-600 dark:text-teal-400" />
            <span>Select Picture / Photo for Option</span>
          </h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button 
            type="button"
            onClick={() => { setActiveTab('photos'); setError(''); setQuery(''); searchPhotos('yoga pose'); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'photos' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <ImageIcon size={16} /> Photos / Unsplash
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('upload'); setError(''); setQuery(''); setResults([]); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'upload' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Upload size={16} /> Upload Image
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('giphy'); setError(''); setQuery(''); searchGiphy(); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'giphy' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Search size={16} /> Giphy GIFs
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('link'); setError(''); setQuery(''); setResults([]); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'link' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <LinkIcon size={16} /> Image Link
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/30">
          {error && (
            <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-xl mb-4 text-center border border-red-500/20 font-bold">
              {error}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-teal-300 dark:border-teal-700 rounded-3xl bg-white dark:bg-slate-800 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-inner">
                <Upload size={32} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white">Upload from your Device</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supports PNG, JPG, WEBP, or GIF (max 2MB)</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl font-bold transition-all shadow-md cursor-pointer hover:scale-105"
              >
                Choose Image File
              </button>
            </div>
          )}

          {activeTab === 'link' && (
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Paste direct Image or GIF URL
              </label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/pose.jpg"
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-teal-500 text-sm font-medium"
                />
                <button 
                  type="submit" 
                  disabled={!linkUrl.trim()}
                  className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </form>
          )}

          {(activeTab === 'photos' || activeTab === 'giphy') && (
            <div className="flex flex-col gap-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (activeTab === 'photos') searchPhotos();
                  else searchGiphy();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={activeTab === 'photos' ? "Search photos (e.g. tree, dog, yoga, cat)..." : "Search GIFs..."}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-teal-500 text-slate-800 dark:text-white"
                  />
                </div>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-2xl transition-colors cursor-pointer text-sm shrink-0"
                >
                  Search
                </button>
              </form>

              {isLoading ? (
                <div className="flex items-center justify-center p-12 text-teal-600">
                  <span className="font-bold animate-pulse text-sm">Loading media...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1">
                  {results.map((item, idx) => (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => onSelect(item.url || item.thumb)}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-transparent hover:border-teal-500 transition-all cursor-pointer shadow-xs hover:scale-105"
                    >
                      <img 
                        src={item.thumb || item.url} 
                        alt={item.title || "Image"} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs p-1 text-center">
                        Select
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
