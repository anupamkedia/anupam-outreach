/**
 * supabase-browser.ts
 *
 * If Anupam Outreach already exports a browser client (commonly
 * `@/lib/supabase/client`), delete this file and change the import at
 * the top of the two pipeline pages to point at yours instead. Two
 * clients in one app is not harmful, but one is tidier.
 *
 * Needs in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
 */
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ── Shared vocabulary ───────────────────────────────────── */

export const STAGES = [
  'new_lead',
  'contacted',
  'qualified',
  'technical_discussion',
  'sample_submitted',
  'quotation_sent',
  'negotiation',
  'converted',
  'lost',
  'on_hold',
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new_lead: 'New lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  technical_discussion: 'Technical discussion',
  sample_submitted: 'Sample submitted',
  quotation_sent: 'Quotation sent',
  negotiation: 'Negotiation',
  converted: 'Converted',
  lost: 'Lost',
  on_hold: 'On hold',
};

/** Stages that get a white label on the shade chip. */
export const DEEP_STAGES: Stage[] = [
  'sample_submitted', 'quotation_sent', 'negotiation', 'converted', 'lost',
];

export const ACTIVE_STAGES = STAGES.filter(
  (s) => s !== 'converted' && s !== 'lost'
) as Stage[];

export const SEGMENT_LABEL: Record<string, string> = {
  railways: 'Railways', metro: 'Metro rail', defence: 'Defence',
  marine: 'Marine & shipyards', oil_gas: 'Oil & gas', power: 'Power',
  steel: 'Steel', cement: 'Cement', infrastructure: 'Infrastructure',
  real_estate: 'Real estate', warehousing: 'Warehousing', water: 'Water infrastructure',
  industrial: 'General industrial', dealer: 'Dealer / trade', unspecified: 'Not set',
};

/* ── Formatting ──────────────────────────────────────────── */

const inrFull = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1.24 Cr · ₹45.0 L · ₹8,200 */
export function inr(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v === 0) return '—';
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${inrFull.format(v)}`;
}

/** 5,200 → "5,200" ; 5,200.5 → "5,200.5" */
export function qty(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v === 0) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

/** Any date → the 1st of its month, as YYYY-MM-DD. */
export function monthStart(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthLabel(period: string): string {
  return new Date(period + 'T00:00:00')
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'rep' | 'coordinator';
};

export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  if (d < 365) return `${Math.round(d / 30)} months ago`;
  return `${Math.round(d / 365)} years ago`;
}

export type Lead = {
  id: string;
  owner_id: string;
  company_name: string;
  contact_person: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  products: string[];
  source: string;
  stage: Stage;
  expected_value: number;
  expected_close_date: string | null;
  probability: number | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  raw_intake: string | null;
  is_locked: boolean;
  converted_at: string | null;
  converted_value: number | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};
