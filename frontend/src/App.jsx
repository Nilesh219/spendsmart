// ============================================================
// SpendSmart Frontend - Step 6 (src/App.jsx)
// Login / signup + personal dashboard, insights, 6-month trend,
// search & filter. Needs:  npm install recharts
// ============================================================
import { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001"; // set VITE_API_URL when deployed
const ML = import.meta.env.VITE_ML_URL || "http://localhost:5001"; // set VITE_ML_URL when deployed

const CATEGORIES = ["Food", "Travel", "Bills", "Shopping", "Fun", "Health", "Education", "Other"];

const COLORS = {
  Food: "#f4a62a",
  Travel: "#3b82f6",
  Bills: "#8b5cf6",
  Shopping: "#ec4899",
  Fun: "#14b8a6",
  Health: "#ef6f5e",
  Education: "#6d83a6",
  Other: "#94a3b8",
};

const EXAMPLES = ["500 groceries at D-Mart", "200 bus ticket to Kolhapur", "899 electricity bill", "300 movie with friends"];

const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const currentMonth = () => todayKey().slice(0, 7);
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("en-IN", { month: "short" })
);

function dayTag(key) {
  if (key === todayKey()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return key === dateKey(y) ? "Yesterday" : null;
}

function Icon({ name }) {
  const p = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  };
  const paths = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />,
    alert: <path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01" />,
    spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
    left: <path d="M15 18l-6-6 6-6" />,
    right: <path d="M9 18l6-6-6-6" />,
    download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chevron: <path d="M6 9l6 6 6-6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  };
  return <svg {...p}>{paths[name]}</svg>;
}

