'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  supabase, STAGES, ACTIVE_STAGES, STAGE_LABEL, DEEP_STAGES,
  SEGMENT_LABEL, inr, ago, type Lead, type Stage, type Profile,
} from '@/lib/supabase-browser';
import { parseLead, PRODUCT_OPTIONS, SEGMENT_OPTIONS, type ParsedLead } from '@/lib/parse-lead';
import { PipelineNav } from './nav';
import './pipeline.css';

const dayKey = (iso: string) => new Date(iso).toDateString();

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const countOnDay = (rows: Lead[], iso: string, by: string) =>
  rows.filter((r) => dayKey(by === 'created' ? r.created_at : r.updated_at) === dayKey(iso)).length;

const EMPTY: Partial<Lead> = {
  company_name: '', contact_person: '', designation: '', email: '', phone: '',
  city: '', state: '', segment: '', products: [], stage: 'new_lead',
  expected_value: 0, notes: '', next_action: '',
};

export default function PipelinePage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stageFilter, setStageFilter] = useState<Stage | null>(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [q, setQ] = useState('');
  const [showConverted, setShowConverted] = useState(false);
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'value'>('created');

  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Lead | null>(null);

  const seesAll =
    me?.role === 'admin' || me?.role === 'manager' || me?.role === 'coordinator';
  const canAssign = me?.role === 'admin' || me?.role === 'coordinator';

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = '/login'; return; }

    const { data: prof } = await supabase
      .from('pipeline_profiles').select('id, full_name, role').eq('id', auth.user.id).single();
    setMe(prof as Profile);

    const { data: people } = await supabase
      .from('pipeline_profiles').select('id, full_name, role').eq('is_active', true).order('full_name');
    setTeam((people ?? []) as Profile[]);

    // RLS decides the scope. No role branching needed here.
    const { data, error } = await supabase
      .from('pipeline_leads').select('*').order('updated_at', { ascending: false }).limit(1000);

    if (error) setError(error.message);
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, { n: number; v: number }> = {};
    for (const s of STAGES) c[s] = { n: 0, v: 0 };
    for (const l of leads) {
      c[l.stage].n += 1;
      c[l.stage].v += Number(l.expected_value) || 0;
    }
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = leads.filter((l) => {
      if (stageFilter && l.stage !== stageFilter) return false;
      if (!stageFilter && !showConverted && (l.stage === 'converted' || l.stage === 'lost')) return false;
      if (ownerFilter !== 'all' && l.owner_id !== ownerFilter) return false;
      if (!needle) return true;
      return [l.company_name, l.contact_person, l.phone, l.email, l.city, l.notes]
        .some((f) => f?.toLowerCase().includes(needle));
    });

    return rows.sort((a, b) =>
      sortBy === 'value'
        ? (Number(b.expected_value) || 0) - (Number(a.expected_value) || 0)
        : (sortBy === 'created' ? b.created_at : b.updated_at)
            .localeCompare(sortBy === 'created' ? a.created_at : a.updated_at));
  }, [leads, stageFilter, ownerFilter, q, showConverted, sortBy]);

  const openValue = visible.reduce(
    (a, l) => a + (l.stage === 'converted' || l.stage === 'lost' ? 0 : Number(l.expected_value) || 0), 0);

  return (
    <div className="pl">
      <div className="pl-wrap">

        <header className="pl-top">
          <h1>Sales pipeline</h1>
          <span className="pl-who">
            {me?.full_name}{seesAll ? ' · seeing all leads' : ' · your leads'}
          </span>
          <PipelineNav current="leads" isAdmin={me?.role === 'admin'} role={me?.role} />
        </header>

        {error && <div className="pl-note stop">Could not load leads: {error}</div>}

        <div className="pl-rail">
          {STAGES.map((s) => (
            <button
              key={s}
              className="pl-chip num"
              style={{ background: `var(--s-${s})` }}
              data-deep={DEEP_STAGES.includes(s) ? '1' : '0'}
              aria-pressed={stageFilter === s}
              onClick={() => setStageFilter(stageFilter === s ? null : s)}
            >
              <span className="k">{STAGE_LABEL[s]}</span>
              <span className="v">{counts[s].n}</span>
              <span className="m">{inr(counts[s].v)}</span>
            </button>
          ))}
        </div>

        <div className="pl-bar">
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, contact, phone, city"
          />
          {seesAll && (
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="all">Everyone</option>
              {team.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="created">By date added</option>
            <option value="updated">By last activity</option>
            <option value="value">By order value</option>
          </select>
          <button className="btn" onClick={() => setShowConverted((v) => !v)}>
            {showConverted ? 'Hide closed' : 'Show closed'}
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>Add lead</button>
        </div>

        <div className="pl-list">
          {loading && <div className="pl-empty">Loading your pipeline…</div>}

          {!loading && visible.length === 0 && (
            <div className="pl-empty">
              <strong>Nothing here yet</strong>
              Add your first lead, or paste an enquiry straight from email or WhatsApp.
            </div>
          )}

          {visible.map((l, idx) => {
            const stamp = sortBy === 'created' ? l.created_at : l.updated_at;
            const prev = idx > 0
              ? (sortBy === 'created' ? visible[idx - 1].created_at : visible[idx - 1].updated_at)
              : null;
            const newDay = sortBy !== 'value'
              && (!prev || dayKey(stamp) !== dayKey(prev));
            const overdue = !!l.next_action_date
              && l.next_action_date < new Date().toISOString().slice(0, 10)
              && !l.is_locked && l.stage !== 'lost';
            return (
              <Fragment key={l.id}>
              {newDay && (
                <div className="pl-daybar">
                  {dayHeading(stamp)}
                  <span>{countOnDay(visible, stamp, sortBy)} leads</span>
                </div>
              )}
              <div
                className="pl-row" data-locked={l.is_locked ? '1' : '0'}
                data-overdue={overdue ? '1' : '0'}
                role="button" tabIndex={0}
                onClick={() => setOpen(l)}
                onKeyDown={(e) => e.key === 'Enter' && setOpen(l)}
              >
                <span className="tick" style={{ background: `var(--s-${l.stage})` }} />
                <span className="co">{l.company_name}</span>
                <span className="amt num">{inr(l.expected_value)}</span>
                <span className="sub">
                  {[l.contact_person, l.city, l.segment && SEGMENT_LABEL[l.segment]]
                    .filter(Boolean).join(' · ')}
                  {overdue && ` · follow-up due ${l.next_action_date}`}
                </span>
                <span className="st">
                  {STAGE_LABEL[l.stage]} · {shortDate(l.created_at)}
                </span>
              </div>
              </Fragment>
            );
          })}
        </div>

        {!loading && visible.length > 0 && (
          <p className="pl-who num" style={{ marginTop: 12 }}>
            {visible.length} leads · {inr(openValue)} still open
          </p>
        )}
      </div>

      {adding && (
        <IntakeDrawer
          me={me} team={team} seesAll={!!seesAll}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      )}

      {open && (
        <LeadDrawer
          lead={open} me={me} team={team} seesAll={!!seesAll}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); load(); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Intake — manual, email paste, WhatsApp paste
   ══════════════════════════════════════════════════════════ */

function IntakeDrawer({ me, team, seesAll, onClose, onSaved }: {
  me: Profile | null; team: Profile[]; seesAll: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState<'manual' | 'email' | 'whatsapp'>('manual');
  const [raw, setRaw] = useState('');
  const [form, setForm] = useState<Partial<Lead>>({ ...EMPTY, owner_id: me?.id });
  const [guessed, setGuessed] = useState<ParsedLead['confidence']>({});
  const [dupes, setDupes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof Lead, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function readPaste() {
    if (!raw.trim()) return;
    const p = parseLead(raw, tab === 'whatsapp' ? 'whatsapp' : 'email');
    setForm((f) => ({
      ...f,
      company_name: p.company_name || f.company_name,
      contact_person: p.contact_person || f.contact_person,
      designation: p.designation || f.designation,
      email: p.email || f.email,
      phone: p.phone || f.phone,
      whatsapp: p.whatsapp || f.whatsapp,
      city: p.city || f.city,
      state: p.state || f.state,
      segment: p.segment || f.segment,
      products: p.products.length ? p.products : f.products,
      expected_value: p.expected_value || f.expected_value,
      notes: p.notes || f.notes,
      raw_intake: raw,
      source: tab === 'whatsapp' ? 'whatsapp_paste' : 'email_paste',
    }));
    setGuessed(p.confidence);
    checkDupes(p.phone, p.email, p.company_name);
  }

  async function checkDupes(phone?: string, email?: string, company?: string) {
    const { data } = await supabase.rpc('pipeline_check_duplicate', {
      p_phone: phone || form.phone || null,
      p_email: email || form.email || null,
      p_company: company || form.company_name || null,
    });
    setDupes(data ?? []);
  }

  async function save() {
    if (!form.company_name?.trim()) { setErr('A company name is needed before saving.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('pipeline_leads').insert({
      ...form,
      owner_id: form.owner_id || me?.id,
      expected_value: Number(form.expected_value) || 0,
      source: form.source ?? 'manual',
    });
    setSaving(false);
    if (error) setErr(error.message); else onSaved();
  }

  const toggleProduct = (p: string) => {
    const cur = form.products ?? [];
    set('products', cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  };

  return (
    <div className="pl-scrim" onClick={onClose}>
      <div className="pl-drawer pl" onClick={(e) => e.stopPropagation()}>
        <h2>Add a lead</h2>
        <p className="hint">Type it in, or paste the enquiry and let the fields fill themselves.</p>

        <div className="pl-tabs" role="tablist">
          {(['manual', 'email', 'whatsapp'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === 'manual' ? 'Type it in' : t === 'email' ? 'Paste email' : 'Paste WhatsApp'}
            </button>
          ))}
        </div>

        {tab !== 'manual' && (
          <div className="fld">
            <label htmlFor="raw">
              {tab === 'email' ? 'Paste the enquiry email' : 'Paste the WhatsApp messages'}
            </label>
            <textarea
              id="raw" value={raw} onChange={(e) => setRaw(e.target.value)}
              style={{ minHeight: 140 }}
              placeholder={tab === 'email'
                ? 'Include the signature — that is where the company, phone and designation usually sit.'
                : 'Copy the chat from WhatsApp and paste it here, names and timestamps included.'}
            />
            <button className="btn" style={{ marginTop: 8 }} onClick={readPaste} disabled={!raw.trim()}>
              Fill the fields
            </button>
          </div>
        )}

        {Object.keys(guessed).length > 0 && (
          <div className="pl-note">
            Filled from your paste. Yellow fields are best guesses — check them before saving.
          </div>
        )}

        {dupes.length > 0 && (
          <div className={`pl-note ${dupes.some((d) => !d.is_mine) ? 'stop' : 'warn'}`}>
            {dupes.map((d, i) => (
              <div key={i}>
                {d.company_name} is already in the pipeline at {STAGE_LABEL[d.stage as Stage]}
                {d.is_mine ? ' under you.' : ` under ${d.owner_name}.`}
              </div>
            ))}
          </div>
        )}

        <Fields form={form} set={set} guessed={guessed} toggleProduct={toggleProduct}
                team={team} seesAll={seesAll} onBlurDupe={() => checkDupes()} />

        {err && <div className="pl-note stop">{err}</div>}

        <div className="pl-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save lead'}
          </button>
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Open lead — edit, move stage, log activity
   ══════════════════════════════════════════════════════════ */

function LeadDrawer({ lead, me, team, seesAll, onClose, onSaved }: {
  lead: Lead; me: Profile | null; team: Profile[]; seesAll: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Lead>>(lead);
  const [log, setLog] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('call');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isAdmin = me?.role === 'admin';
  const locked = lead.is_locked && !isAdmin;
  const set = (k: keyof Lead, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    supabase.from('pipeline_activities')
      .select('id, kind, notes, occurred_at')
      .eq('lead_id', lead.id).order('occurred_at', { ascending: false }).limit(30)
      .then(({ data }) => setLog(data ?? []));
  }, [lead.id]);

  async function save() {
    setSaving(true); setErr('');
    const { id, created_at, updated_at, ...rest } = form as any;
    const { error } = await supabase.from('pipeline_leads')
      .update({ ...rest, expected_value: Number(form.expected_value) || 0 })
      .eq('id', lead.id);
    setSaving(false);
    if (error) setErr(error.message); else onSaved();
  }

  async function addActivity() {
    if (!note.trim()) return;
    const { error } = await supabase.from('pipeline_activities').insert({
      lead_id: lead.id, user_id: me?.id, kind, notes: note.trim(),
    });
    if (error) { setErr(error.message); return; }
    setLog([{ id: Math.random(), kind, notes: note, occurred_at: new Date().toISOString() }, ...log]);
    setNote('');
  }

  return (
    <div className="pl-scrim" onClick={onClose}>
      <div className="pl-drawer pl" onClick={(e) => e.stopPropagation()}>
        <h2>{lead.company_name}</h2>
        <p className="hint">
          Added {ago(lead.created_at)} · {lead.source.replace('_', ' ')}
          {lead.converted_at && ` · converted ${ago(lead.converted_at)}`}
        </p>

        {lead.is_locked && (
          <div className={`pl-note ${isAdmin ? 'warn' : ''}`}>
            {isAdmin
              ? 'This lead is converted and locked. Move it off Converted to reopen it.'
              : 'This lead is converted and locked. Ask an admin if it needs reopening.'}
          </div>
        )}

        <div className="fld">
          <label htmlFor="stage">Stage</label>
          <select
            id="stage" value={form.stage} disabled={locked}
            onChange={(e) => set('stage', e.target.value as Stage)}
          >
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </div>

        {form.stage === 'converted' && (
          <div className="fld">
            <label htmlFor="cv">Order value won</label>
            <input id="cv" type="number" value={form.converted_value ?? form.expected_value ?? 0}
                   disabled={locked} onChange={(e) => set('converted_value', e.target.value)} />
          </div>
        )}

        {form.stage === 'lost' && (
          <div className="fld">
            <label htmlFor="lr">Why was it lost?</label>
            <input id="lr" value={form.lost_reason ?? ''}
                   onChange={(e) => set('lost_reason', e.target.value)}
                   placeholder="Price, lead time, competitor, project shelved" />
          </div>
        )}

        <Fields form={form} set={set} guessed={{}} disabled={locked}
                toggleProduct={(p) => {
                  const cur = form.products ?? [];
                  set('products', cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
                }}
                team={team} seesAll={seesAll && isAdmin} onBlurDupe={() => {}} />

        {err && <div className="pl-note stop">{err}</div>}

        <div className="pl-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving || locked}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn btn-quiet" onClick={onClose}>Close</button>
        </div>

        <div className="pl-log">
          <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Activity</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select value={kind} onChange={(e) => setKind(e.target.value)}
                    style={{ padding: 9, border: '1px solid var(--line)', borderRadius: 6, font: 'inherit' }}>
              {['call', 'email', 'whatsapp', 'meeting', 'site_visit', 'sample', 'quotation', 'note']
                .map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="What happened?" style={{ flex: 1, padding: 9, border: '1px solid var(--line)', borderRadius: 6, font: 'inherit' }} />
            <button className="btn" onClick={addActivity}>Log</button>
          </div>
          <ul style={{ margin: 0, padding: 0 }}>
            {log.map((a) => (
              <li key={a.id}>
                <span className="when">{new Date(a.occurred_at).toLocaleDateString('en-IN')} · {a.kind.replace('_', ' ')}</span>
                <br />{a.notes}
              </li>
            ))}
            {log.length === 0 && <li className="when">No activity logged yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared field block
   ══════════════════════════════════════════════════════════ */

function Fields({ form, set, guessed, toggleProduct, team, seesAll, disabled, onBlurDupe }: {
  form: Partial<Lead>;
  set: (k: keyof Lead, v: any) => void;
  guessed: ParsedLead['confidence'];
  toggleProduct: (p: string) => void;
  team: Profile[]; seesAll: boolean; disabled?: boolean;
  onBlurDupe: () => void;
}) {
  const g = (k: string) => (guessed[k] && guessed[k] !== 'high' ? '1' : '0');

  return (
    <>
      <div className="fld" data-guess={g('company_name')}>
        <label htmlFor="co">Company</label>
        <input id="co" value={form.company_name ?? ''} disabled={disabled}
               onBlur={onBlurDupe}
               onChange={(e) => set('company_name', e.target.value)} />
      </div>

      <div className="grid2">
        <div className="fld" data-guess={g('contact_person')}>
          <label htmlFor="cp">Contact person</label>
          <input id="cp" value={form.contact_person ?? ''} disabled={disabled}
                 onChange={(e) => set('contact_person', e.target.value)} />
        </div>
        <div className="fld" data-guess={g('designation')}>
          <label htmlFor="dg">Designation</label>
          <input id="dg" value={form.designation ?? ''} disabled={disabled}
                 onChange={(e) => set('designation', e.target.value)} />
        </div>
        <div className="fld" data-guess={g('phone')}>
          <label htmlFor="ph">Phone</label>
          <input id="ph" value={form.phone ?? ''} disabled={disabled} onBlur={onBlurDupe}
                 onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="fld" data-guess={g('email')}>
          <label htmlFor="em">Email</label>
          <input id="em" value={form.email ?? ''} disabled={disabled} onBlur={onBlurDupe}
                 onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="fld" data-guess={g('city')}>
          <label htmlFor="ct">City</label>
          <input id="ct" value={form.city ?? ''} disabled={disabled}
                 onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="sg">Segment</label>
          <select id="sg" value={form.segment ?? ''} disabled={disabled}
                  onChange={(e) => set('segment', e.target.value)}>
            <option value="">Not set</option>
            {SEGMENT_OPTIONS.map((s) => (
              <option key={s} value={s}>{SEGMENT_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
        <div className="fld" data-guess={g('expected_value')}>
          <label htmlFor="ev">Expected order value (₹)</label>
          <input id="ev" type="number" value={form.expected_value ?? 0} disabled={disabled}
                 onChange={(e) => set('expected_value', e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="cd">Expected close date</label>
          <input id="cd" type="date" value={form.expected_close_date ?? ''} disabled={disabled}
                 onChange={(e) => set('expected_close_date', e.target.value || null)} />
        </div>
      </div>

      <div className="fld">
        <label>Products enquired</label>
        <div className="chips">
          {PRODUCT_OPTIONS.map((p) => (
            <button key={p} type="button" disabled={disabled}
                    aria-pressed={(form.products ?? []).includes(p)}
                    onClick={() => toggleProduct(p)}>{p}</button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="fld">
          <label htmlFor="na">Next action</label>
          <input id="na" value={form.next_action ?? ''} disabled={disabled}
                 onChange={(e) => set('next_action', e.target.value)}
                 placeholder="Send quotation, arrange site visit" />
        </div>
        <div className="fld">
          <label htmlFor="nd">Next action date</label>
          <input id="nd" type="date" value={form.next_action_date ?? ''} disabled={disabled}
                 onChange={(e) => set('next_action_date', e.target.value || null)} />
        </div>
      </div>

      {seesAll && (
        <div className="fld">
          <label htmlFor="ow">Assigned to</label>
          <select id="ow" value={form.owner_id ?? ''} disabled={disabled}
                  onChange={(e) => set('owner_id', e.target.value)}>
            {team.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      )}

      <div className="fld">
        <label htmlFor="nt">Notes</label>
        <textarea id="nt" value={form.notes ?? ''} disabled={disabled}
                  onChange={(e) => set('notes', e.target.value)} />
      </div>
    </>
  );
}
