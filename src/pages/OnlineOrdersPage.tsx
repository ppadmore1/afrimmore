import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";

const STATUSES = [
  ["received", "Received"], ["packed", "Packed"], ["ready_for_pickup", "Ready for Pickup"],
  ["out_for_delivery", "Out for Delivery"], ["delivered", "Delivered"], ["cancelled", "Cancelled"],
] as const;

export default function OnlineOrdersPage() {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("active");

  const load = async () => {
    const { data } = await supabase.from("online_orders").select("*, online_order_items(*)").order("created_at", { ascending: false });
    setOrders(data || []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("online_orders").update({ status }).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Order updated" }); load(); }
  };

  const shopUrl = tenant?.slug ? `${window.location.origin}/shop/${tenant.slug}` : "";
  const shown = orders.filter((o) => filter === "all" || (filter === "active" ? !["delivered", "cancelled"].includes(o.status) : o.status === filter));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Online Orders</h1>
            <p className="text-muted-foreground">Orders placed on your online shop</p></div>
          {shopUrl && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(shopUrl); toast({ title: "Shop link copied" }); }}><Copy className="w-4 h-4 mr-2" />Copy shop link</Button>
              <Button asChild><a href={shopUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-2" />Open shop</a></Button>
            </div>
          )}
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Open orders</SelectItem>
            <SelectItem value="all">All orders</SelectItem>
            {STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {shown.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((o) => (
            <Card key={o.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div><CardTitle className="text-base">{o.order_number}</CardTitle>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p></div>
                <Badge variant={o.status === "cancelled" ? "destructive" : "secondary"}>{STATUSES.find((s) => s[0] === o.status)?.[1]}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><b>{o.customer_name}</b> · {o.customer_phone}</p>
                <p>{o.fulfillment_type === "delivery" ? `Delivery: ${o.delivery_address}` : "Branch pickup"}</p>
                {o.notes && <p className="text-muted-foreground">Note: {o.notes}</p>}
                <ul className="border-t pt-2">
                  {o.online_order_items?.map((i: any) => <li key={i.id} className="flex justify-between"><span>{i.quantity} × {i.product_name}</span><span>${Number(i.total).toFixed(2)}</span></li>)}
                </ul>
                <p className="font-bold text-right">Total ${Number(o.total_amount).toFixed(2)}</p>
                {!["delivered", "cancelled"].includes(o.status) && (
                  <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
