import { useState, useEffect, useRef, useCallback } from "react";
// @ts-ignore - quagga2 type definitions have TS1540 error
import Quagga from "@ericblade/quagga2";
import { Camera, X, SwitchCamera } from "lucide-react";
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
  const [isInitialized, setIsInitialized] = useState(false);

  const stopScanner = useCallback(() => {
    if (isInitialized) {
      Quagga.stop();
      setIsInitialized(false);
    }
  }, [isInitialized]);

  const initScanner = useCallback(() => {
    if (!scannerRef.current || !isOpen) return;

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
      (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          setError("Could not access camera. Please allow camera permissions.");
          return;
        }
        Quagga.start();
        setIsInitialized(true);
      }
    );

    Quagga.onDetected((result) => {
      if (result.codeResult.code) {
        const code = result.codeResult.code;
        // Play a beep sound for feedback
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

        stopScanner();
        onScan(code);
        onClose();
      }
    });
  }, [facingMode, isOpen, onScan, onClose, stopScanner]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the dialog is mounted
      const timer = setTimeout(initScanner, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, initScanner, stopScanner]);

  const toggleCamera = () => {
    stopScanner();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  useEffect(() => {
    if (isOpen && !isInitialized) {
      const timer = setTimeout(initScanner, 100);
      return () => clearTimeout(timer);
    }
  }, [facingMode, isOpen, isInitialized, initScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
              <Button onClick={initScanner} className="mt-4">
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
