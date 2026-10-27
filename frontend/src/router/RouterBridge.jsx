'use client';

/**
 * Registers the Next.js router into the imperative navigate() bridge so
 * services (which cannot call hooks) can trigger client-side navigation.
 * Mounted once from the (site) layout.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registerNavigate } from './navigate.js';

export default function RouterBridge() {
  const router = useRouter();

  useEffect(() => {
    registerNavigate(router);
  }, [router]);

  return null;
}
