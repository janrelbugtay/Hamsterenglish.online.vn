import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  X,
  RefreshCw,
  FolderPlus,
  Type,
  Layers,
  Wand2,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  AnswerContentMode,
  parseOptionContent,
  formatOptionContent,
  getInstantCartoonPng,
  fetchRecommendedCartoonPng,
  normalizeKeyword,
  SETUP_TOPIC_CATEGORIES,
  SETUP_CLASS_LEVEL_CATEGORIES,
  DEFAULT_SUGGESTED_FOLDERS,
  TOPIC_STARTER_QUESTIONS,
} from '../utils/mediaAndPresets';

interface SetupCurriculumHeaderProps {
  topic: string;
  setTopic: (val: string) => void;
  classLevel: string;
  setClassLevel: (val: string) => void;
  folderId: string;
  setFolderId: (val: string) => void;
  folders: { id: string; name: string }[];
  contentMode: AnswerContentMode;
  setContentMode: (mode: AnswerContentMode) => void;
  autoPhotosEnabled: boolean;
  setAutoPhotosEnabled: (enabled: boolean) => void;
  onApplyModeToAll?: (mode: AnswerContentMode) => void;
  onLoadStarterQuestions?: (
    questions: { id: number; text: string; options: string[]; answerIndex: number }[],
    topicName: string
  ) => void;
  maxOptionsPerQuestion?: number;
}

