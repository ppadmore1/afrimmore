import { useEffect, useMemo, useState } from "react";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Hash, Printer, Trash2 } from "lucide-react";

type Serial = {
  id: string; serial_number: string; status: string; product_id: string; branch_id: string | null;
  sold_at: string | null; notes: string | null; created_at: string;
};

const STATUSES = ["in_stock", "sold", "returned", "damaged"];
const STATUS_LABEL: Record<string, string> = { in_stock: "In stock", sold: "Sold", returned: "Returned", damaged: "Damaged" };

export default function SerialNumbersPage() {
  const [products, setProducts] = useState<{ id: string; name: string; sku: string | null; unit_price: number }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [serials, setSerials] = useState<Serial[]>([]);
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("none");
  const [text, setText] = useState("");
  const [prefix, setPrefix] = useState("");
  const [genCount, setGenCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  const load = async () => {
    const [p, b, s] = await Promise.all([
      supabase.from("products").select("id, name, sku, unit_price").order("name"),
      supabase.from("branches").select("id, name").order("name"),
      supabase.from("product_serials").select("*").order("created_at", { ascending: false }).limit(5000),
    ]);
    setProducts(p.data || []);
    setBranches(b.data || []);
    setSerials((s.data as Serial[]) || []);
  };
  useEffect(() => { load(); }, []);

  const productName = (id: string) => products.find((p) => p.id === id)?.name || "—";
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name || "—";

  const generate = () => {
    const n = Math.min(parseInt(genCount) || 0, 1000);
    if (!n || !prefix.trim()) return toast({ title: "Enter a prefix and how many", variant: "destructive" });
    const start = Date.now().toString().slice(-5);
    const list = Array.from({ length: n }, (_, i) => `${prefix.trim().toUpperCase()}-${start}${String(i + 1).padStart(4, "0")}`);
    setText((t) => (t ? t + "\n" : "") + list.join("\n"));
  };

  const save = async () => {
    if (!productId) return toast({ title: "Choose a product first", variant: "destructive" });
    const list = Array.from(new Set(text.split(/[\n,;\t]+/).map((s) => s.trim().replace(/\s+/g, "").toUpperCase()).filter(Boolean)));
    if (!list.length) return toast({ title: "Enter at least one serial number", variant: "destructive" });
    const existing = new Set(serials.map((s) => s.serial_number.toUpperCase()));
    const fresh = list.filter((s) => !existing.has(s));
    const dupes = list.length - fresh.length;
    if (!fresh.length) return toast({ title: "All of these serial numbers already exist", variant: "destructive" });
    setSaving(true);
    const rows = fresh.map((serial_number) => ({ product_id: productId, serial_number, branch_id: branchId === "none" ? null : branchId }));
    let added = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("product_serials").insert(rows.slice(i, i + 500));
      if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); break; }
      added += rows.slice(i, i + 500).length;
    }
    setSaving(false);
    toast({ title: `${added} serial numbers added`, description: dupes ? `${dupes} skipped because they already exist` : undefined });
    setText("");
    load();
  };

  const filtered = useMemo(() => serials.filter((s) =>
    (statusFilter === "all" || s.status === statusFilter) &&
    (productFilter === "all" || s.product_id === productFilter) &&
    (!search || s.serial_number.toLowerCase().includes(search.toLowerCase()) || productName(s.product_id).toLowerCase().includes(search.toLowerCase()))
  ), [serials, statusFilter, productFilter, search, products]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("product_serials").update({ status, sold_at: status === "sold" ? new Date().toISOString() : null }).eq("id", id);
    if (error) return toast({ title: "Could not update", description: error.message, variant: "destructive" });
    setSerials((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this serial number?")) return;
    const { error } = await supabase.from("product_serials").delete().eq("id", id);
    if (error) return toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    setSerials((prev) => prev.filter((s) => s.id !== id));
  };

  // One sticker per serial (A4, 3 x 6)
  const printLabels = () => {
    const list = filtered.filter((s) => s.status === "in_stock");
    if (!list.length) return toast({ title: "No in-stock serial numbers in this list", variant: "destructive" });
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const cols = 3, rows = 6, w = 70, h = 49.5;
    const canvas = document.createElement("canvas");
    list.forEach((s, i) => {
      const pos = i % (cols * rows);
      if (i > 0 && pos === 0) doc.addPage();
      const x = (pos % cols) * w, y = Math.floor(pos / cols) * h;
      const p = products.find((pp) => pp.id === s.product_id);
      doc.setFontSize(8);
      doc.text((p?.name || "").slice(0, 40), x + w / 2, y + 7, { align: "center" });
      JsBarcode(canvas, s.serial_number, { format: "CODE128", displayValue: false, margin: 0, height: 60 });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", x + 6, y + 10, w - 12, 22);
      doc.setFontSize(9);
      doc.text(`S/N ${s.serial_number}`, x + w / 2, y + 38, { align: "center" });
      if (p) doc.text(`$${Number(p.unit_price).toFixed(2)}`, x + w / 2, y + 44, { align: "center" });
    });
    doc.save(`serial-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const counts = useMemo(() => STATUSES.map((st) => ({ st, n: serials.filter((s) => s.status === st).length })), [serials]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Hash className="w-6 h-6 text-primary" /> Serial Numbers</h1>
          <p className="text-muted-foreground text-sm">Track each unit (laptop, phone, TV) by its own serial number. Scanning a serial at the POS sells that exact unit.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {counts.map(({ st, n }) => (
            <Card key={st}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{STATUS_LABEL[st]}</p><p className="text-2xl font-bold">{n}</p></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Add serial numbers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Serial numbers — one per line (type, paste from a spreadsheet, or scan each one)</Label>
              <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"5CD1234ABC\n5CD1234ABD\n5CD1234ABE"} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label className="text-xs">No serials? Make them: prefix</Label><Input className="w-32" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="HP840" /></div>
              <div className="space-y-1"><Label className="text-xs">How many</Label><Input className="w-24" type="number" value={genCount} onChange={(e) => setGenCount(e.target.value)} placeholder="200" /></div>
              <Button variant="outline" onClick={generate}>Generate</Button>
              <div className="flex-1" />
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save serial numbers"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg">All units ({filtered.length})</CardTitle>
            <Button variant="outline" onClick={printLabels}><Printer className="w-4 h-4 mr-2" />Print stickers (in stock)</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-xs" placeholder="Search serial or product" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All products</SelectItem>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Serial</TableHead><TableHead>Product</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead>Sold</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.serial_number}</TableCell>
                      <TableCell>{productName(s.product_id)}</TableCell>
                      <TableCell>{branchName(s.branch_id)}</TableCell>
                      <TableCell>
                        <Select value={s.status} onValueChange={(v) => setStatus(s.id, v)}>
                          <SelectTrigger className="h-8 w-32"><Badge variant={s.status === "in_stock" ? "default" : "secondary"}>{STATUS_LABEL[s.status]}</Badge></SelectTrigger>
                          <SelectContent>{STATUSES.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.sold_at ? new Date(s.sold_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No serial numbers yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
