import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const usd = (n: number) => `$${(n || 0).toFixed(2)}`;

export default function CashUpDashboardPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [branches, setBranches] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const start = new Date(`${date}T00:00:00Z`).toISOString();
      const end = new Date(`${date}T23:59:59.999Z`).toISOString();
      const histStart = subDays(new Date(`${date}T00:00:00Z`), 30).toISOString();
      const [b, s, sh] = await Promise.all([
        supabase.from("branches").select("id,name").order("name"),
        supabase.from("pos_sales").select("id,total,payment_method,branch_id,status").gte("created_at", start).lte("created_at", end),
        supabase.from("pos_shifts").select("*").gte("opened_at", histStart).lte("opened_at", end).order("opened_at", { ascending: false }).limit(200),
      ]);
      const saleRows = (s.data || []).filter((x: any) => x.status !== "cancelled" && x.status !== "refunded");
      const ids = saleRows.map((x: any) => x.id);
      const it = ids.length
        ? await supabase.from("pos_sale_items").select("sale_id,product_name,quantity,total").in("sale_id", ids.slice(0, 500))
        : { data: [] as any[] };
      const userIds = [...new Set((sh.data || []).map((x: any) => x.user_id))];
      const p = userIds.length ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds) : { data: [] as any[] };
      setBranches(b.data || []);
      setSales(saleRows);
      setItems(it.data || []);
      setShifts(sh.data || []);
      setNames(Object.fromEntries((p.data || []).map((x: any) => [x.id, x.full_name || x.email])));
      setLoading(false);
    })();
  }, [date]);

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name || "No branch";

  const perBranch = useMemo(() => {
    const keys = [...new Set([...branches.map((b) => b.id), ...sales.map((s) => s.branch_id)])];
    const dayShifts = shifts.filter((s) => s.opened_at.slice(0, 10) === date);
    return keys.map((id) => {
      const bs = sales.filter((s) => s.branch_id === id);
      const sum = (m?: string) => bs.filter((s) => !m || s.payment_method === m).reduce((a, s) => a + Number(s.total), 0);
      const sh = dayShifts.filter((s) => s.branch_id === id);
      const diff = sh.reduce((a, s) => a + Number(s.cash_difference || 0) + Number(s.mobile_money_difference || 0), 0);
      return {
        id, name: branchName(id), count: bs.length, total: sum(), cash: sum("cash"), card: sum("card"),
        momo: sum("mobile_money"), bank: sum("bank_transfer"), shifts: sh.length,
        open: sh.filter((s) => s.status === "open").length, diff,
      };
    }).filter((r) => r.count > 0 || r.shifts > 0 || branches.some((b) => b.id === r.id));
  }, [branches, sales, shifts, date]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; total: number }>();
    items.forEach((i) => {
      const r = m.get(i.product_name) || { qty: 0, total: 0 };
      r.qty += Number(i.quantity); r.total += Number(i.total);
      m.set(i.product_name, r);
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  }, [items]);

  const totals = perBranch.reduce((a, r) => ({ total: a.total + r.total, count: a.count + r.count, cash: a.cash + r.cash, momo: a.momo + r.momo, card: a.card + r.card }), { total: 0, count: 0, cash: 0, momo: 0, card: 0 });

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Branch Cash-Up Dashboard</h1>
            <p className="text-muted-foreground text-sm">Each branch's takings for the day, best sellers and shift history.</p>
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["Total sales", usd(totals.total)], ["Transactions", String(totals.count)], ["Cash", usd(totals.cash)], ["Mobile money", usd(totals.momo)], ["Card", usd(totals.card)]].map(([l, v]) => (
            <Card key={l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {perBranch.map((r) => (
            <Card key={r.id || "none"}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {r.name}
                  {r.open > 0 ? <Badge variant="outline">{r.open} shift open</Badge>
                    : r.shifts === 0 ? <Badge variant="secondary">No shift</Badge>
                    : Math.abs(r.diff) < 0.01 ? <Badge>Balanced</Badge>
                    : <Badge variant="destructive">Off by {usd(r.diff)}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-muted-foreground">Sales ({r.count})</span><span className="text-right font-semibold">{usd(r.total)}</span>
                <span className="text-muted-foreground">Cash</span><span className="text-right">{usd(r.cash)}</span>
                <span className="text-muted-foreground">Mobile money</span><span className="text-right">{usd(r.momo)}</span>
                <span className="text-muted-foreground">Card</span><span className="text-right">{usd(r.card)}</span>
                <span className="text-muted-foreground">Bank transfer</span><span className="text-right">{usd(r.bank)}</span>
                <span className="text-muted-foreground">Shifts</span><span className="text-right">{r.shifts}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Top products ({date})</CardTitle></CardHeader>
          <CardContent>
            {topProducts.length === 0 ? <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No sales on this day."}</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
                <TableBody>{topProducts.map(([n, v]) => (
                  <TableRow key={n}><TableCell>{n}</TableCell><TableCell className="text-right">{v.qty}</TableCell><TableCell className="text-right">{usd(v.total)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Shift history (last 30 days)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Opened</TableHead><TableHead>Branch</TableHead><TableHead>Cashier</TableHead>
                <TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Expected cash</TableHead>
                <TableHead className="text-right">Counted USD</TableHead><TableHead className="text-right">Counted LRD</TableHead>
                <TableHead className="text-right">Mobile money</TableHead><TableHead className="text-right">Difference</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {shifts.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No shifts yet.</TableCell></TableRow>}
                {shifts.map((s) => {
                  const d = Number(s.cash_difference || 0) + Number(s.mobile_money_difference || 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(s.opened_at), "dd MMM HH:mm")}</TableCell>
                      <TableCell>{branchName(s.branch_id)}</TableCell>
                      <TableCell>{names[s.user_id] || "—"}</TableCell>
                      <TableCell className="text-right">{usd(Number(s.total_sales))}</TableCell>
                      <TableCell className="text-right">{usd(Number(s.expected_cash))}</TableCell>
                      <TableCell className="text-right">{s.counted_usd != null ? usd(Number(s.counted_usd)) : "—"}</TableCell>
                      <TableCell className="text-right">{s.counted_lrd != null ? `L$${Number(s.counted_lrd).toFixed(0)}` : "—"}</TableCell>
                      <TableCell className="text-right">{s.counted_mobile_money != null ? usd(Number(s.counted_mobile_money)) : "—"}</TableCell>
                      <TableCell className={`text-right ${Math.abs(d) >= 0.01 ? "text-destructive font-semibold" : ""}`}>{s.status === "open" ? "—" : usd(d)}</TableCell>
                      <TableCell><Badge variant={s.status === "open" ? "outline" : "secondary"}>{s.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
