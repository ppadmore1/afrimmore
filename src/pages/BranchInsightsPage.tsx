import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2, Send, RefreshCw, FileText } from "lucide-react";

const SUGGESTIONS = [
  "Which products will run out before our next China shipment?",
  "What products should we order this month?",
  "What is the estimated cost of our next import?",
  "Which products generate the most profit?",
  "Which services should we promote?",
  "Which branch is performing best?",
  "Which products should we transfer between branches?",
  "Which inventory is tying up too much cash?",
  "What are the biggest risks to our business this month?",
  "What actions should management take this week?",
];

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^#{1,6}\s/.test(t)) return <p key={i} className="font-semibold pt-2">{renderInline(t.replace(/^#+\s/, ""))}</p>;
        if (/^[-*•]\s/.test(t)) return <p key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{renderInline(t.replace(/^[-*•]\s/, ""))}</p>;
        return <p key={i}>{renderInline(t)}</p>;
      })}
    </div>
  );
}

const riskBadge = (r: string) =>
  <Badge variant={r === "high" ? "destructive" : r === "medium" ? "secondary" : "outline"} className="capitalize">{r}</Badge>;

async function errMsg(error: unknown) {
  let msg = "Something went wrong. Please try again.";
  if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json()).error || msg; } catch { /* default */ } }
  return msg;
}

