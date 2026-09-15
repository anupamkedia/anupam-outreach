'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { supabase, inr, qty as fmtQty, monthStart, monthLabel, type Profile } from '@/lib/supabase-browser';
import { PipelineNav } from '../nav';
import '../pipeline.css';

type Row = {
  owner_id: string;
  full_name: string;
  target_value: string;
  target_quantity: string;
  achieved_value: number;
  achieved_quantity: number;
  orders: number;
  dirty: boolean;
};

export default function TargetsPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [period, setPeriod] = useState(monthStart(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [copyMonths, setCopyMonths] = useState(3);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = '/login'; return; }

    const { data: prof } = await supabase
      .from('pipeline_profiles').select('id, full_name, role').eq('id', auth.user.id).single();
    setMe(prof as Profile);

    const [{ data: people }, { data: targets }, { data: achieved }] = await Promise.all([
      supabase.from('pipeline_profiles')
        .select('id, full_name, role').eq('is_active', true).eq('role', 'rep').order('full_name'),
      supabase.from('pipeline_targets')
        .select('owner_id, target_value, target_quantity').eq('period', period),
      supabase.from('pipeline_monthly_sales')
        .select('owner_id, gross_value, quantity, orders').eq('month', period),
    ]);

    const tMap = new Map((targets ?? []).map((t: any) => [t.owner_id, t]));
    const aMap = new Map((achieved ?? []).map((a: any) => [a.owner_id, a]));

    setRows((people ?? []).map((p: any) => ({
      owner_id: p.id,
      full_name: p.full_name,
      target_value: String(tMap.get(p.id)?.target_value ?? ''),
      target_quantity: String(tMap.get(p.id)?.target_quantity ?? ''),
      achieved_value: Number(aMap.get(p.id)?.gross_value ?? 0),
      achieved_quantity: Number(aMap.get(p.id)?.quantity ?? 0),
      orders: Number(aMap.get(p.id)?.orders ?? 0),
      dirty: false,
    })));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const edit = (id: string, k: 'target_value' | 'target_quantity', v: string) =>
    setRows((rs) => rs.map((r) => (r.owner_id === id ? { ...r, [k]: v, dirty: true } : r)));

  async function saveAll() {
    setErr(''); setMsg('');
    const changed = rows.filter((r) => r.dirty);
    if (changed.length === 0) { setMsg('Nothing to save.'); return; }

    const { error } = await supabase.from('pipeline_targets').upsert(
      changed.map((r) => ({
        owner_id: r.owner_id,
        period,
        target_value: Number(r.target_value) || 0,
        target_quantity: Number(r.target_quantity) || 0,
      })),
      { onConflict: 'owner_id,period' }
    );

    if (error) { setErr(error.message); return; }
    setMsg(`Saved ${changed.length} ${changed.length === 1 ? 'target' : 'targets'} for ${monthLabel(period)}.`);
    load();
  }

  async function copyForward() {
    setErr(''); setMsg('');
    const base = rows.filter((r) => Number(r.target_value) > 0);
    if (base.length === 0) { setErr('Set some targets for this month first.'); return; }

    const payload: any[] = [];
    for (let n = 1; n <= copyMonths; n++) {
      const d = new Date(period + 'T00:00:00');
      d.setMonth(d.getMonth() + n);
      const p = monthStart(d);
      for (const r of base) {
        payload.push({
          owner_id: r.owner_id, period: p,
          target_value: Number(r.target_value) || 0,
          target_quantity: Number(r.target_quantity) || 0,
        });
      }
    }

    const { error } = await supabase.from('pipeline_targets')
      .upsert(payload, { onConflict: 'owner_id,period' });
    if (error) setErr(error.message);
    else setMsg(`Copied to the next ${copyMonths} ${copyMonths === 1 ? 'month' : 'months'}.`);
  }

  function shift(n: number) {
    const d = new Date(period + 'T00:00:00');
    d.setMonth(d.getMonth() + n);
    setPeriod(monthStart(d));
  }

  if (me && me.role !== 'admin') {
    return (
      <div className="pl"><div className="pl-wrap">
        <header className="pl-top">
          <h1>Targets</h1>
          <PipelineNav current="targets" isAdmin={false} />
        </header>
        <div className="pl-note">
          Targets are set by the administrator. Your own target for this month is on the
          Sales screen.
        </div>
      </div></div>
    );
  }

  const totalTarget = rows.reduce((a, r) => a + (Number(r.target_value) || 0), 0);
  const totalAchieved = rows.reduce((a, r) => a + r.achieved_value, 0);

  return (
    <div className="pl">
      <div className="pl-wrap">
        <header className="pl-top">
          <h1>Targets</h1>
          <span className="pl-who">Only you can change these</span>
          <PipelineNav current="targets" isAdmin />
        </header>

        <div className="pl-bar">
          <button className="btn" onClick={() => shift(-1)}>Previous month</button>
          <span className="btn" style={{ cursor: 'default', minWidth: 140, textAlign: 'center' }}>
            {monthLabel(period)}
          </span>
          <button className="btn" onClick={() => shift(1)}>Next month</button>
          <button className="btn btn-primary" onClick={saveAll}>Save targets</button>
        </div>

        {msg && <div className="pl-note">{msg}</div>}
        {err && <div className="pl-note stop">{err}</div>}

        <div className="card">
          <h3>{monthLabel(period)}</h3>
          <p className="sub">
            Set a value target in rupees, and optionally a volume target in litres or kg.
            Volume targets are what stop a month being made up on discounted bulk.
          </p>

          <table className="tbl num">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th className="r" style={{ width: 140 }}>Target (₹)</th>
                <th className="r" style={{ width: 130 }}>Target volume</th>
                <th className="r">Achieved</th>
                <th className="r">Volume done</th>
                <th className="r">Orders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.owner_id}>
                  <td>{r.full_name}</td>
                  <td className="r">
                    <input type="number" inputMode="numeric" value={r.target_value}
                           placeholder="0" style={inputStyle}
                           onChange={(e) => edit(r.owner_id, 'target_value', e.target.value)} />
                  </td>
                  <td className="r">
                    <input type="number" inputMode="numeric" value={r.target_quantity}
                           placeholder="0" style={inputStyle}
                           onChange={(e) => edit(r.owner_id, 'target_quantity', e.target.value)} />
                  </td>
                  <td className="r">{inr(r.achieved_value)}</td>
                  <td className="r">{fmtQty(r.achieved_quantity)}</td>
                  <td className="r">{r.orders}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="pl-empty">
                  <strong>No salespeople yet</strong>
                  Add them in Supabase under Authentication, then they appear here.
                </td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td>Total</td>
                  <td className="r">{inr(totalTarget)}</td>
                  <td />
                  <td className="r">{inr(totalAchieved)}</td>
                  <td colSpan={2} className="r" style={{ color: 'var(--muted)', fontWeight: 400 }}>
                    {totalTarget > 0 ? `${Math.round((totalAchieved / totalTarget) * 100)}% of target` : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="card">
          <h3>Copy these targets forward</h3>
          <p className="sub">
            Saves setting the same numbers every month. Existing targets in those months are
            overwritten, so change them here first if a month is different.
          </p>
          <div className="pl-bar" style={{ marginBottom: 0 }}>
            <select value={copyMonths} onChange={(e) => setCopyMonths(Number(e.target.value))}>
              {[1, 2, 3, 6, 12].map((n) => (
                <option key={n} value={n}>Next {n} {n === 1 ? 'month' : 'months'}</option>
              ))}
            </select>
            <button className="btn" onClick={copyForward}>Copy forward</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '6px 8px', border: '1px solid var(--line)',
  borderRadius: 5, font: 'inherit', textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
