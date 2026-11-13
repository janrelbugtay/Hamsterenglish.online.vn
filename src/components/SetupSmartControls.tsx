import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  FolderPlus,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import {
  AnswerContentMode,
  parseOptionContent,
  formatOptionContent,
  getInstantCartoonPng,
  fetchRecommendedCartoonPng,
  normalizeKeyword,
} from '../utils/mediaAndPresets';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  mergeAllFolders,
  fetchAllAvailableFolders,
  createUnifiedFolder,
  UnifiedFolderItem,
} from '../lib/gameStore';

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

  const { user } = useAuth();
  const [syncedFolders, setSyncedFolders] = useState<UnifiedFolderItem[]>(() =>
    mergeAllFolders(folders)
  );
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    let active = true;
    fetchAllAvailableFolders(db, user?.uid).then((loaded) => {
      if (active) {
        setSyncedFolders(loaded);
      }
    });

    const handleUpdated = () => {
      setSyncedFolders(mergeAllFolders(folders));
    };
    window.addEventListener('hamster-folders-updated', handleUpdated);
    return () => {
      active = false;
      window.removeEventListener('hamster-folders-updated', handleUpdated);
    };
  }, [user?.uid, folders]);

  const allFolders = React.useMemo(() => {
    return mergeAllFolders(folders, syncedFolders);
  }, [folders, syncedFolders]);

  const handleCreateFolder = async () => {
    const clean = newFolderName.trim();
    if (!clean) return;
    setNewFolderName('');
    setIsAddingFolder(false);
    const created = await createUnifiedFolder(db, user?.uid, clean);
    setSyncedFolders((prev) => mergeAllFolders([created], prev, folders));
    setFolderId(created.id);
  };

  const applyMode = (nextMode: AnswerContentMode) => {
    setContentMode(nextMode);
    handleSetAutoPhotos(nextMode !== 'words');
    if (typeof onApplyModeToAll === 'function') {
      onApplyModeToAll(nextMode);
    }
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

      {/* Row 2: Clean Generate Images / GIFs Bar (no extra details below, neither pre-selected) */}
      <div className="bg-gradient-to-r from-purple-50/90 via-white to-sky-50/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/90 border border-purple-200/80 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <button
          type="button"
          onClick={() => {
            const targetMode: AnswerContentMode =
              contentMode === 'words' ? 'both' : contentMode;
            applyMode(targetMode);
          }}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
          title="Auto-generate images/GIFs for answer options"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles size={16} />
          </div>
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
            Generate Images / GIFs
          </span>
        </button>

        {/* Options: Display Only Images | Both (Neither pre-selected when contentMode === 'words') */}
        <div className="grid grid-cols-2 w-full sm:w-auto bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-1 rounded-xl gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextMode: AnswerContentMode =
                contentMode === 'photos_gifs' ? 'words' : 'photos_gifs';
              applyMode(nextMode);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'photos_gifs'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon size={14} />
            <span>Display Only Images</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const nextMode: AnswerContentMode =
                contentMode === 'both' ? 'words' : 'both';
              applyMode(nextMode);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'both'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white'
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

/**
 * Reusable Image Slot that sits right after an input (replacing the Media button).
 * When clicked, it opens a compact popover showing "Change" or "Delete".
 */
function InlineAttachedImageWithMenu({
  imageUrl,
  alt,
  onChangeMedia,
  onDeleteMedia,
  sizeClass = 'w-11 h-11',
}: {
  imageUrl: string;
  alt: string;
  onChangeMedia: () => void;
  onDeleteMedia: () => void;
  sizeClass?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        className={`${sizeClass} rounded-xl border-2 border-purple-400/80 hover:border-purple-600 bg-white dark:bg-slate-800 p-0.5 flex items-center justify-center overflow-hidden shadow-xs cursor-pointer transition-all`}
        title="Click to Change or Delete image"
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-contain rounded-lg"
        />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 flex items-center gap-1.5 min-w-max animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onChangeMedia();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw size={12} />
            <span>Change</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDeleteMedia();
            }}
            className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      )}
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
 * Smart Option Input:
 * - Preserves manually attached images even when neither global mode is selected (`contentMode === 'words'`).
 * - Places the attached image right after the option input replacing the Media button.
 * - Clicking the attached image shows Change or Delete.
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
  contentMode = 'words',
}: SmartOptionInputProps) {
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
    isAutoPhotos ? getInstantCartoonPng(parsed.text) : null
  );
  const [dismissedAutoUrl, setDismissedAutoUrl] = useState<string | null>(null);
  const [localWord, setLocalWord] = useState<string>(parsed.text || '');

  useEffect(() => {
    if (parsed.mode !== 'image' && parsed.text !== localWord.trim()) {
      setLocalWord(parsed.text);
    } else if (!value) {
      setLocalWord('');
    }
  }, [value, parsed.text, parsed.mode]);

  const effectiveWord = localWord || parsed.text;

  // Whenever the typed word changes AND auto-photos is active, look up the recommended PNG
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

    const instant = getInstantCartoonPng(clean);
    if (instant) {
      setRecommendedUrl(instant);
    }

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

  // Always show manually attached image (`parsed.imageUrl`), plus auto-recommended image when `isAutoPhotos` is active
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
  }, [
    recommendedUrl,
    contentMode,
    isAutoPhotos,
    dismissedAutoUrl,
    parsed.imageUrl,
    effectiveWord,
    value,
    emitChange,
  ]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setLocalWord(newText);
    setDismissedAutoUrl(null);

    const instantPng = isAutoPhotos ? getInstantCartoonPng(newText) : null;
    const imgToKeep = instantPng || parsed.imageUrl;

    if (!imgToKeep) {
      emitChange(newText);
    } else if (!newText.trim()) {
      emitChange(contentMode === 'photos_gifs' ? imgToKeep : '');
    } else if (contentMode === 'photos_gifs') {
      emitChange(imgToKeep);
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

  // Display Only Images Mode ('photos_gifs') OR when option is a pure image with no text
  if (contentMode === 'photos_gifs') {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {typeof onSelectCorrect === 'function' && (
          <input
            type="radio"
            name={radioName}
            checked={isCorrect}
            onChange={onSelectCorrect}
            className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
          />
        )}

        <div
          className={`flex-1 flex items-center justify-between gap-2 min-w-0 rounded-xl border px-2.5 py-1.5 transition-all ${
            isCorrect
              ? 'border-emerald-500/80 bg-emerald-50/60 dark:bg-emerald-500/10'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
          }`}
        >
          <input
            type="text"
            value={localWord}
            onChange={handleTextChange}
            placeholder="Type word to generate image..."
            className="flex-1 min-w-0 bg-transparent outline-none text-xs text-slate-600 dark:text-slate-300 font-medium"
          />

          {activeImageUrl ? (
            <InlineAttachedImageWithMenu
              imageUrl={activeImageUrl}
              alt={effectiveWord || 'Option Image'}
              onChangeMedia={() => onOpenMediaPicker(effectiveWord || '')}
              onDeleteMedia={handleRemoveImage}
              sizeClass="w-11 h-11"
            />
          ) : (
            <button
              type="button"
              onClick={() => onOpenMediaPicker(effectiveWord || '')}
              className="bg-purple-500/12 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-xs font-bold border border-purple-500/20"
              title="Add Photo or GIPHY GIF"
            >
              <ImageIcon size={14} />
              <span>Media</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default Mode ('words') & Both Mode ('both'):
  // Text input on the left, and on the right either the Media button OR the attached image (which shows Change / Delete when clicked)
  return (
    <div className="flex-1 flex items-center gap-2 min-w-0">
      {typeof onSelectCorrect === 'function' && (
        <input
          type="radio"
          name={radioName}
          checked={isCorrect}
          onChange={onSelectCorrect}
          className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
        />
      )}

      <div
        className={`flex-1 flex items-center gap-2 min-w-0 rounded-xl border px-2.5 py-1.5 transition-all ${
          isCorrect
            ? 'border-emerald-500/80 bg-emerald-50/60 dark:bg-emerald-500/10'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
        }`}
      >
        <input
          type="text"
          value={localWord}
          onChange={handleTextChange}
          placeholder={cleanOptionPlaceholder(placeholder)}
          className={`flex-1 min-w-0 bg-transparent outline-none text-sm py-1 ${
            isCorrect
              ? 'text-emerald-900 dark:text-emerald-200 font-bold'
              : 'text-slate-800 dark:text-slate-200 font-medium'
          }`}
        />

        {activeImageUrl ? (
          <InlineAttachedImageWithMenu
            imageUrl={activeImageUrl}
            alt={effectiveWord || 'Option Image'}
            onChangeMedia={() => onOpenMediaPicker(effectiveWord || '')}
            onDeleteMedia={handleRemoveImage}
            sizeClass="w-10 h-10"
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpenMediaPicker(effectiveWord || '')}
            className="bg-purple-500/12 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-xs font-bold border border-purple-500/20"
            title="Add Photo or GIPHY GIF"
          >
            <ImageIcon size={14} />
            <span>Media</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Helper to convert all questions' options when the teacher clicks Generate Images/GIFs
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
      const parsedQ = parseOptionContent(q.text);
      const cleanQuestionText = parsedQ.text || q.text;

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
        text: cleanQuestionText,
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
 * Smart Question Input:
 * - Places the attached image directly after the question input (replacing the Media button).
 * - When the attached image is clicked, it shows "Change" or "Delete".
 * - Never leaks raw URLs or `|||https://...` into the question text input.
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

  // Always strip `|||...` and raw URLs so the question text input only ever shows human-readable words
  const displayedText =
    parsed.mode === 'image'
      ? ''
      : value && value.includes('|||')
      ? parsed.text
      : value || '';

  // Auto-heal any legacy question where `value` accidentally had `|||https://...` baked in alongside `onChangeImage`
  useEffect(() => {
    if (typeof onChangeImage === 'function' && value && (value.includes('|||') || parsed.mode === 'image')) {
      const cleanText = parsed.text || '';
      if (parsed.imageUrl && !imageUrl) {
        onChangeImage(parsed.imageUrl);
      }
      if (cleanText !== value) {
        if (typeof onChange === 'function') onChange(cleanText);
        if (typeof onChangeValue === 'function') onChangeValue(cleanText);
      }
    }
  }, [value, imageUrl, onChangeImage, onChange, onChangeValue, parsed.text, parsed.imageUrl, parsed.mode]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value.replace(/\|\|\|/g, ' ');

    if (typeof onChangeImage === 'function') {
      if (typeof onChange === 'function') onChange(newText);
      if (typeof onChangeValue === 'function') onChangeValue(newText);
    } else {
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
    const cleanTxt = parsed.text || '';
    if (typeof onChangeImage === 'function') {
      onChangeImage(null);
    }
    if (typeof onChange === 'function') onChange(cleanTxt);
    if (typeof onChangeValue === 'function') onChangeValue(cleanTxt);
  };

  return (
    <div className="flex-1 flex items-center gap-2 min-w-0">
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

      {explicitImageUrl ? (
        <InlineAttachedImageWithMenu
          imageUrl={explicitImageUrl}
          alt={displayedText || 'Question Image'}
          onChangeMedia={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
          onDeleteMedia={handleRemoveMedia}
          sizeClass="w-12 h-12"
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
          className="bg-purple-500/15 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white px-3.5 py-3 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold border border-purple-500/30 shadow-xs"
          title="Add Photo or GIPHY GIF to this Question"
        >
          <ImageIcon size={18} />
          <span>Media</span>
        </button>
      )}
    </div>
  );
}
