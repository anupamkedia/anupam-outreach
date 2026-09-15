'use client';

import { supabase } from '@/lib/supabase-browser';

const TABS = [
  { key: 'leads',     href: '/pipeline',           label: 'Leads' },
  { key: 'sales',     href: '/pipeline/sales',     label: 'Sales',   hideForCoordinator: true },
  { key: 'targets',   href: '/pipeline/targets',   label: 'Targets', adminOnly: true },
  { key: 'dashboard', href: '/pipeline/dashboard', label: 'Dashboard' },
];

export function PipelineNav(
  { current, isAdmin, role }: { current: string; isAdmin?: boolean; role?: string }
) {
  return (
    <nav className="pl-nav">
      {TABS
        .filter((t) => !t.adminOnly || isAdmin)
        .filter((t) => !(t.hideForCoordinator && role === 'coordinator'))
        .map((t) => (
        <a key={t.key} href={t.href} aria-current={current === t.key ? 'page' : undefined}>
          {t.label}
        </a>
      ))}
      <button
        className="btn btn-quiet"
        style={{ padding: '7px 11px', fontSize: 14 }}
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = '/login';
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
