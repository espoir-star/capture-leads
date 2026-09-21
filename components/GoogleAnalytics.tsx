'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

/** Mounted only after consent. GA4 enhanced page/form measurement must be disabled. */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  useEffect(() => { if (pathname) trackPageView(pathname); }, [pathname]);
  return null;
}
