import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import jsQR from "jsqr";
import { useEvent } from "../context/EventContext";
import { qrCheckin } from "../api/invitees";
import type { Invitee } from "../api/invitees";
import "./QrScanPage.css";

// Genera un beep con Web Audio API senza caricare file audio
function playBeep(type: "success" | "duplicate" | "error") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "duplicate") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      // error
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }

    osc.onended = () => ctx.close();
  } catch {
    // Web Audio non disponibile: silenzio
  }
}

type ScanResult =
  | { type: "success"; invitee: Invitee }
  | { type: "duplicate"; invitee?: Invitee; message: string }
  | { type: "error"; message: string };

export default function QrScanPage() {
  const { currentEvent } = useEvent();
  const eventId = currentEvent!.id;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const cooldownRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualToken, setManualToken] = useState("");

  const checkinMutation = useMutation({
    mutationFn: (token: string) => qrCheckin(eventId, token),
    onSuccess: (invitee) => {
      playBeep("success");
      setScanResult({ type: "success", invitee });
      cooldownRef.current = true;
      setTimeout(() => {
        setScanResult(null);
        cooldownRef.current = false;
        lastScannedRef.current = null;
      }, 3500);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const message = err?.response?.data?.message ?? "Errore durante il check-in";
      const invitee = err?.response?.data?.invitee;
      if (status === 409) {
        playBeep("duplicate");
        setScanResult({ type: "duplicate", invitee, message });
      } else {
        playBeep("error");
        setScanResult({ type: "error", message });
      }
      cooldownRef.current = true;
      setTimeout(() => {
        setScanResult(null);
        cooldownRef.current = false;
        lastScannedRef.current = null;
      }, 3500);
    },
  });

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      startScanLoop();
    } catch (err: any) {
      setCameraError("Impossibile accedere alla fotocamera. Verifica i permessi del browser.");
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setScanResult(null);
    lastScannedRef.current = null;
  };

  const startScanLoop = () => {
    // Crea BarcodeDetector una volta sola (se disponibile nel browser)
    let barcodeDetector: any = null;
    if ("BarcodeDetector" in window) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        barcodeDetector = null;
      }
    }

    const scan = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { scanLoopRef.current = requestAnimationFrame(scan); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (barcodeDetector) {
          // Chrome/Edge: usa BarcodeDetector nativo (più veloce)
          try {
            const barcodes = await barcodeDetector.detect(canvas);
            for (const barcode of barcodes) {
              handleDetected(barcode.rawValue);
            }
          } catch {
            // frame non decodificabile, continua
          }
        } else {
          // Safari / Firefox / browser senza BarcodeDetector: usa jsQR
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height, {
            inversionAttempts: "dontInvert",
          });
          if (code) handleDetected(code.data);
        }
      }

      scanLoopRef.current = requestAnimationFrame(scan);
    };
    scanLoopRef.current = requestAnimationFrame(scan);
  };

  const handleDetected = (rawValue: string) => {
    if (cooldownRef.current) return;
    if (!rawValue || rawValue === lastScannedRef.current) return;

    // Il QR contiene solo il token (64 char hex)
    const token = rawValue.trim();
    if (!/^[a-f0-9]{64}$/.test(token)) {
      // QR non riconoscibile come token valido
      return;
    }

    lastScannedRef.current = token;
    checkinMutation.mutate(token);
  };

  // Cleanup al dismount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const listLabel = (invitee?: Invitee) => {
    if (!invitee) return "";
    return invitee.listType === "PAGANTE" ? "Pagante" : "Green";
  };

  return (
    <div className="qrscan-page">
      <div className="qrscan-header">
        <h2 className="qrscan-title">Scanner QR</h2>
        <p className="qrscan-subtitle">Inquadra il QR code dell'invitato per effettuare il check-in</p>
      </div>

      <div className="qrscan-viewport">
        <video
          ref={videoRef}
          className={`qrscan-video ${cameraActive ? "active" : ""}`}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="qrscan-canvas" />

        {!cameraActive && (
          <div className="qrscan-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
              <rect x="7" y="7" width="4" height="4" rx="0.5"/>
              <rect x="13" y="7" width="4" height="4" rx="0.5"/>
              <rect x="7" y="13" width="4" height="4" rx="0.5"/>
              <rect x="13" y="13" width="4" height="4" rx="0.5"/>
            </svg>
            <span>Camera non attiva</span>
          </div>
        )}

        {cameraActive && (
          <div className="qrscan-frame">
            <div className="qrscan-corner tl" />
            <div className="qrscan-corner tr" />
            <div className="qrscan-corner bl" />
            <div className="qrscan-corner br" />
            <div className="qrscan-laser" />
          </div>
        )}

        {/* Risultato scan */}
        {scanResult && (
          <div className={`qrscan-result-overlay ${scanResult.type}`}>
            {scanResult.type === "success" && (
              <>
                <div className="result-icon success">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div className="result-name">{scanResult.invitee.lastName} {scanResult.invitee.firstName}</div>
                <div className="result-meta">{listLabel(scanResult.invitee)} · Ingresso autorizzato</div>
              </>
            )}
            {scanResult.type === "duplicate" && (
              <>
                <div className="result-icon duplicate">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                </div>
                {scanResult.invitee && (
                  <div className="result-name">{scanResult.invitee.lastName} {scanResult.invitee.firstName}</div>
                )}
                <div className="result-meta">{scanResult.message}</div>
              </>
            )}
            {scanResult.type === "error" && (
              <>
                <div className="result-icon error">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                </div>
                <div className="result-meta">{scanResult.message}</div>
              </>
            )}
          </div>
        )}
      </div>

      {cameraError && (
        <div className="qrscan-error">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {cameraError}
        </div>
      )}

      <div className="qrscan-controls">
        {!cameraActive ? (
          <button className="qrscan-btn start" onClick={startCamera}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
            Attiva Camera
          </button>
        ) : (
          <button className="qrscan-btn stop" onClick={stopCamera}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
            Ferma Camera
          </button>
        )}
      </div>

      <div className="qrscan-manual">
        <p className="qrscan-manual-label">Inserimento manuale token (se fotocamera non disponibile)</p>
        <div className="qrscan-manual-row">
          <input
            className="qrscan-manual-input"
            type="text"
            placeholder="Incolla qui il token QR (64 caratteri hex)"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value.trim())}
            maxLength={64}
          />
          <button
            className="qrscan-btn manual"
            disabled={!/^[a-f0-9]{64}$/.test(manualToken) || checkinMutation.isPending}
            onClick={() => {
              if (/^[a-f0-9]{64}$/.test(manualToken)) {
                lastScannedRef.current = manualToken;
                checkinMutation.mutate(manualToken);
                setManualToken("");
              }
            }}
          >
            Check-in
          </button>
        </div>
      </div>

      <div className="qrscan-info">
        <p>Il QR code viene letto automaticamente una volta inquadrato.</p>
        <p>Ogni QR è valido per una sola scansione.</p>
      </div>
    </div>
  );
}
