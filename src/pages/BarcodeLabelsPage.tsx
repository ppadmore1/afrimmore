import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import { Download, Printer } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type P = { id: string; name: string; sku: string | null; barcode: string | null; unit_price: number; stock_quantity: number | null };

const LAYOUTS = {
  a4_18: { label: "A4 sheet — 18 labels (3 × 6)", page: [210, 297] as [number, number], cols: 3, rows: 6 },
  a4_24: { label: "A4 sheet — 24 labels (3 × 8)", page: [210, 297] as [number, number], cols: 3, rows: 8 },
  a4_40: { label: "A4 sheet — 40 labels (4 × 10)", page: [210, 297] as [number, number], cols: 4, rows: 10 },
  t40x30: { label: "Thermal roll 40 × 30 mm", page: [40, 30] as [number, number], cols: 1, rows: 1 },
  t50x30: { label: "Thermal roll 50 × 30 mm", page: [50, 30] as [number, number], cols: 1, rows: 1 },
};
type LayoutKey = keyof typeof LAYOUTS;

export default function BarcodeLabelsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<P[]>([]);
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<LayoutKey>("a4_18");
  const [showPrice, setShowPrice] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("products").select("id,name,sku,barcode,unit_price,stock_quantity").eq("is_active", true).order("name")
      .then(({ data }) => setProducts((data as P[]) || []));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || [p.name, p.sku, p.barcode].some((v) => (v || "").toLowerCase().includes(q)));
  }, [products, search]);

  const getQty = (p: P) => qty[p.id] ?? 1;
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const allOn = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const chosen = products.filter((p) => selected.has(p.id) && p.barcode);
  const totalLabels = chosen.reduce((a, p) => a + getQty(p), 0);
  const L = LAYOUTS[layout];
  const sheets = Math.ceil(totalLabels / (L.cols * L.rows));

  const setAllQty = (mode: "one" | "stock" | "sheet") => {
    const per = L.cols * L.rows;
    setQty(Object.fromEntries(filtered.map((p) => [p.id, mode === "one" ? 1 : mode === "sheet" ? per : Math.max(p.stock_quantity || 0, 0)])));
  };

  const build = () => {
    const [pw, ph] = L.page;
    const doc = new jsPDF({ unit: "mm", format: [pw, ph], orientation: pw > ph ? "landscape" : "portrait" });
    const thermal = L.cols === 1;
    const m = thermal ? 0 : 6;
    const cw = (pw - m * 2) / L.cols, ch = (ph - m * 2) / L.rows, pad = thermal ? 1.5 : 2;
    const cache = new Map<string, string>();
    const labels = chosen.flatMap((p) => Array.from({ length: Math.min(getQty(p), 5000) }, () => p));
    labels.forEach((p, i) => {
      const per = L.cols * L.rows;
      if (i > 0 && i % per === 0) doc.addPage([pw, ph], pw > ph ? "landscape" : "portrait");
      const k = i % per, x = m + (k % L.cols) * cw + pad, y = m + Math.floor(k / L.cols) * ch + pad;
      const w = cw - pad * 2, h = ch - pad * 2;
      if (!thermal) { doc.setDrawColor(210); doc.rect(x - pad + 0.5, y - pad + 0.5, cw - 1, ch - 1); }
      const fs = Math.max(5, Math.min(8, h / 4));
      doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(fs);
      doc.text(doc.splitTextToSize(p.name, w)[0], x + w / 2, y + fs * 0.4, { align: "center" });
      let img = cache.get(p.barcode!);
      if (!img) {
        const c = document.createElement("canvas");
        JsBarcode(c, p.barcode!, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14, margin: 4, background: "#ffffff", lineColor: "#000000" });
        img = c.toDataURL("image/png"); cache.set(p.barcode!, img);
      }
      const foot = showPrice || p.sku ? fs * 0.45 : 0;
      doc.addImage(img, "PNG", x, y + fs * 0.55, w, h - fs * 0.55 - foot - 0.5);
      if (foot) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(fs - 0.5);
        const t = [p.sku, showPrice ? `$${Number(p.unit_price).toFixed(2)}` : ""].filter(Boolean).join("  ·  ");
        doc.text(t, x + w / 2, y + h - 0.3, { align: "center" });
      }
    });
    return doc;
  };

  const run = (print: boolean) => {
    if (chosen.length === 0) { toast({ title: "Pick at least one product with a barcode", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const doc = build();
      if (print) {
        const url = doc.output("bloburl");
        const w = window.open(url as unknown as string);
        if (!w) toast({ title: "Allow pop-ups to print", description: "Or use Download PDF instead." });
      } else doc.save(`barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: `${totalLabels} labels ready`, description: `${sheets} ${L.cols === 1 ? "labels" : "sheet(s)"}` });
    } catch (e) {
      console.error(e); toast({ title: "Could not create labels", variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Barcode Labels</h1>
          <p className="text-sm text-muted-foreground">Print full sheets of barcode stickers for many products at once. Printing never changes stock.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Label settings</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Label size</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as LayoutKey)}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LAYOUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2"><Switch checked={showPrice} onCheckedChange={setShowPrice} id="price" /><Label htmlFor="price">Show price</Label></div>
            <div className="flex flex-wrap gap-2 pb-0.5">
              <Button variant="outline" size="sm" onClick={() => setAllQty("one")}>1 each</Button>
              <Button variant="outline" size="sm" onClick={() => setAllQty("sheet")}>Full sheet each</Button>
              <Button variant="outline" size="sm" onClick={() => setAllQty("stock")}>One per unit in stock</Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{totalLabels} labels · {sheets} {L.cols === 1 ? "labels" : "sheet(s)"}</span>
              <Button variant="outline" onClick={() => run(true)} disabled={busy}><Printer className="mr-2 h-4 w-4" />Preview & Print</Button>
              <Button onClick={() => run(false)} disabled={busy}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Input placeholder="Search by name, SKU or barcode" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={allOn} onCheckedChange={(v) => filtered.forEach((p) => p.barcode && toggle(p.id, !!v))} /></TableHead>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Barcode</TableHead>
                <TableHead className="text-right">In stock</TableHead><TableHead className="w-28">Labels</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox disabled={!p.barcode} checked={selected.has(p.id)} onCheckedChange={(v) => toggle(p.id, !!v)} /></TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.barcode || <span className="text-muted-foreground">No barcode</span>}</TableCell>
                    <TableCell className="text-right">{p.stock_quantity ?? 0}</TableCell>
                    <TableCell><Input type="number" min={1} max={5000} value={getQty(p)} onChange={(e) => setQty((q) => ({ ...q, [p.id]: Math.max(1, Math.min(5000, parseInt(e.target.value) || 1)) }))} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
