import { useState, useEffect, useRef, useCallback } from "react";
// @ts-ignore - quagga2 type definitions have TS1540 error
import Quagga from "@ericblade/quagga2";
import { Camera, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const isInitializedRef = useRef(false);
  const detectedHandlerRef = useRef<((result: any) => void) | null>(null);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseAllStreams = useCallback(() => {
    // Stop all video element streams in the scanner container
    if (scannerRef.current) {
      const videos = scannerRef.current.querySelectorAll("video");
      videos.forEach((video) => {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          video.srcObject = null;
        }
        video.remove();
      });
      const canvases = scannerRef.current.querySelectorAll("canvas");
      canvases.forEach((c) => c.remove());
    }
  }, []);

  const stopScanner = useCallback(() => {
    // Clear any pending init timer
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
    // Remove the detected handler
    if (detectedHandlerRef.current) {
      try {
        Quagga.offDetected(detectedHandlerRef.current);
      } catch (e) {
        // ignore
      }
      detectedHandlerRef.current = null;
    }
    // Stop Quagga
    if (isInitializedRef.current) {
      try {
        Quagga.stop();
      } catch (e) {
        console.warn("Quagga stop error:", e);
      }
      isInitializedRef.current = false;
    }
    // Force release all camera streams
    releaseAllStreams();
  }, [releaseAllStreams]);

  const initScanner = useCallback(() => {
    if (!scannerRef.current || !isOpen) return;

    // Always fully clean up before reinitializing
    stopScanner();
    setError(null);

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            facingMode: facingMode,
            width: { min: 640 },
            height: { min: 480 },
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "code_128_reader",
            "code_39_reader",
            "upc_reader",
            "upc_e_reader",
          ],
        },
        locate: true,
      },
      (err: any) => {
        if (err) {
          console.error("Quagga init error:", err);
          // Release any partially acquired streams
          releaseAllStreams();
          setError("Could not access camera. Please allow camera permissions and try again.");
          return;
        }
        Quagga.start();
        isInitializedRef.current = true;
      }
    );

    const handleDetected = (result: any) => {
      if (result.codeResult.code) {
        const code = result.codeResult.code;
        // Play beep
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 1000;
          oscillator.type = "sine";
          gainNode.gain.value = 0.3;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
          // Audio is optional
        }

        stopScanner();
        onScan(code);
        onClose();
      }
    };

    detectedHandlerRef.current = handleDetected;
    Quagga.onDetected(handleDetected);
  }, [facingMode, isOpen, onScan, onClose, stopScanner, releaseAllStreams]);

  // Main lifecycle: start/stop scanner when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // Delay to allow dialog to mount
      initTimerRef.current = setTimeout(initScanner, 400);
      return () => {
        stopScanner();
      };
    } else {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reinit when facingMode changes while open
  useEffect(() => {
    if (isOpen) {
      initTimerRef.current = setTimeout(initScanner, 400);
      return () => {
        if (initTimerRef.current) {
          clearTimeout(initTimerRef.current);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const toggleCamera = () => {
    stopScanner();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleTryAgain = () => {
    setError(null);
    // Give a moment for state to clear, then reinit
    initTimerRef.current = setTimeout(initScanner, 500);
  };

  const handleClose = () => {
    stopScanner();
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
              <Camera className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-destructive">{error}</p>
              <Button onClick={handleTryAgain} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={scannerRef}
                className="relative w-full aspect-[4/3] bg-black overflow-hidden"
              >
                {/* Scanner overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-64 h-32 border-2 border-primary rounded-lg">
                    <div className="absolute inset-0 border-2 border-transparent animate-pulse">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                    </div>
                  </div>
                </div>

                {/* Scanning line animation */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-64 h-32 overflow-hidden">
                    <div className="w-full h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 z-20">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={toggleCamera}
                  className="rounded-full"
                >
                  <SwitchCamera className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="p-4 pt-2">
          <p className="text-sm text-muted-foreground text-center">
            Position the barcode within the frame to scan
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
