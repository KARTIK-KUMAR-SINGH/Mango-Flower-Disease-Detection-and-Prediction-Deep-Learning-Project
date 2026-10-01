import { useCallback, useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api";
const UNSURE = 0.6;
const pretty = (s) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const pct = (v) => `${Math.round(v * 100)}%`;

// General guidance, matched loosely against your class names.
const INFO = [
  { match: /health|normal/, good: true, title: "Looks healthy", tips: ["No disease signs found in this photo.", "Keep checking panicles through flowering, especially after rain.", "Prune crowded branches so air can move through the canopy."] },
  { match: /anthrac/, title: "Anthracnose", tips: ["Dark, sunken spots on flowers and stalks; worse in warm, humid weather.", "Remove and destroy badly affected panicles.", "Copper or recommended fungicide sprays at flowering are the usual control."] },
  { match: /powdery|mildew/, title: "Powdery mildew", tips: ["A white powdery coating on flowers causes blossoms to drop.", "Sulphur-based or systemic fungicide at early flowering is the usual control.", "Avoid dense canopies that stay damp."] },
  { match: /soot/, title: "Sooty mould", tips: ["A black film that grows on honeydew left by sap-sucking insects.", "Control hoppers and scale insects first; the mould then fades.", "Wash light infestations off with water."] },
  { match: /malform/, title: "Malformation", tips: ["Flower clusters become bunched and sterile.", "Prune and burn affected shoots and panicles.", "Plant only certified disease-free material."] },
  { match: /blight|blossom|bacter/, title: "Blight", tips: ["Blossoms brown and dry out, often after wet spells.", "Remove infected parts and improve airflow.", "Ask your local agriculture office for a suitable spray."] },
];
const infoFor = (label) => INFO.find((i) => i.match.test(label.toLowerCase()));

function Ring({ value, warn }) {
  const C = 2 * Math.PI * 42;
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`${pct(value)} confidence`}>
      <circle cx="50" cy="50" r="42" className="ring-bg" />
      <circle cx="50" cy="50" r="42" className={`ring-fg ${warn ? "warn" : ""}`} strokeDasharray={`${C * value} ${C}`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" className="ring-num">{pct(value)}</text>
    </svg>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [server, setServer] = useState("checking");
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/health`).then((r) => setServer(r.ok ? "online" : "offline")).catch(() => setServer("offline"));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const patch = (id, p) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const run = useCallback(async (id, file) => {
    patch(id, { status: "analyzing", error: "" });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API}/predict`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}.`);
      patch(id, { status: "done", result: data });
      setServer("online");
    } catch (e) {
      const offline = e.message === "Failed to fetch";
      if (offline) setServer("offline");
      patch(id, { status: "error", error: offline ? "Can't reach the analysis server. Start the backend, then retry." : e.message });
    }
  }, []);

  const analyze = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setNotice(`"${file.name}" isn't an image. Use JPG, PNG or WebP.`);
    const id = `${Date.now()}${Math.random()}`;
    setItems((l) => [...l, { id, file, url: URL.createObjectURL(file), name: file.name, status: "analyzing" }]);
    setActiveId(id);
    run(id, file);
  }, [run]);

  const addFiles = (files) => [...(files || [])].forEach(analyze);

  useEffect(() => {
    const onPaste = (e) => addFiles([...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()));
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const active = items.find((i) => i.id === activeId);
  const r = active?.result;
  const unsure = r && r.confidence < UNSURE;
  const info = r && !unsure ? infoFor(r.prediction) : null;

  return (
    <div className={`app ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => e.relatedTarget === null && setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
      <header className="top">
        <div>
          <h1>Mango flower doctor</h1>
          <p>Add a close-up photo of a flower cluster and get an instant disease reading.</p>
        </div>
        <span className={`pill ${server}`}>
          <i /> {server === "online" ? "Model ready" : server === "offline" ? "Server offline" : "Connecting…"}
        </span>
      </header>

      {notice && <div className="notice" role="alert">{notice}</div>}

      <main className="grid">
        <section className="left">
          <div className={`frame ${active ? "filled" : ""}`} onClick={() => !active && inputRef.current?.click()}
            role={active ? undefined : "button"} tabIndex={active ? -1 : 0}
            onKeyDown={(e) => !active && (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            aria-label={active ? undefined : "Choose a photo"}>
            {active ? (
              <>
                <img src={active.url} alt={active.name} />
                {active.status === "analyzing" && <><div className="scan" /><span className="chip">Analyzing…</span></>}
              </>
            ) : (
              <div className="empty">
                <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><path d="M32 44V20m0 0-10 10m10-10 10 10M12 44v6a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4v-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <strong>Drop a photo anywhere on this page</strong>
                <span>or click to choose one. You can also paste an image.</span>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

          <div className="actions">
            <button className="btn primary" onClick={() => inputRef.current?.click()}>{active ? "Add another photo" : "Choose photo"}</button>
            {items.length > 0 && <button className="btn" onClick={() => { setItems([]); setActiveId(null); }}>Clear all</button>}
          </div>

          {items.length > 1 && (
            <ul className="strip" aria-label="Photos analyzed this session">
              {items.map((i) => (
                <li key={i.id}>
                  <button className={i.id === activeId ? "on" : ""} onClick={() => setActiveId(i.id)} title={i.name}>
                    <img src={i.url} alt={i.name} />
                    <span>{i.status === "done" ? pretty(i.result.prediction) : i.status === "error" ? "Failed" : "…"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="right" aria-live="polite">
          {!active && (
            <div className="card">
              <h2>For a reliable reading</h2>
              <ul className="tips">
                <li>Fill the frame with the flower cluster.</li>
                <li>Use daylight and keep the photo sharp.</li>
                <li>One affected panicle per photo works best.</li>
              </ul>
            </div>
          )}

          {active?.status === "analyzing" && <div className="card"><p className="muted">Reading the photo…</p><div className="skeleton" /><div className="skeleton short" /></div>}

          {active?.status === "error" && (
            <div className="card">
              <h2 className="bad">Couldn't analyze this photo</h2>
              <p>{active.error}</p>
              <button className="btn" onClick={() => run(active.id, active.file)}>Try again</button>
            </div>
          )}

          {r && (
            <div className="card">
              <div className="result">
                <Ring value={r.confidence} warn={unsure} />
                <div>
                  <p className="muted">{unsure ? "Best guess" : "Most likely"}</p>
                  <h2>{pretty(r.prediction)}</h2>
                </div>
              </div>
              {unsure && <p className="callout">The model isn't sure about this one. Try a closer, sharper photo in daylight.</p>}

              <h3>All possibilities</h3>
              <ul className="bars">
                {r.scores.map((s, i) => (
                  <li key={s.label}>
                    <div className="row"><span>{pretty(s.label)}</span><b>{pct(s.confidence)}</b></div>
                    <div className="track"><div className={`fill ${i === 0 ? "top" : ""}`} style={{ width: pct(s.confidence) }} /></div>
                  </li>
                ))}
              </ul>

              {info && (
                <div className={`advice ${info.good ? "good" : ""}`}>
                  <h3>{info.title}</h3>
                  <ul>{info.tips.map((t) => <li key={t}>{t}</li>)}</ul>
                  <small>General guidance only. Confirm with a local agriculture officer before treating.</small>
                </div>
              )}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
