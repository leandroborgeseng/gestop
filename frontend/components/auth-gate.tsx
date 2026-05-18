'use client';

/**
 * @deprecated Use SessionLayout + RequirePermissions instead.
 * Kept for backwards compatibility during migration.
 */
import { SessionLayout } from '@/components/auth/session-layout';
import { RequirePermissions } from '@/components/auth/require-permissions';

export function AuthGate({
  children,
  requiredPermissions = [],
}: {
  children: React.ReactNode;
  requiredPermissions?: string[];
}) {
  return (
    <SessionLayout>
      <RequirePermissions permissions={requiredPermissions}>{children}</RequirePermissions>
    </SessionLayout>
  );
}
