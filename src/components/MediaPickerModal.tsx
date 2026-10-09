import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Link as LinkIcon, Upload, Image as ImageIcon } from 'lucide-react';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mediaUrl: string) => void;
}

type Tab = 'giphy' | 'upload' | 'photos';

export function MediaPickerModal({ isOpen, onClose, onSelect }: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('giphy');
  
  // Giphy state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Link state
  const [linkUrl, setLinkUrl] = useState("");

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setError("");
      setLinkUrl("");
      setActiveTab('giphy');
    }
  }, [isOpen]);

  const searchPhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/photo-search?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch photos. API might be rate limited.");
      }
      if (data.error) throw new Error(data.error);
      
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch photos");
    } finally {
      setIsLoading(false);
    }
  };

  const searchGiphy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/giphy-search?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch GIFs from Giphy. API might be rate limited.");
      }
      if (data.error) throw new Error(data.error);
      
      setResults(data.data || []);
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

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Select Image or GIF
          </h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button 
            onClick={() => { setActiveTab('giphy'); setError(''); setQuery(''); setResults([]); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'giphy' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Search size={16} /> Giphy
          </button>
          <button 
            onClick={() => { setActiveTab('upload'); setError(''); setQuery(''); setResults([]); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Upload size={16} /> Upload File
          </button>
          <button 
            onClick={() => { setActiveTab('photos'); setError(''); setQuery(''); setResults([]); }}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'photos' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <ImageIcon size={16} /> Photos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/20">
          
          {error && activeTab === 'upload' && (
            <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg mb-4 text-center border border-red-500/20">
              {error}
            </div>
          )}

          {activeTab === 'giphy' && (
            <div className="flex flex-col h-full">
              <form onSubmit={searchGiphy} className="relative mb-4 shrink-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Giphy..."
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium"
                  autoFocus
                />
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <button 
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="absolute right-2 top-2 bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>

              <div className="flex-1 min-h-[250px]">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center py-8">{error}</div>
                ) : results.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {results.map((gif) => (
                      <button
                        key={gif.id}
                        onClick={() => onSelect(gif.images.fixed_height.url)}
                        className="relative group rounded-xl overflow-hidden aspect-square border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer bg-slate-200 dark:bg-slate-800"
                      >
                        <img 
                          src={gif.images.fixed_height_small.url} 
                          alt={gif.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-bold px-2 py-1 bg-blue-500 rounded-lg">Select</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query ? (
                   <div className="text-slate-500 text-center py-8">No GIFs found for "{query}"</div>
                ) : (
                  <div className="text-slate-500 text-center py-8 flex flex-col items-center justify-center h-full gap-2">
                     <Search size={32} className="text-slate-300 dark:text-slate-600" />
                     <p>Search to find the perfect GIF!</p>
                     <a href="https://giphy.com/?utm_source=chatgpt.com" target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-blue-500 flex items-center mt-4">
                       Powered By GIPHY
                     </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="h-[250px] flex flex-col items-center justify-center">
              <input 
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-sm border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-100 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20 transition-colors rounded-2xl flex flex-col items-center justify-center gap-4 py-12 cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Upload size={28} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Click to upload a file</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">PNG, JPG, GIF up to 2MB</p>
                </div>
              </button>
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="flex flex-col h-full">
              <form onSubmit={searchPhotos} className="relative mb-4 shrink-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Openverse photos..."
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium"
                  autoFocus
                />
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <button 
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="absolute right-2 top-2 bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>

              <div className="flex-1 min-h-[250px]">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center py-8">{error}</div>
                ) : results.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {results.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => onSelect(photo.urls.regular)}
                        className="relative group rounded-xl overflow-hidden aspect-square border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer bg-slate-200 dark:bg-slate-800"
                      >
                        <img 
                          src={photo.urls.small} 
                          alt={photo.alt_description || "Photo"}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-bold px-2 py-1 bg-blue-500 rounded-lg">Select</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query ? (
                   <div className="text-slate-500 text-center py-8">No photos found for "{query}"</div>
                ) : (
                  <div className="text-slate-500 text-center py-8 flex flex-col items-center justify-center h-full gap-2">
                     <Search size={32} className="text-slate-300 dark:text-slate-600" />
                     <p>Search to find the perfect photo!</p>
                     <a href="https://openverse.org" target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-blue-500 flex items-center mt-4">
                       Powered By Openverse
                     </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
