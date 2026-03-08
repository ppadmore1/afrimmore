import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Plus, Truck, Check, Package, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { format } from "date-fns";

interface Branch { id: string; name: string; code: string; }
interface Product { id: string; name: string; sku: string | null; stock_quantity: number; }
interface Transfer {
  id: string; transfer_number: string; from_branch_id: string; to_branch_id: string;
  status: string; notes: string | null; requested_by: string | null;
  approved_by: string | null; shipped_at: string | null; received_at: string | null;
  created_at: string;
}
interface TransferItem {
  id: string; product_id: string; quantity_requested: number;
  quantity_shipped: number; quantity_received: number;
}

interface NewItem { product_id: string; quantity: number; }

export default function StockTransfersPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [detailItems, setDetailItems] = useState<TransferItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  // Create form
  const [fromBranch, setFromBranch] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [notes, setNotes] = useState("");
  const [newItems, setNewItems] = useState<NewItem[]>([{ product_id: "", quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: t }, { data: b }, { data: p }] = await Promise.all([
      supabase.from("stock_transfers").select("*").order("created_at", { ascending: false }),
      supabase.from("branches").select("id, name, code").eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, sku, stock_quantity").eq("is_active", true).order("name"),
    ]);
    setTransfers((t as Transfer[]) || []);
    setBranches((b as Branch[]) || []);
    setProducts((p as Product[]) || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!fromBranch || !toBranch || fromBranch === toBranch) {
      toast.error("Select different source and destination branches");
      return;
    }
    const validItems = newItems.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }

    setSaving(true);
    try {
      const today = format(new Date(), "yyyyMMdd");
      const { count } = await supabase.from("stock_transfers").select("*", { count: "exact", head: true }).like("transfer_number", `ST-${today}%`);
      const num = `ST-${today}-${String((count || 0) + 1).padStart(4, "0")}`;

      const { data: transfer, error } = await supabase.from("stock_transfers").insert({
        transfer_number: num, from_branch_id: fromBranch, to_branch_id: toBranch,
        status: "draft", requested_by: user?.id, notes: notes || null,
      }).select().single();
      if (error) throw error;

      const items = validItems.map(i => ({
        transfer_id: transfer.id, product_id: i.product_id,
        quantity_requested: i.quantity, quantity_shipped: 0, quantity_received: 0,
      }));
      const { error: iErr } = await supabase.from("stock_transfer_items").insert(items);
      if (iErr) throw iErr;

      toast.success(`Transfer ${num} created`);
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Error creating transfer");
    } finally { setSaving(false); }
  }

  function resetForm() {
    setFromBranch(""); setToBranch(""); setNotes("");
    setNewItems([{ product_id: "", quantity: 1 }]);
  }

  async function viewDetail(t: Transfer) {
    setSelectedTransfer(t);
    const { data } = await supabase.from("stock_transfer_items").select("*").eq("transfer_id", t.id);
    setDetailItems((data as TransferItem[]) || []);
    setDetailOpen(true);
  }

  async function updateStatus(transfer: Transfer, newStatus: string) {
    const updates: any = { status: newStatus };
    if (newStatus === "approved") updates.approved_by = user?.id;
    if (newStatus === "in_transit") updates.shipped_at = new Date().toISOString();
    if (newStatus === "received") updates.received_at = new Date().toISOString();

    const { error } = await supabase.from("stock_transfers").update(updates).eq("id", transfer.id);
    if (error) { toast.error(error.message); return; }

    // If received, update stock quantities
    if (newStatus === "received") {
      for (const item of detailItems) {
        // Decrease from source branch
        const { data: srcPb } = await supabase.from("product_branches")
          .select("id, stock_quantity").eq("product_id", item.product_id).eq("branch_id", transfer.from_branch_id).single();
        if (srcPb) {
          await supabase.from("product_branches").update({ stock_quantity: srcPb.stock_quantity - item.quantity_requested }).eq("id", srcPb.id);
        }
        // Increase at destination branch (upsert)
        const { data: dstPb } = await supabase.from("product_branches")
          .select("id, stock_quantity").eq("product_id", item.product_id).eq("branch_id", transfer.to_branch_id).single();
        if (dstPb) {
          await supabase.from("product_branches").update({ stock_quantity: dstPb.stock_quantity + item.quantity_requested }).eq("id", dstPb.id);
        } else {
          await supabase.from("product_branches").insert({ product_id: item.product_id, branch_id: transfer.to_branch_id, stock_quantity: item.quantity_requested });
        }
        // Record stock movements
        await supabase.from("stock_movements").insert([
          { product_id: item.product_id, quantity: -item.quantity_requested, movement_type: "transfer_out", reference_type: "stock_transfer", reference_id: transfer.id, branch_id: transfer.from_branch_id, created_by: user?.id, notes: `Transfer ${transfer.transfer_number} to ${getBranchName(transfer.to_branch_id)}` },
          { product_id: item.product_id, quantity: item.quantity_requested, movement_type: "transfer_in", reference_type: "stock_transfer", reference_id: transfer.id, branch_id: transfer.to_branch_id, created_by: user?.id, notes: `Transfer ${transfer.transfer_number} from ${getBranchName(transfer.from_branch_id)}` },
        ]);
        // Update transfer items
        await supabase.from("stock_transfer_items").update({ quantity_shipped: item.quantity_requested, quantity_received: item.quantity_requested }).eq("id", item.id);
      }
    }

    toast.success(`Transfer ${newStatus.replace("_", " ")}`);
    setDetailOpen(false);
    loadData();
  }

  function getBranchName(id: string) { return branches.find(b => b.id === id)?.name || "Unknown"; }
  function getProductName(id: string) { return products.find(p => p.id === id)?.name || "Unknown"; }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { draft: "secondary", approved: "default", in_transit: "outline", received: "default", cancelled: "destructive" };
    return <Badge variant={map[s] as any || "secondary"} className={s === "received" ? "bg-emerald-600 text-white" : s === "in_transit" ? "border-amber-500 text-amber-600" : ""}>{s.replace("_", " ")}</Badge>;
  };

  const filtered = statusFilter === "all" ? transfers : transfers.filter(t => t.status === statusFilter);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ArrowLeftRight className="w-8 h-8" /> Stock Transfers
            </h1>
            <p className="text-muted-foreground mt-1">Transfer inventory between branches</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Transfer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Stock Transfer</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Branch *</Label>
                    <Select value={fromBranch} onValueChange={setFromBranch}>
                      <SelectTrigger><SelectValue placeholder="Source branch" /></SelectTrigger>
                      <SelectContent className="bg-popover">{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Branch *</Label>
                    <Select value={toBranch} onValueChange={setToBranch}>
                      <SelectTrigger><SelectValue placeholder="Destination branch" /></SelectTrigger>
                      <SelectContent className="bg-popover">{branches.filter(b => b.id !== fromBranch).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Items</Label>
                  {newItems.map((item, i) => (
                    <div key={i} className="flex gap-2 mt-2">
                      <Select value={item.product_id} onValueChange={v => { const n = [...newItems]; n[i].product_id = v; setNewItems(n); }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent className="bg-popover">{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" min={1} className="w-24" value={item.quantity} onChange={e => { const n = [...newItems]; n[i].quantity = parseInt(e.target.value) || 1; setNewItems(n); }} />
                      {newItems.length > 1 && <Button variant="ghost" size="icon" onClick={() => setNewItems(newItems.filter((_, j) => j !== i))}>✕</Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setNewItems([...newItems, { product_id: "", quantity: 1 }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Transfer notes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Transfer"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers found</TableCell></TableRow>
                ) : filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-medium">{t.transfer_number}</TableCell>
                    <TableCell>{getBranchName(t.from_branch_id)}</TableCell>
                    <TableCell>{getBranchName(t.to_branch_id)}</TableCell>
                    <TableCell>{statusBadge(t.status)}</TableCell>
                    <TableCell>{format(new Date(t.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => viewDetail(t)}><Eye className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Transfer {selectedTransfer?.transfer_number}</DialogTitle></DialogHeader>
            {selectedTransfer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">From:</span> {getBranchName(selectedTransfer.from_branch_id)}</div>
                  <div><span className="text-muted-foreground">To:</span> {getBranchName(selectedTransfer.to_branch_id)}</div>
                  <div><span className="text-muted-foreground">Status:</span> {statusBadge(selectedTransfer.status)}</div>
                  <div><span className="text-muted-foreground">Date:</span> {format(new Date(selectedTransfer.created_at), "MMM d, yyyy")}</div>
                </div>
                {selectedTransfer.notes && <p className="text-sm text-muted-foreground">{selectedTransfer.notes}</p>}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Shipped</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{getProductName(item.product_id)}</TableCell>
                        <TableCell className="text-right">{item.quantity_requested}</TableCell>
                        <TableCell className="text-right">{item.quantity_shipped}</TableCell>
                        <TableCell className="text-right">{item.quantity_received}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <DialogFooter className="gap-2">
                  {selectedTransfer.status === "draft" && (
                    <>
                      <Button variant="destructive" onClick={() => updateStatus(selectedTransfer, "cancelled")}>Cancel Transfer</Button>
                      <Button onClick={() => updateStatus(selectedTransfer, "approved")}><Check className="w-4 h-4 mr-1" /> Approve</Button>
                    </>
                  )}
                  {selectedTransfer.status === "approved" && (
                    <Button onClick={() => updateStatus(selectedTransfer, "in_transit")}><Truck className="w-4 h-4 mr-1" /> Mark Shipped</Button>
                  )}
                  {selectedTransfer.status === "in_transit" && (
                    <Button onClick={() => updateStatus(selectedTransfer, "received")}><Package className="w-4 h-4 mr-1" /> Mark Received</Button>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
