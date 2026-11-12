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
  Search,
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

      {/* Row 2: Option Display Mode (Text Only / Pictures Only / Words + Pictures) */}
      <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
              Answer Display Mode
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {contentMode === 'words'
                ? 'Text Only: Shows only words inside the game'
                : contentMode === 'photos_gifs'
                ? 'Pictures Only: Hides text labels in-game and shows large pictures/GIFs only'
                : 'Words + Pictures: Shows both the word and picture together in-game'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 w-full sm:w-auto bg-slate-200/75 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              setContentMode('words');
              handleSetAutoPhotos(false);
              if (typeof onApplyModeToAll === 'function') onApplyModeToAll('words');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'photos_gifs'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon size={14} />
            <span>Pictures Only</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContentMode('both');
              handleSetAutoPhotos(true);
              if (typeof onApplyModeToAll === 'function') onApplyModeToAll('both');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              contentMode === 'both'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>Words + Pictures</span>
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
 * Smart Option Input that adapts cleanly to the 3 Answer Display Modes:
 * - 'words' (Text Only): Clean text input with optional media icon, hides images in-game.
 * - 'photos_gifs' (Pictures Only): Large visual Picture Card in the editor + quick word lookup bar,
 *   saves pure image URL so in-game targets/bubbles show ONLY the picture (hiding text labels).
 * - 'both' (Words + Pictures): Single unified horizontal card combining thumbnail + word input + action button
 *   without duplicate "Replace" rows underneath.
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
    getInstantCartoonPng(parsed.text)
  );
  const [dismissedAutoUrl, setDismissedAutoUrl] = useState<string | null>(null);

  // Keep local text state so typing a word in 'photos_gifs' or 'both' mode is smooth
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

  const activeImageUrl =
    contentMode === 'words'
      ? null
      : parsed.imageUrl ||
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

    if (contentMode === 'words' || !imgToKeep) {
      emitChange(newText);
    } else if (!newText.trim()) {
      emitChange('');
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

  // MODE 2: PICTURES ONLY ('photos_gifs') -> Large visual picture card in editor, hides text in-game
  if (contentMode === 'photos_gifs') {
    return (
      <div className="flex-1 flex items-start gap-2 min-w-0">
        {typeof onSelectCorrect === 'function' && (
          <input
            type="radio"
            name={radioName}
            checked={isCorrect}
            onChange={onSelectCorrect}
            className="w-4 h-4 mt-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
          />
        )}
        <div
          className={`flex-1 flex flex-col rounded-2xl border-2 transition-all overflow-hidden bg-white dark:bg-slate-800/95 ${
            isCorrect
              ? 'border-emerald-500 shadow-sm shadow-emerald-500/10'
              : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          {/* Large Picture Stage */}
          <div
            onClick={() => onOpenMediaPicker(effectiveWord || '')}
            className="relative group h-28 bg-slate-50 dark:bg-slate-900/70 flex flex-col items-center justify-center p-2 cursor-pointer border-b border-slate-200 dark:border-slate-700/80"
            title="Click to choose Photo, Clipart, or GIPHY GIF"
          >
            {activeImageUrl ? (
              <>
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-black uppercase tracking-wider shadow-2xs">
                  Picture Only
                </span>
                <img
                  src={activeImageUrl}
                  alt={effectiveWord || 'Answer Picture'}
                  className="max-h-24 w-auto object-contain rounded-lg transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-black shadow flex items-center gap-1">
                    <RefreshCw size={12} /> Change Picture / GIF
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage();
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-white/90 hover:bg-rose-500 text-slate-600 hover:text-white shadow-xs transition-colors cursor-pointer"
                  title="Clear picture"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 group-hover:text-purple-600 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ImageIcon size={20} />
                </div>
                <span className="text-xs font-bold">Click to Pick Photo or GIPHY GIF</span>
              </div>
            )}
          </div>

          {/* Quick Word Lookup Bar (Auto-fetches picture; text stays hidden in game) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={localWord}
              onChange={handleTextChange}
              placeholder="Type word to auto-find picture..."
              className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
            />
            <button
              type="button"
              onClick={() => onOpenMediaPicker(effectiveWord || '')}
              className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
            >
              Browse
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MODE 1 ('words' - Text Only) & MODE 3 ('both' - Unified Word + Picture Card)
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
        {/* Inline Thumbnail when in 'both' mode and an image is attached */}
        {activeImageUrl && (
          <div
            onClick={() => onOpenMediaPicker(effectiveWord || '')}
            className="relative group w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer shadow-2xs"
            title="Click to replace picture or GIF"
          >
            <img
              src={activeImageUrl}
              alt={effectiveWord || 'Option'}
              className="w-full h-full object-contain p-0.5"
            />
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <RefreshCw size={12} />
            </div>
          </div>
        )}

        <input
          type="text"
          value={localWord}
          onChange={handleTextChange}
          placeholder={cleanOptionPlaceholder(placeholder)}
          className={`flex-1 min-w-0 bg-transparent outline-none text-sm ${
            isCorrect
              ? 'text-emerald-900 dark:text-emerald-200 font-bold'
              : 'text-slate-800 dark:text-slate-200 font-medium'
          }`}
        />

        {activeImageUrl ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenMediaPicker(effectiveWord || '')}
              className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-600 text-purple-700 dark:text-purple-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
              title="Change Photo or GIPHY GIF"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Remove picture"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenMediaPicker(effectiveWord || '')}
            className="bg-purple-500/12 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-xs font-bold border border-purple-500/20"
            title="Add Photo, Clipart, or GIPHY GIF"
          >
            <ImageIcon size={14} />
            <span className="hidden xl:inline">Media</span>
          </button>
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
 * - Guarantees raw URLs or `|||https://...` delimiters NEVER appear inside the question text input or preview badge.
 * - Automatically heals legacy `text|||url` strings when `onChangeImage` is provided.
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
          className="bg-purple-500/15 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white px-3.5 py-3 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold border border-purple-500/30 shadow-xs"
          title={
            explicitImageUrl
              ? 'Change Question Photo or GIPHY GIF'
              : 'Add Photo, Clipart, or GIPHY GIF to this Question'
          }
        >
          <ImageIcon size={18} />
          <span>{explicitImageUrl ? 'Change Media' : 'Add Media'}</span>
        </button>
      </div>

      {/* Compact, Clean Question Media Preview Card (Never shows raw URLs) */}
      {explicitImageUrl && (
        <div className="flex items-center justify-between gap-3 bg-purple-50/70 dark:bg-slate-800/95 border border-purple-200 dark:border-purple-500/30 rounded-xl p-2 px-3 shadow-2xs w-fit max-w-full">
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
              className="relative group w-14 h-14 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer shadow-2xs"
              title="Click to Change Question Media"
            >
              <img
                src={explicitImageUrl}
                alt={displayedText || 'Question Media'}
                className="w-full h-full object-contain p-1"
              />
            </div>

            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Question Visual Attached
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                {displayedText.trim()
                  ? `Prompt: "${displayedText.trim()}"`
                  : 'Visual-only question prompt'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenMediaPicker(normalizeKeyword(displayedText) || '')}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-purple-600 text-purple-700 dark:text-purple-200 hover:text-white border border-purple-200 dark:border-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <RefreshCw size={12} /> Change
            </button>
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
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
