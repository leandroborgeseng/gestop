import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { SIGMA_NAME, SIGMA_TAGLINE } from '@/lib/brand';
import { Chip } from '@/components/ui/chip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthPageShell({
  icon: Icon,
  chipLabel,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  chipLabel: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="sigma-shell flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section className="sigma-brand-panel hidden rounded-[var(--r-card)] p-10 text-white lg:block">
          <div className="space-y-5">
            <Logo theme="light" variant="full" priority className="h-20 max-w-[320px]" />
            <Chip variant="accent" className="bg-white/15 text-white">
              {SIGMA_NAME}
            </Chip>
          </div>
          <p className="mt-8 max-w-md text-[15px] leading-relaxed text-white/85">
            {SIGMA_TAGLINE} — Prefeitura de Franca.
          </p>
        </section>

        <Card elevation={2} className="w-full">
          <CardHeader>
            <div className="mb-6 flex flex-col items-center gap-2 text-center lg:hidden">
              <Logo variant="full" priority className="h-14 max-w-[260px]" />
              <p className="page-kicker">{SIGMA_NAME}</p>
            </div>
            <Chip variant="brand" className="mb-3 w-fit gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {chipLabel}
            </Chip>
            <CardTitle className="page-title text-[var(--ink)]">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
