import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const usd = (n: any) => `$${Number(n || 0).toFixed(2)}`;

export default function BranchPortalPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ub } = await supabase.from("user_branches").select("branch_id, branches(id,name)").eq("user_id", user.id);
      const list = (ub || []).map((r: any) => r.branches).filter(Boolean);
      setBranches(list);
      if (list[0]) setBranchId(list[0].id);
    })();
  }, [user]);

  useEffect(() => {
    if (!branchId) return;
    (async () => {
      setError(null);
      const { data, error } = await (supabase.rpc as any)("get_branch_portal", { p_branch_id: branchId, p_date: date });
      if (error) { setError(error.message); setData(null); } else setData(data);
    })();
  }, [branchId, date]);

  const s = data?.sales || {};
  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Branch</h1>
            <p className="text-sm text-muted-foreground">Sales, stock and cash-up for the branches you're assigned to.</p>
          </div>
          <div className="flex gap-2">
            {branches.length > 1 && (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
        </div>

        {branches.length === 0 && <Card><CardContent className="p-6 text-muted-foreground">You aren't assigned to a branch yet. Ask an admin to assign you in User Management.</CardContent></Card>}
        {error && <Card><CardContent className="p-6 text-destructive">{error}</CardContent></Card>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[["Sales", `${usd(s.total)} (${s.count})`], ["Cash", usd(s.cash)], ["Mobile money", usd(s.mobile_money)], ["Card", usd(s.card)], ["Bank transfer", usd(s.bank_transfer)]].map(([l, v]) => (
                <Card key={l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold">{v}</p></CardContent></Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Top products</CardTitle></CardHeader>
                <CardContent>
                  {data.top_products.length === 0 ? <p className="text-sm text-muted-foreground">No sales on this day.</p> : (
                    <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
                      <TableBody>{data.top_products.map((p: any) => <TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.qty}</TableCell><TableCell className="text-right">{usd(p.total)}</TableCell></TableRow>)}</TableBody></Table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Stock</CardTitle></CardHeader>
                <CardContent>
                  <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">In stock</TableHead><TableHead className="text-right">Min</TableHead></TableRow></TableHeader>
                    <TableBody>{data.stock.map((p: any) => (
                      <TableRow key={p.name}><TableCell>{p.name}</TableCell>
                        <TableCell className="text-right">{p.stock <= (p.min_level || 0) ? <Badge variant="destructive">{p.stock}</Badge> : p.stock}</TableCell>
                        <TableCell className="text-right">{p.min_level}</TableCell></TableRow>
                    ))}</TableBody></Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Cash-up — shifts (last 30 days)</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Opened</TableHead><TableHead>Cashier</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Expected cash</TableHead>
                  <TableHead className="text-right">USD</TableHead><TableHead className="text-right">LRD</TableHead><TableHead className="text-right">Mobile money</TableHead><TableHead className="text-right">Difference</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                  <TableBody>
                    {data.shifts.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No shifts.</TableCell></TableRow>}
                    {data.shifts.map((sh: any, i: number) => {
                      const d = Number(sh.cash_difference || 0) + Number(sh.mobile_money_difference || 0);
                      return <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{format(new Date(sh.opened_at), "dd MMM HH:mm")}</TableCell>
                        <TableCell>{sh.cashier || "—"}</TableCell>
                        <TableCell className="text-right">{usd(sh.total_sales)}</TableCell>
                        <TableCell className="text-right">{usd(sh.expected_cash)}</TableCell>
                        <TableCell className="text-right">{sh.counted_usd != null ? usd(sh.counted_usd) : "—"}</TableCell>
                        <TableCell className="text-right">{sh.counted_lrd != null ? `L$${Number(sh.counted_lrd).toFixed(0)}` : "—"}</TableCell>
                        <TableCell className="text-right">{sh.counted_mobile_money != null ? usd(sh.counted_mobile_money) : "—"}</TableCell>
                        <TableCell className={`text-right ${Math.abs(d) >= 0.01 ? "font-semibold text-destructive" : ""}`}>{sh.status === "open" ? "—" : usd(d)}</TableCell>
                        <TableCell><Badge variant="secondary">{sh.status}</Badge></TableCell>
                      </TableRow>;
                    })}
                  </TableBody></Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
