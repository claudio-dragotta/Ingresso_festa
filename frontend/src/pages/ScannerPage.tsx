import { BrowserMultiFormatReader } from "@zxing/browser";
import type { Result } from "@zxing/library";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { checkInToken } from "../api/invitees";

interface ScanFeedback {
  status: "success" | "error";
  message: string;
  inviteeName?: string;
  extra?: string;
}

const parsePayload = (result: Result): string | null => {
  const raw = result.getText()?.trim();
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw);
    if (payload?.token) {
      return String(payload.token);
    }
  } catch (error) {
    // Fall back to raw token string
    return raw;
  }

  return raw;
};

const ScannerPage = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [manualToken, setManualToken] = useState("");
  const lastTokenRef = useRef<string | null>(null);

  const checkInMutation = useMutation({
    mutationFn: (token: string) => checkInToken(token),
    onSuccess: (data) => {
      setFeedback({
        status: "success",
        message: data.message,
        inviteeName: `${data.invitee.firstName} ${data.invitee.lastName}`,
      });
    },
    onError: (error: unknown) => {
      let message = "Errore sconosciuto";
      if (isAxiosError(error)) {
        message = (error.response?.data as { message?: string })?.message ?? message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setFeedback({ status: "error", message });
    },
  });

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    type ReaderControls = Awaited<ReturnType<BrowserMultiFormatReader["decodeFromVideoDevice"]>>;
    let controls: ReaderControls | null = null;

    const start = async () => {
      try {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        controls = await reader.decodeFromVideoDevice(undefined, videoElement, (result) => {
          if (!result) return;
          const token = parsePayload(result);
          if (!token || token === lastTokenRef.current) {
            return;
          }
          lastTokenRef.current = token;
          handleToken(token);
        });
      } catch (error) {
        setFeedback({
          status: "error",
          message:
            "Impossibile accedere alla fotocamera. Controlla i permessi del browser e riprova.",
        });
      }
    };

    void start();

    return () => {
      controls?.stop();
    };
  }, []);

  const handleToken = (token: string) => {
    setFeedback(null);
    checkInMutation.mutate(token);
  };

  const handleManualSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualToken.trim()) return;
    handleToken(manualToken.trim());
    setManualToken("");
  };

  const resetScanner = () => {
    setFeedback(null);
    lastTokenRef.current = null;
  };

  return (
    <div className="scanner-container">
      <div className="card">
        <h2>Scanner QR ufficiale</h2>
        <p>Inquadra il codice. Solo i QR generati dal sistema vengono riconosciuti.</p>
        <video ref={videoRef} className="scanner-video" autoPlay muted playsInline />
        <div className="actions" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={resetScanner}>
            Resetta lettore
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`result-card ${feedback.status}`}>
          <h3>{feedback.status === "success" ? "Accesso consentito" : "Errore"}</h3>
          <p>{feedback.message}</p>
          {feedback.inviteeName && <strong>{feedback.inviteeName}</strong>}
          {feedback.extra && <p>{feedback.extra}</p>}
        </div>
      )}

      <div className="card">
        <h2>Inserimento manuale</h2>
        <form className="grid" style={{ gap: "0.75rem" }} onSubmit={handleManualSubmit}>
          <input
            value={manualToken}
            onChange={(event) => setManualToken(event.target.value)}
            placeholder="Incolla token"
          />
          <button type="submit">Verifica</button>
        </form>
      </div>
    </div>
  );
};

export default ScannerPage;
