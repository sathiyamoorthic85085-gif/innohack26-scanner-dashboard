import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  active: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, active }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "html5qr-code-full-region";

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          const backCam = devices.find((d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn("Could not get cameras:", err);
      });
  }, []);

  const startScanner = async (cameraId: string) => {
    try {
      setError(null);
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // parse error, ignore frames without qr
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      setError(err?.message || "Failed to access camera");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn("Stop scanner error", err);
      }
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (active && selectedCameraId) {
      startScanner(selectedCameraId);
    } else {
      stopScanner();
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, [active, selectedCameraId]);

  return (
    <div style={{ width: "100%", background: "#050f24", borderRadius: "14px", border: "1px solid rgba(98,185,255,0.3)", padding: "16px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Camera size={18} color="#2199ff" />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>LIVE CAMERA QR SCANNER</span>
        </div>

        {cameras.length > 1 && (
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            style={{ background: "#091a3a", color: "#fff", border: "1px solid #2199ff", borderRadius: "6px", padding: "4px 8px", fontSize: "12px" }}
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || `Camera ${c.id.slice(0, 5)}`}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        id={containerId}
        style={{
          width: "100%",
          maxWidth: "380px",
          margin: "0 auto",
          minHeight: "260px",
          background: "#000",
          borderRadius: "10px",
          overflow: "hidden",
          border: "2px dashed #2199ff",
        }}
      />

      {error && (
        <p style={{ color: "#f87171", fontSize: "12px", marginTop: "8px" }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: "12px", display: "flex", justifyContent: "center", gap: "10px" }}>
        {isScanning ? (
          <button
            type="button"
            onClick={stopScanner}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(248,113,113,0.15)", border: "1px solid #f87171", color: "#f87171", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            <CameraOff size={14} /> PAUSE CAMERA
          </button>
        ) : (
          <button
            type="button"
            onClick={() => startScanner(selectedCameraId || (cameras[0]?.id || ""))}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,153,255,0.2)", border: "1px solid #2199ff", color: "#2199ff", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            <RefreshCw size={14} /> START CAMERA
          </button>
        )}
      </div>
    </div>
  );
};
