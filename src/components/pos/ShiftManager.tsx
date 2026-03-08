import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, Play, Square, DollarSign, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";

interface ActiveShift {
  id: string;
  opened_at: string;
  opening_float: number;
  total_sales: number;
  total_transactions: number;
  cash_sales: number;
  status: string;
}

interface ShiftManagerProps {
  onShiftChange: (shiftId: string | null) => void;
}

export function ShiftManager({ onShiftChange }: ShiftManagerProps) {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  useEffect(() => {
    checkActiveShift();
  }, [user?.id]);

  async function checkActiveShift() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("pos_shifts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveShift(data as ActiveShift);
        onShiftChange(data.id);
      } else {
        setActiveShift(null);
        onShiftChange(null);
      }
    } catch (error) {
      console.error("Error checking shift:", error);
    } finally {
      setLoading(false);
    }
  }

  async function openShift() {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("pos_shifts")
        .insert({
          user_id: user.id,
          branch_id: currentBranch?.id || null,
          opening_float: parseFloat(openingFloat) || 0,
          expected_cash: parseFloat(openingFloat) || 0,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveShift(data as ActiveShift);
      onShiftChange(data.id);
      setShowOpenDialog(false);
      setOpeningFloat("0");
      toast({ title: "Shift Opened", description: "Your shift has started. Good luck!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  async function closeShift() {
    if (!activeShift) return;
    try {
      // Get latest shift totals
      const { data: salesData } = await supabase
        .from("pos_sales")
        .select("total, payment_method")
        .eq("shift_id", activeShift.id);

      const totals = (salesData || []).reduce((acc, s) => {
        acc.total += Number(s.total);
        acc.count += 1;
        if (s.payment_method === "cash") acc.cash += Number(s.total);
        if (s.payment_method === "card") acc.card += Number(s.total);
        if (s.payment_method === "mobile_money") acc.mobile += Number(s.total);
        if (s.payment_method === "bank_transfer") acc.bank += Number(s.total);
        return acc;
      }, { total: 0, count: 0, cash: 0, card: 0, mobile: 0, bank: 0 });

      const expectedCash = (parseFloat(String(activeShift.opening_float)) || 0) + totals.cash;
      const actualCashNum = parseFloat(actualCash) || 0;
      const difference = actualCashNum - expectedCash;

      const { error } = await supabase
        .from("pos_shifts")
        .update({
          closed_at: new Date().toISOString(),
          status: "closed",
          closed_by: user?.id,
          total_sales: totals.total,
          total_transactions: totals.count,
          cash_sales: totals.cash,
          card_sales: totals.card,
          mobile_money_sales: totals.mobile,
          bank_transfer_sales: totals.bank,
          expected_cash: expectedCash,
          actual_cash: actualCashNum,
          cash_difference: difference,
          notes: closeNotes || null,
        })
        .eq("id", activeShift.id);

      if (error) throw error;

      setActiveShift(null);
      onShiftChange(null);
      setShowCloseDialog(false);
      setActualCash("");
      setCloseNotes("");

      toast({
        title: "Shift Closed",
        description: difference === 0
          ? "Cash balanced perfectly! ✅"
          : `Cash difference: $${difference.toFixed(2)}`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }

  if (loading) return null;

  return (
    <>
      {/* Shift Status Bar */}
      {activeShift ? (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
            <Clock className="w-3 h-3" />
            Shift: {format(new Date(activeShift.opened_at), "HH:mm")}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCloseDialog(true)}
            className="text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,15%)] gap-1 h-7 text-xs"
          >
            <Square className="w-3 h-3" />
            End Shift
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() => setShowOpenDialog(true)}
          className="gap-1.5 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))] h-8"
        >
          <Play className="w-3.5 h-3.5" />
          Start Shift
        </Button>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-[hsl(var(--success))]" />
              Start New Shift
            </DialogTitle>
            <DialogDescription>Enter the opening cash float in your drawer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Opening Float ($)</label>
              <Input
                type="number"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="mt-1 text-lg font-mono text-center h-12"
                placeholder="0.00"
              />
            </div>
            <Button onClick={openShift} className="w-full bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90">
              <Play className="w-4 h-4 mr-2" />
              Open Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5 text-destructive" />
              Close Shift
            </DialogTitle>
            <DialogDescription>Count the cash in your drawer and enter the total.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Actual Cash in Drawer ($)</label>
              <Input
                type="number"
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="mt-1 text-lg font-mono text-center h-12"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Any notes about this shift..."
                className="mt-1"
                rows={2}
              />
            </div>
            <Button onClick={closeShift} variant="destructive" className="w-full">
              <Square className="w-4 h-4 mr-2" />
              Close Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