// Month picker: arrows for quick steps, click the label to jump to any month or year.
function MonthPicker({ month, onChange, maxMonth }) {
  const [open, setOpen] = useState(false);
  const [y, m] = month.split("-").map(Number);
  const [maxY, maxM] = maxMonth.split("-").map(Number);
  const [year, setYear] = useState(y);
  const ref = useRef(null);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const isFuture = (yr, mo) => yr > maxY || (yr === maxY && mo > maxM);

  useEffect(() => {
    if (open) setYear(y);
  }, [open, y]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function shift(delta) {
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }

  return (
    <div className="stepper" ref={ref} role="group" aria-label="Choose month">
      <button onClick={() => shift(-1)} aria-label="Previous month"><Icon name="left" /></button>
      <button className="stepper-label" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <Icon name="calendar" />
        {label}
        <Icon name="chevron" />
      </button>
      <button onClick={() => shift(1)} disabled={month >= maxMonth} aria-label="Next month"><Icon name="right" /></button>

      {open && (
        <div className="popover" role="dialog" aria-label="Pick a month">
          <div className="year-row">
            <button onClick={() => setYear((v) => v - 1)} disabled={year <= 2000} aria-label="Previous year"><Icon name="left" /></button>
            <b>{year}</b>
            <button onClick={() => setYear((v) => v + 1)} disabled={year >= maxY} aria-label="Next year"><Icon name="right" /></button>
          </div>
          <div className="month-grid">
            {MONTH_NAMES.map((name, i) => (
              <button
                key={name}
                className={year === y && i + 1 === m ? "on" : ""}
                disabled={isFuture(year, i + 1)}
                onClick={() => {
                  onChange(`${year}-${pad(i + 1)}`);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <button className="link this-month" onClick={() => { onChange(maxMonth); setOpen(false); }}>
            Jump to this month
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LOGIN / SIGNUP SCREEN
// ============================================================
function AuthScreen({ onAuth, theme, toggleTheme }) {
  // a reset link looks like  http://localhost:5173/?reset=TOKEN
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
  const [mode, setMode] = useState(resetToken ? "reset" : "login"); // login | signup | forgot | reset
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const showName = mode === "signup";
  const showEmail = mode !== "reset";
  const showPassword = mode !== "forgot";

  const titles = {
    login: ["Welcome back", "Log in to see your expenses."],
    signup: ["Create your account", "It takes less than a minute."],
    forgot: ["Forgot your password?", "Enter your email and we will send you a reset link."],
    reset: ["Choose a new password", "Pick something you have not used before."],
  };
  const buttons = { login: "Log in", signup: "Create account", forgot: "Send reset link", reset: "Save new password" };

  function goTo(next) {
    if (resetToken) window.history.replaceState({}, "", window.location.pathname); // drop ?reset=... from the address bar
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
  }

  async function post(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json() };
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const { ok, data } = await post("/api/auth/forgot", { email });
        if (!ok) setError(data.error || "Something went wrong. Please try again.");
        else setNotice([data.message, data.devNote].filter(Boolean).join(" "));
      } else if (mode === "reset") {
        const { ok, data } = await post("/api/auth/reset", { token: resetToken, password });
        if (!ok) {
          setError(data.error || "Something went wrong. Please try again.");
        } else {
          goTo("login");
          setNotice("Password changed. Log in with your new password.");
        }
      } else {
        const { ok, data } = await post(`/api/auth/${mode}`, { name, email, password });
        if (!ok) setError(data.error || "Something went wrong. Please try again.");
        else onAuth(data);
      }
    } catch {
      setError("Cannot reach the server. Check that `node server.js` is running on port 3001.");
    }
    setBusy(false);
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="brand">
          <span className="logo" aria-hidden="true">₹</span>
          <span className="brand-name">SpendSmart</span>
        </div>
        <div>
          <h1>Know where your money goes.</h1>
          <p>Type an expense in plain words. SpendSmart sorts it, tracks your budgets and shows you the trends.</p>
          <ul className="points">
            <li><b>Type it, done</b><span>"500 groceries at D-Mart" becomes Food automatically.</span></li>
            <li><b>Budgets that warn you</b><span>Get a red alert the moment a category goes over.</span></li>
            <li><b>Private to you</b><span>Your expenses are saved to your own account.</span></li>
          </ul>
        </div>
        <span className="auth-foot">Free to use. No bank access needed.</span>
      </aside>

      <main className="auth-main">
        <button className="icon-btn auth-theme" onClick={toggleTheme} aria-label="Toggle light or dark mode">
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>

        <form className="auth-form" onSubmit={submit}>
          <h2>{titles[mode][0]}</h2>
          <p className="muted">{titles[mode][1]}</p>

          {showName && (
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>
          )}
          {showEmail && (
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
          )}
          {showPassword && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
              <div className="pw">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "login" ? undefined : 8}
                  required
                />
                <button type="button" className="link" onClick={() => setShow((s) => !s)}>
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              {mode !== "login" && <small className="muted">At least 8 characters.</small>}
            </label>
          )}

          {mode === "login" && (
            <button type="button" className="link forgot" onClick={() => goTo("forgot")}>
              Forgot password?
            </button>
          )}

          {error && <div className="notice error" role="alert">{error}</div>}
          {notice && <div className="notice ok" role="status">{notice}</div>}

          <button className="cta auth-cta" disabled={busy}>
            {busy ? "Please wait…" : buttons[mode]}
          </button>

          <p className="switch">
            {mode === "login" && (
              <>
                New to SpendSmart? <button type="button" className="link" onClick={() => goTo("signup")}>Create an account</button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account? <button type="button" className="link" onClick={() => goTo("login")}>Log in</button>
              </>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button type="button" className="link" onClick={() => goTo("login")}>Back to log in</button>
            )}
          </p>
        </form>
      </main>
    </div>
  );
}

// ============================================================
// DASHBOARD (only shown when logged in)
// ============================================================
function Dashboard({ token, user, onLogout, theme, toggleTheme }) {
  const [month, setMonth] = useState(currentMonth());
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ grandTotal: 0, prevTotal: 0, byCategory: [], alerts: [] });
  const [budgets, setBudgets] = useState([]);
  const [trends, setTrends] = useState([]);

  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [chartType, setChartType] = useState("pie");
  const [entryDate, setEntryDate] = useState(todayKey());

  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("All");

  const [budgetCat, setBudgetCat] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState("");

  const inputRef = useRef(null);

  // every request to the backend carries the login token; a 401 means "log in again"
  const api = useCallback(
    async (path, options = {}) => {
      const res = await fetch(`${API}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
      if (res.status === 401) {
        onLogout();
        throw new Error("unauthorized");
      }
      return res;
    },
    [token, onLogout]
  );

  const backendDown = "Cannot reach the backend. Check that `node server.js` is running on port 3001.";

  const load = useCallback(async () => {
    try {
      const [e, s, b, t] = await Promise.all([
        api(`/api/expenses?month=${month}`).then((r) => r.json()),
        api(`/api/summary?month=${month}`).then((r) => r.json()),
        api(`/api/budgets`).then((r) => r.json()),
        api(`/api/trends?month=${month}&months=6`).then((r) => r.json()),
      ]);
      setExpenses(e);
      setSummary(s);
      setBudgets(b);
      setTrends(t);
      setError("");
    } catch (err) {
      if (err.message !== "unauthorized") setError(backendDown);
    }
  }, [api, month]);

  useEffect(() => {
    load();
  }, [load]);

  // wake up the AI service early (free hosting puts it to sleep when idle)
  useEffect(() => {
    fetch(`${ML}/health`).catch(() => {});
  }, []);

  // ---- live AI preview ----
  useEffect(() => {
    const t = text.trim();
    if (t.length < 4) {
      setPreview(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${ML}/categorize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error("ml");
        setPreview(await r.json());
      } catch {
        if (!ctrl.signal.aborted) setPreview(null);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text]);

  // ---- actions ----
  async function addExpense(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      const res = await api(`/api/expenses`, { method: "POST", body: JSON.stringify({ text, date: entryDate }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not add the expense.");
      } else {
        setText("");
        setPreview(null);
        setError("");
        const target = (entryDate || todayKey()).slice(0, 7);
        if (month !== target) setMonth(target);
        else await load();
        inputRef.current?.focus();
      }
    } catch (err) {
      if (err.message !== "unauthorized") setError(backendDown);
    }
    setAdding(false);
  }

  async function changeCategory(id, category) {
    await api(`/api/expenses/${id}`, { method: "PATCH", body: JSON.stringify({ category }) });
    load();
  }

  async function removeExpense(id) {
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    load();
  }

  async function saveBudget(e) {
    e.preventDefault();
    const limit = Number(budgetLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError("Enter a budget amount greater than 0.");
      return;
    }
    await api(`/api/budgets/${budgetCat}`, { method: "PUT", body: JSON.stringify({ limit }) });
    setBudgetLimit("");
    setError("");
    load();
  }

  async function removeBudget(category) {
    await api(`/api/budgets/${category}`, { method: "DELETE" });
    load();
  }

  // CSV needs the login token, so we fetch it and save the file ourselves
  async function exportCsv() {
    try {
      const res = await api(`/api/export/csv?month=${month}`);
      if (!res.ok) throw new Error("export");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `spendsmart-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err.message !== "unauthorized") setError("Could not export the CSV. Please try again.");
    }
  }

  // ---- derived values ----
  const [yy, mm] = month.split("-").map(Number);
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const prevMonthName = new Date(yy, mm - 2, 1).toLocaleDateString("en-IN", { month: "long" });
  const spentIn = (cat) => summary.byCategory.find((c) => c.category === cat)?.total || 0;
  const chartData = summary.byCategory.map((c) => ({ name: c.category, value: c.total }));
  const top = summary.byCategory[0];
  const overCount = summary.alerts.length;
  const detectedAmount = (text.replace(/,/g, "").match(/\d+(?:\.\d+)?/) || [])[0];
  const typed = text.trim().length >= 4;

  // insights
  const isCurrent = month === currentMonth();
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const daysElapsed = isCurrent ? new Date().getDate() : daysInMonth;
  const dailyAvg = summary.grandTotal / daysElapsed;
  const projected = dailyAvg * daysInMonth;
  const biggest = expenses.reduce((best, x) => (!best || x.amount > best.amount ? x : best), null);
  const prev = summary.prevTotal || 0;
  let deltaText = "No data yet";
  let deltaClass = "";
  let deltaNote = `Nothing recorded in ${prevMonthName}`;
  if (prev > 0) {
    const pct = Math.round(((summary.grandTotal - prev) / prev) * 100);
    deltaText = pct === 0 ? "About the same" : `${pct < 0 ? "Down" : "Up"} ${Math.abs(pct)}%`;
    deltaClass = pct < 0 ? "good" : pct > 0 ? "bad" : "";
    deltaNote = `${rupee(prev)} in ${prevMonthName}${isCurrent ? " (same days)" : ""}`;
  }

  // search + filter, then group by day
  const q = query.trim().toLowerCase();
  const shown = expenses.filter(
    (x) => (filterCat === "All" || x.category === filterCat) && (!q || x.text.toLowerCase().includes(q))
  );
  const groups = [];
  for (const x of shown) {
    const d = new Date(x.date);
    const key = dateKey(d);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, date: d, total: 0, items: [] };
      groups.push(g);
    }
    g.total += x.amount;
    g.items.push(x);
  }
  const busiest = groups.length ? groups.reduce((a, b) => (b.total > a.total ? b : a)) : null;

  return (
    <div className="app">
      {/* ---------------- top bar ---------------- */}
      <header className="bar">
        <div className="brand">
          <span className="logo" aria-hidden="true">₹</span>
          <span className="brand-name">SpendSmart</span>
        </div>
        <div className="bar-right">
          <MonthPicker month={month} onChange={setMonth} maxMonth={currentMonth()} />
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <div className="user">
            <span className="avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
            <span className="hello">{user.name.split(" ")[0]}</span>
            <button className="btn small" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>

      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="hero-top">
          <div>
            <p className="hero-label">Spent in {monthLabel}</p>
            <p className="hero-total">{rupee(summary.grandTotal)}</p>
          </div>
          <dl className="facts">
            <div><dt>Transactions</dt><dd>{expenses.length}</dd></div>
            <div><dt>Top category</dt><dd>{top ? top.category : "None yet"}</dd></div>
            <div>
              <dt>Budgets</dt>
              <dd>{overCount > 0 ? `${overCount} over limit` : budgets.length ? "All on track" : "Not set"}</dd>
            </div>
          </dl>
        </div>

        <form className="entry" onSubmit={addExpense}>
          <input
            ref={inputRef}
            className="entry-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you spend? e.g. 500 groceries at D-Mart"
            aria-label="New expense"
          />
          <input
            type="date"
            className="entry-date"
            value={entryDate}
            max={todayKey()}
            onChange={(e) => setEntryDate(e.target.value)}
            aria-label="Date of expense"
            title="Date of the expense (defaults to today)"
          />
          <button className="cta" disabled={adding || !text.trim()}>
            {adding ? "Adding…" : "Add expense"}
          </button>
        </form>

        <div className="preview" aria-live="polite">
          {!typed ? (
            <>
              <span className="preview-label">Try</span>
              {EXAMPLES.map((ex) => (
                <button
                  type="button"
                  key={ex}
                  className="example"
                  onClick={() => {
                    setText(ex);
                    inputRef.current?.focus();
                  }}
                >
                  {ex}
                </button>
              ))}
            </>
          ) : (
            <>
              {detectedAmount ? (
                <span className="chip">{rupee(detectedAmount)}</span>
              ) : (
                <span className="chip warn">No amount found. Include a number, like 500.</span>
              )}
              {entryDate && entryDate !== todayKey() && (
                <span className="chip">
                  Dated {new Date(entryDate + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {preview && (
                <span className="chip cat" style={{ "--c": COLORS[preview.category] }}>
                  <Icon name="spark" />
                  <i className="dot" />
                  {preview.category}
                  <em>{Math.round(preview.confidence)}% sure</em>
                </span>
              )}
              {preview?.category === "Other" && (
                <span className="preview-note">The AI is unsure. You can change the category after adding.</span>
              )}
            </>
          )}
        </div>
      </section>

      {error && <div className="notice error">{error}</div>}

      {summary.alerts.map((a) => (
        <div className="notice over" role="alert" key={a.category}>
          <Icon name="alert" />
          <span>
            <b>Over budget on {a.category}.</b> You spent {rupee(a.total)} of {rupee(a.limit)}, which is{" "}
            {rupee(a.total - a.limit)} over.
          </span>
        </div>
      ))}

      {/* ---------------- insights ---------------- */}
      {expenses.length > 0 && (
        <section className="insights" aria-label="Insights">
          <div className="insight">
            <p className="insight-label">Compared with {prevMonthName}</p>
            <p className={`insight-value ${deltaClass}`}>{deltaText}</p>
            <p className="insight-note">{deltaNote}</p>
          </div>
          <div className="insight">
            <p className="insight-label">Daily average</p>
            <p className="insight-value">{rupee(Math.round(dailyAvg))}</p>
            <p className="insight-note">over {daysElapsed} {daysElapsed === 1 ? "day" : "days"}</p>
          </div>
          {isCurrent ? (
            <div className="insight">
              <p className="insight-label">Projected for the month</p>
              <p className="insight-value">{rupee(Math.round(projected))}</p>
              <p className="insight-note">if you keep this pace</p>
            </div>
          ) : (
            <div className="insight">
              <p className="insight-label">Busiest day</p>
              <p className="insight-value">{busiest ? rupee(busiest.total) : "–"}</p>
              <p className="insight-note">
                {busiest ? busiest.date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : ""}
              </p>
            </div>
          )}
          <div className="insight">
            <p className="insight-label">Biggest expense</p>
            <p className="insight-value">{biggest ? rupee(biggest.amount) : "–"}</p>
            <p className="insight-note" title={biggest?.text}>{biggest?.text}</p>
          </div>
        </section>
      )}

      <div className="grid">
        {/* ---------------- chart ---------------- */}
        <section className="panel">
          <div className="panel-head">
            <h2>Where your money went</h2>
            <div className="seg" role="group" aria-label="Chart type">
              <button className={chartType === "pie" ? "on" : ""} onClick={() => setChartType("pie")}>Donut</button>
              <button className={chartType === "bar" ? "on" : ""} onClick={() => setChartType("bar")}>Bars</button>
            </div>
          </div>

          {chartData.length === 0 ? (
            <p className="empty">No spending in {monthLabel} yet. Type an expense above and it will show up here.</p>
          ) : (
            <div className="chart-wrap">
              <div className="chart">
                <ResponsiveContainer width="100%" height={230}>
                  {chartType === "pie" ? (
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={2} stroke="none">
                        {chartData.map((d) => (
                          <Cell key={d.name} fill={COLORS[d.name]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => rupee(v)} />
                    </PieChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                      <Tooltip formatter={(v) => rupee(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((d) => (
                          <Cell key={d.name} fill={COLORS[d.name]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <ul className="legend">
                {summary.byCategory.map((c) => (
                  <li key={c.category}>
                    <span className="dot" style={{ background: COLORS[c.category] }} />
                    <span className="legend-name">{c.category}</span>
                    <span className="legend-share">{Math.round((c.total / summary.grandTotal) * 100)}%</span>
                    <b>{rupee(c.total)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ---------------- budgets ---------------- */}
        <section className="panel">
          <h2>Monthly budgets</h2>
          <p className="muted">Set a limit per category. You get a red warning when you pass it.</p>

          <form className="budget-form" onSubmit={saveBudget}>
            <select value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)} aria-label="Budget category">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              placeholder="Limit in ₹"
              aria-label="Budget limit"
            />
            <button className="btn">Save</button>
          </form>

          {budgets.length === 0 ? (
            <p className="empty">No budgets yet. Pick a category and a limit above to start.</p>
          ) : (
            <ul className="budgets">
              {budgets.map((b) => {
                const spent = spentIn(b.category);
                const pct = (spent / b.limit) * 100;
                const state = spent > b.limit ? "over" : pct >= 80 ? "near" : "ok";
                const stateText = state === "over" ? `Over by ${rupee(spent - b.limit)}` : state === "near" ? "Close to limit" : "On track";
                return (
                  <li key={b.category}>
                    <div className="budget-row">
                      <span className="budget-name">
                        <i className="dot" style={{ background: COLORS[b.category] }} />
                        {b.category}
                      </span>
                      <span className={`pill ${state}`}>{stateText}</span>
                    </div>
                    <div className="bar-track">
                      <div className={`fill ${state}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="budget-foot">
                      <span>{rupee(spent)} of {rupee(b.limit)}</span>
                      <button className="link" onClick={() => removeBudget(b.category)} aria-label={`Remove ${b.category} budget`}>
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- 6-month trend ---------------- */}
      <section className="panel trend">
        <div className="panel-head">
          <h2>Last 6 months</h2>
          <p className="muted">Click a bar to open that month</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trends} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip formatter={(v) => rupee(v)} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => setMonth((d.payload || d).month)}>
              {trends.map((t) => (
                <Cell key={t.month} className={t.month === month ? "bar-on" : "bar-off"} fill={t.month === month ? "#0b6b57" : "#b9c8c3"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ---------------- expenses ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2>
            Expenses <span className="count">{shown.length === expenses.length ? expenses.length : `${shown.length} of ${expenses.length}`}</span>
          </h2>
          <button className="btn with-icon" onClick={exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
        </div>

        {expenses.length > 0 && (
          <div className="filters">
            <label className="search">
              <Icon name="search" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses" aria-label="Search expenses" />
            </label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} aria-label="Filter by category">
              <option>All</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="empty">Nothing recorded for {monthLabel}. Pick another month above, or add an expense.</p>
        ) : shown.length === 0 ? (
          <p className="empty">No expenses match your search or filter.</p>
        ) : (
          <div className="days">
            {groups.map((g) => (
              <section className="day" key={g.key}>
                <header className="day-head">
                  <span className="day-name">
                    {g.date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {dayTag(g.key) && <span className="day-tag">{dayTag(g.key)}</span>}
                  </span>
                  <span className="day-total">{rupee(g.total)}</span>
                </header>
                <ul className="list">
                  {g.items.map((x) => (
                    <li key={x._id}>
                      <div className="what">
                        <span className="what-text">
                          {x.text}
                          {x.categorizedBy === "ai" && <span className="tag" title="Category chosen by the AI">AI</span>}
                        </span>
                      </div>
                      <select
                        className="cat-select"
                        style={{ "--c": COLORS[x.category] }}
                        value={x.category}
                        onChange={(e) => changeCategory(x._id, e.target.value)}
                        aria-label={`Category for ${x.text}`}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <b className="amt">{rupee(x.amount)}</b>
                      <button className="icon-btn danger" onClick={() => removeExpense(x._id)} aria-label={`Delete ${x.text}`} title="Delete">
                        <Icon name="trash" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// ROOT: decides between the login screen and the dashboard
// ============================================================
export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("spendsmart-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("spendsmart-theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // the saved login (token + user) survives page refresh
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("spendsmart-auth"));
    } catch {
      return null;
    }
  });

  const handleAuth = (data) => {
    try {
      localStorage.setItem("spendsmart-auth", JSON.stringify(data));
    } catch {}
    setAuth(data);
  };

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem("spendsmart-auth");
    } catch {}
    setAuth(null);
  }, []);

  if (!auth?.token) return <AuthScreen onAuth={handleAuth} theme={theme} toggleTheme={toggleTheme} />;
  return <Dashboard token={auth.token} user={auth.user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;
}