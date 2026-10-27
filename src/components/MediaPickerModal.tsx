import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Link as LinkIcon, Upload, Image as ImageIcon, Sparkles } from 'lucide-react';
import {
  searchPhotosMultiSource,
  searchGifsMultiSource,
  getInstantCartoonGallery,
  PhotoSearchResult,
  GifSearchResult,
  normalizeKeyword,
} from '../utils/mediaAndPresets';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mediaUrl: string) => void;
  initialQuery?: string;
  defaultTab?: 'photos' | 'giphy' | 'upload';
}

type Tab = 'photos' | 'giphy' | 'upload';

const QUICK_SEARCH_CHIPS = [
  'cat',
  'dog',
  'hamster',
  'lion',
  'shark',
  'pizza',
  'ice cream',
  'car',
  'airplane',
  'book',
  'run',
  'happy',
  'sun',
];

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
  defaultTab = 'photos',
}: MediaPickerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [query, setQuery] = useState('');
  const [photoResults, setPhotoResults] = useState<PhotoSearchResult[]>([]);
  const [gifResults, setGifResults] = useState<GifSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [prioritizeCartoonPng, setPrioritizeCartoonPng] = useState(true);
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (searchWord: string, tab: Tab, cartoonPriority: boolean = prioritizeCartoonPng) => {
    const clean = searchWord.trim();
    if (!clean) {
      if (tab === 'photos') {
        setPhotoResults(getInstantCartoonGallery(''));
        setIsLoading(false);
      } else if (tab === 'giphy') {
        setIsLoading(true);
        const items = await searchGifsMultiSource('happy cartoon', (partial) => {
          setGifResults(partial);
          if (partial.length > 0) setIsLoading(false);
        });
        setGifResults(items);
        setIsLoading(false);
      }
      return;
    }

    setError('');

    try {
      if (tab === 'photos') {
        const instant = getInstantCartoonGallery(clean);
        if (instant.length > 0) {
          setPhotoResults(instant);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
        const items = await searchPhotosMultiSource(clean, cartoonPriority, (partial) => {
          setPhotoResults(partial);
          if (partial.length > 0) {
            setIsLoading(false);
          }
        });
        setPhotoResults(items);
      } else if (tab === 'giphy') {
        setIsLoading(true);
        const items = await searchGifsMultiSource(clean, (partial) => {
          setGifResults(partial);
          if (partial.length > 0) {
            setIsLoading(false);
          }
        });
        setGifResults(items);
      }
    } catch (err: any) {
      setError(err.message || 'Search encountered an issue. Please try another keyword.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setPhotoResults([]);
      setGifResults([]);
      setError('');
      setLinkUrl('');
      setIsLoading(false);
    } else {
      const startTab = defaultTab || 'photos';
      setActiveTab(startTab);
      const cleanedInit = normalizeKeyword(initialQuery) || initialQuery.trim();
      if (cleanedInit) {
        setQuery(cleanedInit);
        runSearch(cleanedInit, startTab, prioritizeCartoonPng);
      } else {
        // Keep search input completely empty (do not pre-type 'apple') and show instant Cartoon PNG starter gallery!
        setQuery('');
        setPhotoResults(getInstantCartoonGallery(''));
        setIsLoading(false);
        if (startTab === 'giphy') {
          runSearch('', 'giphy', prioritizeCartoonPng);
        }
      }
    }
  }, [isOpen, initialQuery, defaultTab]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, activeTab, prioritizeCartoonPng);
  };

  const handleSwitchTab = (tab: Tab) => {
    setActiveTab(tab);
    setError('');
    if (tab === 'photos' && photoResults.length === 0) {
      runSearch(query, 'photos', prioritizeCartoonPng);
    } else if (tab === 'giphy' && gifResults.length === 0) {
      runSearch(query, 'giphy', prioritizeCartoonPng);
    }
  };

  const handleToggleCartoonPriority = (cartoonOnly: boolean) => {
    setPrioritizeCartoonPng(cartoonOnly);
    if (activeTab === 'photos') {
      runSearch(query, 'photos', cartoonOnly);
    }
  };

  const handleQuickChip = (word: string) => {
    setQuery(word);
    runSearch(word, activeTab, prioritizeCartoonPng);
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

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onSelect(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              Select Cartoon PNG, Photo, or GIF
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Search Cartoon PNGs, Photos &amp; Animated GIFs or upload your own
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => handleSwitchTab('photos')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'photos'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ImageIcon size={16} /> Photos &amp; Cartoon PNGs
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('giphy')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'giphy'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Search size={16} /> GIFs
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('upload')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Upload size={16} /> Upload / Paste Link
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/20">
          {(activeTab === 'photos' || activeTab === 'giphy') && (
            <div className="flex flex-col h-full">
              {/* Search Form */}
              <form onSubmit={handleFormSubmit} className="relative mb-2.5 shrink-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    activeTab === 'photos'
                      ? 'Type a word to search Cartoon PNGs & Photos...'
                      : 'Type a word to search Animated GIFs...'
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-24 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium shadow-xs"
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

              {/* Filter & Quick Word Chips */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
                {activeTab === 'photos' && (
                  <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleToggleCartoonPriority(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        prioritizeCartoonPng
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      🎨 Cartoon PNGs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCartoonPriority(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        !prioritizeCartoonPng
                          ? 'bg-blue-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      📸 All Photos
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1">
                  {QUICK_SEARCH_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickChip(chip)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition shrink-0 cursor-pointer ${
                        query.toLowerCase() === chip
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results Grid */}
              <div className="flex-1 min-h-[260px]">
                {isLoading ? (
                  <div className="h-56 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="animate-spin text-blue-500" size={34} />
                    <span className="text-xs font-bold text-slate-500">
                      Searching...
                    </span>
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center py-8">{error}</div>
                ) : activeTab === 'photos' ? (
                  photoResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {photoResults.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => onSelect(photo.urls.regular)}
                          className="relative group rounded-xl overflow-hidden aspect-square border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all cursor-pointer bg-white dark:bg-slate-800 p-2 flex flex-col items-center justify-center shadow-xs"
                        >
                          {photo.isCartoonPng && (
                            <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow">
                              Cartoon PNG
                            </span>
                          )}
                          <img
                            src={photo.urls.small}
                            alt={photo.alt_description || 'Photo'}
                            className={`w-full h-full ${
                              photo.isCartoonPng ? 'object-contain p-1' : 'object-cover rounded-lg'
                            }`}
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-white text-xs font-bold px-3 py-1.5 bg-blue-500 rounded-lg shadow">
                              Use Picture
                            </span>
                            {photo.source && (
                              <span className="text-[10px] text-white/80 mt-1 font-medium truncate max-w-full">
                                {photo.source}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-center py-12">
                      No photos found for &ldquo;{query}&rdquo;. Try another keyword!
                    </div>
                  )
                ) : gifResults.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {gifResults.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => onSelect(gif.images.fixed_height.url)}
                        className="relative group rounded-xl overflow-hidden aspect-square border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all cursor-pointer bg-slate-200 dark:bg-slate-800"
                      >
                        <img
                          src={gif.images.fixed_height_small.url}
                          alt={gif.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-bold px-3 py-1.5 bg-blue-500 rounded-lg shadow">
                            Select GIF
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-12">
                    No GIFs found for &ldquo;{query}&rdquo;. Try another keyword!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="py-6 flex flex-col items-center justify-center gap-6">
              {error && (
                <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg w-full max-w-md text-center border border-red-500/20">
                  {error}
                </div>
              )}

              <input
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp, image/svg+xml"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-md border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20 transition-colors rounded-2xl flex flex-col items-center justify-center gap-3 py-10 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Upload size={26} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Click to upload an image or GIF</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    PNG, JPG, GIF, SVG, WebP up to 5MB
                  </p>
                </div>
              </button>

              <form onSubmit={handleLinkSubmit} className="w-full max-w-md flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <LinkIcon size={13} /> Or Paste Direct Image / GIF URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com/cartoon-apple.png"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!linkUrl.trim()}
                    className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl cursor-pointer"
                  >
                    Use URL
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
