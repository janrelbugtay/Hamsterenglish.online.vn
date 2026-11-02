import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';

export function FullscreenButton({
  targetId,
  className = '',
  showLabel = false,
}: {
  targetId?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const nativeFs = !!document.fullscreenElement;
      const el = targetId ? document.getElementById(targetId) : null;
      const cssFs = el ? el.getAttribute('data-css-fullscreen') === 'true' : false;
      setIsFullscreen(nativeFs || cssFs);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [targetId]);

  const applyCssFullscreen = (el: HTMLElement | null, enable: boolean) => {
    if (!el) return;
    if (enable) {
      el.setAttribute('data-css-fullscreen', 'true');
      el.style.position = 'fixed';
      el.style.inset = '0px';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.zIndex = '9999';
      el.style.borderRadius = '0px';
    } else {
      el.removeAttribute('data-css-fullscreen');
      el.style.position = '';
      el.style.inset = '';
      el.style.width = '';
      el.style.height = '';
      el.style.zIndex = '';
      el.style.borderRadius = '';
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
  };

  const toggle = async () => {
    const el = (targetId && document.getElementById(targetId)) || document.documentElement;
    const isCssFs = el.getAttribute('data-css-fullscreen') === 'true';

    if (!document.fullscreenElement && !isCssFs) {
      applyCssFullscreen(el, true);
      setIsFullscreen(true);
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        }
      } catch {
        // Native fullscreen blocked by iframe policy; CSS fullscreen remains active
      }
    } else {
      applyCssFullscreen(el, false);
      setIsFullscreen(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
    }
  };

  const isLight = className.includes('text-black') || className.includes('text-slate-900') || className.includes('bg-white');
  const defaultBg = className.includes('bg-') ? '' : 'bg-slate-900/90 hover:bg-slate-800 border-white/25';
  const defaultText = className.includes('text-') ? '' : 'text-white';

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${
        showLabel ? 'px-4 py-2.5 rounded-2xl gap-2 font-black' : 'w-11 h-11 rounded-full'
      } ${defaultBg} ${defaultText} flex items-center justify-center shadow-md border transition-all active:scale-95 cursor-pointer ${className}`}
      title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
    >
      {isFullscreen ? (
        <Minimize size={18} className={isLight ? '!text-black shrink-0' : 'text-amber-400 shrink-0'} />
      ) : (
        <Maximize size={18} className={isLight ? '!text-black shrink-0' : 'text-sky-300 shrink-0'} />
      )}
      {showLabel && (
        <span className={`text-xs sm:text-sm font-black whitespace-nowrap ${isLight ? '!text-black' : ''}`}>
          {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        </span>
      )}
    </button>
  );
}

