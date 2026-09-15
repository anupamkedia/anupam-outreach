'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  supabase, inr, qty as fmtQty, SEGMENT_LABEL, type Profile,
} from '@/lib/supabase-browser';
import { PRODUCT_OPTIONS } from '@/lib/parse-lead';
import { PipelineNav } from '../nav';
import '../pipeline.css';

type Item = { product: string; quantity: string; unit: 'L' | 'KG'; rate: string };
type Sale = {
  id: string; owner_id: string; company_name: string; invoice_no: string | null;
  sale_date: string; segment: string | null; quantity: number; gross_value: number;
  transport_cost: number; net_value: number; asp: number | null;
  net_realization: number | null; notes: string | null;
};
type ThisMonth = {
  target: number; achieved: number; quantity: number; transport: number; net: number;
  orders: number; asp: number | null; transport_pct: number | null; days_left: number;
};
type OwnerRow = {
  owner_id: string; full_name: string; target_value: number; achieved_value: number;
  achieved_quantity: number; orders: number; pct_value: number | null;
  gap_value: number; asp: number | null;
};

const blankItem = (): Item => ({ product: '', quantity: '', unit: 'L', rate: '' });

export default function SalesPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tm, setTm] = useState<ThisMonth | null>(null);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [editing, setEditing] = useState<Sale | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const seesAll = me?.role === 'admin' || me?.role === 'manager';

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = '/login'; return; }

    const [{ data: prof }, { data: people }, { data: rows }, { data: dash }] = await Promise.all([
      supabase.from('pipeline_profiles').select('id, full_name, role').eq('id', auth.user.id).single(),
      supabase.from('pipeline_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('pipeline_sales').select('*').order('sale_date', { ascending: false }).limit(300),
      supabase.rpc('pipeline_sales_dashboard', { p_months: 12 }),
    ]);

    setMe(prof as Profile);
    setTeam((people ?? []) as Profile[]);
    setSales((rows ?? []) as Sale[]);
    if (dash) {
      setTm(dash.this_month as ThisMonth);
      setOwners((dash.by_owner ?? []) as OwnerRow[]);
      setProducts(dash.products ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => sales.filter((s) => ownerFilter === 'all' || s.owner_id === ownerFilter),
    [sales, ownerFilter]
  );

  const pct = tm && tm.target > 0 ? (tm.achieved / tm.target) * 100 : 0;
  const perDay = tm && tm.days_left > 0 ? Math.max(0, tm.target - tm.achieved) / tm.days_left : 0;

  return (
    <div className="pl">
      <div className="pl-wrap">
        <header className="pl-top">
          <h1>Sales and targets</h1>
          <span className="pl-who">{me?.full_name}{seesAll ? ' · whole team' : ''}</span>
          <PipelineNav current="sales" isAdmin={me?.role === 'admin'} />
        </header>

        {err && <div className="pl-note stop">{err}</div>}

        {tm && (
          <div className="card">
            <h3>This month</h3>
            <p className="sub">
              {tm.target > 0
                ? `${inr(tm.achieved)} against a target of ${inr(tm.target)}`
                : 'No target has been set for this month yet.'}
            </p>
            <span className="bar" style={{ height: 10 }}>
              <i style={{ width: `${Math.min(100, pct)}%` }} data-over={pct >= 100 ? '1' : '0'} />
            </span>
            <div className="kpis" style={{ marginTop: 14 }}>
              <Kpi k="Achieved" v={inr(tm.achieved)} m={`${tm.orders} orders`}
                   tone={pct >= 100 ? 'won' : undefined} />
              <Kpi k="Gap to target" v={tm.target > 0 ? inr(Math.max(0, tm.target - tm.achieved)) : '—'}
                   m={tm.days_left > 0 ? `${inr(perDay)} a day for ${tm.days_left} days` : 'Month is over'}
                   tone={pct < 60 && tm.target > 0 ? 'alert' : undefined} />
              <Kpi k="Volume" v={fmtQty(tm.quantity)} m="Litres and kg billed" />
              <Kpi k="Average selling price" v={tm.asp ? `₹${tm.asp}` : '—'} m="Per litre / kg, before freight" />
              <Kpi k="Net realization" v={tm.quantity > 0 ? `₹${(tm.net / tm.quantity).toFixed(2)}` : '—'}
                   m="After freight" />
              <Kpi k="Freight" v={inr(tm.transport)}
                   m={tm.transport_pct != null ? `${tm.transport_pct}% of billing` : 'Nothing booked'}
                   tone={(tm.transport_pct ?? 0) > 6 ? 'alert' : undefined} />
            </div>
          </div>
        )}

        <div className="pl-bar">
          {seesAll && (
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="all">Everyone</option>
              {team.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Record sale</button>
        </div>

        {seesAll && owners.length > 0 && (
          <div className="card">
            <h3>Against target, by salesperson</h3>
            <p className="sub">Current month only.</p>
            <table className="tbl num">
              <thead>
                <tr>
                  <th>Name</th><th className="r">Target</th><th className="r">Achieved</th>
                  <th style={{ width: 120 }}>Progress</th>
                  <th className="r">Volume</th><th className="r">ASP</th><th className="r">Orders</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => {
                  const p = o.pct_value ?? 0;
                  return (
                    <tr key={o.owner_id}>
                      <td>{o.full_name}</td>
                      <td className="r">{inr(o.target_value)}</td>
                      <td className="r">{inr(o.achieved_value)}</td>
                      <td>
                        <span className="bar">
                          <i style={{ width: `${Math.min(100, p)}%` }} data-over={p >= 100 ? '1' : '0'} />
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p}%</span>
                      </td>
                      <td className="r">{fmtQty(o.achieved_quantity)}</td>
                      <td className="r">{o.asp ? `₹${o.asp}` : '—'}</td>
                      <td className="r">{o.orders}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="card">
          <h3>Recorded sales</h3>
          <p className="sub">Tap a row to correct it. Freight is shown separately so it never hides inside the rate.</p>
          <table className="tbl num">
            <thead>
              <tr>
                <th>Date</th><th>Company</th><th className="r">Volume</th>
                <th className="r">Billed</th><th className="r">Freight</th>
                <th className="r">ASP</th><th className="r">Net/unit</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(s)}>
                  <td>{new Date(s.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td>{s.company_name}{s.invoice_no ? ` · ${s.invoice_no}` : ''}</td>
                  <td className="r">{fmtQty(s.quantity)}</td>
                  <td className="r">{inr(s.gross_value)}</td>
                  <td className="r">{inr(s.transport_cost)}</td>
                  <td className="r">{s.asp ? `₹${s.asp}` : '—'}</td>
                  <td className="r">{s.net_realization ? `₹${s.net_realization}` : '—'}</td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={7} className="pl-empty">
                  <strong>No sales recorded yet</strong>
                  Record the first one and the target bar above starts moving.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {products.length > 0 && (
          <div className="card">
            <h3>By product</h3>
            <p className="sub">
              Where the volume actually goes, and the spread between your lowest and highest rate
              on the same product.
            </p>
            <table className="tbl num">
              <thead>
                <tr>
                  <th>Product</th><th className="r">Volume</th><th className="r">Value</th>
                  <th className="r">ASP</th><th className="r">Rate range</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={i}>
                    <td>{p.product}</td>
                    <td className="r">{fmtQty(p.quantity)} {p.unit}</td>
                    <td className="r">{inr(p.value)}</td>
                    <td className="r">₹{p.asp}</td>
                    <td className="r">
                      {p.lowest_rate === p.highest_rate
                        ? `₹${p.lowest_rate}`
                        : `₹${p.lowest_rate} – ₹${p.highest_rate}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <SaleDrawer
          sale={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onError={setErr}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */

function SaleDrawer({ sale, onClose, onSaved, onError }: {
  sale: Sale | null; onClose: () => void; onSaved: () => void; onError: (s: string) => void;
}) {
  const [company, setCompany] = useState(sale?.company_name ?? '');
  const [invoice, setInvoice] = useState(sale?.invoice_no ?? '');
  const [date, setDate] = useState(sale?.sale_date ?? new Date().toISOString().slice(0, 10));
  const [segment, setSegment] = useState(sale?.segment ?? '');
  const [transport, setTransport] = useState(String(sale?.transport_cost ?? 0));
  const [notes, setNotes] = useState(sale?.notes ?? '');
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [leads, setLeads] = useState<{ id: string; company_name: string }[]>([]);
  const [leadId, setLeadId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('pipeline_leads').select('id, company_name')
      .order('company_name').limit(500)
      .then(({ data }) => setLeads(data ?? []));

    if (sale) {
      supabase.from('pipeline_sale_items')
        .select('product, quantity, unit, rate').eq('sale_id', sale.id)
        .then(({ data }) => setItems(
          (data ?? []).map((i: any) => ({
            product: i.product, quantity: String(i.quantity),
            unit: i.unit, rate: String(i.rate),
          })).concat(blankItem())
        ));
    }
  }, [sale]);

  const setItem = (i: number, k: keyof Item, v: string) =>
    setItems((rows) => {
      const next = rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r));
      // Always keep one empty row at the bottom so adding a line needs no button.
      if (i === rows.length - 1 && v) next.push(blankItem());
      return next;
    });

  const filled = items.filter((i) => i.product.trim() && Number(i.quantity) > 0);
  const totalQty = filled.reduce((a, i) => a + Number(i.quantity), 0);
  const gross = filled.reduce((a, i) => a + Number(i.quantity) * Number(i.rate || 0), 0);
  const freight = Number(transport) || 0;
  const asp = totalQty > 0 ? gross / totalQty : 0;
  const netUnit = totalQty > 0 ? (gross - freight) / totalQty : 0;

  async function save() {
    if (!company.trim()) { setErr('Which company was this billed to?'); return; }
    if (filled.length === 0) { setErr('Add at least one product line with a quantity.'); return; }
    setSaving(true); setErr('');

    const { error } = await supabase.rpc('pipeline_record_sale', {
      p_company: company.trim(),
      p_items: filled.map((i) => ({
        product: i.product.trim(), quantity: Number(i.quantity),
        unit: i.unit, rate: Number(i.rate || 0),
      })),
      p_sale_date: date,
      p_invoice: invoice || null,
      p_segment: segment || null,
      p_transport: freight,
      p_lead: leadId || null,
      p_notes: notes || null,
      p_sale_id: sale?.id ?? null,
    });

    setSaving(false);
    if (error) setErr(error.message); else onSaved();
  }

  async function remove() {
    if (!sale) return;
    const { error } = await supabase.from('pipeline_sales').delete().eq('id', sale.id);
    if (error) onError(error.message); else onSaved();
  }

  return (
    <div className="pl-scrim" onClick={onClose}>
      <div className="pl-drawer pl" onClick={(e) => e.stopPropagation()}>
        <h2>{sale ? 'Correct this sale' : 'Record a sale'}</h2>
        <p className="hint">Enter rates before freight. Freight goes in its own box below.</p>

        <div className="fld">
          <label htmlFor="co">Company billed</label>
          <input id="co" list="known-leads" value={company}
                 onChange={(e) => {
                   setCompany(e.target.value);
                   const hit = leads.find((l) => l.company_name === e.target.value);
                   if (hit) setLeadId(hit.id);
                 }} />
          <datalist id="known-leads">
            {leads.map((l) => <option key={l.id} value={l.company_name} />)}
          </datalist>
        </div>

        <div className="grid2">
          <div className="fld">
            <label htmlFor="inv">Invoice number</label>
            <input id="inv" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="dt">Invoice date</label>
            <input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="fld">
          <label htmlFor="sg">Segment</label>
          <select id="sg" value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">Not set</option>
            {Object.keys(SEGMENT_LABEL).filter((k) => k !== 'unspecified')
              .map((s) => <option key={s} value={s}>{SEGMENT_LABEL[s]}</option>)}
          </select>
        </div>

        <div className="fld">
          <label>Products sold</label>
          <table className="tbl num pl-items">
            <thead>
              <tr>
                <th>Product</th><th className="r">Qty</th><th>Unit</th>
                <th className="r">Rate</th><th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <input list="known-products" value={it.product} placeholder="Product"
                           onChange={(e) => setItem(i, 'product', e.target.value)} />
                  </td>
                  <td><input type="number" inputMode="decimal" value={it.quantity}
                             onChange={(e) => setItem(i, 'quantity', e.target.value)} /></td>
                  <td>
                    <select value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)}>
                      <option value="L">L</option><option value="KG">KG</option>
                    </select>
                  </td>
                  <td><input type="number" inputMode="decimal" value={it.rate}
                             onChange={(e) => setItem(i, 'rate', e.target.value)} /></td>
                  <td className="r">
                    {Number(it.quantity) && Number(it.rate)
                      ? inr(Number(it.quantity) * Number(it.rate)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="known-products">
            {PRODUCT_OPTIONS.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>

        <div className="fld">
          <label htmlFor="tr">Transport cost on this invoice (₹)</label>
          <input id="tr" type="number" inputMode="decimal" value={transport}
                 onChange={(e) => setTransport(e.target.value)} />
        </div>

        <div className="pl-note num">
          <div>Volume {fmtQty(totalQty)} · Billed {inr(gross)} · Freight {inr(freight)}</div>
          <div style={{ marginTop: 4, fontWeight: 600 }}>
            Average selling price ₹{asp.toFixed(2)} · Net realization ₹{netUnit.toFixed(2)} per unit
          </div>
        </div>

        <div className="fld">
          <label htmlFor="nt">Notes</label>
          <textarea id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {err && <div className="pl-note stop">{err}</div>}

        <div className="pl-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : sale ? 'Save changes' : 'Record sale'}
          </button>
          {sale && <button className="btn" onClick={remove}>Delete</button>}
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ k, v, m, tone }: { k: string; v: string; m: string; tone?: 'won' | 'alert' }) {
  return (
    <div className="kpi" data-tone={tone}>
      <div className="k">{k}</div>
      <div className="v num">{v}</div>
      <div className="m">{m}</div>
    </div>
  );
}
