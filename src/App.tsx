import React, { useEffect, useState, useMemo } from "react";
import {
  CheckCircle2, Clock, LogOut, QrCode, RotateCcw, Search,
  ShieldCheck, TrendingUp, Undo2, Utensils, Volume2, VolumeX,
  Download, AlertCircle, Users
} from "lucide-react";
import { CameraScanner } from "./components/CameraScanner";
import {
  FoodPassData, HeadCountMetrics, MEAL_SCHEDULE,
  MealSlotId, ScanAuditLogItem
} from "./types";

const GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzhhyU-nkNr0tDTjK-OUeUbRGSDejmhx9kPgzJ7ecz8Hut2lmPlAVzal-IdfxuzXqf8dA/exec";

function playBeep(success: boolean) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (success) {
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.1);
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
  } catch (e) {}
}

export function App() {
  const [organizerEmail, setOrganizerEmail] = useState<string>(() => localStorage.getItem("innohack26_scanner_organizer_email") || "");
  const [emailInput, setEmailInput] = useState("");
  const [activeMealId, setActiveMealId] = useState<MealSlotId>("attendance");
  const [cameraActive, setCameraActive] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [tokenInput, setTokenInput] = useState("");
  const [isLoadingPass, setIsLoadingPass] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<any[] | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<HeadCountMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<ScanAuditLogItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${GAS_WEBHOOK_URL}?action=headcount`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (organizerEmail) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [organizerEmail]);

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
    setCurrentTeam(null);
  };

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

  const lookupToken = async (rawToken: string, autoRedeemActiveMeal = false) => {
    const tokenId = parseTokenId(rawToken);
    if (!tokenId) return;

    setIsLoadingPass(true);
    setPassError(null);
    setStatusMessage(null);

    try {
      // Bypass Vercel API and hit Google Apps Script directly
      const res = await fetch(`${GAS_WEBHOOK_URL}?action=lookup&token=${encodeURIComponent(tokenId)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setPassError(data.error || "Team not found.");
        setCurrentTeam(null);
        if (soundEnabled) playBeep(false);
        return;
      }

      if (data.team) {
        setCurrentTeam(data.team);
      } else if (data.pass) {
        setCurrentTeam([data.pass]);
      } else {
        setPassError("No members found.");
        setCurrentTeam(null);
        if (soundEnabled) playBeep(false);
        return;
      }

      if (soundEnabled) playBeep(true);
    } catch (e: any) {
      setPassError(e.message || "Failed to reach backend.");
      setCurrentTeam(null);
      if (soundEnabled) playBeep(false);
    } finally {
      setIsLoadingPass(false);
    }
  };

  const executeRedemption = async (tokenId: string, mealId: MealSlotId, memberName: string, forceAction?: "redeem" | "undo") => {
    try {
      // POST to Google Apps Script via GET request to avoid CORS preflight issues
      const claimed = forceAction === "undo" ? "false" : "true";
      const res = await fetch(`${GAS_WEBHOOK_URL}?action=redeem&token=${encodeURIComponent(tokenId)}&meal=${encodeURIComponent(mealId)}&claimed=${claimed}&by=${encodeURIComponent(organizerEmail)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setStatusMessage({ text: data.error || "Failed to update", type: "error" });
        if (soundEnabled) playBeep(false);
        return;
      }

      setCurrentTeam(prev => {
        if (!prev) return prev;
        return prev.map(member => {
          if (member.tokenId === tokenId) {
            return {
              ...member,
              meals: {
                ...member.meals,
                [mealId]: {
                  claimed: forceAction === "undo" ? false : (forceAction === "redeem" ? true : data.claimed),
                  claimedAt: new Date().toISOString()
                }
              }
            };
          }
          return member;
        });
      });

      setStatusMessage({
        text: forceAction === "undo" ? `↩️ Undid ${mealId} for ${memberName}.` : `✅ Marked ${mealId} for ${memberName}!`,
        type: forceAction === "undo" ? "info" : "success",
      });

      if (soundEnabled) playBeep(forceAction !== "undo");

      setAuditLog((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          tokenId,
          memberName,
          teamName: "Team",
          mealId,
          mealName: mealId,
          scannedBy: organizerEmail,
          action: forceAction === "undo" ? "undone" : "redeemed",
        },
        ...prev.slice(0, 19),
      ]);

      fetchMetrics();
    } catch (e: any) {
      setStatusMessage({ text: e.message || "Network error", type: "error" });
      if (soundEnabled) playBeep(false);
    }
  };

  const exportCsv = () => {
    if (!metrics) return;
    const rows = [
      ["Meal Slot ID", "Served", "Eligible"],
      ...metrics.mealStats.map((m) => [m.id, m.servedCount, m.totalEligible]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `headcount_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeMealDef = useMemo(() => MEAL_SCHEDULE.find((m) => m.id === activeMealId) || MEAL_SCHEDULE[0], [activeMealId]);

  if (!organizerEmail) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: "440px", width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "32px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
          <ShieldCheck size={32} style={{ color: "var(--primary)", marginBottom: "16px" }} />
          <h1 style={{ fontSize: "22px", fontWeight: 900, marginBottom: "24px", color: "#fff" }}>MEAL SCANNER</h1>
          <form onSubmit={handleLogin} style={{ display: "grid", gap: "14px" }}>
            <input type="email" placeholder="organiser@email.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required style={{ padding: "12px", background: "#050f24", color: "#fff", border: "1px solid var(--border)", borderRadius: "8px" }} />
            <button type="submit" style={{ padding: "12px", background: "var(--primary)", border: "none", borderRadius: "8px", color: "#000", fontWeight: 800 }}>ACCESS SCANNER</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "16px 20px 60px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#fff" }}>INNOHACK-26 SCANNER</h1>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{organizerEmail}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ padding: "8px", background: "#091a3a", borderRadius: "8px", color: "var(--accent)", border: "1px solid var(--border)" }}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={handleLogout} style={{ padding: "8px 12px", background: "rgba(248,113,113,0.15)", borderRadius: "8px", color: "var(--danger)", border: "1px solid var(--danger)", fontWeight: 700, fontSize: "12px" }}>LOGOUT</button>
        </div>
      </header>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 800, color: "#fff", marginBottom: "12px" }}>METRICS</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
          {MEAL_SCHEDULE.map((slot) => {
            const stat = metrics?.mealStats?.find((s) => s.id === slot.id);
            const served = stat ? stat.servedCount : 0;
            const total = stat ? stat.totalEligible : 0;
            const isSelected = activeMealId === slot.id;
            return (
              <div key={slot.id} onClick={() => setActiveMealId(slot.id)} style={{ background: isSelected ? "#0d2a63" : "var(--bg-card)", border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)", borderRadius: "10px", padding: "12px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: isSelected ? "var(--accent)" : "var(--text-muted)" }}>{slot.name}</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: served > 0 ? "var(--success)" : "#fff" }}>{served} / {total}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        <section style={{ display: "grid", gap: "16px" }}>
          <div style={{ background: "#091a3a", border: "1px solid var(--primary)", borderRadius: "12px", padding: "16px", color: "#fff", fontWeight: 900 }}>
            CURRENT: {activeMealDef.name}
          </div>
          <CameraScanner active={cameraActive} onScan={(text) => { setTokenInput(text); lookupToken(text, false); }} />
          <form onSubmit={(e) => { e.preventDefault(); lookupToken(tokenInput, false); }} style={{ display: "flex", gap: "8px" }}>
            <input type="text" placeholder="Token / Ref Code" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} style={{ flex: 1, padding: "10px", background: "#050f24", color: "#fff", border: "1px solid var(--border)", borderRadius: "8px" }} />
            <button type="submit" disabled={isLoadingPass} style={{ padding: "10px 16px", background: "var(--primary)", color: "#000", fontWeight: 800, borderRadius: "8px", border: "none" }}>LOOKUP</button>
          </form>
          {statusMessage && <div style={{ padding: "12px", color: statusMessage.type === 'error' ? 'var(--danger)' : 'var(--success)', background: 'rgba(255,255,255,0.1)', borderRadius: "8px", fontWeight: 'bold' }}>{statusMessage.text}</div>}
        </section>

        <section style={{ display: "grid", gap: "16px" }}>
          {passError && <div style={{ padding: "20px", color: "var(--danger)", background: "rgba(248,113,113,0.15)", borderRadius: "12px", fontWeight: 800 }}>{passError}</div>}
          
          {currentTeam ? (
            <div style={{ background: "var(--bg-card)", border: "2px solid var(--primary)", borderRadius: "14px", padding: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 900, color: "#fff", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                TEAM: {currentTeam[0]?.teamName || "N/A"}
              </h2>
              <div style={{ display: "grid", gap: "12px" }}>
                {currentTeam.map(member => {
                  const isRedeemed = member.meals?.[activeMealId]?.claimed;
                  return (
                    <div key={member.tokenId} style={{ background: "#050f24", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 800, fontSize: "14px" }}>{member.memberName}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{member.role}</div>
                      </div>
                      <div>
                        {isRedeemed ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ color: "var(--success)", fontWeight: 800, fontSize: "12px" }}><CheckCircle2 size={16}/> DONE</span>
                            <button onClick={() => executeRedemption(member.tokenId, activeMealId, member.memberName, "undo")} style={{ background: "none", border: "1px solid var(--danger)", color: "var(--danger)", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}>UNDO</button>
                          </div>
                        ) : (
                          <button onClick={() => executeRedemption(member.tokenId, activeMealId, member.memberName, "redeem")} style={{ background: "var(--primary)", color: "#000", border: "none", padding: "6px 12px", borderRadius: "4px", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}>MARK</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: "14px" }}>
              <h3 style={{ color: "#fff" }}>AWAITING SCAN</h3>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
export default App;
