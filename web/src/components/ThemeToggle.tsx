'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'so.theme';

/** The theme in effect right now: the visitor's explicit choice, otherwise their device's setting. */
function isDark() {
  const explicit = document.documentElement.dataset.theme;
  return explicit ? explicit === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** One tap switches between light and dark. It starts from the device setting and remembers an explicit choice. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark());
    // follow the device while the visitor hasn't chosen
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(isDark());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the choice just won't be remembered */
    }
    setDark(!dark);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`tap inline-flex items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink ${className}`}
      aria-label={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  );
}

/**
 * Runs before the first paint (inlined in <head>) so a visitor who chose a theme never sees a flash of the other one.
 * Nothing to do when they haven't chosen: the stylesheet follows the device by itself.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;
