'use client';

import { SessionLayout } from '@/components/auth/session-layout';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <SessionLayout>{children}</SessionLayout>;
}
