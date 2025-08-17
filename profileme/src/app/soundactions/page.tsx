"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLedgerDmk } from "@/ledger/useLedgerDmk";
import { ensureAttestation, getCurrentAttestation, clearAttestation, type LedgerAttestation } from "@/ledger/attestation";
import { canEdit, loadMappings, saveMappings, type Mapping as SoundMapping } from "@/sound/mappings";
import { v4 as uuidv4 } from "uuid";

type TableRow = {
  id?: string;
  freq: number;
  label: string;
  url: string;
};

type LogItem = {
  at: number;
  message: string;
};

async function playTone(frequency: number, durationMs = 600, volume = 0.5): Promise<void> {
  const Ctx: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  try {
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(volume, 1));
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    const now = ctx.currentTime;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.02);
    env.gain.linearRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(env);
    env.connect(master);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);

    await new Promise((r) => setTimeout(r, durationMs + 60));
  } finally {
    try { await ctx.close(); } catch {}
  }
}

export default function SoundActionsPage() {
  const { supported, isConnecting, isConnected, device, error, connect, disconnect } = useLedgerDmk();

  const [mappings, setMappings] = useState<SoundMapping[]>(() => loadMappings(undefined));
  const [uiRows, setUiRows] = useState<TableRow[]>([]);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [attestation, setAttestation] = useState<LedgerAttestation | null>(null);

  const pushToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    if (error) pushToast(error);
  }, [error, pushToast]);

  const wasConnectedRef = useRef<boolean>(false);
  useEffect(() => {
    if (wasConnectedRef.current && !isConnected) {
      pushToast("Ledger disconnected");
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, pushToast]);

  useEffect(() => {
    const current = getCurrentAttestation();
    setAttestation(current);
  }, []);

  useEffect(() => {
    const list = loadMappings(attestation?.pubkey);
    setMappings(list);
  }, [attestation?.pubkey]);

  useEffect(() => {
    const rows: TableRow[] = mappings
      .filter((m) => m.action && m.action.type === "openUrl")
      .map((m) => ({ id: m.id, freq: m.frequencyHz, label: m.label, url: (m.action as any).url }));
    setUiRows(rows);
  }, [mappings]);

  const TOLERANCE_HZ = 100;
  const COOLDOWN_MS = 3000;

  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("Not Listening");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTriggeredAtRef = useRef<Record<number, number>>({});

  const appendLog = useCallback((message: string) => {
    setLogs((prev) => [{ at: Date.now(), message }, ...prev].slice(0, 200));
  }, []);

  const handlePlay = useCallback(async (freq: number) => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await playTone(freq, 600, 0.55);
      appendLog(`Played ${freq} Hz test tone`);
    } catch (err: any) {
      appendLog(`Could not play tone: ${err?.message || String(err)}`);
    } finally {
      setIsPlaying(false);
    }
  }, [isPlaying, appendLog]);

  const stopListening = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setIsListening(false);
    setStatusText("Not Listening");
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const startListening = useCallback(async () => {
    try {
      setStatusText("Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096; // Higher resolution for 1k/2k/3k detection
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;

      source.connect(analyser);

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      const detectLoop = () => {
        if (!analyserRef.current || !audioContextRef.current) return;
        analyserRef.current.getByteFrequencyData(frequencyData);

        // Find the dominant bin ignoring very low frequencies (reduce hum)
        let maxVal = -1;
        let maxIndex = 0;
        const minHz = 200; // ignore <200Hz
        const sampleRate = audioContextRef.current.sampleRate;
        const binHz = sampleRate / analyserRef.current.fftSize;
        const minIndex = Math.floor(minHz / binHz);
        for (let i = minIndex; i < frequencyData.length; i++) {
          const v = frequencyData[i];
          if (v > maxVal) {
            maxVal = v;
            maxIndex = i;
          }
        }

        const dominantHz = maxIndex * binHz;

        // Noise gate
        if (maxVal > 140 && Number.isFinite(dominantHz)) {
          // Find mapping within tolerance
          let matched: TableRow | null = null;
          for (const m of uiRows) {
            if (Math.abs(dominantHz - m.freq) <= TOLERANCE_HZ) {
              matched = m;
              break;
            }
          }

          if (matched) {
            const now = Date.now();
            const lastAt = lastTriggeredAtRef.current[matched.freq] || 0;
            if (now - lastAt >= COOLDOWN_MS) {
              lastTriggeredAtRef.current[matched.freq] = now;
              const prettyHz = Math.round(dominantHz);
              const opened = window.open(matched.url, "_blank", "noopener,noreferrer");
              if (opened) {
                appendLog(`Detected ${prettyHz} Hz → Opened ${matched.label}`);
              } else {
                appendLog(`Detected ${prettyHz} Hz → Blocked popup. Please allow popups for this site to open ${matched.label}.`);
              }
            }
          } else {
            // Optional: log near misses sparingly — skip to avoid spam
          }
        }

        rafIdRef.current = requestAnimationFrame(detectLoop);
      };

      setIsListening(true);
      setStatusText("Listening");
      rafIdRef.current = requestAnimationFrame(detectLoop);
      appendLog("Microphone access granted. Listening for mapped tones...");
    } catch (err: any) {
      console.error(err);
      setStatusText("Microphone error");
      appendLog(`Microphone error: ${err?.message || String(err)}`);
      stopListening();
    }
  }, [appendLog, stopListening, uiRows]);

  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFreq, setFormFreq] = useState<number>(1000);
  const [formLabel, setFormLabel] = useState<string>("");
  const [formUrl, setFormUrl] = useState<string>("https://");

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormFreq(1000);
    setFormLabel("");
    setFormUrl("https://");
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setIsEditorOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((row: TableRow) => {
    setEditingId(row.id || null);
    setFormFreq(row.freq);
    setFormLabel(row.label);
    setFormUrl(row.url);
    setIsEditorOpen(true);
  }, []);

  const saveEdit = useCallback(() => {
    if (!attestation?.pubkey) {
      pushToast("Attest with Ledger to edit mappings.");
      return;
    }
    if (!Number.isFinite(formFreq) || formFreq <= 0) {
      pushToast("Enter a valid frequency in Hz.");
      return;
    }
    try {
      const u = new URL(formUrl);
      if (!/^https?:$/i.test(u.protocol)) throw new Error("Invalid protocol");
    } catch {
      pushToast("Enter a valid http(s) URL.");
      return;
    }
    const now = Date.now();
    let next: SoundMapping[];
    if (editingId) {
      next = mappings.map((m) =>
        m.id === editingId
          ? { ...m, frequencyHz: formFreq, label: formLabel, action: { type: "openUrl", url: formUrl }, updatedAt: now }
          : m
      );
    } else {
      next = [
        ...mappings,
        {
          id: uuidv4(),
          frequencyHz: formFreq,
          label: formLabel,
          action: { type: "openUrl", url: formUrl },
          createdAt: now,
          updatedAt: now,
        },
      ];
    }
    saveMappings(attestation.pubkey, next);
    setMappings(next);
    setIsEditorOpen(false);
    resetForm();
  }, [attestation?.pubkey, formFreq, formLabel, formUrl, editingId, mappings, resetForm, pushToast]);

  const handleDelete = useCallback((row: TableRow) => {
    if (!attestation?.pubkey) return;
    if (!row.id) return;
    if (!window.confirm(`Delete mapping for ${row.freq} Hz?`)) return;
    const next = mappings.filter((m) => m.id !== row.id);
    saveMappings(attestation.pubkey, next);
    setMappings(next);
  }, [attestation?.pubkey, mappings]);

  const handleAttach = useCallback(async () => {
    await connect();
    try {
      const att = await ensureAttestation();
      setAttestation(att);
      pushToast("Ledger attested for this session.");
    } catch (e: any) {
      const msg = e?.message || String(e);
      pushToast(`Attestation failed: ${msg}`);
    }
  }, [connect, pushToast]);

  const handleDisconnect = useCallback(async () => {
    clearAttestation();
    setAttestation(null);
    await disconnect();
  }, [disconnect]);

  return (
    <div className="px-6 py-6 mx-auto" style={{ maxWidth: 1200, minHeight: "100vh" }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="m-0" style={{ color: "var(--foreground)", fontWeight: 700 }}>Sound Actions</h3>
          <div className="muted" style={{ fontSize: 14 }}>Listen for specific tones to trigger quick actions</div>
        </div>
        <div>
          <span
            className="badge"
            style={{
              backgroundColor: isListening ? "#133a2a" : "#2a2f3a",
              color: isListening ? "#1de9b6" : "#9aa3b2",
              border: isListening ? "1px solid rgba(29,233,182,0.35)" : "1px solid rgba(255,255,255,0.08)",
              padding: "10px 12px",
            }}
          >
            {statusText}
          </span>
        </div>
      </div>

      <div className="card elevated mb-3">
        <div className="card-body d-flex align-items-center justify-content-between">
          <div>
            <div style={{ fontWeight: 700 }}>Ledger Status: <span style={{ color: isConnected ? "#1de9b6" : "#9aa3b2" }}>{isConnected ? "Connected" : "Disconnected"}</span></div>
            <div className="muted" style={{ fontSize: 13 }}>
              {isConnected && device ? `${device.product || "Ledger"} via ${device.transport.toUpperCase()}` : (supported ? "" : "WebHID/WebUSB not supported in this browser.")}
            </div>
          </div>
          <div className="d-flex" style={{ gap: 8 }}>
            {!isConnected ? (
              <button className="btn btn-primary" onClick={handleAttach} disabled={isConnecting || !supported}>
                {isConnecting ? "Attaching..." : "Attach Ledger"}
              </button>
            ) : (
              <button className="btn btn-outline-primary" onClick={handleDisconnect}>Disconnect</button>
            )}
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card elevated">
            <div className="card-body">
              <h5 className="card-title mb-3" style={{ fontWeight: 700 }}>Controls</h5>
              <div className="d-flex gap-2">
                {!isListening ? (
                  <button className="btn btn-primary" onClick={startListening}>
                    Start Listening
                  </button>
                ) : (
                  <button className="btn btn-outline-primary" onClick={stopListening}>
                    Stop Listening
                  </button>
                )}
              </div>
              <div className="mt-3 muted" style={{ fontSize: 13 }}>
                Reading and triggering works even without a Ledger. Attach a Ledger to edit mappings.
              </div>
            </div>
          </div>

          <div className="card elevated mt-4" style={{ minHeight: 260 }}>
            <div className="card-body d-flex flex-column" style={{ gap: 8 }}>
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="card-title m-0" style={{ fontWeight: 700 }}>Live Log</h5>
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setLogs([])}
                  aria-label="Clear logs"
                >
                  Clear
                </button>
              </div>
              <div
                className="mt-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  maxHeight: 320,
                  overflow: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {logs.length === 0 ? (
                  <div className="muted">No events yet. Try playing a 1000 Hz, 2000 Hz, or 3000 Hz tone.</div>
                ) : (
                  <ul className="m-0 p-0" style={{ listStyle: "none" }}>
                    {logs.map((log) => {
                      const dt = new Date(log.at);
                      const ts = dt.toLocaleTimeString();
                      return (
                        <li key={log.at} style={{ padding: "6px 4px", borderBottom: "1px dashed rgba(255,255,255,0.06)" }}>
                          <span className="muted" style={{ marginRight: 8 }}>{ts}</span>
                          <span>{log.message}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card elevated">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="card-title m-0" style={{ fontWeight: 700 }}>Frequency ↦ Action Mappings</h5>
                <button
                  className={`btn btn-sm ${canEdit(Boolean(attestation) && isConnected) ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={openAdd}
                  disabled={!canEdit(Boolean(attestation) && isConnected)}
                  title={canEdit(Boolean(attestation) && isConnected) ? "" : "Attach + attest with Ledger to edit mappings."}
                >
                  Add Mapping
                </button>
              </div>
              <div className="mb-3">
                {attestation ? (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "#133a2a",
                      color: "#1de9b6",
                      border: "1px solid rgba(29,233,182,0.35)",
                      padding: "8px 10px",
                      fontSize: 12,
                    }}
                  >
                    Attested (pubkey {attestation.pubkey.slice(2, 6)}…{attestation.pubkey.slice(-4)}) valid until {new Date(attestation.expiresAt).toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>Attach and attest with your Ledger to unlock editing.</span>
                )}
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle" style={{ color: "var(--foreground)" }}>
                  <thead>
                    <tr className="text-muted">
                      <th style={{ width: 140 }}>Frequency (Hz)</th>
                      <th>Action</th>
                      <th>Destination</th>
                      <th style={{ width: 160 }}>Tolerance</th>
                      <th style={{ width: 120 }}>Test</th>
                      <th style={{ width: 140 }}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uiRows.map((m) => (
                      <tr key={`${m.id || m.freq}`}>
                        <td><code>{m.freq}</code></td>
                        <td>{m.label}</td>
                        <td>
                          <a href={m.url} target="_blank" rel="noreferrer">
                            {m.url}
                          </a>
                        </td>
                        <td>±{TOLERANCE_HZ} Hz (cooldown {Math.round(COOLDOWN_MS / 1000)}s)</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handlePlay(m.freq)}
                            disabled={isPlaying}
                            aria-label={`Play ${m.freq} Hz`}
                          >
                            {isPlaying ? "Playing..." : "Play"}
                          </button>
                        </td>
                        <td>
                          <div className="d-flex" style={{ gap: 8 }}>
                            <button
                              className={`btn btn-sm ${canEdit(Boolean(attestation) && isConnected) ? "btn-outline-primary" : "btn-outline-secondary"}`}
                              onClick={() => openEdit(m)}
                              disabled={!canEdit(Boolean(attestation) && isConnected)}
                              title={canEdit(Boolean(attestation) && isConnected) ? "" : "Attach + attest with Ledger to edit mappings."}
                            >
                              Edit
                            </button>
                            <button
                              className={`btn btn-sm ${canEdit(Boolean(attestation) && isConnected) ? "btn-outline-danger" : "btn-outline-secondary"}`}
                              onClick={() => handleDelete(m)}
                              disabled={!canEdit(Boolean(attestation) && isConnected)}
                              title={canEdit(Boolean(attestation) && isConnected) ? "" : "Attach + attest with Ledger to edit mappings."}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {canEdit(Boolean(attestation) && isConnected)
                  ? "Editing is attested by your Ledger and saved locally bound to your Ledger public key."
                  : "Attach + attest with Ledger to edit mappings. Defaults are read-only."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", top: 16, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999 }}>
          {toasts.map((t) => (
            <div key={t.id} className="card" style={{ background: "#2a2f3a", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: 12, borderRadius: 12, minWidth: 280 }}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card elevated" style={{ width: "100%", maxWidth: 520 }}>
            <div className="card-body">
              <h5 className="card-title mb-3" style={{ fontWeight: 700 }}>{editingId ? "Edit Mapping" : "Add Mapping"}</h5>
              <div className="mb-3">
                <label className="form-label">Frequency (Hz)</label>
                <input type="number" className="form-control" value={formFreq} onChange={(e) => setFormFreq(Number(e.target.value))} min={1} step={1} />
              </div>
              <div className="mb-3">
                <label className="form-label">Label</label>
                <input type="text" className="form-control" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Open Ledger" />
              </div>
              <div className="mb-3">
                <label className="form-label">URL</label>
                <input type="url" className="form-control" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="d-flex justify-content-end" style={{ gap: 8 }}>
                <button className="btn btn-outline-secondary" onClick={() => { setIsEditorOpen(false); resetForm(); }}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEdit}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

