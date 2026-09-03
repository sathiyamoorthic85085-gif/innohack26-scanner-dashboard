import React, { useEffect, useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  LogOut,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Undo2,
  Users,
  Utensils,
  Volume2,
  VolumeX,
  Download,
  AlertCircle,
  Coffee,
} from "lucide-react";
import { CameraScanner } from "./components/CameraScanner";
import {
  FoodPassData,
  HeadCountMetrics,
  MEAL_SCHEDULE,
  MealSlotId,
  ScanAuditLogItem,
} from "./types";

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || "https://innohack26.vercel.app";

// Helper audio beep synthesizer
function playBeep(success: boolean) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (success) {
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.1); // D6
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {
    // audio not supported or blocked
  }
}

export function App() {
  const [organizerEmail, setOrganizerEmail] = useState<string>(
    () => localStorage.getItem("innohack26_scanner_organizer_email") || ""
  );
  const [emailInput, setEmailInput] = useState("");
  const [apiBase, setApiBase] = useState<string>(
    () => localStorage.getItem("innohack26_scanner_api_base") || DEFAULT_API_BASE
  );
  const [activeMealId, setActiveMealId] = useState<MealSlotId>("sep24_night_dinner");
  const [cameraActive, setCameraActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [tokenInput, setTokenInput] = useState("");
  const [isLoadingPass, setIsLoadingPass] = useState(false);
  const [currentPass, setCurrentPass] = useState<FoodPassData | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<HeadCountMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<ScanAuditLogItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Auto-fetch metrics periodically
  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${apiBase}/api/food-token?action=headcount`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.warn("Metrics fetch error", e);
    }
  };

  useEffect(() => {
    if (organizerEmail) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [organizerEmail, apiBase]);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) {
      alert("Please enter a valid organiser email address.");
      return;
    }
    const email = emailInput.trim().toLowerCase();
    localStorage.setItem("innohack26_scanner_organizer_email", email);
    setOrganizerEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem("innohack26_scanner_organizer_email");
    setOrganizerEmail("");
    setCurrentPass(null);
  };

  // Extract token ID from URL or raw text
  const parseTokenId = (raw: string): string => {
    let clean = raw.trim();
    if (clean.includes("token=")) {
      try {
        const url = new URL(clean.startsWith("http") ? clean : `https://x.com/${clean}`);
        const tokenParam = url.searchParams.get("token");
        if (tokenParam) return tokenParam.trim();
      } catch {}
    }
    return clean;
  };

  // Lookup food pass
  const lookupToken = async (rawToken: string, autoRedeemActiveMeal = false) => {
    const tokenId = parseTokenId(rawToken);
    if (!tokenId) return;

    setIsLoadingPass(true);
    setPassError(null);
    setStatusMessage(null);

    try {
      const res = await fetch(`${apiBase}/api/food-token?token=${encodeURIComponent(tokenId)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setPassError(data.error || "Food pass not found.");
        setCurrentPass(null);
        if (soundEnabled) playBeep(false);
        return;
      }

      setCurrentPass(data);

      if (autoRedeemActiveMeal) {
        await executeRedemption(data.tokenId, activeMealId);
      } else {
        if (soundEnabled) playBeep(true);
      }
    } catch (e: any) {
      setPassError(e.message || "Failed to reach catering backend.");
      setCurrentPass(null);
      if (soundEnabled) playBeep(false);
    } finally {
      setIsLoadingPass(false);
    }
  };

  // Execute meal redemption or toggle
  const executeRedemption = async (tokenId: string, mealId: MealSlotId, forceAction?: "redeem" | "undo") => {
    try {
      const res = await fetch(`${apiBase}/api/food-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          mealId,
          scannedBy: organizerEmail,
          forceAction,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setStatusMessage({ text: data.error || "Failed to update redemption", type: "error" });
        if (soundEnabled) playBeep(false);
        return;
      }

      setCurrentPass(data.pass);
      setStatusMessage({
        text:
          data.action === "redeemed"
            ? `✅ Successfully marked ${data.mealName} as REDEEMED for ${data.pass.memberName}!`
            : `↩️ Undid redemption of ${data.mealName} for ${data.pass.memberName}.`,
        type: data.action === "redeemed" ? "success" : "info",
      });

      if (soundEnabled) playBeep(data.action === "redeemed");

      // Add to audit log
      setAuditLog((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          tokenId: data.pass.tokenId,
          memberName: data.pass.memberName,
          teamName: data.pass.teamName,
          mealId,
          mealName: data.mealName,
          scannedBy: organizerEmail,
          action: data.action,
        },
        ...prev.slice(0, 19),
      ]);

      // Refresh metrics
      fetchMetrics();
    } catch (e: any) {
      setStatusMessage({ text: e.message || "Network error", type: "error" });
      if (soundEnabled) playBeep(false);
    }
  };

  // Export head count CSV
  const exportCsv = () => {
    if (!metrics) return;
    const rows = [
      ["InnoHack-26 Meal & Head Count Report"],
      [`Generated at: ${new Date().toLocaleString()}`],
      [`Total Registered Participants: ${metrics.totalRegisteredParticipants}`],
      [`Total Squads: ${metrics.totalSquads}`],
      [],
      ["Meal Slot ID", "Meal Name", "Slot Description", "Type", "Time Window", "Served Count", "Total Eligible", "Remaining", "% Served"],
      ...metrics.mealStats.map((m) => [
        m.id,
        m.name,
        m.slot,
        m.type.toUpperCase(),
        m.timeWindow,
        m.servedCount,
        m.totalEligible,
        m.totalEligible - m.servedCount,
        `${m.totalEligible > 0 ? Math.round((m.servedCount / m.totalEligible) * 100) : 0}%`,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((c) => `"${c}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `innohack26_headcount_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active meal definition
  const activeMealDef = useMemo(
    () => MEAL_SCHEDULE.find((m) => m.id === activeMealId) || MEAL_SCHEDULE[0],
    [activeMealId]
  );

  if (!organizerEmail) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: "440px", width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "inline-flex", padding: "12px", background: "rgba(33,153,255,0.15)", borderRadius: "12px", color: "var(--primary)", marginBottom: "16px" }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 900, textTransform: "uppercase", marginBottom: "8px", color: "#fff" }}>
            INNOHACK-26 <span style={{ color: "var(--accent)" }}>MEAL SCANNER</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
            Organiser Catering &amp; Live Head Count Portal. Enter your organiser email to start scanning passes.
          </p>

          <form onSubmit={handleLogin} style={{ display: "grid", gap: "14px" }}>
            <input
              type="email"
              placeholder="organiser@innohack26.in"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              style={{ padding: "12px 14px", background: "#050f24", border: "1px solid var(--border)", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" }}
            />
            <button
              type="submit"
              style={{ padding: "12px", background: "var(--primary)", border: "none", borderRadius: "8px", color: "#051329", fontWeight: 800, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              ACCESS SCANNER DASHBOARD &rarr;
            </button>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textAlign: "left", marginBottom: "4px" }}>
              CATERING BACKEND API ENDPOINT:
            </label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => {
                setApiBase(e.target.value);
                localStorage.setItem("innohack26_scanner_api_base", e.target.value);
              }}
              style={{ width: "100%", padding: "6px 10px", background: "#050f24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#94bcf8", fontSize: "11px", fontFamily: "monospace" }}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "16px 20px 60px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Top Navbar */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingBottom: "16px", borderBottom: "1px solid var(--border)", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "rgba(33,153,255,0.2)", border: "1px solid var(--primary)", borderRadius: "8px", padding: "6px", color: "var(--accent)" }}>
            <Utensils size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#fff", textTransform: "uppercase" }}>
              INNOHACK-26 · <span style={{ color: "var(--accent)" }}>MEAL SCANNER &amp; HEAD COUNT</span>
            </h1>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Organiser: <strong style={{ color: "#fff" }}>{organizerEmail}</strong> · Connected to: <span className="mono" style={{ color: "var(--primary)" }}>{apiBase}</span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Sound"
            style={{ padding: "8px", background: "#091a3a", border: "1px solid var(--border)", borderRadius: "8px", color: soundEnabled ? "var(--accent)" : "#666", cursor: "pointer" }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            title="Export CSV"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "#091a3a", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            <Download size={14} /> EXPORT CSV
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "rgba(248,113,113,0.15)", border: "1px solid var(--danger)", borderRadius: "8px", color: "var(--danger)", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            <LogOut size={14} /> LOGOUT
          </button>
        </div>
      </header>

      {/* Live Head Count Overview Bar */}
      <section style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={18} color="var(--primary)" /> LIVE MEAL HEAD COUNT METRICS
          </h2>
          <button
            type="button"
            onClick={fetchMetrics}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "none", border: "none", color: "var(--primary)", fontSize: "12px", cursor: "pointer", fontWeight: 700 }}
          >
            <RotateCcw size={12} /> REFRESH
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
          {MEAL_SCHEDULE.map((slot) => {
            const stat = metrics?.mealStats?.find((s) => s.id === slot.id);
            const served = stat ? stat.servedCount : 0;
            const total = stat ? stat.totalEligible : 0;
            const pct = total > 0 ? Math.round((served / total) * 100) : 0;
            const isSelected = activeMealId === slot.id;

            return (
              <div
                key={slot.id}
                onClick={() => setActiveMealId(slot.id)}
                style={{
                  background: isSelected ? "linear-gradient(135deg, #0d2a63, #071530)" : "var(--bg-card)",
                  border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: isSelected ? "var(--accent)" : "var(--text-muted)" }}>
                    {slot.name.split(" ")[0]} {slot.name.split(" ")[1]}
                  </span>
                  <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: slot.type === "food" ? "rgba(33,153,255,0.2)" : "rgba(255,220,134,0.2)", color: slot.type === "food" ? "var(--primary)" : "var(--accent)", fontWeight: "bold" }}>
                    {slot.type.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {slot.slot}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "18px", fontWeight: 900, color: served > 0 ? "var(--success)" : "#fff" }}>
                    {served} <small style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>/ {total}</small>
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--accent)" }}>
                    {pct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: isSelected ? "var(--accent)" : "var(--primary)", transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Scanner Section Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
        
        {/* Left Column: Active Scanner & Input */}
        <section style={{ display: "grid", gap: "16px" }}>
          
          {/* Active Slot Banner */}
          <div style={{ background: "linear-gradient(135deg, #091a3a, #040d1e)", border: "1px solid var(--primary)", borderRadius: "12px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ color: "var(--accent)", fontSize: "11px", fontWeight: "bold", letterSpacing: "1px" }}>
                CURRENT ACTIVE SCANNING SLOT:
              </span>
              <span style={{ color: "#fff", fontSize: "11px" }}>{activeMealDef.timeWindow}</span>
            </div>
            <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 900, margin: 0 }}>
              🍽️ {activeMealDef.name} — <span style={{ color: "var(--accent)" }}>{activeMealDef.slot}</span>
            </h3>
          </div>

          {/* Camera QR Scanner */}
          <CameraScanner
            active={cameraActive}
            onScan={(text) => {
              setTokenInput(text);
              lookupToken(text, true);
            }}
          />

          {/* Manual Token / Barcode Input */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "var(--accent)", marginBottom: "8px" }}>
              ENTER TOKEN ID / SCAN WITH BARCODE GUN:
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookupToken(tokenInput, false);
              }}
              style={{ display: "flex", gap: "8px" }}
            >
              <input
                type="text"
                placeholder="e.g. IH26-MTLK99-F1 or paste QR URL"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", background: "#050f24", border: "1px solid var(--border)", borderRadius: "8px", color: "#fff", fontSize: "14px", fontFamily: "monospace" }}
              />
              <button
                type="submit"
                disabled={isLoadingPass}
                style={{ padding: "10px 16px", background: "var(--primary)", border: "none", borderRadius: "8px", color: "#041408", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Search size={16} /> {isLoadingPass ? "..." : "LOOKUP"}
              </button>
            </form>
          </div>

          {statusMessage && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 700,
                background: statusMessage.type === "success" ? "rgba(52,211,153,0.15)" : statusMessage.type === "error" ? "rgba(248,113,113,0.15)" : "rgba(33,153,255,0.15)",
                border: `1px solid ${statusMessage.type === "success" ? "var(--success)" : statusMessage.type === "error" ? "var(--danger)" : "var(--primary)"}`,
                color: statusMessage.type === "success" ? "var(--success)" : statusMessage.type === "error" ? "var(--danger)" : "var(--primary)",
              }}
            >
              {statusMessage.text}
            </div>
          )}
        </section>

        {/* Right Column: Scanned Pass Details & Actions */}
        <section style={{ display: "grid", gap: "16px" }}>
          {passError && (
            <div style={{ background: "rgba(248,113,113,0.15)", border: "1px solid var(--danger)", borderRadius: "12px", padding: "20px", textAlign: "center", color: "var(--danger)" }}>
              <AlertCircle size={32} style={{ marginBottom: "8px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 800 }}>PASS NOT FOUND</h3>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>{passError}</p>
            </div>
          )}

          {currentPass ? (
            <div style={{ background: "var(--bg-card)", border: "2px solid var(--primary)", borderRadius: "14px", padding: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: "14px", marginBottom: "14px" }}>
                <div>
                  <span style={{ background: "rgba(255,220,134,0.15)", color: "var(--accent)", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>
                    PASS #{currentPass.memberIndex} OF {currentPass.memberCount}
                  </span>
                  <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#fff", marginTop: "4px" }}>
                    {currentPass.memberName}
                  </h2>
                  <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {currentPass.role} · Squad: <strong style={{ color: "#fff" }}>{currentPass.teamName}</strong>
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "bold" }}>TOKEN ID</span>
                  <div className="mono" style={{ fontSize: "15px", fontWeight: 900, color: "#fff" }}>
                    {currentPass.tokenId}
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--primary)" }}>Ref: {currentPass.referenceCode}</span>
                </div>
              </div>

              {/* Quick Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
                <div>🏛️ <strong>{currentPass.college}</strong></div>
                <div>⚡ Track: <strong style={{ color: "var(--accent)", textTransform: "uppercase" }}>{currentPass.buildType} BUILD</strong></div>
                <div>🎯 Domain: <strong>{currentPass.domain}</strong></div>
                <div>👥 Squad: <strong>{currentPass.memberCount} Members</strong></div>
              </div>

              {/* Active Meal Stamp Action Bar */}
              {(() => {
                const isRedeemed = Boolean(currentPass.redemptions[activeMealId]);
                const redemptionInfo = currentPass.redemptions[activeMealId];

                return (
                  <div style={{ background: isRedeemed ? "rgba(52,211,153,0.12)" : "rgba(33,153,255,0.12)", border: `1px solid ${isRedeemed ? "var(--success)" : "var(--primary)"}`, borderRadius: "10px", padding: "14px", marginBottom: "16px", textAlign: "center" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                      CURRENT SLOT: <strong style={{ color: "#fff" }}>{activeMealDef.name} ({activeMealDef.slot})</strong>
                    </div>

                    {isRedeemed ? (
                      <div>
                        <div style={{ color: "var(--success)", fontSize: "16px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: "6px 0" }}>
                          <CheckCircle2 size={20} /> ALREADY REDEEMED
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "10px" }}>
                          Stamped on {new Date(redemptionInfo.redeemedAt).toLocaleTimeString()} by {redemptionInfo.redeemedBy}
                        </span>
                        <button
                          type="button"
                          onClick={() => executeRedemption(currentPass.tokenId, activeMealId, "undo")}
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(248,113,113,0.2)", border: "1px solid var(--danger)", color: "var(--danger)", padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 800, cursor: "pointer" }}
                        >
                          <Undo2 size={13} /> UNDO REDEMPTION
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => executeRedemption(currentPass.tokenId, activeMealId, "redeem")}
                          style={{ width: "100%", padding: "12px", background: "var(--success)", border: "none", borderRadius: "8px", color: "#041408", fontSize: "15px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 6px 20px rgba(52,211,153,0.3)" }}
                        >
                          <Utensils size={18} /> STAMP AS REDEEMED NOW &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* All 6 Meal Slots Checklist */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--accent)", letterSpacing: "1px", display: "block", marginBottom: "8px" }}>
                  ALL 6 MEAL SLOTS STATUS:
                </span>
                <div style={{ display: "grid", gap: "6px" }}>
                  {MEAL_SCHEDULE.map((m) => {
                    const isDone = Boolean(currentPass.redemptions[m.id]);
                    return (
                      <div
                        key={m.id}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: isDone ? "rgba(52,211,153,0.08)" : "#050f24", border: `1px solid ${isDone ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: "6px", fontSize: "12px" }}
                      >
                        <div>
                          <strong style={{ color: "#fff" }}>{m.name}</strong>
                          <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>({m.slot})</span>
                        </div>
                        {isDone ? (
                          <span style={{ color: "var(--success)", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={14} /> REDEEMED
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => executeRedemption(currentPass.tokenId, m.id, "redeem")}
                            style={{ background: "none", border: "1px solid var(--primary)", color: "var(--primary)", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                          >
                            MARK
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: "14px", padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <QrCode size={48} style={{ opacity: 0.4, marginBottom: "12px" }} />
              <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: 700 }}>AWAITING NEXT PASS</h3>
              <p style={{ fontSize: "12px", marginTop: "4px" }}>
                Scan an attendee QR code with the camera above or type their Token ID.
              </p>
            </div>
          )}

          {/* Live Recent Scans Audit Log */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <Clock size={15} color="var(--accent)" /> RECENT SCANS AUDIT FEED
            </h3>
            {auditLog.length === 0 ? (
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>No scans performed yet in this session.</span>
            ) : (
              <div style={{ display: "grid", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                {auditLog.map((log) => (
                  <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", padding: "6px 8px", background: "#050f24", borderRadius: "6px" }}>
                    <div>
                      <strong style={{ color: "#fff" }}>{log.memberName}</strong> ({log.teamName})
                      <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>· {log.mealName}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: log.action === "redeemed" ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                        {log.action.toUpperCase()}
                      </span>
                      <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>{log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
export default App;
