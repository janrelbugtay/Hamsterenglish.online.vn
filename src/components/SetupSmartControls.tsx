import React, { useState, useEffect, useCallback } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  X,
  RefreshCw,
  FolderPlus,
  Type,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  AnswerContentMode,
  parseOptionContent,
  formatOptionContent,
  getInstantCartoonPng,
  fetchRecommendedCartoonPng,
  normalizeKeyword,
} from '../utils/mediaAndPresets';

function cleanOptionPlaceholder(placeholder?: string): string {
  if (!placeholder) return 'Option';
  return placeholder.replace(/\s*\(e\.g\.?\s*apple\)/gi, '').trim() || 'Option';
}

export interface SetupCurriculumHeaderProps {
  topic: string;
  setTopic: (val: string) => void;
  classLevel: string;
  setClassLevel: (val: string) => void;
  folderId: string;
  setFolderId: (val: string) => void;
  folders: { id: string; name: string }[];
  onCreateFolder?: (name: string) => void;
  contentMode: AnswerContentMode;
  setContentMode: (mode: AnswerContentMode) => void;
  autoPhotosEnabled?: boolean;
  setAutoPhotosEnabled?: (enabled: boolean) => void;
  autoRecommendPhoto?: boolean;
  setAutoRecommendPhoto?: (enabled: boolean) => void;
  onApplyModeToAll?: (mode: AnswerContentMode) => void;
  onLoadStarterQuestions?: (
    questions: { id: number; text: string; options: string[]; answerIndex: number }[],
    topicName: string
  ) => void;
  onApplyStarterTopic?: (
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
  onCreateFolder,
  contentMode,
  setContentMode,
  setAutoPhotosEnabled,
  setAutoRecommendPhoto,
  onApplyModeToAll,
}: SetupCurriculumHeaderProps) {
  const handleSetAutoPhotos = useCallback(
    (enabled: boolean) => {
      if (typeof setAutoPhotosEnabled === 'function') setAutoPhotosEnabled(enabled);
      if (typeof setAutoRecommendPhoto === 'function') setAutoRecommendPhoto(enabled);
    },
    [setAutoPhotosEnabled, setAutoRecommendPhoto]
  );

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

  // Merge user folders + custom folders without preset clutter
  const allFolders = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (folders || []).forEach((f) => map.set(f.id, f));
    customFolders.forEach((f) => map.set(f.id, f));
    return Array.from(map.values());
  }, [folders, customFolders]);

  const handleCreateFolder = () => {
    const clean = newFolderName.trim();
    if (!clean) return;
    const newF = { id: `custom-folder-${Date.now()}`, name: clean };
    const updated = [...customFolders, newF];
    setCustomFolders(updated);
    try {
      localStorage.setItem('esl_custom_setup_folders', JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
    if (typeof onCreateFolder === 'function') {
      onCreateFolder(clean);
    } else {
      setFolderId(newF.id);
    }
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Topic, Class Level & Folder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TOPIC */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Topic
          </label>
          <input
            type="text"
            placeholder="e.g. Animals, Present Simple..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
          />
        </div>

        {/* CLASS LEVEL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Class Level
          </label>
          <input
            type="text"
            placeholder="e.g. Kindergarten, Grade 3, Starters..."
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
            className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
          />
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
          ) : (
            <div className="relative">
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors pr-8"
              >
                <option value="">No Folder (Root Library)</option>
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
          )}
        </div>
      </div>

      {/* Row 2: Redesigned Option Content Mode (Text Only / Photos / Both) */}
      <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Layers size={15} />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Option Content Mode
          </span>
        </div>

        <div className="grid grid-cols-3 w-full sm:w-auto bg-slate-200/75 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              setContentMode('words');
              handleSetAutoPhotos(false);
              if (typeof onApplyModeToAll === 'function') onApplyModeToAll('words');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'words'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Type size={14} />
            <span>Text Only</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContentMode('photos_gifs');
              handleSetAutoPhotos(true);
              if (typeof onApplyModeToAll === 'function') onApplyModeToAll('photos_gifs');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'photos_gifs'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon size={14} />
            <span>Photos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContentMode('both');
              handleSetAutoPhotos(true);
              if (typeof onApplyModeToAll === 'function') onApplyModeToAll('both');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'both'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>Both</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export interface SmartOptionInputProps {
  value: string;
  onChange?: (newValue: string) => void;
  onChangeValue?: (newValue: string) => void;
  onOpenMediaPicker: (initialQuery: string) => void;
  placeholder?: string;
  isCorrect?: boolean;
  onSelectCorrect?: () => void;
  optionIndex?: number;
  radioName?: string;
  contentMode?: AnswerContentMode;
  autoPhotosEnabled?: boolean;
  autoRecommendPhoto?: boolean;
}

/**
 * Smart Option Input that:
 * 1. Lets the user type any word
 * 2. Automatically recommends & attaches a Cartoon PNG photo when in Photos or Both mode
 * 3. Allows the user to Replace or Remove the photo
 */
export function SmartOptionInput({
  value,
  onChange,
  onChangeValue,
  onOpenMediaPicker,
  placeholder = 'Option',
  isCorrect = false,
  onSelectCorrect,
  radioName,
  contentMode = 'both',
}: SmartOptionInputProps) {
  // Auto-recommend is automatic whenever contentMode is 'photos_gifs' or 'both'
  const isAutoPhotos = contentMode !== 'words';

  const emitChange = useCallback(
    (newVal: string) => {
      if (typeof onChange === 'function') {
        onChange(newVal);
      }
      if (typeof onChangeValue === 'function') {
        onChangeValue(newVal);
      }
    },
    [onChange, onChangeValue]
  );

  const parsed = parseOptionContent(value);
  const [recommendedUrl, setRecommendedUrl] = useState<string | null>(() =>
    getInstantCartoonPng(parsed.text)
  );
  const [dismissedAutoUrl, setDismissedAutoUrl] = useState<string | null>(null);

  // Keep local text state so spaces while typing are never trimmed by parseOptionContent
  const [localWord, setLocalWord] = useState<string>(parsed.text || '');

  useEffect(() => {
    if (parsed.mode !== 'image' && parsed.text !== localWord.trim()) {
      setLocalWord(parsed.text);
    } else if (!value) {
      setLocalWord('');
    }
  }, [value, parsed.text, parsed.mode]);

  const effectiveWord = localWord || parsed.text;

  // Whenever the typed word changes, look up the recommended Cartoon PNG automatically
  useEffect(() => {
    if (!isAutoPhotos) {
      setRecommendedUrl(null);
      return;
    }
    const clean = normalizeKeyword(effectiveWord);
    if (!clean || clean.length < 2) {
      setRecommendedUrl(null);
      return;
    }

    // 1. Check instant dictionary first (0ms latency)
    const instant = getInstantCartoonPng(clean);
    if (instant) {
      setRecommendedUrl(instant);
    }

    // 2. Debounced fetch from ARASAAC / Wikimedia Cartoon PNGs
    let cancelled = false;
    const timer = setTimeout(async () => {
      const url = await fetchRecommendedCartoonPng(clean);
      if (!cancelled && url) {
        setRecommendedUrl(url);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [effectiveWord, isAutoPhotos]);

  // Determine the active image to display
  const activeImageUrl =
    parsed.imageUrl ||
    (isAutoPhotos && recommendedUrl && recommendedUrl !== dismissedAutoUrl
      ? recommendedUrl
      : null);

  // Auto-sync into option value when contentMode is 'both' or 'photos_gifs'
  useEffect(() => {
    if (!isAutoPhotos || !recommendedUrl || recommendedUrl === dismissedAutoUrl) return;
    if (parsed.imageUrl) return;
    if (!effectiveWord.trim()) return;

    if (contentMode === 'both') {
      const nextVal = formatOptionContent(effectiveWord, recommendedUrl, 'both');
      if (nextVal !== value) {
        emitChange(nextVal);
      }
    } else if (contentMode === 'photos_gifs') {
      const nextVal = formatOptionContent(effectiveWord, recommendedUrl, 'photos_gifs');
      if (nextVal !== value) {
        emitChange(nextVal);
      }
    }
  }, [recommendedUrl, contentMode, isAutoPhotos, dismissedAutoUrl, parsed.imageUrl, effectiveWord, value, emitChange]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setLocalWord(newText);
    setDismissedAutoUrl(null);

    const instantPng = isAutoPhotos ? getInstantCartoonPng(newText) : null;
    const imgToKeep = parsed.imageUrl || instantPng;

    if (contentMode === 'words' || !imgToKeep) {
      emitChange(newText);
    } else if (!newText.trim()) {
      emitChange('');
    } else {
      emitChange(`${newText}|||${imgToKeep}`);
    }
  };

  const handleRemoveImage = () => {
    if (recommendedUrl) {
      setDismissedAutoUrl(recommendedUrl);
    }
    emitChange(effectiveWord || '');
  };

  return (
    <div className="flex-1 flex items-start gap-2 min-w-0">
      {typeof onSelectCorrect === 'function' && (
        <input
          type="radio"
          name={radioName}
          checked={isCorrect}
          onChange={onSelectCorrect}
          className="w-4 h-4 mt-3 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
        />
      )}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={localWord}
            onChange={handleTextChange}
            placeholder={cleanOptionPlaceholder(placeholder)}
            className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${
              isCorrect
                ? 'border-emerald-500/70 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold'
                : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
            } rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium transition-colors`}
          />

          <button
            type="button"
            onClick={() => onOpenMediaPicker(effectiveWord || '')}
            className="bg-purple-500/15 hover:bg-purple-500 text-purple-600 dark:text-purple-300 hover:text-white px-2.5 py-2 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-xs font-bold border border-purple-500/25"
            title={activeImageUrl ? 'Replace Photo or GIF' : 'Select Photo or GIF'}
          >
            <ImageIcon size={15} />
            <span className="hidden xl:inline">{activeImageUrl ? 'Replace' : 'Media'}</span>
          </button>
        </div>

        {/* Attached / Automatic Picture Preview */}
        {activeImageUrl && (
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 px-2.5 shadow-xs">
            <div
              onClick={() => onOpenMediaPicker(effectiveWord || '')}
              className="relative group w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
              title="Click to Replace Picture"
            >
              <img
                src={activeImageUrl}
                alt={effectiveWord || 'Option picture'}
                className="w-full h-full object-contain p-0.5"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onOpenMediaPicker(effectiveWord || '')}
                className="px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-600 dark:text-blue-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Replace with another Cartoon PNG, Photo, or GIF"
              >
                <RefreshCw size={11} /> Replace
              </button>

              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer"
                title="Remove picture"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper to convert all questions' options when the teacher switches Content Mode
 * ('words' | 'photos_gifs' | 'both') in the Game Setup header
 */
export async function convertQuestionsContentMode<
  T extends { id: any; text: string; options: string[]; answerIndex: number; optionImages?: (string | null)[] }
>(
  questions: T[],
  mode: AnswerContentMode,
  onComplete?: (updated: T[]) => void
): Promise<T[]> {
  const result = await Promise.all(
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

  if (typeof onComplete === 'function') {
    onComplete(result);
  }
  return result;
}

export interface SmartQuestionInputProps {
  id?: string;
  value: string;
  imageUrl?: string | null;
  onChange?: (newValue: string) => void;
  onChangeValue?: (newValue: string) => void;
  onChangeImage?: (newImageUrl: string | null) => void;
  onOpenMediaPicker: (initialQuery: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoPhotosEnabled?: boolean;
  autoRecommendPhoto?: boolean;
  inputClassName?: string;
}

/**
 * Smart Question Input that allows typing questions smoothly AND attaching media (Cartoon PNG, Photo, GIF):
 * - Never calls onChangeImage during text typing so parent state is never overwritten.
 */
export function SmartQuestionInput({
  id,
  value,
  imageUrl,
  onChange,
  onChangeValue,
  onChangeImage,
  onOpenMediaPicker,
  onKeyDown,
  onPaste,
  placeholder = 'Type your question here...',
  inputClassName,
}: SmartQuestionInputProps) {
  const parsed = parseOptionContent(value);
  const explicitImageUrl = imageUrl || parsed.imageUrl || null;

  // Determine the displayed text inside the input without trimming spaces while typing
  const displayedText =
    typeof onChangeImage === 'function'
      ? value
      : parsed.mode === 'image'
      ? ''
      : value.includes('|||')
      ? value.split('|||')[0]
      : value;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;

    if (typeof onChangeImage === 'function') {
      // Parent manages `image` in a separate field — only emit the text change!
      if (typeof onChange === 'function') onChange(newText);
      if (typeof onChangeValue === 'function') onChangeValue(newText);
    } else {
      // Parent encodes image inside `text` via `text|||imageUrl`
      const formatted = explicitImageUrl
        ? newText
          ? `${newText}|||${explicitImageUrl}`
          : explicitImageUrl
        : newText;
      if (typeof onChange === 'function') onChange(formatted);
      if (typeof onChangeValue === 'function') onChangeValue(formatted);
    }
  };

  const handleRemoveMedia = () => {
    if (typeof onChangeImage === 'function') {
      onChangeImage(null);
      if (value.includes('|||') || value === explicitImageUrl) {
        const cleanTxt = parsed.text || '';
        if (typeof onChange === 'function') onChange(cleanTxt);
        if (typeof onChangeValue === 'function') onChangeValue(cleanTxt);
      }
    } else {
      const cleanTxt = parsed.text || '';
      if (typeof onChange === 'function') onChange(cleanTxt);
      if (typeof onChangeValue === 'function') onChangeValue(cleanTxt);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          value={displayedText}
          onChange={handleTextChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          className={
            inputClassName ||
            'flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium'
          }
        />

        <button
          type="button"
          onClick={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
          className="bg-purple-500/15 hover:bg-purple-500 text-purple-600 dark:text-purple-300 hover:text-white px-3.5 py-3 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold border border-purple-500/30 shadow-xs"
          title={
            explicitImageUrl
              ? 'Replace Question Photo or GIF'
              : 'Add Cartoon PNG, Photo, or GIF to this Question'
          }
        >
          <ImageIcon size={18} />
          <span>{explicitImageUrl ? 'Replace Media' : 'Add Media'}</span>
        </button>
      </div>

      {/* Attached Question Media Bar */}
      {explicitImageUrl && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-purple-500/5 dark:bg-slate-800/95 border border-purple-500/30 dark:border-purple-500/30 rounded-xl p-2 px-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
              className="relative group w-14 h-14 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer shadow-xs"
              title="Click to Replace Question Media"
            >
              <img
                src={explicitImageUrl}
                alt={displayedText || 'Question Media'}
                className="w-full h-full object-contain p-1"
              />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Question Media Attached
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {displayedText.trim()
                  ? `Showing: "${displayedText.trim()}" + Media`
                  : 'Showing: Media Only'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
              className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-600 dark:text-blue-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw size={12} /> Replace
            </button>
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer"
              title="Remove media from question"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


