import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subDays } from "date-fns";
import { Building2, Receipt, TrendingUp, Wallet } from "lucide-react";
import { fmtLrd, usdToLrd } from "@/lib/currency";

type Sale = { id: string; total: number; branch_id: string | null; created_at: string; payment_method: string };
type Item = { product_name: string; quantity: number; total: number; sale_id: string };

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BranchPerformance() {
  const { branches, userBranches, isAdmin } = useBranch();
  const visible = isAdmin ? branches : userBranches;
  const [scope, setScope] = useState("all");
  const [days, setDays] = useState("30");
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const since = subDays(new Date(), Number(days)).toISOString();
    (async () => {
      const { data: s } = await supabase.from("pos_sales").select("id,total,branch_id,created_at,payment_method")
        .gte("created_at", since).neq("status", "cancelled").limit(5000);
      setSales((s as Sale[]) || []);
      const { data: i } = await supabase.from("pos_sale_items").select("product_name,quantity,total,sale_id")
        .gte("created_at", since).limit(10000);
      setItems((i as Item[]) || []);
    })();
  }, [days]);

  const allowed = new Set(visible.map((b) => b.id));
  const scoped = sales.filter((s) => (scope === "all" ? (isAdmin || (s.branch_id && allowed.has(s.branch_id))) : s.branch_id === scope));
  const scopedIds = new Set(scoped.map((s) => s.id));

  const revenue = scoped.reduce((a, s) => a + Number(s.total), 0);
  const count = scoped.length;
  const avg = count ? revenue / count : 0;
  const todayStr = new Date().toDateString();
  const today = scoped.filter((s) => new Date(s.created_at).toDateString() === todayStr).reduce((a, s) => a + Number(s.total), 0);

  const byBranch = useMemo(() => visible.map((b) => {
    const bs = sales.filter((s) => s.branch_id === b.id);
    return { name: b.name, revenue: +bs.reduce((a, s) => a + Number(s.total), 0).toFixed(2), sales: bs.length };
  }).sort((a, b) => b.revenue - a.revenue), [sales, visible]);

  const trend = useMemo(() => {
    const n = Math.min(Number(days), 30);
    return Array.from({ length: n }, (_, k) => {
      const d = subDays(new Date(), n - 1 - k);
      const ds = d.toDateString();
      return { day: format(d, "dd MMM"), revenue: +scoped.filter((s) => new Date(s.created_at).toDateString() === ds).reduce((a, s) => a + Number(s.total), 0).toFixed(2) };
    });
  }, [scoped, days]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; total: number }>();
    items.filter((i) => scopedIds.has(i.sale_id)).forEach((i) => {
      const e = m.get(i.product_name) || { qty: 0, total: 0 };
      e.qty += i.quantity; e.total += Number(i.total); m.set(i.product_name, e);
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [items, scoped]);

  const methods = ["cash", "mobile_money", "card", "bank_transfer"].map((m) => ({
    m, v: scoped.filter((s) => s.payment_method === m).reduce((a, s) => a + Number(s.total), 0),
  })).filter((x) => x.v > 0);

  const kpis = [
    { label: "Sales revenue", value: money(revenue), sub: fmtLrd(usdToLrd(revenue)), icon: Wallet },
    { label: "Today", value: money(today), sub: fmtLrd(usdToLrd(today)), icon: TrendingUp },
    { label: "Transactions", value: count.toLocaleString(), sub: `${days} days`, icon: Receipt },
    { label: "Average sale", value: money(avg), sub: "per transaction", icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Branch Performance</h2>
          <p className="text-sm text-muted-foreground">{scope === "all" ? "All branches combined" : visible.find((b) => b.id === scope)?.name}</p>
        </div>
        <div className="flex gap-2">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {visible.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">{k.label}<k.icon className="w-4 h-4 text-primary" /></div>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Daily sales trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" fontSize={11} interval="preserveStartEnd" />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by branch</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBranch} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Branch ranking</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left"><tr><th className="py-1">Branch</th><th>Sales</th><th className="text-right">Revenue</th><th className="text-right">Share</th></tr></thead>
              <tbody>
                {byBranch.map((b, i) => {
                  const total = byBranch.reduce((a, x) => a + x.revenue, 0) || 1;
                  return (
                    <tr key={b.name} className="border-t">
                      <td className="py-2 font-medium">{i + 1}. {b.name}</td><td>{b.sales}</td>
                      <td className="text-right">{money(b.revenue)}</td>
                      <td className="text-right">{((b.revenue / total) * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top products</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topProducts.length === 0 && <p className="text-muted-foreground">No sales yet.</p>}
            {topProducts.map(([name, v]) => (
              <div key={name} className="flex justify-between"><span className="truncate">{name} <span className="text-muted-foreground">×{v.qty}</span></span><span className="font-medium">{money(v.total)}</span></div>
            ))}
            {methods.length > 0 && (
              <div className="border-t pt-2 mt-2 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Payment methods</p>
                {methods.map((x) => <div key={x.m} className="flex justify-between"><span className="capitalize">{x.m.replace("_", " ")}</span><span>{money(x.v)}</span></div>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
