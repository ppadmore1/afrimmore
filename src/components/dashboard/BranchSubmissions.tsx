import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const usd = (n: any) => `$${Number(n || 0).toFixed(2)}`;

/** Owner view: today's branch closing reports and cashier float counts per branch. */
export function BranchSubmissions() {
  const [rows, setRows] = useState<any[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    (async () => {
      const start = new Date(`${today}T00:00:00`).toISOString();
      const [b, r, s] = await Promise.all([
        supabase.from("branches").select("id,name").eq("is_active", true).order("name"),
        supabase.from("branch_reports").select("*").eq("report_type", "daily").eq("period_start", today),
        supabase.from("pos_shifts").select("branch_id,status,cash_difference,total_sales").gte("opened_at", start),
      ]);
      setRows((b.data || []).map((br: any) => {
        const rep = (r.data || []).find((x: any) => x.branch_id === br.id);
        const sh = (s.data || []).filter((x: any) => x.branch_id === br.id);
        return {
          ...br, rep,
          open: sh.filter((x: any) => x.status === "open").length,
          closed: sh.filter((x: any) => x.status !== "open").length,
          variance: sh.reduce((a: number, x: any) => a + Number(x.cash_difference || 0), 0),
          sales: sh.reduce((a: number, x: any) => a + Number(x.total_sales || 0), 0),
        };
      }));
    })();
  }, [today]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Today's Branch Submissions</CardTitle>
        <Button asChild variant="outline" size="sm"><Link to="/branch-reports">All reports</Link></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No branches yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                Shifts: {r.closed} closed, {r.open} open · Shift sales {usd(r.sales)} · Float variance {usd(r.variance)}
              </p>
            </div>
            {r.rep ? (
              <Badge>{r.rep.status === "approved" ? "Approved" : "Submitted"} · {usd(r.rep.total_sales)}</Badge>
            ) : (
              <Badge variant="outline">Not submitted</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
