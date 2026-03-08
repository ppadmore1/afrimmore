import { useEffect, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Package, AlertTriangle, Clock, Layers } from "lucide-react";

interface Batch {
  id: string;
  product_id: string;
  batch_number: string;
  quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  manufacture_date: string | null;
  expiry_date: string | null;
  received_date: string;
  supplier_id: string | null;
  branch_id: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  product_name?: string;
  supplier_name?: string;
  branch_name?: string;
}

interface ProductOption { id: string; name: string; sku: string | null; }
interface SupplierOption { id: string; name: string; }
interface BranchOption { id: string; name: string; }

export default function BatchTrackingPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    product_id: "", batch_number: "", quantity: 0, unit_cost: 0,
    manufacture_date: "", expiry_date: "", supplier_id: "", branch_id: "", notes: "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [batchRes, prodRes, supRes, brRes] = await Promise.all([
        supabase.from("product_batches").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, sku").eq("is_active", true).order("name"),
        supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
      ]);

      const prods = (prodRes.data || []) as ProductOption[];
      const sups = (supRes.data || []) as SupplierOption[];
      const brs = (brRes.data || []) as BranchOption[];
      setProducts(prods);
      setSuppliers(sups);
      setBranches(brs);

      const enriched = ((batchRes.data || []) as Batch[]).map(b => ({
        ...b,
        product_name: prods.find(p => p.id === b.product_id)?.name || "Unknown",
        supplier_name: sups.find(s => s.id === b.supplier_id)?.name || "",
        branch_name: brs.find(br => br.id === b.branch_id)?.name || "",
      }));
      setBatches(enriched);
    } catch {
      toast({ title: "Error loading batch data", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!form.product_id) { toast({ title: "Select a product", variant: "destructive" }); return; }
    if (!form.batch_number) { toast({ title: "Enter a batch number", variant: "destructive" }); return; }
    if (form.quantity <= 0) { toast({ title: "Enter a valid quantity", variant: "destructive" }); return; }

    const { error } = await supabase.from("product_batches").insert({
      product_id: form.product_id,
      batch_number: form.batch_number,
      quantity: form.quantity,
      remaining_quantity: form.quantity,
      unit_cost: form.unit_cost,
      manufacture_date: form.manufacture_date || null,
      expiry_date: form.expiry_date || null,
      supplier_id: form.supplier_id || null,
      branch_id: form.branch_id || null,
      notes: form.notes || null,
      created_by: user?.id,
    });

    if (error) { toast({ title: "Error creating batch", description: error.message, variant: "destructive" }); return; }

    // Also update product stock
    await supabase.rpc("log_activity" as any, {
      p_action: "batch_created",
      p_entity_type: "product_batch",
      p_entity_name: form.batch_number,
      p_metadata: { product_id: form.product_id, quantity: form.quantity },
    });

    toast({ title: "Batch created successfully" });
    setShowCreate(false);
    setForm({ product_id: "", batch_number: "", quantity: 0, unit_cost: 0, manufacture_date: "", expiry_date: "", supplier_id: "", branch_id: "", notes: "" });
    loadData();
  }

  async function handleDeplete(batch: Batch) {
    await supabase.from("product_batches").update({ status: "depleted", remaining_quantity: 0 }).eq("id", batch.id);
    toast({ title: `Batch ${batch.batch_number} marked as depleted` });
    loadData();
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const today = new Date();

  const getExpiryStatus = (expiry: string | null) => {
    if (!expiry) return null;
    const days = differenceInDays(new Date(expiry), today);
    if (days < 0) return { label: "Expired", variant: "destructive" as const, days };
    if (days <= 30) return { label: `${days}d left`, variant: "outline" as const, days };
    if (days <= 90) return { label: `${days}d left`, variant: "secondary" as const, days };
    return { label: `${days}d left`, variant: "default" as const, days };
  };

  const filtered = batches.filter(b => {
    const matchSearch = b.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.product_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchProduct = filterProduct === "all" || b.product_id === filterProduct;
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchProduct && matchStatus;
  });

  const totalBatches = batches.length;
  const activeBatches = batches.filter(b => b.status === "active").length;
  const expiringBatches = batches.filter(b => {
    const exp = getExpiryStatus(b.expiry_date);
    return exp && exp.days >= 0 && exp.days <= 30 && b.status === "active";
  }).length;
  const expiredBatches = batches.filter(b => {
    const exp = getExpiryStatus(b.expiry_date);
    return exp && exp.days < 0 && b.status === "active";
  }).length;
  const totalValue = batches.filter(b => b.status === "active").reduce((s, b) => s + (b.remaining_quantity * b.unit_cost), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Batch Tracking</h1>
            <p className="text-muted-foreground">Track stock batches with lot numbers, expiry dates, and costs</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New Batch</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Batches</p><p className="text-xl font-bold">{totalBatches}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-green-600">{activeBatches}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><Clock className="h-5 w-5 text-orange-500" /></div>
            <div><p className="text-xs text-muted-foreground">Expiring Soon</p><p className="text-xl font-bold text-orange-600">{expiringBatches}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Expired</p><p className="text-xl font-bold text-destructive">{expiredBatches}</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Active Stock Value</p>
            <p className="text-xl font-bold">{fmt(totalValue)}</p>
          </CardContent></Card>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search batches..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="depleted">Depleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch #</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Qty (Orig)</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No batches found</TableCell></TableRow>
            ) : filtered.map(b => {
              const expiry = getExpiryStatus(b.expiry_date);
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.batch_number}</TableCell>
                  <TableCell>{b.product_name}</TableCell>
                  <TableCell>{b.branch_name || "—"}</TableCell>
                  <TableCell>{b.supplier_name || "—"}</TableCell>
                  <TableCell className="text-right">{b.quantity}</TableCell>
                  <TableCell className="text-right font-semibold">{b.remaining_quantity}</TableCell>
                  <TableCell className="text-right">{fmt(b.unit_cost)}</TableCell>
                  <TableCell>{format(new Date(b.received_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    {b.expiry_date ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{format(new Date(b.expiry_date), "MMM dd, yyyy")}</span>
                        {expiry && <Badge variant={expiry.variant}>{expiry.label}</Badge>}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {b.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => handleDeplete(b)}>Deplete</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Batch</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label>Product *</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Batch Number *</Label>
              <Input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder="e.g. LOT-2026-0312" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantity *</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Unit Cost</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Manufacture Date</Label><Input type="date" value={form.manufacture_date} onChange={e => setForm({ ...form, manufacture_date: e.target.value })} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select value={form.branch_id} onValueChange={v => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes about this batch..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
