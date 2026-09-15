'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart,
} from 'recharts';
import {
  supabase, STAGE_LABEL, SEGMENT_LABEL, inr, type Stage,
} from '@/lib/supabase-browser';
import { PipelineNav } from '../nav';
import '../pipeline.css';

type Dash = {
  months: { month: string; label: string; prospects: number; prospect_value: number;
            conversions: number; converted_value: number; lost: number }[];
  by_stage: { stage: Stage; leads: number; value: number; weighted_value: number }[];
  by_segment: { segment: string; leads: number; value: number; won: number }[];
  by_owner: { owner_id: string; name: string; target: number; open: number; open_value: number;
              won: number; won_value: number; won_this_month: number; won_value_this_month: number }[];
  totals: {
    open_leads: number; open_value: number; weighted_value: number;
    won_all_time: number; won_this_month: number; won_value_this_month: number;
    added_this_month: number; lost_all_time: number;
    conversion_rate: number | null; overdue_actions: number; avg_days_to_convert: number | null;
  };
};

const FUNNEL_ORDER: Stage[] = [
  'new_lead', 'contacted', 'qualified', 'technical_discussion',
  'sample_submitted', 'quotation_sent', 'negotiation', 'on_hold',
];

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [months, setMonths] = useState(12);
  const [role, setRole] = useState<string>('rep');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/login'; return; }
      const { data: p } = await supabase
        .from('pipeline_profiles').select('role').eq('id', auth.user.id).single();
      setRole(p?.role ?? 'rep');

      const { data, error } = await supabase.rpc('pipeline_dashboard', { p_months: months });
      if (error) setErr(error.message); else setD(data as Dash);
    })();
  }, [months]);

  if (err) return <div className="pl"><div className="pl-wrap">
    <div className="pl-note stop">Could not load the dashboard: {err}</div></div></div>;

  if (!d) return <div className="pl"><div className="pl-wrap">
    <p className="pl-who">Working out the numbers…</p></div></div>;

  const t = d.totals;
  const seesAll = role === 'admin' || role === 'manager';
  const funnel = FUNNEL_ORDER
    .map((s) => d.by_stage.find((x) => x.stage === s))
    .filter(Boolean) as Dash['by_stage'];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.leads));

  return (
    <div className="pl">
      <div className="pl-wrap">

        <header className="pl-top">
          <h1>Pipeline dashboard</h1>
          <span className="pl-who">{seesAll ? 'Whole team' : 'Your numbers'}</span>
          <PipelineNav current="dashboard" isAdmin={role === 'admin'} />
        </header>

        <div className="pl-bar">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>

        <div className="kpis">
          <Kpi k="Open pipeline" v={inr(t.open_value)} m={`${t.open_leads} live leads`} />
          <Kpi k="Weighted value" v={inr(t.weighted_value)} m="By stage probability" />
          <Kpi k="Won this month" v={inr(t.won_value_this_month)}
               m={`${t.won_this_month} orders`} tone="won" />
          <Kpi k="New leads this month" v={String(t.added_this_month)} m="Added to pipeline" />
          <Kpi k="Conversion rate" v={t.conversion_rate == null ? '—' : `${t.conversion_rate}%`}
               m={`${t.won_all_time} won / ${t.lost_all_time} lost`} />
          <Kpi k="Follow-ups overdue" v={String(t.overdue_actions)}
               m={t.avg_days_to_convert ? `Avg ${t.avg_days_to_convert} days to close` : 'No closes yet'}
               tone={t.overdue_actions > 0 ? 'alert' : undefined} />
        </div>

        <div className="card">
          <h3>Prospects added against orders won</h3>
          <p className="sub">
            Bars are leads entering the pipeline. The line is orders won that month.
            A widening gap means enquiries are arriving faster than they are closing.
          </p>
          <div style={{ height: 290 }}>
            <ResponsiveContainer>
              <ComposedChart data={d.months} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#E8EDF2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7A8C' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7A8C' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12.5 }} />
                <Bar dataKey="prospects" name="Prospects added" fill="#A3C3DF" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill="#E4C4C4" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="conversions" name="Converted"
                      stroke="#166E52" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Order value won each month</h3>
          <p className="sub">Value of leads marked converted, by the month they closed.</p>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={d.months} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <CartesianGrid stroke="#E8EDF2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6B7A8C' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7A8C' }} axisLine={false} tickLine={false}
                       tickFormatter={(v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : `${Math.round(v / 1e5)}L`)} />
                <Tooltip contentStyle={tip} formatter={(v: any) => inr(Number(v))} />
                <Bar dataKey="converted_value" name="Value won" fill="#166E52" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="two">
          <div className="card">
            <h3>Where the live leads are sitting</h3>
            <p className="sub">Closed leads are excluded.</p>
            <table className="tbl num">
              <tbody>
                {funnel.map((f) => (
                  <tr key={f.stage}>
                    <td style={{ width: 145 }}>{STAGE_LABEL[f.stage]}</td>
                    <td>
                      <span className="bar">
                        <i style={{
                          width: `${Math.max(3, (f.leads / funnelMax) * 100)}%`,
                          background: `var(--s-${f.stage})`,
                        }} />
                      </span>
                    </td>
                    <td className="r" style={{ width: 44 }}>{f.leads}</td>
                    <td className="r" style={{ width: 86 }}>{inr(f.value)}</td>
                  </tr>
                ))}
                {funnel.length === 0 && <tr><td colSpan={4} className="pl-who">No live leads yet.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Segment mix</h3>
            <p className="sub">Which industries the enquiries are coming from.</p>
            <table className="tbl num">
              <thead>
                <tr><th>Segment</th><th className="r">Leads</th><th className="r">Won</th><th className="r">Value</th></tr>
              </thead>
              <tbody>
                {d.by_segment.map((s) => (
                  <tr key={s.segment}>
                    <td>{SEGMENT_LABEL[s.segment] ?? s.segment}</td>
                    <td className="r">{s.leads}</td>
                    <td className="r">{s.won}</td>
                    <td className="r">{inr(s.value)}</td>
                  </tr>
                ))}
                {d.by_segment.length === 0 && <tr><td colSpan={4} className="pl-who">Nothing to show yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {seesAll && (
          <div className="card">
            <h3>By salesperson</h3>
            <p className="sub">This month against target, with the open book behind it.</p>
            <table className="tbl num">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="r">Open</th>
                  <th className="r">Open value</th>
                  <th className="r">Won this month</th>
                  <th style={{ width: 130 }}>Against target</th>
                  <th className="r">Won all time</th>
                </tr>
              </thead>
              <tbody>
                {d.by_owner.map((o) => {
                  const pct = o.target > 0 ? (o.won_value_this_month / o.target) * 100 : 0;
                  return (
                    <tr key={o.owner_id}>
                      <td>{o.name}</td>
                      <td className="r">{o.open}</td>
                      <td className="r">{inr(o.open_value)}</td>
                      <td className="r">{inr(o.won_value_this_month)}</td>
                      <td>
                        {o.target > 0 ? (
                          <>
                            <span className="bar">
                              <i style={{ width: `${Math.min(100, pct)}%` }}
                                 data-over={pct >= 100 ? '1' : '0'} />
                            </span>
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                              {Math.round(pct)}% of {inr(o.target)}
                            </span>
                          </>
                        ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>No target set</span>}
                      </td>
                      <td className="r">{inr(o.won_value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const tip = {
  background: '#fff', border: '1px solid #D8DFE6', borderRadius: 6,
  fontSize: 13, color: '#152030',
};

function Kpi({ k, v, m, tone }: { k: string; v: string; m: string; tone?: 'won' | 'alert' }) {
  return (
    <div className="kpi" data-tone={tone}>
      <div className="k">{k}</div>
      <div className="v num">{v}</div>
      <div className="m">{m}</div>
    </div>
  );
}
