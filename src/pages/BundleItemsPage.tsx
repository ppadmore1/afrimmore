import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Plus, Trash2, Edit2, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";

interface Product { id: string; name: string; sku: string | null; unit_price: number; is_bundle: boolean; }
interface Bundle { id: string; parent_product_id: string; is_active: boolean; auto_deduct_stock: boolean; }
interface BundleComponent { id: string; bundle_id: string; component_product_id: string; quantity: number; }
interface NewComponent { product_id: string; quantity: number; }

export default function BundleItemsPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [components, setComponents] = useState<Record<string, BundleComponent[]>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);

  const [parentProductId, setParentProductId] = useState("");
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [newComponents, setNewComponents] = useState<NewComponent[]>([{ product_id: "", quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: b }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("product_bundles").select("*"),
      supabase.from("products").select("id, name, sku, unit_price, is_bundle").eq("is_active", true).order("name"),
      supabase.from("product_bundle_components").select("*"),
    ]);
    setBundles((b as Bundle[]) || []);
    setProducts((p as Product[]) || []);
    // Group components by bundle_id
    const grouped: Record<string, BundleComponent[]> = {};
    ((c as BundleComponent[]) || []).forEach(comp => {
      if (!grouped[comp.bundle_id]) grouped[comp.bundle_id] = [];
      grouped[comp.bundle_id].push(comp);
    });
    setComponents(grouped);
    setLoading(false);
  }

  const bundleProductIds = bundles.map(b => b.parent_product_id);
  const availableParentProducts = products.filter(p => !bundleProductIds.includes(p.id));

  async function handleCreate() {
    if (!parentProductId) { toast.error("Select a parent product"); return; }
    const valid = newComponents.filter(c => c.product_id && c.quantity > 0 && c.product_id !== parentProductId);
    if (valid.length === 0) { toast.error("Add at least one component"); return; }

    setSaving(true);
    try {
      // Mark product as bundle
      await supabase.from("products").update({ is_bundle: true }).eq("id", parentProductId);

      const { data: bundle, error } = await supabase.from("product_bundles").insert({
        parent_product_id: parentProductId, is_active: true, auto_deduct_stock: autoDeduct,
      }).select().single();
      if (error) throw error;

      const comps = valid.map(c => ({ bundle_id: bundle.id, component_product_id: c.product_id, quantity: c.quantity }));
      const { error: cErr } = await supabase.from("product_bundle_components").insert(comps);
      if (cErr) throw cErr;

      toast.success("Bundle created");
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function resetForm() {
    setParentProductId(""); setAutoDeduct(true);
    setNewComponents([{ product_id: "", quantity: 1 }]);
  }

  async function deleteBundle(bundle: Bundle) {
    if (!confirm("Delete this bundle? The product will remain but won't be a bundle anymore.")) return;
    await supabase.from("product_bundle_components").delete().eq("bundle_id", bundle.id);
    await supabase.from("product_bundles").delete().eq("id", bundle.id);
    await supabase.from("products").update({ is_bundle: false }).eq("id", bundle.parent_product_id);
    toast.success("Bundle deleted");
    loadData();
  }

  function viewBundle(b: Bundle) { setSelectedBundle(b); setDetailOpen(true); }

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || "Unknown";
  const getProductPrice = (id: string) => products.find(p => p.id === id)?.unit_price || 0;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-8 h-8" /> Composite / Bundle Items
            </h1>
            <p className="text-muted-foreground mt-1">Create product bundles that auto-deduct component stock on sale</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> New Bundle</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Product Bundle</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Parent Product (the bundle item) *</Label>
                  <Select value={parentProductId} onValueChange={setParentProductId}>
                    <SelectTrigger><SelectValue placeholder="Select product to make a bundle" /></SelectTrigger>
                    <SelectContent className="bg-popover">{availableParentProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - ${p.unit_price.toFixed(2)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={autoDeduct} onCheckedChange={setAutoDeduct} />
                  <Label>Auto-deduct component stock on sale</Label>
                </div>
                <div>
                  <Label>Components</Label>
                  {newComponents.map((comp, i) => (
                    <div key={i} className="flex gap-2 mt-2">
                      <Select value={comp.product_id} onValueChange={v => { const n = [...newComponents]; n[i].product_id = v; setNewComponents(n); }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select component product" /></SelectTrigger>
                        <SelectContent className="bg-popover">{products.filter(p => p.id !== parentProductId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" min={1} className="w-24" placeholder="Qty" value={comp.quantity} onChange={e => { const n = [...newComponents]; n[i].quantity = parseInt(e.target.value) || 1; setNewComponents(n); }} />
                      {newComponents.length > 1 && <Button variant="ghost" size="icon" onClick={() => setNewComponents(newComponents.filter((_, j) => j !== i))}>✕</Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setNewComponents([...newComponents, { product_id: "", quantity: 1 }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Component
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating..." : "Create Bundle"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle Product</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Auto-Deduct</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : bundles.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bundles created yet</TableCell></TableRow>
                ) : bundles.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{getProductName(b.parent_product_id)}</TableCell>
                    <TableCell>{(components[b.id] || []).length} items</TableCell>
                    <TableCell>{b.auto_deduct_stock ? <Badge className="bg-emerald-600 text-white">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell>{b.is_active ? <Badge className="bg-emerald-600 text-white">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => viewBundle(b)}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteBundle(b)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Bundle: {selectedBundle ? getProductName(selectedBundle.parent_product_id) : ""}</DialogTitle></DialogHeader>
            {selectedBundle && (
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Bundle Price:</span> ${getProductPrice(selectedBundle.parent_product_id).toFixed(2)}</p>
                  <p><span className="text-muted-foreground">Auto-Deduct:</span> {selectedBundle.auto_deduct_stock ? "Yes" : "No"}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Qty per Bundle</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(components[selectedBundle.id] || []).map(c => (
                      <TableRow key={c.id}>
                        <TableCell>{getProductName(c.component_product_id)}</TableCell>
                        <TableCell className="text-right">{c.quantity}</TableCell>
                        <TableCell className="text-right">${getProductPrice(c.component_product_id).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-sm text-muted-foreground">
                  Component cost: ${(components[selectedBundle.id] || []).reduce((sum, c) => sum + c.quantity * getProductPrice(c.component_product_id), 0).toFixed(2)}
                  {" | "}
                  Bundle margin: ${(getProductPrice(selectedBundle.parent_product_id) - (components[selectedBundle.id] || []).reduce((sum, c) => sum + c.quantity * getProductPrice(c.component_product_id), 0)).toFixed(2)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