export function SetupCurriculumHeader({
  topic,
  setTopic,
  classLevel,
  setClassLevel,
  folderId,
  setFolderId,
  folders,
  contentMode,
  setContentMode,
  autoPhotosEnabled,
  setAutoPhotosEnabled,
  onApplyModeToAll,
  onLoadStarterQuestions,
  maxOptionsPerQuestion = 4,
}: SetupCurriculumHeaderProps) {
  const [customFolders, setCustomFolders] = useState<{ id: string; name: string }[]>(() => {
    try {
      const saved = localStorage.getItem('esl_custom_setup_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Merge user folders + custom folders + suggested curriculum folders without duplicates
  const allFolders = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    folders.forEach((f) => map.set(f.id, f));
    customFolders.forEach((f) => map.set(f.id, f));
    DEFAULT_SUGGESTED_FOLDERS.forEach((f) => {
      if (!map.has(f.id)) map.set(f.id, f);
    });
    return Array.from(map.values());
  }, [folders, customFolders]);

  const handleCreateFolder = () => {
    const clean = newFolderName.trim();
    if (!clean) return;
    const newF = { id: `custom-folder-${Date.now()}`, name: `📁 ${clean}` };
    const updated = [...customFolders, newF];
    setCustomFolders(updated);
    try {
      localStorage.setItem('esl_custom_setup_folders', JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
    setFolderId(newF.id);
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  const hasStarterDeck = Boolean(topic && TOPIC_STARTER_QUESTIONS[topic]);

  const handleGenerateTopicDeck = async () => {
    if (!onLoadStarterQuestions || !topic || !TOPIC_STARTER_QUESTIONS[topic]) return;
    const templates = TOPIC_STARTER_QUESTIONS[topic];

    const built = await Promise.all(
      templates.map(async (tpl, idx) => {
        // Slice options if game requires 2 options (like Roller Coaster Quiz)
        let opts = [...tpl.options];
        let ansIdx = tpl.answerIndex;
        if (maxOptionsPerQuestion === 2 && opts.length > 2) {
          const correctOpt = opts[ansIdx] || opts[0];
          const wrongOpt = opts.find((_, i) => i !== ansIdx) || opts[1];
          opts = idx % 2 === 0 ? [correctOpt, wrongOpt] : [wrongOpt, correctOpt];
          ansIdx = idx % 2 === 0 ? 0 : 1;
        }

        const formattedOpts = await Promise.all(
          opts.map(async (word) => {
            if (contentMode === 'words') return word;
            const png = getInstantCartoonPng(word) || (await fetchRecommendedCartoonPng(word));
            return formatOptionContent(word, png, contentMode);
          })
        );

        return {
          id: Date.now() + idx,
          text: tpl.text,
          options: formattedOpts,
          answerIndex: ansIdx,
        };
      })
    );

    onLoadStarterQuestions(built, topic);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Topic, Class Level & Folder with Rich Presets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TOPIC */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Topic
            </label>
            {hasStarterDeck && onLoadStarterQuestions && (
              <button
                type="button"
                onClick={handleGenerateTopicDeck}
                className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                title="Load ready-to-play questions with Cartoon PNGs for this topic"
              >
                <Wand2 size={12} /> Load {topic} Questions
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              placeholder="Type or select a Topic below..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
            />
            <div className="relative">
              <select
                value={SETUP_TOPIC_CATEGORIES.some((c) => c.topics.includes(topic)) ? topic : ''}
                onChange={(e) => {
                  if (e.target.value) setTopic(e.target.value);
                }}
                className="w-full text-xs font-bold bg-blue-50/70 dark:bg-slate-800/90 border border-blue-200 dark:border-slate-700 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg outline-none focus:border-blue-500 cursor-pointer appearance-none pr-7"
              >
                <option value="">✨ Choose from 40+ Preset Topics...</option>
                {SETUP_TOPIC_CATEGORIES.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.topics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500"
              />
            </div>
          </div>
        </div>

        {/* CLASS LEVEL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Class Level
          </label>
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              placeholder="e.g. Kindergarten, Grade 3, Starters, KET..."
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
            />
            <div className="relative">
              <select
                value={
                  SETUP_CLASS_LEVEL_CATEGORIES.some((c) => c.levels.includes(classLevel))
                    ? classLevel
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) setClassLevel(e.target.value);
                }}
                className="w-full text-xs font-bold bg-indigo-50/70 dark:bg-slate-800/90 border border-indigo-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-lg outline-none focus:border-indigo-500 cursor-pointer appearance-none pr-7"
              >
                <option value="">🎓 Choose Preset Class Level (Pre-K to IELTS)...</option>
                {SETUP_CLASS_LEVEL_CATEGORIES.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* FOLDER */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Folder
            </label>
            <button
              type="button"
              onClick={() => setIsAddingFolder((prev) => !prev)}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FolderPlus size={12} /> {isAddingFolder ? 'Cancel' : '+ New Folder'}
            </button>
          </div>

          {isAddingFolder ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name..."
                  className="flex-1 text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-blue-400 outline-none text-slate-800 dark:text-white px-3 py-2.5 rounded-xl"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Add
                </button>
              </div>
              <span className="text-[11px] text-slate-400 px-1">
                Creates a new folder and selects it immediately
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors pr-8"
                >
                  <option value="">📂 No Folder (Root Library)</option>
                  {allFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {DEFAULT_SUGGESTED_FOLDERS.slice(0, 3).map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => setFolderId(sf.id)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md border truncate cursor-pointer transition ${
                      folderId === sf.id
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {sf.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Option Display Content Mode (Words Only / Photos & GIFs / Both) + Auto-Recommended Cartoon PNG Toggle */}
      <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-amber-500/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-amber-950/30 border border-blue-500/25 rounded-2xl p-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Layers size={15} className="text-blue-500" />
            Option Content Mode:
          </span>

          <div className="inline-flex rounded-xl bg-white/90 dark:bg-slate-900/90 p-1 border border-slate-200 dark:border-slate-700 shadow-xs flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setContentMode('words');
                if (onApplyModeToAll) onApplyModeToAll('words');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                contentMode === 'words'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Type size={13} />
              <span>Words Only</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContentMode('photos_gifs');
                setAutoPhotosEnabled(true);
                if (onApplyModeToAll) onApplyModeToAll('photos_gifs');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                contentMode === 'photos_gifs'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ImageIcon size={13} />
              <span>Photos &amp; GIFs</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContentMode('both');
                setAutoPhotosEnabled(true);
                if (onApplyModeToAll) onApplyModeToAll('both');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                contentMode === 'both'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles size={13} />
              <span>Both (Words + Photos/GIFs)</span>
            </button>
          </div>
        </div>

        {/* Auto-Photo Recommender Toggle & Status */}
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <label className="flex items-center gap-2 cursor-pointer select-none bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-amber-400/40">
            <input
              type="checkbox"
              checked={autoPhotosEnabled}
              onChange={(e) => setAutoPhotosEnabled(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" />
              Auto-Recommend Cartoon PNGs (e.g. type &ldquo;apple&rdquo;)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

interface SmartOptionInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onOpenMediaPicker: (initialQuery: string) => void;
  placeholder?: string;
  isCorrect?: boolean;
  contentMode?: AnswerContentMode;
  autoPhotosEnabled?: boolean;
}

/**
 * Smart Option Input that:
 * 1. Lets the user type any word (e.g., "apple")
 * 2. Automatically recommends & shows a Cartoon PNG photo for that word!
 * 3. Allows the user to Replace the photo (opens MediaPickerModal pre-searched with the word),
 *    switch between Word / Photo / Both, or Remove the photo.
 */
export function SmartOptionInput({
  value,
  onChange,
  onOpenMediaPicker,
  placeholder = 'Option',
  isCorrect = false,
  contentMode = 'both',
  autoPhotosEnabled = true,
}: SmartOptionInputProps) {
  const parsed = parseOptionContent(value);
  const [recommendedUrl, setRecommendedUrl] = useState<string | null>(() =>
    getInstantCartoonPng(parsed.text)
  );
  const [dismissedAutoUrl, setDismissedAutoUrl] = useState<string | null>(null);
  const [isLoadingAuto, setIsLoadingAuto] = useState(false);

  // Keep a remembered word label even if the option is switched to "Photos & GIFs Only" mode
  const [rememberedWord, setRememberedWord] = useState<string>(parsed.text || '');

  useEffect(() => {
    if (parsed.text) {
      setRememberedWord(parsed.text);
    }
  }, [parsed.text]);

  const effectiveWord = parsed.text || rememberedWord;

  // Whenever the typed word changes, look up the recommended Cartoon PNG!
  useEffect(() => {
    const clean = normalizeKeyword(effectiveWord);
    if (!clean || clean.length < 2) {
      setRecommendedUrl(null);
      return;
    }

    // 1. Check instant dictionary first (0ms latency for "apple", "cat", "dog", etc.)
    const instant = getInstantCartoonPng(clean);
    if (instant) {
      setRecommendedUrl(instant);
    }

    // 2. Debounced fetch from ARASAAC / Wikimedia Cartoon PNGs
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoadingAuto(true);
      const url = await fetchRecommendedCartoonPng(clean);
      if (!cancelled && url) {
        setRecommendedUrl(url);
      }
      if (!cancelled) {
        setIsLoadingAuto(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [effectiveWord]);

  // Determine the active image to display (either explicitly set on the option, or the auto-recommended Cartoon PNG)
  const activeImageUrl =
    parsed.imageUrl ||
    (autoPhotosEnabled && recommendedUrl && recommendedUrl !== dismissedAutoUrl
      ? recommendedUrl
      : null);

  // Auto-sync into option value when contentMode is 'both' or 'photos_gifs' and we have an auto-recommended cartoon PNG
  useEffect(() => {
    if (!autoPhotosEnabled || !recommendedUrl || recommendedUrl === dismissedAutoUrl) return;
    if (parsed.imageUrl) return; // Already has an explicit image
    if (!parsed.text.trim()) return;

    if (contentMode === 'both') {
      const nextVal = formatOptionContent(parsed.text, recommendedUrl, 'both');
      if (nextVal !== value) {
        onChange(nextVal);
      }
    } else if (contentMode === 'photos_gifs') {
      const nextVal = formatOptionContent(parsed.text, recommendedUrl, 'photos_gifs');
      if (nextVal !== value) {
        onChange(nextVal);
      }
    }
  }, [recommendedUrl, contentMode, autoPhotosEnabled, dismissedAutoUrl]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setRememberedWord(newText);
    setDismissedAutoUrl(null);

    const instantPng = autoPhotosEnabled ? getInstantCartoonPng(newText) : null;
    const imgToKeep = parsed.imageUrl || instantPng;

    if (contentMode === 'words' || !imgToKeep) {
      onChange(newText);
    } else if (contentMode === 'both') {
      if (!newText.trim()) {
        onChange('');
      } else {
        onChange(`${newText}${ '|||' }${imgToKeep}`);
      }
    } else {
      // contentMode === 'photos_gifs'
      if (!newText.trim()) {
        onChange('');
      } else {
        onChange(`${newText}|||${imgToKeep}`);
      }
    }
  };

  const handleRemoveImage = () => {
    if (recommendedUrl) {
      setDismissedAutoUrl(recommendedUrl);
    }
    onChange(effectiveWord || '');
  };

  const handleAcceptRecommended = (targetMode: AnswerContentMode = 'both') => {
    if (!recommendedUrl) return;
    setDismissedAutoUrl(null);
    onChange(formatOptionContent(effectiveWord, recommendedUrl, targetMode));
  };

  return (
    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2">
        {/* Word Input (Always editable so user can type "apple" and see recommended picture!) */}
        <input
          type="text"
          value={parsed.mode === 'image' ? rememberedWord : parsed.text}
          onChange={handleTextChange}
          placeholder={placeholder}
          className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${
            isCorrect
              ? 'border-emerald-500/70 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold'
              : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          } rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium transition-colors`}
        />

        {/* Button to Open MediaPickerModal (Pre-filled with the typed word e.g. "apple") */}
        <button
          type="button"
          onClick={() => onOpenMediaPicker(effectiveWord || '')}
          className="bg-purple-500/15 hover:bg-purple-500 text-purple-600 dark:text-purple-300 hover:text-white px-2.5 py-2 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-xs font-bold border border-purple-500/25"
          title={activeImageUrl ? 'Replace Photo or GIF' : 'Search Cartoon PNGs, Photos or Giphy'}
        >
          <ImageIcon size={15} />
          <span className="hidden xl:inline">{activeImageUrl ? 'Replace' : 'Media'}</span>
        </button>
      </div>

      {/* Automatic Recommended Picture / Attached Picture Preview Bar */}
      {(activeImageUrl || recommendedUrl) && (
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800/95 border border-amber-400/40 dark:border-slate-700 rounded-xl p-1.5 px-2.5 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div
              onClick={() => onOpenMediaPicker(effectiveWord || '')}
              className="relative group w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
              title="Click to Replace Picture or GIF"
            >
              <img
                src={activeImageUrl || recommendedUrl!}
                alt={effectiveWord || 'Option picture'}
                className="w-full h-full object-contain p-0.5"
              />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-700 dark:text-amber-300">
                  {parsed.imageUrl === recommendedUrl || !parsed.imageUrl
                    ? '✨ Recommended PNG'
                    : '🖼️ Custom Media'}
                </span>
                {isLoadingAuto && (
                  <span className="text-[10px] text-slate-400 animate-pulse">updating...</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {parsed.mode === 'both'
                  ? `Showing: "${effectiveWord}" + Picture`
                  : parsed.mode === 'image'
                  ? 'Showing: Picture Only'
                  : 'Word Only (Click Use to attach)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!parsed.imageUrl && recommendedUrl && (
              <button
                type="button"
                onClick={() => handleAcceptRecommended('both')}
                className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                title="Use this recommended picture with the word"
              >
                <Check size={11} /> Use
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenMediaPicker(effectiveWord || '')}
              className="px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-600 dark:text-blue-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Replace with another Cartoon PNG, Photo, or Giphy GIF"
            >
              <RefreshCw size={11} /> Replace
            </button>

            {activeImageUrl && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer"
                title="Remove picture (keep word only)"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper to convert all questions' options when the teacher switches Content Mode
 * ('words' | 'photos_gifs' | 'both') in the Game Setup header
 */
export async function convertQuestionsContentMode<
  T extends { id: any; text: string; options: string[]; answerIndex: number; optionImages?: (string | null)[] }
>(questions: T[], mode: AnswerContentMode): Promise<T[]> {
  return Promise.all(
    questions.map(async (q) => {
      const newOptions = await Promise.all(
        q.options.map(async (rawOpt, idx) => {
          const parsed = parseOptionContent(rawOpt);
          const existingImg = parsed.imageUrl || q.optionImages?.[idx] || null;

          if (mode === 'words') {
            return parsed.text || rawOpt;
          }

          let imgUrl = existingImg;
          if (!imgUrl && parsed.text.trim()) {
            imgUrl =
              getInstantCartoonPng(parsed.text) ||
              (await fetchRecommendedCartoonPng(parsed.text));
          }

          if (!imgUrl) return rawOpt;

          if (mode === 'photos_gifs') {
            return imgUrl;
          }
          // mode === 'both'
          return formatOptionContent(parsed.text, imgUrl, 'both');
        })
      );

      return {
        ...q,
        options: newOptions,
      };
    })
  );
}
