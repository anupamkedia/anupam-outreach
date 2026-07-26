"use client";
import { useState, useEffect, useCallback } from "react";

// ── CONSTANTS ──
const ANUPAM_CONTEXT = `You are drafting outreach emails for Anupam Kedia, Managing Director of Anupam Enterprises (Anupam Paints), Kolkata.
Company: 50+ year paint manufacturer. ISO 9001, ISO 14001, ISO 45001. Own alkyd resin plant, ~1000 KL/month, NABL-compliant lab.
Products: Decorative, industrial, marine, railway, defence coatings. Epoxy, PU, Polyurea, Polyaspartic, zinc-rich primers, intumescent, heat-resistant, chemical-resistant, waterproofing, tank linings, pipeline coatings, food-grade, anti-fouling.
Approvals: RDSO, ICF, CLW, DMW, RCF, MCF, Indian Navy, MES, EIL, BHEL, CMRL, AAI, IGBC, WRAS.
Clients: Indian Railways, Indian Navy, GRSE, Mazagon Dock, BHEL, Reliance, Adani, Tata Projects, L&T, Shapoorji Pallonji, KEC, HPCL, IOCL, Lodha, NCC, NBCC.
Key advantage: 10-15% cost advantage vs Asian, Berger, AkzoNobel, Jotun without compromising quality.
Tone: Professional, confident, non-generic. Reference ONLY relevant coatings/approvals/clients for the prospect's industry.`;

const STATUS_CONFIG = {
  new: { label: "New", color: "#64748B", bg: "#64748B18" },
  researched: { label: "Researched", color: "#8B5CF6", bg: "#8B5CF618" },
  emailed: { label: "Emailed", color: "#F5B731", bg: "#F5B73118" },
  followed_up: { label: "Followed Up", color: "#F97316", bg: "#F9731618" },
  whatsapp_sent: { label: "WA Sent", color: "#25D366", bg: "#25D36618" },
  responded: { label: "Responded", color: "#06B6D4", bg: "#06B6D418" },
  meeting: { label: "Meeting", color: "#3B82F6", bg: "#3B82F618" },
  won: { label: "Won ✓", color: "#22C55E", bg: "#22C55E18" },
  lost: { label: "Lost", color: "#EF4444", bg: "#EF444418" },
};

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "outreach", label: "New Outreach", icon: "🎯" },
  { id: "contacts", label: "Contacts", icon: "📇" },
  { id: "training", label: "Training", icon: "✍️" },
  { id: "team", label: "Team", icon: "👥" },
];

const STEPS = [
  { num: 1, label: "Input" }, { num: 2, label: "Review" }, { num: 3, label: "Research" },
  { num: 4, label: "Email" }, { num: 5, label: "Sent" }, { num: 6, label: "WhatsApp" },
];