export default function BranchInsightsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [days, setDays] = useState("30");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id,name").eq("is_active", true).order("name").then(({ data }) => setBranches(data || []));
  }, []);

  async function loadReport() {
    setReportLoading(true);
    const { data, error } = await supabase.functions.invoke("branch-insights", {
      body: { mode: "report", branchId: branchId === "all" ? null : branchId, days: Number(days) },
    });
    setReportLoading(false);
    if (error) { setError(await errMsg(error)); return; }
    setReport(data.report); setSelected(new Set());
  }
  useEffect(() => { loadReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [branchId, days]);

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (text.length < 3) return;
    setQuestion(text); setLoading(true); setError(null); setAnswer(null);
    const { data, error } = await supabase.functions.invoke("branch-insights", {
      body: { question: text, branchId: branchId === "all" ? null : branchId, days: Number(days) },
    });
    setLoading(false);
    if (error) { setError(await errMsg(error)); return; }
    setAnswer(data.answer); setSummary(data.summary);
  }

  async function createDraftPOs() {
    const rows = (report?.import_plan || []).filter((r: any) => selected.has(r.product_id) && r.net_order_qty > 0);
    const noSupplier = rows.filter((r: any) => !r.supplier_id);
    const bySupplier = new Map<string, any[]>();
    rows.filter((r: any) => r.supplier_id).forEach((r: any) => bySupplier.set(r.supplier_id, [...(bySupplier.get(r.supplier_id) || []), r]));
    if (!bySupplier.size) { toast({ title: "Link a supplier to these products first", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const today = format(new Date(), "yyyyMMdd");
      const { data: last } = await supabase.from("purchase_orders").select("po_number").like("po_number", `PO-${today}-%`).order("po_number", { ascending: false }).limit(1);
      let next = last?.length ? parseInt(last[0].po_number.split("-").pop() || "0") + 1 : 1;
      const made: string[] = [];
      for (const [supplierId, items] of bySupplier) {
        const subtotal = items.reduce((s, r) => s + r.net_order_qty * r.unit_cost, 0);
        const poNumber = `PO-${today}-${String(next++).padStart(4, "0")}`;
        const { data: po, error } = await supabase.from("purchase_orders").insert({
          po_number: poNumber, supplier_id: supplierId, branch_id: branchId === "all" ? null : branchId, status: "draft",
          order_date: format(new Date(), "yyyy-MM-dd"), subtotal, total: subtotal, created_by: user?.id,
          notes: "Draft prepared from AI Insights import plan — review before submitting.",
        }).select().single();
        if (error) throw error;
        const { error: e2 } = await supabase.from("purchase_order_items").insert(items.map((r) => ({
          purchase_order_id: po.id, product_id: r.product_id, quantity: r.net_order_qty, unit_cost: r.unit_cost, total: r.net_order_qty * r.unit_cost,
        })));
        if (e2) throw e2;
        made.push(poNumber);
      }
      toast({ title: `Draft purchase order${made.length > 1 ? "s" : ""} created: ${made.join(", ")}`, description: noSupplier.length ? `${noSupplier.length} product(s) skipped — no supplier linked.` : "Nothing was sent to suppliers." });
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: "Couldn't create the draft", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  }

  const prodRows: any[] = report?.products?.[period] || [];
  const svcRows: any[] = report?.services?.[period] || [];
  const top = (rows: any[], key: string, n = 10) => [...rows].filter((r) => r[key] != null).sort((a, b) => b[key] - a[key]).slice(0, n);
  const [topN, setTopN] = useState("10");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Lightbulb className="w-7 h-7 text-primary" /> AI Insights</h1>
          <p className="text-muted-foreground mt-1">Forecasts, import planning, profit and branch comparisons from your real records — ask questions in plain language.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger aria-label="Branch" className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my branches</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger aria-label="Period" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadReport} disabled={reportLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${reportLoading ? "animate-spin" : ""}`} /> Recalculate
          </Button>
          {report && <span className="text-xs text-muted-foreground">Calculated {new Date(report.calculated_at).toLocaleString()} · forecasts use the last {report.history_days} days of sales</span>}
        </div>

        {error && <Card className="border-destructive"><CardContent className="pt-6 text-destructive text-sm">{error}</CardContent></Card>}

        <Tabs defaultValue="ask">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="ask">Ask AI</TabsTrigger>
            <TabsTrigger value="forecast">Stock Forecast</TabsTrigger>
            <TabsTrigger value="import">China Import Plan</TabsTrigger>
            <TabsTrigger value="profit">Best Sellers & Profit</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="quality">Data Quality</TabsTrigger>
          </TabsList>

          <TabsContent value="ask" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Textarea aria-label="Your question" placeholder="e.g. Which products will run out before our next China shipment?" value={question} maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)} rows={3}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" className="h-auto py-1.5 text-xs whitespace-normal text-left" disabled={loading} onClick={() => ask(s)}>{s}</Button>
                  ))}
                </div>
                <Button onClick={() => ask()} disabled={loading || question.trim().length < 3}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {loading ? "Analyzing your data…" : "Ask"}
                </Button>
              </CardContent>
            </Card>
            {answer && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Answer</CardTitle>
                  {summary && <p className="text-xs text-muted-foreground">{usd(summary.revenue)} revenue · {summary.branch} · {summary.period} · calculated {new Date(summary.calculated_at).toLocaleTimeString()}</p>}
                </CardHeader>
                <CardContent><Answer text={answer} /></CardContent>
              </Card>
            )}
          </TabsContent>

          {!report ? (
            <div className="py-10 text-center text-muted-foreground">{reportLoading ? "Calculating…" : "No data yet."}</div>
          ) : (<>
            <TabsContent value="forecast">
              <Card>
                <CardHeader>
                  <CardTitle>Products at risk of running out</CardTitle>
                  <CardDescription>Stock on hand + stock in transit + confirmed purchase orders, against average daily sales. Default lead time 120 days — set it per product or supplier.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {report.at_risk.length === 0 ? <p className="text-sm text-muted-foreground">No products at risk with current sales and stock.</p> : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Per day / month</TableHead>
                        <TableHead className="text-right">Demand over lead time</TableHead><TableHead>Incoming</TableHead><TableHead>Runs out</TableHead>
                        <TableHead className="text-right">Left at arrival</TableHead><TableHead>Reorder by</TableHead><TableHead className="text-right">Suggest</TableHead>
                        <TableHead className="text-right">Est. cost</TableHead><TableHead>Risk</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {report.at_risk.map((f: any) => (
                          <TableRow key={f.product_id}>
                            <TableCell><div className="font-medium">{f.name}</div><div className="text-xs text-muted-foreground">{f.sku} · {f.leadDays}d lead ({f.lead_source}){f.estimate ? " · estimate" : ""}</div><div className="text-xs text-muted-foreground max-w-xs">{f.reason}</div></TableCell>
                            <TableCell className="text-right">{f.on_hand}{f.in_transit ? ` (+${f.in_transit} transit)` : ""}</TableCell>
                            <TableCell className="text-right">{f.dailyRate} / {f.monthlyRate}</TableCell>
                            <TableCell className="text-right">{f.demand_forecast_lead}</TableCell>
                            <TableCell>{f.incomingQty ? `${f.incomingQty}${f.nextArrival ? ` on ${f.nextArrival}` : ""}` : "—"}</TableCell>
                            <TableCell>{f.stockoutDate || "—"}</TableCell>
                            <TableCell className="text-right">{f.projectedAtArrival}</TableCell>
                            <TableCell>{f.reorderDate}</TableCell>
                            <TableCell className="text-right">{f.suggestQty}</TableCell>
                            <TableCell className="text-right">{usd(f.estCost)}</TableCell>
                            <TableCell>{riskBadge(f.risk)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              {report.accuracy.length > 0 && (
                <Card className="mt-4">
                  <CardHeader><CardTitle>Forecast accuracy</CardTitle><CardDescription>Earlier predictions compared with what actually sold.</CardDescription></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Since</TableHead><TableHead className="text-right">Predicted/day</TableHead><TableHead className="text-right">Actual/day</TableHead><TableHead className="text-right">Accuracy</TableHead></TableRow></TableHeader>
                      <TableBody>{report.accuracy.map((a: any, i: number) => <TableRow key={i}><TableCell>{a.name}</TableCell><TableCell>{a.since}</TableCell><TableCell className="text-right">{a.predicted_daily}</TableCell><TableCell className="text-right">{a.actual_daily}</TableCell><TableCell className="text-right">{a.accuracy_pct}%</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="import">
              <Card>
                <CardHeader>
                  <CardTitle>China import plan</CardTitle>
                  <CardDescription>Recommended orders after counting stock that could be moved from other branches. Rounded up to supplier minimum order and carton size where set. Estimated total: <strong>{usd(report.import_total)}</strong> (landed cost).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                  {report.import_plan.length === 0 ? <p className="text-sm text-muted-foreground">Nothing needs ordering right now — projected stock is sufficient.</p> : (<>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead></TableHead><TableHead>Product</TableHead><TableHead>Supplier</TableHead><TableHead>Order by</TableHead>
                        <TableHead className="text-right">Demand before arrival</TableHead><TableHead className="text-right">From other branches</TableHead>
                        <TableHead className="text-right">Order qty</TableHead><TableHead className="text-right">Est. cost</TableHead><TableHead>Why</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {report.import_plan.map((f: any) => (
                          <TableRow key={f.product_id}>
                            <TableCell><input type="checkbox" aria-label={`Select ${f.name}`} checked={selected.has(f.product_id)} disabled={f.net_order_qty <= 0}
                              onChange={(e) => { const s = new Set(selected); e.target.checked ? s.add(f.product_id) : s.delete(f.product_id); setSelected(s); }} /></TableCell>
                            <TableCell><div className="font-medium">{f.name}</div><div className="text-xs text-muted-foreground">{f.sku}</div></TableCell>
                            <TableCell>{f.supplier || <span className="text-destructive text-xs">No supplier</span>}</TableCell>
                            <TableCell>{f.reorderDate}</TableCell>
                            <TableCell className="text-right">{f.demand_forecast_lead}</TableCell>
                            <TableCell className="text-right">{f.transferable || "—"}</TableCell>
                            <TableCell className="text-right font-medium">{f.net_order_qty}</TableCell>
                            <TableCell className="text-right">{usd(f.est_cost_after_transfers)}</TableCell>
                            <TableCell className="text-xs max-w-xs">{f.reason} Stock left when it arrives: {f.projectedAtArrival}. {f.delay_consequence || ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Button onClick={createDraftPOs} disabled={!selected.size || creating}>
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />} Prepare draft purchase order
                    </Button>
                    <p className="text-xs text-muted-foreground">Drafts are saved for review under <Link className="underline" to="/purchase-orders">Purchase Orders</Link>. Nothing is sent or paid automatically.</p>
                  </>)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profit" className="space-y-4">
              <div className="flex gap-3">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-40" aria-label="Compare period"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem><SelectItem value="90d">90 days</SelectItem><SelectItem value="12m">12 months</SelectItem></SelectContent>
                </Select>
                <Select value={topN} onValueChange={setTopN}>
                  <SelectTrigger className="w-28" aria-label="How many"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="10">Top 10</SelectItem><SelectItem value="20">Top 20</SelectItem><SelectItem value="50">Top 50</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {[["By units sold", "units"], ["By revenue", "revenue"], ["By gross profit", "gross_profit"], ["Highest margin", "margin_pct"]].map(([title, key]) => (
                  <Card key={key}>
                    <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
                    <CardContent>
                      <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Profit</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
                        <TableBody>{top(prodRows, key, Number(topN)).map((r, i) => (
                          <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell className="text-right">{r.units}</TableCell><TableCell className="text-right">{usd(r.revenue)}</TableCell><TableCell className="text-right">{usd(r.gross_profit)}</TableCell><TableCell className="text-right">{r.margin_pct == null ? "—" : `${r.margin_pct}%`}</TableCell></TableRow>
                        ))}</TableBody>
                      </Table>
                      {!prodRows.length && <p className="text-sm text-muted-foreground pt-2">No sales in this period.</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Services</CardTitle></CardHeader>
                  <CardContent>{svcRows.length ? (
                    <Table><TableBody>{top(svcRows, "revenue", Number(topN)).map((r, i) => <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell className="text-right">{usd(r.revenue)}</TableCell><TableCell className="text-right">{usd(r.gross_profit)}</TableCell></TableRow>)}</TableBody></Table>
                  ) : <p className="text-sm text-muted-foreground">No service sales. Tick "This is a service" on a product to track it here.</p>}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Growing & declining (last 30 vs previous 30 days)</CardTitle></CardHeader>
                  <CardContent><Table><TableBody>{[...report.growth].sort((a: any, b: any) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 15).map((g: any, i: number) => (
                    <TableRow key={i}><TableCell>{g.name}{g.service ? " (service)" : ""}</TableCell><TableCell className="text-right">{g.prev30} → {g.last30}</TableCell><TableCell className="text-right">{g.change_pct == null ? "new" : `${g.change_pct > 0 ? "+" : ""}${g.change_pct}%`}</TableCell></TableRow>
                  ))}</TableBody></Table></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Slow & non-moving stock</CardTitle><CardDescription>Over 180 days of stock or no sales in 90 days.</CardDescription></CardHeader>
                  <CardContent>{report.slow.length ? <Table><TableBody>{report.slow.slice(0, 20).map((s: any, i: number) => <TableRow key={i}><TableCell>{s.name}</TableCell><TableCell>{s.status}</TableCell><TableCell className="text-right">{s.on_hand} units</TableCell><TableCell className="text-right">{usd(s.cash_tied)} tied up</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">None.</p>}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Out of stock but selling</CardTitle></CardHeader>
                  <CardContent>{report.stockouts.length ? <Table><TableBody>{report.stockouts.map((s: any, i: number) => <TableRow key={i}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.units_90d} sold in 90 days</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">None.</p>}</CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branches" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[["Revenue", report.finance.revenue], ["Gross profit", report.finance.gross_profit], ["Expenses", report.finance.expenses], ["Unpaid invoices", report.finance.outstanding_invoices], ["Inventory value", report.finance.inventory_value], ["Open purchase orders", report.finance.open_po_commitments]].map(([l, v]) => (
                  <Card key={l as string}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{l as string}</p><p className="text-lg font-semibold">{usd(v as number)}</p></CardContent></Card>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">USD. Inventory ≈ L${report.finance.inventory_value_lrd.toLocaleString()} at {report.currency.lrd_rate} LRD/USD ({report.currency.lrd_rate_source}). {report.finance.net_profit_note}</p>
              <Card>
                <CardHeader><CardTitle>Branch comparison (last {report.period_days} days)</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table><TableHeader><TableRow><TableHead>Branch</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Gross profit</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Stock value</TableHead><TableHead className="text-right">Out-of-stock sellers</TableHead><TableHead>Top products</TableHead></TableRow></TableHeader>
                    <TableBody>{[...report.branches].sort((a: any, b: any) => b.revenue - a.revenue).map((b: any) => (
                      <TableRow key={b.branch}><TableCell className="font-medium">{b.branch}</TableCell><TableCell className="text-right">{usd(b.revenue)}</TableCell><TableCell className="text-right">{usd(b.gross_profit)}{!b.profit_complete && <span className="text-xs text-muted-foreground"> (some costs missing)</span>}</TableCell><TableCell className="text-right">{b.units}</TableCell><TableCell className="text-right">{usd(b.stock_value)}</TableCell><TableCell className="text-right">{b.high_risk_items}</TableCell><TableCell className="text-xs">{b.top_products.map((t: any) => `${t.name} (${t.units})`).join(", ") || "—"}</TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Suggested branch transfers</CardTitle><CardDescription>Move surplus to branches that would run short within the lead time — before importing more. <Link className="underline" to="/stock-transfers">Open Stock Transfers</Link></CardDescription></CardHeader>
                <CardContent>{report.transfers.length ? <Table><TableBody>{report.transfers.flatMap((t: any) => t.moves.map((m: any, i: number) => <TableRow key={t.name + i}><TableCell>{t.name}</TableCell><TableCell>{m.from} → {m.to}</TableCell><TableCell className="text-right">{m.qty} units</TableCell></TableRow>))}</TableBody></Table> : <p className="text-sm text-muted-foreground">No transfers needed.</p>}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality">
              <Card>
                <CardHeader><CardTitle>Data quality</CardTitle><CardDescription>Gaps that make forecasts and profit figures less reliable. Fix these for better recommendations.</CardDescription></CardHeader>
                <CardContent>{report.data_quality.length ? (
                  <Table><TableBody>{report.data_quality.map((q: any, i: number) => <TableRow key={i}><TableCell>{q.product || "—"}</TableCell><TableCell>{q.issue}</TableCell></TableRow>)}</TableBody></Table>
                ) : <p className="text-sm text-muted-foreground">No issues found.</p>}</CardContent>
              </Card>
            </TabsContent>
          </>)}
        </Tabs>
      </div>
    </AppLayout>
  );
}
