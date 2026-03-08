import { useState } from "react";
import { ShieldCheck, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ManagerPinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (managerId: string, managerName: string) => void;
  actionDescription: string;
}

export function ManagerPinDialog({ isOpen, onClose, onVerified, actionDescription }: ManagerPinDialogProps) {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handlePinPress = (digit: string) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  const handleDelete = () => setPin(prev => prev.slice(0, -1));
  const handleClear = () => { setPin(""); setError(""); };

  const handleVerify = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("verify_manager_pin", { p_pin: pin });
      if (rpcError) throw rpcError;
      if (!data || data.length === 0) {
        setError("Invalid manager PIN");
        setPin("");
        return;
      }
      const manager = data[0];
      onVerified(manager.manager_id, manager.manager_name);
      setPin("");
      toast({ title: "Authorized", description: `Approved by ${manager.manager_name}` });
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setPin(""); setError(""); } }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Manager Approval
          </DialogTitle>
          <DialogDescription className="text-center">{actionDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* PIN Display */}
          <div className="flex justify-center gap-2 py-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  i < pin.length ? "bg-primary border-primary" : "border-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-destructive text-xs text-center font-medium">{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map(key => (
              key === "" ? <div key="empty" /> : (
                <Button
                  key={key}
                  variant="outline"
                  className="h-12 text-lg font-bold"
                  onClick={() => key === "⌫" ? handleDelete() : handlePinPress(key)}
                  disabled={verifying}
                >
                  {key}
                </Button>
              )
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); handleClear(); }}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleVerify} disabled={pin.length < 4 || verifying}>
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
