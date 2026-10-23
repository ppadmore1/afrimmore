import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
  /** Only accept codes this returns true for; misreads keep scanning */
  acceptCode?: (code: string) => boolean;
}

const cameraError = (err: any) => {
  const n = err?.name || "";
  if (n === "NotAllowedError" || n === "PermissionDeniedError") return "Camera permission is blocked. Please allow camera access and try again.";
  if (n === "NotReadableError" || n === "TrackStartError") return "Camera is busy in another app or tab. Close it and tap Try Again.";
  if (n === "OverconstrainedError") return "This camera mode isn't supported. Try switching camera.";
  return "Could not access camera. Please allow camera permissions and try again.";
};

const beep = () => {
  try {
    const a = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 1000; g.gain.value = 0.3;
    o.start(); o.stop(a.currentTime + 0.1);
  } catch { /* optional */ }
};

export function BarcodeScanner({ onScan, onClose, isOpen, acceptCode }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [attempt, setAttempt] = useState(0);

  const stop = () => {
    try { controlsRef.current?.stop(); } catch { /* ignore */ }
    controlsRef.current = null;
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!isOpen) return;
    doneRef.current = false;
    setError(null);
    setLastRead(null);
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });

    const accept = (code: string) => {
      if (doneRef.current) return;
      if (acceptCode && !acceptCode(code)) { setLastRead(code); return; }
      doneRef.current = true;
      beep();
      stop();
      onScan(code);
      onClose();
    };

    (async () => {
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled || !videoRef.current) return;
      try {
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => { if (result) accept(result.getText().trim()); },
        );
        if (cancelled) stop();
      } catch (e) {
        console.error("Scanner start error:", e);
        if (!cancelled) setError(cameraError(e));
      }
    })();

    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode, attempt]);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { stop(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5" />Scan Barcode</DialogTitle>
        </DialogHeader>
        <div className="relative">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
              <Camera className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-destructive">{error}</p>
              <Button onClick={() => { stop(); setAttempt((a) => a + 1); }} className="mt-4">Try Again</Button>
            </div>
          ) : (
            <div className="relative w-full aspect-[4/3] bg-foreground overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-32 border-2 border-primary rounded-lg" />
              </div>
              <Button size="icon" variant="secondary" className="absolute bottom-4 right-4 rounded-full"
                onClick={() => { stop(); setFacingMode((f) => (f === "environment" ? "user" : "environment")); }}>
                <SwitchCamera className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="p-4 pt-2 text-center text-sm text-muted-foreground space-y-1">
          <p>Hold the barcode flat inside the frame, about 15–20 cm away.</p>
          {lastRead && <p>Read "<span className="font-mono">{lastRead}</span>" — no product has this code. Check the product's barcode field.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
