import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { useFeedback } from "../hooks/useFeedback";
import type { ScanResult } from "../types";
import styles from "./ScanPage.module.css";

const RESET_DELAY = 4000; // ms before returning to scanning state
const CODE_ABSENCE_DELAY = 900; // ms without a detection before another scan is allowed

export default function ScanPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const codeReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<ScanResult>({ status: "idle" });
  const [scanCount, setScanCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const { playSuccess, playAlreadyScanned, playError } = useFeedback();

  const resetToScanning = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      // Keep the code locked while it remains visible in the camera.
      if (decodedText === lastScannedRef.current) {
        if (codeReleaseTimerRef.current)
          clearTimeout(codeReleaseTimerRef.current);
        codeReleaseTimerRef.current = setTimeout(() => {
          lastScannedRef.current = null;
        }, CODE_ABSENCE_DELAY);
        return;
      }

      // Ignore if already processing
      if (processingRef.current) return;

      lastScannedRef.current = decodedText;
      codeReleaseTimerRef.current = setTimeout(() => {
        lastScannedRef.current = null;
      }, CODE_ABSENCE_DELAY);
      processingRef.current = true;
      setResult({ status: "scanning" });

      // Clear any pending reset
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

      try {
        // 1. Look up the QR in the primary list, then the demo list.
        const { data: primaryGuest } = await supabase
          .from("guests")
          .select("*")
          .eq("id", decodedText)
          .maybeSingle();

        let guest = primaryGuest;
        let scanTable = "scans";

        if (!guest) {
          const { data: demoGuest } = await supabase
            .from("demo_guests")
            .select("*")
            .eq("id", decodedText)
            .maybeSingle();
          guest = demoGuest;
          scanTable = "demo_scans";
        }

        if (!guest) {
          playError();
          setResult({ status: "invalid" });
          resetTimerRef.current = setTimeout(resetToScanning, RESET_DELAY);
          processingRef.current = false;
          return;
        }

        // 2. Check for prior valid scan
        const { data: existingScan } = await supabase
          .from(scanTable)
          .select("id, scanned_at")
          .eq("guest_id", decodedText)
          .eq("status", "valid")
          .maybeSingle();

        const status = existingScan ? "already_scanned" : "valid";

        // 3. Log this scan attempt
        const { error: scanError } = await supabase.from(scanTable).insert({
          guest_id: decodedText,
          status,
        });

        if (scanError) throw scanError;

        if (status === "valid") {
          playSuccess();
          setScanCount((c) => c + 1);
        } else {
          playAlreadyScanned();
        }

        setResult({
          status,
          guest,
          scannedAt: existingScan?.scanned_at,
        });

        resetTimerRef.current = setTimeout(resetToScanning, RESET_DELAY);
      } catch (err) {
        console.error("Scan error:", err);
        playError();
        setResult({ status: "invalid" });
        resetTimerRef.current = setTimeout(resetToScanning, RESET_DELAY);
      }

      processingRef.current = false;
    },
    [playSuccess, playAlreadyScanned, playError, resetToScanning],
  );

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 260 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          "This browser does not support camera access. Use a mobile device or a desktop browser with a webcam.",
        );
        return;
      }

      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          handleScanSuccess,
          () => {}, // ignore per-frame errors
        );
      } catch (err) {
        console.error("Camera error:", err);
        const message =
          err instanceof Error && err.name === "NotFoundError"
            ? "No camera was found on this device. Please connect a webcam or use a mobile device with a camera."
            : "Camera access denied. Please allow camera permissions and reload the page.";
        setCameraError(message);
      }
    };

    void startScanner();

    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (codeReleaseTimerRef.current)
        clearTimeout(codeReleaseTimerRef.current);

      try {
        const state = scanner.getState();
        if (state === 2 || state === 3) {
          void scanner.stop();
        }
      } catch {
        // ignore stop errors when the scanner never started
      }
    };
  }, [handleScanSuccess]);

  const statusConfig = {
    idle: {
      color: "var(--text-secondary)",
      bg: "transparent",
      label: "Ready to scan",
    },
    scanning: {
      color: "var(--accent-light)",
      bg: "transparent",
      label: "Checking…",
    },
    valid: { color: "var(--green)", bg: "var(--green-bg)", label: "Welcome!" },
    already_scanned: {
      color: "var(--amber)",
      bg: "var(--amber-bg)",
      label: "Already checked in",
    },
    invalid: {
      color: "var(--red)",
      bg: "var(--red-bg)",
      label: "Invalid ticket",
    },
  };

  const current = statusConfig[result.status];
  const isResultState = ["valid", "already_scanned", "invalid"].includes(
    result.status,
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div
            className={styles.dot}
            style={{
              background: isResultState ? current.color : "var(--text-muted)",
            }}
          />
          <span className={styles.headerTitle}>Guest Scanner</span>
          <span className={styles.scanCount}>{scanCount} checked in</span>
        </div>
      </header>

      {/* Camera */}
      <div className={styles.cameraWrap} ref={containerRef}>
        <div
          id="qr-reader"
          className={styles.camera}
          style={{ opacity: isResultState ? 0.25 : 1 }}
        />

        {/* Corner frame overlay */}
        {!isResultState && (
          <div className={styles.frame} aria-hidden="true">
            <div className={styles.corner} data-pos="tl" />
            <div className={styles.corner} data-pos="tr" />
            <div className={styles.corner} data-pos="bl" />
            <div className={styles.corner} data-pos="br" />
          </div>
        )}

        {cameraError && (
          <div className={styles.cameraError}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p>{cameraError}</p>
          </div>
        )}
      </div>

      {/* Result panel */}
      <div
        className={styles.resultPanel}
        style={{
          background: isResultState ? current.bg : "transparent",
          borderColor: isResultState ? current.color + "33" : "transparent",
        }}
      >
        {result.status === "idle" && (
          <div className={styles.idleState}>
            <p className={styles.idleText}>Point camera at a guest QR code</p>
          </div>
        )}

        {result.status === "scanning" && (
          <div className={styles.idleState}>
            <div className={styles.spinner} />
            <p className={styles.idleText}>Checking ticket…</p>
          </div>
        )}

        {result.status === "valid" && result.guest && (
          <div className={styles.resultContent}>
            <div className={styles.statusIcon} style={{ color: current.color }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className={styles.guestInfo}>
              <p
                className={styles.statusLabel}
                style={{ color: current.color }}
              >
                {current.label}
              </p>
              <h2 className={styles.guestName}>{result.guest.name}</h2>
              <div className={styles.guestMeta}>
                <span
                  className={styles.badge}
                  style={{
                    color: current.color,
                    borderColor: current.color + "44",
                  }}
                >
                  {result.guest.party_size === 1
                    ? "1 guest"
                    : `Party of ${result.guest.party_size}`}
                </span>
              </div>
              {result.guest.notes && (
                <p className={styles.notes}>{result.guest.notes}</p>
              )}
            </div>
          </div>
        )}

        {result.status === "already_scanned" && result.guest && (
          <div className={styles.resultContent}>
            <div className={styles.statusIcon} style={{ color: current.color }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className={styles.guestInfo}>
              <p
                className={styles.statusLabel}
                style={{ color: current.color }}
              >
                {current.label}
              </p>
              <h2 className={styles.guestName}>{result.guest.name}</h2>
              <div className={styles.guestMeta}>
                <span
                  className={styles.badge}
                  style={{
                    color: current.color,
                    borderColor: current.color + "44",
                  }}
                >
                  {result.guest.party_size === 1
                    ? "1 guest"
                    : `Party of ${result.guest.party_size}`}
                </span>
              </div>
              {result.scannedAt && (
                <p className={styles.scannedTime}>
                  First scanned at{" "}
                  {new Date(result.scannedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {result.status === "invalid" && (
          <div className={styles.resultContent}>
            <div className={styles.statusIcon} style={{ color: current.color }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className={styles.guestInfo}>
              <p
                className={styles.statusLabel}
                style={{ color: current.color }}
              >
                {current.label}
              </p>
              <p className={styles.invalidMessage}>
                This QR code is not on the guest list.
              </p>
            </div>
          </div>
        )}

        {/* Progress bar — counts down to next scan */}
        {isResultState && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                background: current.color,
                animationDuration: `${RESET_DELAY}ms`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