// ── STYLES ──
const S = {
  card: { background: "#111827", borderRadius: 12, border: "1px solid #1E293B", padding: 16, marginBottom: 12 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #1E293B", background: "#0B1120", color: "#E8ECF1", fontSize: 14, outline: "none" },
  textarea: { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #1E293B", background: "#0B1120", color: "#E8ECF1", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical" },
  btnPrimary: { width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #D4940A, #F5B731)", color: "#0B1120", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  btnSecondary: { padding: "10px 16px", borderRadius: 8, border: "1px solid #1E293B", background: "#111827", color: "#94A3B8", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  label: { fontSize: 11, color: "#64748B", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" },
  badge: (status) => ({ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: STATUS_CONFIG[status]?.bg || "#1E293B", color: STATUS_CONFIG[status]?.color || "#94A3B8", whiteSpace: "nowrap" }),
};

// ── API HELPERS ──
function getPin() { return typeof window !== "undefined" ? localStorage.getItem("ap-pin") || "" : ""; }
function getUserId() { try { const u = JSON.parse(localStorage.getItem("ap-user") || "{}"); return u.id || ""; } catch { return ""; } }

async function api(endpoint, body) {
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), userId: getUserId(), ...body }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiGet(params) {
  const qs = new URLSearchParams({ pin: getPin(), ...params }).toString();
  const res = await fetch(`/api/prospects?${qs}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function callClaude(messages, useSearch = false) { return api("/api/claude", { messages, useSearch }); }
function extractText(r) { return (r?.content || []).filter(b => b.type === "text").map(b => b.text).join("\n"); }
function parseJSON(t) { try { return JSON.parse(t.replace(/```json|```/g, "").trim()); } catch { return null; } }

// ══════════════════════════════════════════
// MAIN APP COMPONENT
// ══════════════════════════════════════════
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Dashboard
  const [dashboard, setDashboard] = useState(null);

  // Outreach
  const [step, setStep] = useState(1);
  const [inputMode, setInputMode] = useState("manual");
  const [inputText, setInputText] = useState("");
  const [form, setForm] = useState({ name: "", company: "", designation: "", email: "", phone: "", industry: "", location: "", summary: "" });
  const [prospect, setProspect] = useState(null);
  const [savedProspectId, setSavedProspectId] = useState(null);
  const [research, setResearch] = useState("");
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });
  const [whatsappDraft, setWhatsappDraft] = useState("");
  const [lushaLoading, setLushaLoading] = useState(false);
  const [tcLoading, setTcLoading] = useState(false);

  // Contacts
  const [contacts, setContacts] = useState([]);
  const [contactFilter, setContactFilter] = useState("all");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactDetail, setContactDetail] = useState(null);

  // Training & Team
  const [styles, setStyles] = useState([]);
  const [newSample, setNewSample] = useState("");
  const [team, setTeam] = useState([]);
  const [newMember, setNewMember] = useState({ name: "", email: "" });

  // Follow-up
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");

  // ── AUTH ──
  useEffect(() => {
    const pin = localStorage.getItem("ap-pin");
    const u = localStorage.getItem("ap-user");
    if (pin && u) { setAuthed(true); setUser(JSON.parse(u)); }
  }, []);

  const handleLogin = async () => {
    if (!loginEmail || !loginPin) { setLoginError("Enter email and PIN"); return; }
    setLoading(true);
    try {
      localStorage.setItem("ap-pin", loginPin);
      const userData = await api("/api/prospects", { action: "login", email: loginEmail.toLowerCase().trim() });
      localStorage.setItem("ap-user", JSON.stringify(userData));
      setUser(userData); setAuthed(true); setLoginError("");
    } catch (e) {
      setLoginError(e.message);
      localStorage.removeItem("ap-pin");
    }
    setLoading(false);
  };

  const logout = () => { localStorage.removeItem("ap-pin"); localStorage.removeItem("ap-user"); setAuthed(false); setUser(null); };

  // ── DATA LOADING ──
  const loadDashboard = useCallback(async () => {
    try { setDashboard(await apiGet({ action: "dashboard" })); } catch {}
  }, []);

  const loadContacts = useCallback(async () => {
    try { setContacts(await apiGet({ action: "list", status: contactFilter, search: contactSearch })); } catch {}
  }, [contactFilter, contactSearch]);

  const loadContactDetail = useCallback(async (id) => {
    try { setContactDetail(await apiGet({ action: "detail", id })); } catch {}
  }, []);

  const loadStyles = useCallback(async () => {
    try { setStyles(await apiGet({ action: "styles" })); } catch {}
  }, []);

  const loadTeam = useCallback(async () => {
    try { setTeam(await apiGet({ action: "team" })); } catch {}
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (tab === "dashboard") loadDashboard();
    if (tab === "contacts") loadContacts();
    if (tab === "training") loadStyles();
    if (tab === "team") loadTeam();
  }, [authed, tab, loadDashboard, loadContacts, loadStyles, loadTeam]);

  // ── OUTREACH HANDLERS ──
  const lushaLookup = async () => {
    if (!prospect) return;
    setLushaLoading(true); setError("");
    try {
      var parts = prospect.name.trim().split(" ");
      var data = await api("/api/lusha", { firstName: parts[0], lastName: parts.slice(1).join(" "), company: prospect.company });
      var updates = {};
      if (data.emails && data.emails.length && !prospect.email) updates.email = data.emails[0].email;
      if (data.phones && data.phones.length && !prospect.phone) updates.phone = data.phones[0].phone;
      if (data.title && !prospect.designation) updates.designation = data.title;
      if (Object.keys(updates).length) {
        setProspect(function(p) { return Object.assign({}, p, updates); });
        setStatus("Lusha found " + (data.emails ? data.emails.length : 0) + " email(s), " + (data.phones ? data.phones.length : 0) + " phone(s)");
      } else { setStatus("Lusha: No new data found"); }
      setTimeout(function() { setStatus(""); }, 3000);
    } catch (e) { setError("Lusha: " + e.message); }
    setLushaLoading(false);
  };

  const resetOutreach = () => {
    setStep(1); setInputText(""); setProspect(null); setSavedProspectId(null);
    setResearch(""); setEmailDraft({ subject: "", body: "" }); setWhatsappDraft("");
    setError(""); setStatus("");
    setForm({ name: "", company: "", designation: "", email: "", phone: "", industry: "", location: "", summary: "" });
  };

  const handleExtract = async () => {
    if (inputMode === "manual") {
      if (!form.name && !form.company) { setError("Enter name or company"); return; }
      setProspect({ ...form }); setStep(2); return;
    }
    if (!inputText.trim()) { setError("Paste profile text"); return; }
    setLoading(true); setError("");
    try {
      const r = await callClaude([{ role: "user", content: `Extract from LinkedIn profile. ONLY JSON:\n{"name":"","company":"","designation":"","industry":"","email":"","phone":"","location":"","summary":""}\n\n${inputText}` }]);
      const p = parseJSON(extractText(r));
      if (p) { setProspect(p); setStep(2); } else setError("Parse failed. Use manual.");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleResearch = async () => {
    setLoading(true); setError(""); setStatus("Researching...");
    try {
      const r = await callClaude([{ role: "user", content: `Research "${prospect.company}" thoroughly. What they do, industry, projects, infrastructure, coating needs. 3-4 paragraphs.` }], true);
      const text = extractText(r);
      setResearch(text);
      // Save prospect to DB
      const saved = await api("/api/prospects", { action: "create_prospect", ...prospect, research: text, status: "researched", source: inputMode });
      setSavedProspectId(saved.id);
      setStep(3); setStatus("");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleDraftEmail = async () => {
    setLoading(true); setError(""); setStatus("Drafting...");
    let styleCtx = "";
    if (styles.length > 0) {
      styleCtx = "\n\nMatch this writing style:\n" + styles.slice(0, 3).map((s, i) => `--- ${i + 1} ---\n${s.content}`).join("\n\n");
    }
    try {
      const r = await callClaude([{ role: "user", content: `${ANUPAM_CONTEXT}${styleCtx}\n\nPROSPECT: ${prospect.name} | ${prospect.company} | ${prospect.designation} | ${prospect.industry || ""}\nRESEARCH:\n${research}\n\nDraft personalized B2B email. Subject + body. 150-200 words. Only relevant coatings/clients. Include 10-15% cost advantage. CTA for meeting.\nReturn ONLY JSON: {"subject":"","body":""}` }]);
      const p = parseJSON(extractText(r));
      if (p) { setEmailDraft(p); setStep(4); }
      setStatus("");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleSendEmail = async () => {
    if (!prospect.email) { setError("Add email first"); return; }
    setLoading(true); setError(""); setStatus("Sending...");
    try {
      await api("/api/send-email", { to: prospect.email, subject: emailDraft.subject, body: emailDraft.body });
      await api("/api/prospects", { action: "save_email", prospectId: savedProspectId, subject: emailDraft.subject, body: emailDraft.body, emailType: "initial" });
      setStep(5); setStatus("Email sent!");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleDraftWhatsApp = async () => {
    setLoading(true); setError("");
    try {
      const r = await callClaude([{ role: "user", content: `Convert to WhatsApp (60-80 words). Professional, warm. Greet by name. End "Anupam Kedia, Anupam Paints".\n\nSubject: ${emailDraft.subject}\n${emailDraft.body}\n\nReturn ONLY the message.` }]);
      setWhatsappDraft(extractText(r)); setStep(6);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const saveWhatsApp = async () => {
    if (savedProspectId) {
      await api("/api/prospects", { action: "save_whatsapp", prospectId: savedProspectId, message: whatsappDraft }).catch(() => {});
    }
  };

  const addFollowup = async () => {
    if (!followupDate || !savedProspectId) return;
    try {
      await api("/api/prospects", { action: "add_followup", prospectId: savedProspectId, date: followupDate, note: followupNote });
      setStatus("Follow-up scheduled!"); setFollowupDate(""); setFollowupNote("");
      setTimeout(() => setStatus(""), 2000);
    } catch (e) { setError(e.message); }
  };

  const copyText = (t) => { navigator.clipboard.writeText(t); setStatus("Copied!"); setTimeout(() => setStatus(""), 1500); };

  // Contact follow-up
  const startFollowUp = async (contact) => {
    setProspect(contact); setResearch(contact.research || "");
    setSavedProspectId(contact.id); setTab("outreach"); setStep(4);
    setLoading(true);
    try {
      const detail = await apiGet({ action: "detail", id: contact.id });
      const prev = (detail.emails || []).map(e => `Subject: ${e.subject}\n${e.body}`).join("\n---\n");
      const r = await callClaude([{ role: "user", content: `${ANUPAM_CONTEXT}\nPROSPECT: ${contact.name} at ${contact.company}\nPREVIOUS:\n${prev}\n\nFollow-up email (100-120 words). New angle, clear CTA.\nJSON: {"subject":"","body":""}` }]);
      const p = parseJSON(extractText(r));
      if (p) setEmailDraft(p);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // ══════════════════════════════════════
  // LOGIN SCREEN
  // ══════════════════════════════════════
  if (!authed) return (
    <div style={{ minHeight: "100vh", background: "#0B1120", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }} className="fade-in">
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg, #D4940A, #F5B731)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "#0B1120", margin: "0 auto 20px" }}>A</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#F5B731", marginBottom: 4 }}>ANUPAM OUTREACH</h1>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 36 }}>Marketing Command Center</p>
        <div style={{ textAlign: "left" }}>
          <label style={S.label}>Your Email</label>
          <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@anupampaints.com" style={{ ...S.input, marginBottom: 12 }} />
          <label style={S.label}>Team PIN</label>
          <input value={loginPin} onChange={e => setLoginPin(e.target.value)} type="password" placeholder="••••" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...S.input, marginBottom: 16 }} />
        </div>
        {loginError && <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12 }}>{loginError}</p>}
        <button onClick={handleLogin} disabled={loading} style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════
  // MAIN APP
  // ══════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "#0B1120" }}>
      {/* Header */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1E293B", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #D4940A, #F5B731)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#0B1120" }}>A</div>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: "#F5B731" }}>OUTREACH</div><div style={{ fontSize: 10, color: "#475569" }}>{user?.name}</div></div>
        </div>
        <button onClick={logout} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer" }}>Logout</button>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", borderBottom: "1px solid #1E293B", background: "#111827", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "outreach") resetOutreach(); setSelectedContact(null); setContactDetail(null); setError(""); setStatus(""); }}
            style={{ flex: "0 0 auto", padding: "10px 14px", border: "none", background: tab === t.id ? "#0B1120" : "transparent",
              color: tab === t.id ? "#F5B731" : "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer",
              borderBottom: tab === t.id ? "2px solid #F5B731" : "2px solid transparent", whiteSpace: "nowrap" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {(status || error) && (
        <div style={{ padding: "8px 16px", background: error ? "#7F1D1D20" : "#05201520", color: error ? "#FCA5A5" : "#6EE7B7", fontSize: 13 }}>
          {error || status}
        </div>
      )}

      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>

        {/* ════ DASHBOARD ════ */}
        {tab === "dashboard" && dashboard && (
          <div className="fade-in">
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#F1F5F9", marginBottom: 16 }}>Dashboard</h2>

            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Total", value: dashboard.total, color: "#F5B731" },
                { label: "Emailed", value: (dashboard.statusCounts.emailed || 0) + (dashboard.statusCounts.followed_up || 0), color: "#3B82F6" },
                { label: "Won", value: dashboard.statusCounts.won || 0, color: "#22C55E" },
              ].map(s => (
                <div key={s.label} style={{ ...S.card, textAlign: "center", padding: 14 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pipeline */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 10 }}>Pipeline</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} style={{ ...S.badge(key), fontSize: 11, padding: "4px 10px" }}>
                    {cfg.label}: {dashboard.statusCounts[key] || 0}
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Follow-ups */}
            {dashboard.pendingFollowups?.length > 0 && (
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#F97316", marginBottom: 10 }}>⏰ Pending Follow-ups</div>
                {dashboard.pendingFollowups.map(f => (
                  <div key={f.id} style={{ padding: "8px 0", borderBottom: "1px solid #1E293B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><div style={{ fontSize: 13, color: "#E2E8F0" }}>{f.prospect?.name} — {f.prospect?.company}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{f.scheduled_date} · {f.note}</div></div>
                    <button onClick={async () => { await api("/api/prospects", { action: "complete_followup", followupId: f.id }); loadDashboard(); }}
                      style={{ ...S.btnSecondary, padding: "4px 10px", fontSize: 11 }}>Done</button>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Activity */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 10 }}>Recent Activity</div>
              {(dashboard.recentActivity || []).map(a => (
                <div key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid #0B112080", fontSize: 12 }}>
                  <span style={{ color: "#F5B731" }}>{a.performed_by_user?.name || "—"}</span>
                  <span style={{ color: "#64748B" }}> {a.action} </span>
                  <span style={{ color: "#94A3B8" }}>{a.prospect?.name} ({a.prospect?.company})</span>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{new Date(a.created_at).toLocaleString("en-IN")}</div>
                </div>
              ))}
              {(!dashboard.recentActivity || dashboard.recentActivity.length === 0) && <p style={{ color: "#475569", fontSize: 12 }}>No activity yet.</p>}
            </div>
          </div>
        )}
        {tab === "dashboard" && !dashboard && <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Loading...</div>}

        {/* ════ OUTREACH ════ */}
        {tab === "outreach" && (
          <div className="fade-in">
            <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
              {STEPS.map(s => (
                <div key={s.num} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 3, borderRadius: 2, background: step >= s.num ? "#F5B731" : "#1E293B", marginBottom: 4 }} />
                  <span style={{ fontSize: 9, color: step >= s.num ? "#F5B731" : "#475569" }}>{s.label}</span>
                </div>
              ))}
            </div>

            {step === 1 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F5B731", marginBottom: 14 }}>New Prospect</h2>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[{ id: "manual", label: "✏️ Manual" }, { id: "text", label: "📋 Paste" }].map(m => (
                    <button key={m.id} onClick={() => setInputMode(m.id)}
                      style={{ flex: 1, padding: "10px", border: "1px solid " + (inputMode === m.id ? "#F5B731" : "#1E293B"),
                        borderRadius: 8, background: inputMode === m.id ? "#F5B73110" : "#111827",
                        color: inputMode === m.id ? "#F5B731" : "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {inputMode === "text" ? (
                  <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste LinkedIn profile text..." rows={6} style={{ ...S.textarea, marginBottom: 12 }} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[{ k: "name", l: "Name", p: "Rajiv Sharma" }, { k: "company", l: "Company", p: "Tata Projects" }, { k: "designation", l: "Designation", p: "VP Procurement" },
                      { k: "industry", l: "Industry", p: "Infrastructure / EPC" }, { k: "email", l: "Email", p: "rajiv@company.com" }, { k: "phone", l: "Phone", p: "+91 98765 43210" }].map(f => (
                      <div key={f.k}><label style={S.label}>{f.l}</label>
                        <input value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.p} style={S.input} /></div>
                    ))}
                  </div>
                )}
                <button onClick={handleExtract} disabled={loading} style={{ ...S.btnPrimary, marginTop: 16, opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Processing..." : "Continue →"}
                </button>
              </div>
            )}

            {step === 2 && prospect && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F5B731", marginBottom: 14 }}>Review Prospect</h2>
                <div style={S.card}>
                  {["name", "company", "designation", "industry", "email", "phone", "location"].map(k => (
                    <div key={k} style={{ marginBottom: 10 }}><label style={S.label}>{k}</label>
                      <input value={prospect[k] || ""} onChange={e => setProspect(p => ({ ...p, [k]: e.target.value }))} style={S.input} /></div>
                  ))}
                </div>
                <button onClick={lushaLookup} disabled={lushaLoading} style={{ ...S.btnSecondary, width: "100%", marginBottom: 8, color: lushaLoading ? "#64748B" : "#8B5CF6", borderColor: "#8B5CF630" }}>
                  {lushaLoading ? "Searching Lusha..." : "\ud83d\udd0d Lusha Lookup (Email + Phone)"}
                </button>
                <button onClick={handleResearch} disabled={loading} style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}>
                  {loading ? "🔍 Researching..." : "Research Company →"}
                </button>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F5B731", marginBottom: 4 }}>Research</h2>
                <p style={{ color: "#64748B", fontSize: 12, marginBottom: 12 }}>{prospect.company}</p>
                <div style={{ ...S.card, maxHeight: 220, overflowY: "auto", fontSize: 13, lineHeight: 1.6, color: "#CBD5E1" }}>
                  {research.split("\n").map((p, i) => <p key={i} style={{ marginBottom: 8 }}>{p}</p>)}
                </div>
                <button onClick={handleDraftEmail} disabled={loading} style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}>
                  {loading ? "✍️ Drafting..." : "Draft Email →"}
                </button>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F5B731", marginBottom: 12 }}>Email Draft</h2>
                <label style={S.label}>Subject</label>
                <input value={emailDraft.subject} onChange={e => setEmailDraft(p => ({ ...p, subject: e.target.value }))} style={{ ...S.input, marginBottom: 12, fontWeight: 600 }} />
                <label style={S.label}>Body</label>
                <textarea value={emailDraft.body} onChange={e => setEmailDraft(p => ({ ...p, body: e.target.value }))} rows={10} style={{ ...S.textarea, marginBottom: 12 }} />
                {!prospect.email && (
                  <div style={{ marginBottom: 12 }}><label style={{ ...S.label, color: "#F5B731" }}>⚠️ Prospect email required</label>
                    <input placeholder="prospect@company.com" onChange={e => setProspect(p => ({ ...p, email: e.target.value }))} style={{ ...S.input, borderColor: "#F5B731" }} /></div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSendEmail} disabled={loading || !prospect.email} style={{ ...S.btnPrimary, flex: 2, opacity: (loading || !prospect.email) ? 0.5 : 1 }}>
                    {loading ? "Sending..." : "📧 Send"}
                  </button>
                  <button onClick={() => copyText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)} style={{ ...S.btnSecondary, flex: 1 }}>📋 Copy</button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div style={{ textAlign: "center", paddingTop: 20 }} className="fade-in">
                <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#6EE7B7", marginBottom: 4 }}>Sent!</h2>
                <p style={{ color: "#64748B", fontSize: 13, marginBottom: 20 }}>{prospect.name} — {prospect.email}</p>

                {/* Schedule follow-up */}
                <div style={{ ...S.card, textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#F97316", marginBottom: 8 }}>⏰ Schedule Follow-up</div>
                  <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} style={{ ...S.input, marginBottom: 8 }} />
                  <input value={followupNote} onChange={e => setFollowupNote(e.target.value)} placeholder="Note (optional)" style={{ ...S.input, marginBottom: 8 }} />
                  <button onClick={addFollowup} disabled={!followupDate} style={{ ...S.btnSecondary, width: "100%", opacity: followupDate ? 1 : 0.5 }}>Schedule</button>
                </div>

                <button onClick={handleDraftWhatsApp} disabled={loading}
                  style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                  {loading ? "Drafting..." : "📱 Draft WhatsApp →"}
                </button>
                <button onClick={resetOutreach} style={{ ...S.btnSecondary, width: "100%", marginTop: 8 }}>← New Outreach</button>
              </div>
            )}

            {step === 6 && (
              <div className="fade-in">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#25D366", marginBottom: 12 }}>📱 WhatsApp</h2>
                {!prospect.phone && (
                  <div style={{ marginBottom: 12 }}><label style={{ ...S.label, color: "#F5B731" }}>Phone</label>
                    <input placeholder="+91 98765 43210" onChange={e => setProspect(p => ({ ...p, phone: e.target.value }))} style={{ ...S.input, borderColor: "#25D366" }} /></div>
                )}
                <textarea value={whatsappDraft} onChange={e => setWhatsappDraft(e.target.value)} rows={6} style={{ ...S.textarea, borderColor: "#25D36630", background: "#052015", marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { copyText(whatsappDraft); saveWhatsApp(); }}
                    style={{ flex: 1, padding: 13, borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>📋 Copy</button>
                  {prospect.phone && (
                    <button onClick={() => { saveWhatsApp(); window.open(`https://wa.me/${prospect.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(whatsappDraft)}`, "_blank"); }}
                      style={{ flex: 1, padding: 13, borderRadius: 10, border: "none", background: "#128C7E", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Open WA ↗</button>
                  )}
                </div>
                <button onClick={resetOutreach} style={{ ...S.btnSecondary, width: "100%", marginTop: 10 }}>← New Outreach</button>
              </div>
            )}
          </div>
        )}

        {/* ════ CONTACTS ════ */}
        {tab === "contacts" && !selectedContact && (
          <div className="fade-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 12 }}>Contacts</h2>
            <input value={contactSearch} onChange={e => { setContactSearch(e.target.value); }} placeholder="🔍 Search name or company..."
              onKeyDown={e => e.key === "Enter" && loadContacts()} style={{ ...S.input, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              {["all", "new", "emailed", "followed_up", "responded", "meeting", "won"].map(s => (
                <button key={s} onClick={() => setContactFilter(s)}
                  style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 11,
                    background: contactFilter === s ? "#F5B73118" : "#111827",
                    color: contactFilter === s ? "#F5B731" : "#64748B",
                    border: `1px solid ${contactFilter === s ? "#F5B731" : "#1E293B"}`, whiteSpace: "nowrap" }}>
                  {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
                </button>
              ))}
            </div>

            {contacts.length === 0 ? <p style={{ textAlign: "center", color: "#475569", padding: 30 }}>No contacts found.</p> : contacts.map(c => (
              <div key={c.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => { setSelectedContact(c); loadContactDetail(c.id); }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div><div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{c.designation} — {c.company}</div></div>
                  <span style={S.badge(c.status)}>{STATUS_CONFIG[c.status]?.label || c.status}</span>
                </div>
                {c.email && <div style={{ fontSize: 11, color: "#475569" }}>📧 {c.email}</div>}
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>By {c.created_by_user?.name || "—"} · {new Date(c.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        )}

        {/* Contact Detail */}
        {tab === "contacts" && selectedContact && (
          <div className="fade-in">
            <button onClick={() => { setSelectedContact(null); setContactDetail(null); }} style={{ ...S.btnSecondary, marginBottom: 14, padding: "6px 14px" }}>← Back</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9" }}>{selectedContact.name}</h2>
                <div style={{ fontSize: 13, color: "#64748B" }}>{selectedContact.designation}</div>
                <div style={{ fontSize: 14, color: "#94A3B8", fontWeight: 600 }}>{selectedContact.company}</div></div>
              <span style={S.badge(selectedContact.status)}>{STATUS_CONFIG[selectedContact.status]?.label}</span>
            </div>

            {/* Quick Info */}
            <div style={S.card}>
              {selectedContact.email && <div style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 4 }}>📧 {selectedContact.email}</div>}
              {selectedContact.phone && <div style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 4 }}>📱 {selectedContact.phone}</div>}
              {selectedContact.location && <div style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 4 }}>📍 {selectedContact.location}</div>}
              {selectedContact.industry && <div style={{ fontSize: 13, color: "#CBD5E1" }}>🏭 {selectedContact.industry}</div>}
            </div>

            {/* Status update */}
            <div style={{ ...S.card }}>
              <label style={S.label}>Update Status</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={async () => {
                    await api("/api/prospects", { action: "update_prospect", id: selectedContact.id, updates: { status: key }, logAction: `Status → ${cfg.label}` });
                    setSelectedContact({ ...selectedContact, status: key }); loadContacts();
                  }} style={{ ...S.badge(key), cursor: "pointer", border: "none", padding: "5px 10px", fontSize: 11 }}>{cfg.label}</button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => startFollowUp(selectedContact)} style={{ ...S.btnPrimary, flex: 1, fontSize: 13 }}>📧 Follow-up</button>
              <button onClick={() => { setProspect(selectedContact); setSavedProspectId(selectedContact.id); setTab("outreach"); setStep(5); }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📱 WhatsApp</button>
            </div>

            {/* Communication History */}
            {contactDetail && (
              <>
                {contactDetail.emails?.length > 0 && (
                  <div style={S.card}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F5B731", marginBottom: 8 }}>📧 Emails ({contactDetail.emails.length})</div>
                    {contactDetail.emails.map(e => (
                      <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid #1E293B" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>{e.subject}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{e.sent_by_user?.name} · {new Date(e.sent_at).toLocaleString("en-IN")} · {e.email_type}</div>
                        <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, maxHeight: 60, overflow: "hidden", whiteSpace: "pre-wrap" }}>{e.body?.substring(0, 200)}...</div>
                      </div>
                    ))}
                  </div>
                )}

                {contactDetail.activity?.length > 0 && (
                  <div style={S.card}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8 }}>📋 Activity</div>
                    {contactDetail.activity.map(a => (
                      <div key={a.id} style={{ fontSize: 12, padding: "4px 0", color: "#64748B" }}>
                        <span style={{ color: "#F5B731" }}>{a.performed_by_user?.name}</span> {a.action} {a.details && `— ${a.details}`}
                        <div style={{ fontSize: 10, color: "#475569" }}>{new Date(a.created_at).toLocaleString("en-IN")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ TRAINING ════ */}
        {tab === "training" && (
          <div className="fade-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F5B731", marginBottom: 4 }}>Style Training</h2>
            <p style={{ color: "#64748B", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>Paste Anupam sir's actual emails. AI matches this tone in all drafts.</p>
            <textarea value={newSample} onChange={e => setNewSample(e.target.value)} placeholder="Paste an outreach email..." rows={6} style={{ ...S.textarea, marginBottom: 12 }} />
            <button onClick={async () => {
              if (!newSample.trim()) return;
              await api("/api/prospects", { action: "add_style", content: newSample.trim() });
              setNewSample(""); loadStyles(); setStatus("Saved!"); setTimeout(() => setStatus(""), 2000);
            }} disabled={!newSample.trim()} style={{ ...S.btnPrimary, opacity: newSample.trim() ? 1 : 0.5, marginBottom: 20 }}>Save Sample</button>

            {styles.map(s => (
              <div key={s.id} style={{ ...S.card, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#F5B731", fontWeight: 600 }}>Sample</span>
                  <button onClick={async () => { await api("/api/prospects", { action: "delete_style", styleId: s.id }); loadStyles(); }}
                    style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer" }}>Remove</button>
                </div>
                <div style={{ fontSize: 12, color: "#64748B", maxHeight: 60, overflow: "hidden", whiteSpace: "pre-wrap" }}>{s.content?.substring(0, 200)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ════ TEAM ════ */}
        {tab === "team" && (
          <div className="fade-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Team Members</h2>
            {user?.role === "admin" && (
              <div style={{ ...S.card }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#F5B731", marginBottom: 8 }}>Add Member</div>
                <input value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} placeholder="Name" style={{ ...S.input, marginBottom: 8 }} />
                <input value={newMember.email} onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))} placeholder="Email" style={{ ...S.input, marginBottom: 8 }} />
                <button onClick={async () => {
                  if (!newMember.name || !newMember.email) return;
                  await api("/api/prospects", { action: "add_member", memberName: newMember.name, email: newMember.email });
                  setNewMember({ name: "", email: "" }); loadTeam(); setStatus("Member added!"); setTimeout(() => setStatus(""), 2000);
                }} style={{ ...S.btnPrimary, fontSize: 13 }}>Add Member</button>
              </div>
            )}
            {team.map(m => (
              <div key={m.id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{m.email}</div></div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: m.role === "admin" ? "#F5B73118" : "#1E293B", color: m.role === "admin" ? "#F5B731" : "#64748B" }}>{m.role}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
