import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Loader2,
  Link as LinkIcon,
  Upload,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
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
type GifFilter = 'gifs' | 'stickers';

const QUICK_SEARCH_CHIPS = [
  'lion',
  'cat',
  'dog',
  'hamster',
  'shark',
  'elephant',
  'pizza',
  'ice cream',
  'apple',
  'policeman',
  'airplane',
  'run',
  'dance',
  'happy',
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
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [gifFilter, setGifFilter] = useState<GifFilter>('gifs');
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (
    searchWord: string,
    tab: Tab,
    gFilter: GifFilter = gifFilter,
    fallbackIfEmpty: boolean = false
  ) => {
    const clean = searchWord.trim();

    if (!clean) {
      if (tab === 'photos') {
        setPhotoResults(getInstantCartoonGallery(''));
        setIsLoading(false);
      } else if (tab === 'giphy') {
        setIsLoading(true);
        const items = await searchGifsMultiSource(
          'happy cartoon',
          (partial) => {
            setGifResults(partial);
            if (partial.length > 0) setIsLoading(false);
          },
          gFilter
        );
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
        // Always prioritize PNGs first (prioritizePng = true)
        const items = await searchPhotosMultiSource(clean, true, (partial) => {
          setPhotoResults(partial);
          if (partial.length > 0) {
            setIsLoading(false);
          }
        });
        if (items.length === 0 && fallbackIfEmpty) {
          setQuery('');
          setPhotoResults(getInstantCartoonGallery(''));
        } else {
          setPhotoResults(items);
        }
      } else if (tab === 'giphy') {
        setIsLoading(true);
        const items = await searchGifsMultiSource(
          clean,
          (partial) => {
            setGifResults(partial);
            if (partial.length > 0) {
              setIsLoading(false);
            }
          },
          gFilter
        );
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
      setFailedUrls(new Set());
      setError('');
      setLinkUrl('');
      setIsLoading(false);
    } else {
      const startTab = defaultTab || 'photos';
      setActiveTab(startTab);
      const cleanedInit = normalizeKeyword(initialQuery) || initialQuery.trim();
      if (cleanedInit) {
        setQuery(cleanedInit);
        runSearch(cleanedInit, startTab, gifFilter, true);
      } else {
        setQuery('');
        setPhotoResults(getInstantCartoonGallery(''));
        setIsLoading(false);
        if (startTab === 'giphy') {
          runSearch('', 'giphy', gifFilter, true);
        }
      }
    }
  }, [isOpen, initialQuery, defaultTab]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, activeTab, gifFilter, false);
  };

  const handleSwitchTab = (tab: Tab) => {
    setActiveTab(tab);
    setError('');
    if (tab === 'photos') {
      runSearch(query, 'photos', gifFilter, false);
    } else if (tab === 'giphy') {
      runSearch(query, 'giphy', gifFilter, false);
    }
  };

  const handleGifFilterChange = (nextGifFilter: GifFilter) => {
    setGifFilter(nextGifFilter);
    runSearch(query, 'giphy', nextGifFilter, false);
  };

  const handleQuickChip = (word: string) => {
    setQuery(word);
    runSearch(word, activeTab, gifFilter, false);
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

  const finalPhotos = photoResults.filter(
    (item) => !failedUrls.has(item.urls.small) && !failedUrls.has(item.urls.regular)
  );

  const displayedGifs = gifResults.filter(
    (g) =>
      !failedUrls.has(g.images.fixed_height_small.url) &&
      !failedUrls.has(g.images.fixed_height.url)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] border border-slate-200 dark:border-slate-700">
        {/* Top Bar: Photos (Prioritize PNG) | GIPHY | Upload + Close Button */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-900/60 p-2">
          <div className="grid grid-cols-3 flex-1 gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchTab('photos')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'photos'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ImageIcon size={16} />
              <span>Photos</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab('giphy')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'giphy'
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Film size={16} />
              <span>GIPHY</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab('upload')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload size={16} />
              <span>Upload</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-slate-50/70 dark:bg-slate-900/20">
          {(activeTab === 'photos' || activeTab === 'giphy') && (
            <div className="flex flex-col h-full">
              {/* Search Bar */}
              <form onSubmit={handleFormSubmit} className="relative mb-3 shrink-0">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    activeTab === 'photos'
                      ? 'Search PNGs & Photos (e.g. lion, policeman, pizza, swim)...'
                      : 'Search GIPHY GIFs & Stickers (e.g. lion, happy dance, policeman)...'
                  }
                  className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-28 py-3 outline-none focus:border-blue-500 text-slate-900 dark:text-white font-semibold shadow-xs text-sm sm:text-base"
                  autoFocus
                />
                <Search className="absolute left-3.5 top-3.5 text-slate-400" size={20} />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      runSearch('', activeTab, gifFilter, false);
                    }}
                    className="absolute right-24 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-black disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  Search
                </button>
              </form>

              {/* Quick Vocabulary Chips & GIPHY Sub-toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 shrink-0">
                {activeTab === 'giphy' && (
                  <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleGifFilterChange('gifs')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        gifFilter === 'gifs'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      GIPHY GIFs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGifFilterChange('stickers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        gifFilter === 'stickers'
                          ? 'bg-pink-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      GIPHY Stickers
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
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results Grid */}
              <div className="flex-1 min-h-[280px]">
                {isLoading ? (
                  <div className="h-60 flex flex-col items-center justify-center gap-2.5">
                    <Loader2 className="animate-spin text-blue-600" size={36} />
                    <span className="text-xs font-bold text-slate-500">
                      {activeTab === 'giphy'
                        ? 'Searching GIPHY...'
                        : 'Searching PNGs & Photos...'}
                    </span>
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center py-8 font-semibold">{error}</div>
                ) : activeTab === 'photos' ? (
                  finalPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {finalPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => onSelect(photo.urls.regular)}
                          className="relative group rounded-2xl overflow-hidden aspect-square border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all cursor-pointer bg-white dark:bg-slate-800 p-2 flex flex-col items-center justify-center shadow-xs hover:shadow-md"
                        >
                          <span
                            className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs ${
                              photo.isCartoonPng
                                ? 'bg-emerald-500 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {photo.isCartoonPng ? 'PNG' : 'Photo'}
                          </span>
                          <img
                            src={photo.urls.small}
                            alt={photo.alt_description || 'Photo'}
                            onError={() => {
                              setFailedUrls((prev) => {
                                const next = new Set(prev);
                                next.add(photo.urls.small);
                                return next;
                              });
                            }}
                            className={`w-full h-full ${
                              photo.isCartoonPng
                                ? 'object-contain p-2'
                                : 'object-cover rounded-xl'
                            }`}
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-2 pt-5 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center">
                            <span className="text-white text-xs font-black px-3 py-1 bg-blue-600 rounded-lg shadow">
                              Select
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-center py-12 font-medium">
                      No matching photos found for &ldquo;{query}&rdquo;. Try switching to{' '}
                      <button
                        type="button"
                        onClick={() => handleSwitchTab('giphy')}
                        className="text-purple-600 font-bold underline cursor-pointer"
                      >
                        GIPHY
                      </button>{' '}
                      or try another keyword!
                    </div>
                  )
                ) : displayedGifs.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {displayedGifs.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => onSelect(gif.images.fixed_height.url)}
                        className={`relative group rounded-2xl overflow-hidden aspect-square border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 transition-all cursor-pointer ${
                          gif.isSticker
                            ? 'bg-slate-100 dark:bg-slate-800 p-2'
                            : 'bg-slate-900'
                        } shadow-xs hover:shadow-md`}
                      >
                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                          GIPHY
                        </span>
                        <img
                          src={gif.images.fixed_height_small.url}
                          alt={gif.title}
                          onError={() => {
                            setFailedUrls((prev) => {
                              const next = new Set(prev);
                              next.add(gif.images.fixed_height_small.url);
                              return next;
                            });
                          }}
                          className={`w-full h-full ${
                            gif.isSticker ? 'object-contain p-1' : 'object-cover'
                          }`}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-black px-3.5 py-1.5 bg-purple-600 rounded-xl shadow">
                            Select
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-12 font-medium">
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
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <Upload size={26} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Click to upload an image or GIF from your computer
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    PNG, JPG, GIF, SVG, WebP up to 5MB
                  </p>
                </div>
              </button>

              <form onSubmit={handleLinkSubmit} className="w-full max-w-md flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <LinkIcon size={13} /> Or Paste Any Image / GIPHY Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://media.giphy.com/media/.../giphy.gif"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!linkUrl.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl cursor-pointer"
                  >
                    Use Link
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
