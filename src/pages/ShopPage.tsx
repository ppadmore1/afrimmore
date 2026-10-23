import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Minus, Plus, Search, CheckCircle2 } from "lucide-react";
import { fmtLrd, usdToLrd } from "@/lib/currency";

type Item = { tenant_id: string; tenant_name: string; logo_url: string | null; product_id: string; name: string; description: string | null; unit_price: number; image_url: string | null; unit: string | null; in_stock: number };

export default function ShopPage() {
  const { slug = "" } = useParams();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", type: "pickup", address: "", notes: "" });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.rpc("get_shop_catalog", { p_slug: slug });
    setItems((data as Item[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [slug]);

  const shopName = items[0]?.tenant_name || "Online Shop";
  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  const lines = useMemo(() => items.filter((i) => cart[i.product_id]).map((i) => ({ ...i, qty: cart[i.product_id] })), [items, cart]);
  const total = lines.reduce((s, l) => s + l.qty * Number(l.unit_price), 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const setQty = (id: string, qty: number, max: number) =>
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = Math.min(qty, max); return n; });

  const placeOrder = async () => {
    setPlacing(true);
    const { data, error } = await supabase.rpc("place_online_order", {
      p_slug: slug, p_customer_name: form.name, p_customer_phone: form.phone, p_customer_email: form.email || null,
      p_fulfillment_type: form.type, p_delivery_address: form.type === "delivery" ? form.address : null, p_notes: form.notes || null,
      p_items: lines.map((l) => ({ product_id: l.product_id, quantity: l.qty })),
    });
    setPlacing(false);
    if (error) { toast({ title: "Could not place order", description: error.message, variant: "destructive" }); return; }
    const row = (data as any)?.[0];
    setDone(row?.order_number || "");
    setCart({}); setOpen(false); load();
  };

  if (!loading && items.length === 0)
    return <div className="min-h-screen grid place-items-center text-muted-foreground">This shop is not available.</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow">
        <div className="max-w-6xl mx-auto flex items-center gap-3 p-4">
          {items[0]?.logo_url && <img src={items[0].logo_url} alt="" className="h-9 w-9 rounded bg-card object-contain" />}
          <h1 className="text-xl font-bold flex-1">{shopName}</h1>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <ShoppingBag className="w-4 h-4 mr-2" /> Cart ({count})
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {done !== null && (
          <Card className="border-primary"><CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="text-primary" />
            <div><p className="font-semibold">Thank you! Your order {done} was received.</p>
            <p className="text-sm text-muted-foreground">We will call you to confirm.</p></div>
          </CardContent></Card>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const qty = cart[p.product_id] || 0;
            return (
              <Card key={p.product_id} className="overflow-hidden flex flex-col">
                <div className="aspect-square bg-muted grid place-items-center">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-10 h-10 text-muted-foreground" />}
                </div>
                <CardContent className="p-3 flex-1 flex flex-col gap-1">
                  <p className="font-medium line-clamp-2">{p.name}</p>
                  <p className="text-lg font-bold text-primary">${Number(p.unit_price).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{fmtLrd(usdToLrd(Number(p.unit_price)))}</p>
                  <p className="text-xs text-muted-foreground">{p.in_stock > 0 ? `${p.in_stock} in stock` : "Out of stock"}</p>
                  <div className="mt-auto pt-2">
                    {qty === 0 ? (
                      <Button className="w-full" size="sm" disabled={p.in_stock <= 0} onClick={() => setQty(p.product_id, 1, p.in_stock)}>Add to cart</Button>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Button size="icon" variant="outline" onClick={() => setQty(p.product_id, qty - 1, p.in_stock)}><Minus className="w-4 h-4" /></Button>
                        <span className="font-semibold">{qty}</span>
                        <Button size="icon" variant="outline" onClick={() => setQty(p.product_id, qty + 1, p.in_stock)}><Plus className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Your cart</SheetTitle></SheetHeader>
          {lines.length === 0 ? <p className="text-muted-foreground mt-6">Your cart is empty.</p> : (
            <div className="space-y-4 mt-4">
              {lines.map((l) => (
                <div key={l.product_id} className="flex justify-between text-sm">
                  <span>{l.qty} × {l.name}</span><span>${(l.qty * Number(l.unit_price)).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total</span><span>${total.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">({fmtLrd(usdToLrd(total))})</span></span>
              </div>
              <Input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Phone (e.g. 0770 000 000) *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <RadioGroup value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="pickup" id="pk" /><Label htmlFor="pk">Branch pickup</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="delivery" id="dl" /><Label htmlFor="dl">Delivery</Label></div>
              </RadioGroup>
              {form.type === "delivery" && <Textarea placeholder="Delivery address *" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}
              <Textarea placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <p className="text-xs text-muted-foreground">Payment on pickup or delivery (cash or mobile money).</p>
              <Button className="w-full" disabled={placing || !form.name || !form.phone} onClick={placeOrder}>
                {placing ? "Placing order..." : "Place order"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
