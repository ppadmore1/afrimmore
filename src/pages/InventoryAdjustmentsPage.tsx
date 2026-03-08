import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Plus, Check, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "sonner";
import { format } from "date-fns";

const REASON_CODES = [
  { value: "stock_count", label: "Stock Count / Physical Count" },
  { value: "damage", label: "Damage / Breakage" },
  { value: "theft", label: "Theft / Shrinkage" },
  { value: "expired", label: "Expired / Write-off" },
  { value: "correction", label: "Data Entry Correction" },
  { value: "return_to_vendor", label: "Return to Vendor" },
  { value: "other", label: "Other" },
];

interface Adjustment {
  id: string; adjustment_number: string; branch_id: string; reason: string;
  status: string; notes: string | null; adjusted_by: string | null; created_at: string;
}
interface AdjItem {
  id: string; product_id: string; current_quantity: number; new_quantity: number; difference: number; notes: string | null;
}
interface Product { id: string; name: string; sku: string | null; stock_quantity: number; }
interface Branch { id: string; name: string; }

interface NewAdjItem { product_id: string; new_quantity: number; notes: string; }

export default function InventoryAdjustmentsPage() {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Adjustment | null>(null);
  const [detailItems, setDetailItems] = useState<AdjItem[]>([]);

  const [branchId, setBranchId] = useState(currentBranch?.id || "");
  const [reason, setReason] = useState("stock_count");
  const [notes, setNotes] = useState("");
  const [adjItems, setAdjItems] = useState<NewAdjItem[]>([{ product_id: "", new_quantity: 0, notes: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: a }, { data: b }, { data: p }] = await Promise.all([
      supabase.from("inventory_adjustments").select("*").order("created_at", { ascending: false }),
      supabase.from("branches").select("id, name").eq("is_active", true),
      supabase.from("products").select("id, name, sku, stock_quantity").eq("is_active", true).order("name"),
    ]);
    setAdjustments((a as Adjustment[]) || []);
    setBranches((b as Branch[]) || []);
    setProducts((p as Product[]) || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!branchId) { toast.error("Select a branch"); return; }
    const valid = adjItems.filter(i => i.product_id);
    if (valid.length === 0) { toast.error("Add at least one item"); return; }

    setSaving(true);
    try {
      const today = format(new Date(), "yyyyMMdd");
      const { count } = await supabase.from("inventory_adjustments").select("*", { count: "exact", head: true }).like("adjustment_number", `ADJ-${today}%`);
      const num = `ADJ-${today}-${String((count || 0) + 1).padStart(4, "0")}`;

      const { data: adj, error } = await supabase.from("inventory_adjustments").insert({
        adjustment_number: num, branch_id: branchId, reason, status: "draft",
        notes: notes || null, adjusted_by: user?.id,
      }).select().single();
      if (error) throw error;

      const items = valid.map(i => {
        const product = products.find(p => p.id === i.product_id);
        const current = product?.stock_quantity || 0;
        return {
          adjustment_id: adj.id, product_id: i.product_id,
          current_quantity: current, new_quantity: i.new_quantity,
          difference: i.new_quantity - current, notes: i.notes || null,
        };
      });
      const { error: iErr } = await supabase.from("inventory_adjustment_items").insert(items);
      if (iErr) throw iErr;

      toast.success(`Adjustment ${num} created`);
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function resetForm() {
    setBranchId(currentBranch?.id || ""); setReason("stock_count"); setNotes("");
    setAdjItems([{ product_id: "", new_quantity: 0, notes: "" }]);
  }

  async function viewDetail(a: Adjustment) {
    setSelected(a);
    const { data } = await supabase.from("inventory_adjustment_items").select("*").eq("adjustment_id", a.id);
    setDetailItems((data as AdjItem[]) || []);
    setDetailOpen(true);
  }

  async function approveAdjustment() {
    if (!selected) return;
    // Apply stock changes
    for (const item of detailItems) {
      await supabase.from("products").update({ stock_quantity: item.new_quantity }).eq("id", item.product_id);
      // Record stock movement
      await supabase.from("stock_movements").insert({
        product_id: item.product_id, quantity: item.difference, movement_type: "adjustment",
        reference_type: "inventory_adjustment", reference_id: selected.id,
        branch_id: selected.branch_id, created_by: user?.id,
        notes: `${REASON_CODES.find(r => r.value === selected.reason)?.label || selected.reason}: ${selected.adjustment_number}`,
      });
    }
    await supabase.from("inventory_adjustments").update({ status: "approved", approved_by: user?.id }).eq("id", selected.id);
    toast.success("Adjustment approved and stock updated");
    setDetailOpen(false);
    loadData();
  }

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || "Unknown";
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || "Unknown";
  const getReasonLabel = (v: string) => REASON_CODES.find(r => r.value === v)?.label || v;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-8 h-8" /> Inventory Adjustments
            </h1>
            <p className="text-muted-foreground mt-1">Write-offs, corrections, and stock count adjustments</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> New Adjustment</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Inventory Adjustment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Branch *</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent className="bg-popover">{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason *</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">{REASON_CODES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Items</Label>
                  {adjItems.map((item, i) => (
                    <div key={i} className="flex gap-2 mt-2 items-end">
                      <div className="flex-1">
                        {i === 0 && <span className="text-xs text-muted-foreground">Product</span>}
                        <Select value={item.product_id} onValueChange={v => { const n = [...adjItems]; n[i].product_id = v; const p = products.find(x => x.id === v); if (p) n[i].new_quantity = p.stock_quantity; setAdjItems(n); }}>
                          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent className="bg-popover">{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Current: {p.stock_quantity})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="w-28">
                        {i === 0 && <span className="text-xs text-muted-foreground">New Qty</span>}
                        <Input type="number" min={0} value={item.new_quantity} onChange={e => { const n = [...adjItems]; n[i].new_quantity = parseInt(e.target.value) || 0; setAdjItems(n); }} />
                      </div>
                      <div className="w-32">
                        {i === 0 && <span className="text-xs text-muted-foreground">Note</span>}
                        <Input value={item.notes} onChange={e => { const n = [...adjItems]; n[i].notes = e.target.value; setAdjItems(n); }} placeholder="Reason" />
                      </div>
                      {adjItems.length > 1 && <Button variant="ghost" size="icon" onClick={() => setAdjItems(adjItems.filter((_, j) => j !== i))}>✕</Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setAdjItems([...adjItems, { product_id: "", new_quantity: 0, notes: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Adjustment"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adjustment #</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : adjustments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No adjustments found</TableCell></TableRow>
                ) : adjustments.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-medium">{a.adjustment_number}</TableCell>
                    <TableCell>{getBranchName(a.branch_id)}</TableCell>
                    <TableCell>{getReasonLabel(a.reason)}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "approved" ? "default" : a.status === "cancelled" ? "destructive" : "secondary"}
                        className={a.status === "approved" ? "bg-emerald-600 text-white" : ""}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(a.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => viewDetail(a)}><Eye className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Adjustment {selected?.adjustment_number}</DialogTitle></DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Branch:</span> {getBranchName(selected.branch_id)}</div>
                  <div><span className="text-muted-foreground">Reason:</span> {getReasonLabel(selected.reason)}</div>
                  <div><span className="text-muted-foreground">Status:</span> {selected.status}</div>
                  <div><span className="text-muted-foreground">Date:</span> {format(new Date(selected.created_at), "MMM d, yyyy")}</div>
                </div>
                {selected.notes && <p className="text-sm text-muted-foreground">{selected.notes}</p>}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">New</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{getProductName(item.product_id)}</TableCell>
                        <TableCell className="text-right">{item.current_quantity}</TableCell>
                        <TableCell className="text-right">{item.new_quantity}</TableCell>
                        <TableCell className={`text-right font-medium ${item.difference > 0 ? "text-emerald-600" : item.difference < 0 ? "text-destructive" : ""}`}>
                          {item.difference > 0 ? "+" : ""}{item.difference}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selected.status === "draft" && (
                  <DialogFooter>
                    <Button onClick={approveAdjustment}><Check className="w-4 h-4 mr-1" /> Approve & Apply</Button>
                  </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
