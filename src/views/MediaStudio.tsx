import React, { useState } from "react";
import { Search, Image, Film, Sparkles, Copy, Check, ExternalLink, Loader2 } from "lucide-react";

export function MediaStudio() {
  const [activeTab, setActiveTab] = useState<"photos" | "gifs">("photos");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      const endpoint =
        activeTab === "photos"
          ? `/api/photo-search?q=${encodeURIComponent(query)}`
          : `/api/giphy-search?q=${encodeURIComponent(query)}`;

      const res = await fetch(endpoint);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch media assets");
      }
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Failed to search media");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 text-brand-purple text-xs font-bold mb-2">
            <Sparkles size={14} />
            <span>Classroom Media Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
            Media Studio
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Search royalty-free images and animated GIFs for your classroom quizzes and game cards.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1.5 rounded-2xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("photos");
              setResults([]);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "photos"
                ? "bg-white dark:bg-slate-800 text-brand-purple shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            <Image size={16} />
            Photos
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("gifs");
              setResults([]);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "gifs"
                ? "bg-white dark:bg-slate-800 text-brand-purple shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            <Film size={16} />
            GIFs
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search high-quality ${activeTab === "photos" ? "photos (e.g., animals, sports, food)" : "GIFs (e.g., happy, celebration, dancing)"}...`}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3.5 bg-brand-purple hover:bg-brand-purple/90 active:scale-95 text-white rounded-2xl font-bold flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer shrink-0"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Results / Empty state */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-2xl border border-rose-200 dark:border-rose-800 text-sm font-semibold">
          {error}
        </div>
      )}

      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {results.map((item, idx) => {
            const url = item.url || item.images?.fixed_height?.url || item.urls?.regular;
            const thumb = item.thumb || item.images?.fixed_height_small?.url || item.urls?.small || url;
            const title = item.title || item.alt_description || `Media ${idx + 1}`;

            if (!url) return null;

            return (
              <div
                key={idx}
                className="group relative aspect-video sm:aspect-square bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center"
              >
                <img
                  src={thumb}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <span className="text-[11px] font-bold text-white/90 truncate">{title}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(url)}
                      className="px-2.5 py-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                    >
                      {copiedUrl === url ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl shadow-sm transition-transform active:scale-95"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm text-slate-400">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base">
            No media searched yet
          </h3>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            Type keywords above to find photos or animated GIFs for your custom quiz cards.
          </p>
        </div>
      ) : null}
    </div>
  );
}
