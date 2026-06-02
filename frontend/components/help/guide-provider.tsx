'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getGuideForPath } from '@/lib/guide-content';
import { GuidePanel } from '@/components/help/guide-panel';

type GuideContextValue = {
  open: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  toggleGuide: () => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const content = useMemo(() => getGuideForPath(pathname), [pathname]);

  const openGuide = useCallback(() => setOpen(true), []);
  const closeGuide = useCallback(() => setOpen(false), []);
  const toggleGuide = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
          return;
        }
        event.preventDefault();
        toggleGuide();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleGuide]);

  const value = useMemo(
    () => ({ open, openGuide, closeGuide, toggleGuide }),
    [open, openGuide, closeGuide, toggleGuide],
  );

  return (
    <GuideContext.Provider value={value}>
      {children}
      <GuidePanel open={open} onClose={closeGuide} content={content} pathname={pathname} />
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error('useGuide must be used within GuideProvider');
  return ctx;
}
