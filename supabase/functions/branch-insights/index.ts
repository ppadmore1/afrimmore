import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { z } from "npm:zod@3";
import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";
import { DEFAULT_LEAD_DAYS, forecastItem, grossProfit, suggestTransfers } from "../_shared/forecast.ts";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const DAY = 86400000;
const HISTORY_DAYS = 90; // window used for demand forecasting

const Body = z.object({
  mode: z.enum(["ask", "report"]).optional(),
  question: z.string().trim().max(500).optional(),
  branchId: z.string().uuid().nullable().optional(),
  days: z.number().int().min(1).max(365).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const r2 = (n: number) => Math.round(n * 100) / 100;

async function fetchAll(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function buildReport(supabase: any, uid: string, scope: string[] | null, branchId: string | null, days: number) {
  const now = Date.now();
  const since365 = new Date(now - 365 * DAY).toISOString();
  const [{ data: branches }, { data: products }, { data: prodSup }, { data: suppliers }, { data: rateRow }] = await Promise.all([
    supabase.from("branches").select("id,name").eq("is_active", true),
    supabase.from("products").select("id,name,sku,unit_price,cost_price,purchase_cost,freight_cost,customs_cost,local_transport_cost,min_selling_price,lead_time_days,safety_stock_days,is_service,is_active").eq("is_active", true),
    supabase.from("product_suppliers").select("product_id,supplier_id,cost_price,lead_time_days,is_preferred,min_order_qty,carton_qty"),
    supabase.from("suppliers").select("id,name,country,lead_time_days"),
    supabase.from("exchange_rates").select("rate,effective_date").eq("from_currency", "USD").eq("to_currency", "LRD").order("effective_date", { ascending: false }).limit(1),
  ]);
  const bName = new Map((branches || []).map((b: any) => [b.id, b.name]));
  const visibleBranches = (branches || []).filter((b: any) => !scope || scope.includes(b.id));
  const prod = new Map((products || []).map((p: any) => [p.id, p]));
  const supName = new Map((suppliers || []).map((s: any) => [s.id, s]));
  const supFor = new Map<string, any>();
  for (const ps of prodSup || []) { const cur = supFor.get(ps.product_id); if (!cur || ps.is_preferred) supFor.set(ps.product_id, ps); }

  // Sales lines for the last 12 months (POS + invoices), scoped by branch.
  const posLines = await fetchAll((a, b) => {
    let q = supabase.from("pos_sale_items").select("product_id,product_name,quantity,unit_price,discount,pos_sales!inner(created_at,branch_id,status)").gte("pos_sales.created_at", since365).range(a, b);
    if (scope) q = q.in("pos_sales.branch_id", scope);
    return q;
  });
  const invLines = scope ? [] : await fetchAll((a, b) => supabase.from("invoice_items").select("product_id,description,quantity,unit_price,discount,invoices!inner(created_at,status)").gte("invoices.created_at", since365).range(a, b));
  type Line = { pid: string | null; name: string; qty: number; rev: number; at: number; branch: string | null };
  const lines: Line[] = [];
  for (const l of posLines) {
    if (["cancelled", "voided", "refunded"].includes(l.pos_sales?.status)) continue;
    lines.push({ pid: l.product_id, name: l.product_name, qty: Number(l.quantity) || 0, rev: (Number(l.unit_price) || 0) * (Number(l.quantity) || 0) * (1 - (Number(l.discount) || 0) / 100), at: new Date(l.pos_sales.created_at).getTime(), branch: l.pos_sales.branch_id });
  }
  for (const l of invLines) {
    if (["cancelled", "draft"].includes(l.invoices?.status)) continue;
    lines.push({ pid: l.product_id, name: l.description, qty: Number(l.quantity) || 0, rev: (Number(l.unit_price) || 0) * (Number(l.quantity) || 0) * (1 - (Number(l.discount) || 0) / 100), at: new Date(l.invoices.created_at).getTime(), branch: null });
  }

  // Stock, in-transit and confirmed incoming
  let stq = supabase.from("product_branches").select("product_id,branch_id,stock_quantity,low_stock_threshold");
  if (scope) stq = stq.in("branch_id", scope);
  const { data: stock } = await stq;
  const { data: transfers } = await supabase.from("stock_transfers").select("to_branch_id,status,stock_transfer_items(product_id,quantity_shipped,quantity_requested)").eq("status", "in_transit");
  const { data: pos } = await supabase.from("purchase_orders").select("id,po_number,branch_id,status,expected_date,supplier_id,purchase_order_items(product_id,quantity,quantity_received,unit_cost)").in("status", ["confirmed", "shipped"]);
  const { data: unconfirmed } = await supabase.from("purchase_orders").select("id").in("status", ["draft", "submitted"]);

  const onHand = new Map<string, number>(); const byBranch = new Map<string, Map<string, number>>();
  for (const s of stock || []) {
    onHand.set(s.product_id, (onHand.get(s.product_id) || 0) + (s.stock_quantity || 0));
    if (!byBranch.has(s.product_id)) byBranch.set(s.product_id, new Map());
    byBranch.get(s.product_id)!.set(s.branch_id, s.stock_quantity || 0);
  }
  const inTransit = new Map<string, number>();
  for (const t of transfers || []) {
    if (scope && !scope.includes(t.to_branch_id)) continue;
    for (const i of t.stock_transfer_items || []) inTransit.set(i.product_id, (inTransit.get(i.product_id) || 0) + (i.quantity_shipped ?? i.quantity_requested ?? 0));
  }
  const incoming = new Map<string, { qty: number; date: string | null }[]>(); let poCommit = 0;
  for (const po of pos || []) {
    if (scope && po.branch_id && !scope.includes(po.branch_id)) continue;
    for (const i of po.purchase_order_items || []) {
      const left = (i.quantity || 0) - (i.quantity_received || 0);
      if (left <= 0) continue;
      poCommit += left * (Number(i.unit_cost) || 0);
      if (!incoming.has(i.product_id)) incoming.set(i.product_id, []);
      incoming.get(i.product_id)!.push({ qty: left, date: po.expected_date });
    }
  }

  // Product stats per period
  const periods = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 } as Record<string, number>;
  const productPeriods: Record<string, any[]> = {}; const servicePeriods: Record<string, any[]> = {};
  for (const [key, d] of Object.entries(periods)) {
    const cutoff = now - d * DAY;
    const agg = new Map<string, { name: string; units: number; revenue: number }>();
    for (const l of lines) {
      if (l.at < cutoff) continue;
      const k = l.pid || `name:${l.name}`;
      const a = agg.get(k) || { name: prod.get(l.pid!)?.name || l.name, units: 0, revenue: 0 };
      a.units += l.qty; a.revenue += l.rev; agg.set(k, a);
    }
    const rows = [...agg.entries()].map(([k, a]) => {
      const p = prod.get(k); const gp = grossProfit(a.revenue, a.units, p?.cost_price);
      return { product_id: p?.id || null, name: a.name, sku: p?.sku || null, service: !!p?.is_service, units: a.units, revenue: r2(a.revenue), gross_profit: gp.profit, margin_pct: gp.margin };
    });
    productPeriods[key] = rows.filter((r) => !r.service);
    servicePeriods[key] = rows.filter((r) => r.service);
  }
  // Growth: last 30 days vs the 30 before
  const unitsBetween = (pid: string, from: number, to: number) => lines.filter((l) => l.pid === pid && l.at >= from && l.at < to).reduce((s, l) => s + l.qty, 0);
  const growth = (products || []).map((p: any) => {
    const cur = unitsBetween(p.id, now - 30 * DAY, now + 1); const prev = unitsBetween(p.id, now - 60 * DAY, now - 30 * DAY);
    return { product_id: p.id, name: p.name, service: !!p.is_service, last30: cur, prev30: prev, change_pct: prev > 0 ? r2(((cur - prev) / prev) * 100) : null };
  }).filter((g: any) => g.last30 + g.prev30 > 0);

  // Forecast
  const histStart = now - HISTORY_DAYS * DAY;
  const forecasts: any[] = []; const quality: { issue: string; product?: string }[] = [];
  for (const p of (products || []) as any[]) {
    if (p.is_service) continue;
    const pl = lines.filter((l) => l.pid === p.id && l.at >= histStart);
    const units = pl.reduce((s, l) => s + l.qty, 0);
    const oh = onHand.get(p.id) || 0;
    let inStockDays = HISTORY_DAYS;
    if (oh <= 0 && pl.length) inStockDays = Math.max(1, Math.ceil((Math.max(...pl.map((l) => l.at)) - histStart) / DAY));
    const ps = supFor.get(p.id); const sup = ps ? supName.get(ps.supplier_id) : null;
    const leadDays = p.lead_time_days || ps?.lead_time_days || sup?.lead_time_days || null;
    const unitCost = Number(p.cost_price) || Number(ps?.cost_price) || 0;
    const f = forecastItem({ onHand: oh, inTransit: inTransit.get(p.id) || 0, incoming: incoming.get(p.id) || [], unitsSold: units, historyDays: HISTORY_DAYS, inStockDays, leadDays, safetyDays: p.safety_stock_days, unitCost, moq: ps?.min_order_qty, carton: ps?.carton_qty });
    // Branch-level rebalancing
    const rows = visibleBranches.map((b: any) => {
      const bu = pl.filter((l) => l.branch === b.id).reduce((s, l) => s + l.qty, 0);
      return { branchId: b.id, branch: b.name, onHand: byBranch.get(p.id)?.get(b.id) || 0, dailyRate: bu / HISTORY_DAYS };
    });
    const transfers = suggestTransfers(rows, f.leadDays, f.safetyDays);
    const transferable = transfers.reduce((s, t) => s + t.qty, 0);
    forecasts.push({
      product_id: p.id, name: p.name, sku: p.sku, on_hand: oh, in_transit: inTransit.get(p.id) || 0, units_90d: units,
      supplier: sup?.name || null, supplier_id: ps?.supplier_id || null, unit_cost: unitCost, lead_source: p.lead_time_days ? "product" : ps?.lead_time_days ? "supplier link" : sup?.lead_time_days ? "supplier" : "default",
      ...f, demand_forecast_lead: f.demandLead, transfers, transferable,
      stockout_suppressed: inStockDays < HISTORY_DAYS, cash_tied: r2(oh * unitCost),
      days_of_cover: f.dailyRate > 0 ? Math.round(oh / f.dailyRate) : null,
      delay_consequence: f.risk === "high" && f.dailyRate > 0 ? `Each week of delay loses about ${Math.round(f.dailyRate * 7)} units of sales (~$${r2(f.dailyRate * 7 * (Number(p.unit_price) || 0))}).` : null,
    });
    if (!p.cost_price) quality.push({ issue: "No cost price — profit can't be calculated", product: p.name });
    if (!leadDays) quality.push({ issue: `No lead time set — using the ${DEFAULT_LEAD_DAYS}-day default`, product: p.name });
    if (!ps) quality.push({ issue: "No supplier linked", product: p.name });
    if (oh < 0) quality.push({ issue: `Negative stock (${oh}) — recount needed`, product: p.name });
    if (units > 0 && units < 10) quality.push({ issue: "Fewer than 10 units sold in 90 days — forecast is a rough estimate", product: p.name });
  }
  if (lines.length === 0) quality.push({ issue: "No sales recorded in the last 12 months — forecasts can't be made yet" });
  if ((unconfirmed || []).length) quality.push({ issue: `${unconfirmed!.length} draft/submitted purchase orders are not counted as incoming until confirmed` });
  for (const po of pos || []) if (!po.expected_date) quality.push({ issue: `Purchase order ${po.po_number} has no expected arrival date — assumed to arrive at the end of the lead time` });

  // Forecast accuracy against earlier snapshots, then save today's snapshot (once per day)
  const scopeKey = branchId || (scope ? scope.slice().sort().join(",") : "all");
  const { data: snaps } = await supabase.from("insight_forecast_snapshots").select("product_id,predicted_daily,created_at").eq("branch_scope", scopeKey).lte("created_at", new Date(now - 7 * DAY).toISOString()).order("created_at", { ascending: false }).limit(1000);
  const accuracy: any[] = []; const seen = new Set<string>();
  for (const s of snaps || []) {
    if (seen.has(s.product_id)) continue; seen.add(s.product_id);
    const since = new Date(s.created_at).getTime(); const d = (now - since) / DAY;
    const actual = unitsBetween(s.product_id, since, now + 1) / d; const pred = Number(s.predicted_daily);
    const top = Math.max(actual, pred);
    accuracy.push({ name: prod.get(s.product_id)?.name, predicted_daily: r2(pred), actual_daily: r2(actual), accuracy_pct: top > 0 ? Math.round((1 - Math.abs(actual - pred) / top) * 100) : 100, since: s.created_at.slice(0, 10) });
  }
  const { data: todaySnap } = await supabase.from("insight_forecast_snapshots").select("id").eq("branch_scope", scopeKey).gte("created_at", new Date(now - DAY).toISOString()).limit(1);
  if (!todaySnap?.length) {
    const rows = forecasts.filter((f) => f.dailyRate > 0).map((f) => ({ product_id: f.product_id, branch_scope: scopeKey, predicted_daily: f.dailyRate, history_days: HISTORY_DAYS }));
    if (rows.length) await supabase.from("insight_forecast_snapshots").insert(rows);
  }

  // Branch comparison (last `days`) and finance
  const cutoff = now - days * DAY;
  const branchCmp = visibleBranches.map((b: any) => {
    const bl = lines.filter((l) => l.branch === b.id && l.at >= cutoff);
    let profit = 0; let costKnown = true;
    for (const l of bl) { const c = Number(prod.get(l.pid!)?.cost_price); if (!c) costKnown = false; else profit += l.rev - l.qty * c; }
    const top = new Map<string, number>(); for (const l of bl) top.set(l.name, (top.get(l.name) || 0) + l.qty);
    const stockValue = (stock || []).filter((s: any) => s.branch_id === b.id).reduce((s: number, x: any) => s + (x.stock_quantity || 0) * (Number(prod.get(x.product_id)?.cost_price) || 0), 0);
    return { branch: b.name, revenue: r2(bl.reduce((s, l) => s + l.rev, 0)), gross_profit: r2(profit), profit_complete: costKnown, units: bl.reduce((s, l) => s + l.qty, 0), stock_value: r2(stockValue),
      high_risk_items: forecasts.filter((f) => (byBranch.get(f.product_id)?.get(b.id) || 0) <= 0 && f.units_90d > 0).length,
      top_products: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, q]) => ({ name: n, units: q })) };
  });
  let exq = supabase.from("expenses").select("amount,branch_id").gte("expense_date", new Date(cutoff).toISOString().slice(0, 10));
  if (scope) exq = exq.in("branch_id", scope);
  const { data: exps } = await exq;
  const { data: openInv } = scope ? { data: [] } : await supabase.from("invoices").select("total,amount_paid,status,due_date").not("status", "in", "(paid,cancelled,draft)");
  const revenueP = r2(lines.filter((l) => l.at >= cutoff).reduce((s, l) => s + l.rev, 0));
  const gpP = r2(lines.filter((l) => l.at >= cutoff).reduce((s, l) => { const c = Number(prod.get(l.pid!)?.cost_price); return s + (c ? l.rev - l.qty * c : 0); }, 0));
  const lrd = Number(rateRow?.[0]?.rate) || 195;
  const invValue = r2((stock || []).reduce((s: number, x: any) => s + Math.max(0, x.stock_quantity || 0) * (Number(prod.get(x.product_id)?.cost_price) || 0), 0));

  const atRisk = forecasts.filter((f) => f.risk === "high" || f.risk === "medium").sort((a, b) => (a.stockoutDate || "9") < (b.stockoutDate || "9") ? -1 : 1);
  const importPlan = forecasts.filter((f) => f.suggestQty > 0).map((f) => ({ ...f, net_order_qty: Math.max(0, f.suggestQty - f.transferable), est_cost_after_transfers: r2(Math.max(0, f.suggestQty - f.transferable) * f.unit_cost) }));
  const slow = forecasts.filter((f) => f.on_hand > 0 && (f.units_90d === 0 || (f.days_of_cover ?? 0) > 180)).map((f) => ({ name: f.name, sku: f.sku, on_hand: f.on_hand, units_90d: f.units_90d, days_of_cover: f.days_of_cover, cash_tied: f.cash_tied, status: f.units_90d === 0 ? "non-moving" : "slow" })).sort((a, b) => b.cash_tied - a.cash_tied);

  return {
    calculated_at: new Date(now).toISOString(), history_days: HISTORY_DAYS, period_days: days,
    branch: branchId ? bName.get(branchId) : scope ? "your assigned branches" : "all branches",
    currency: { base: "USD", lrd_rate: lrd, lrd_rate_source: rateRow?.[0] ? `exchange rate ${rateRow[0].effective_date}` : "default 195" },
    finance: { revenue: revenueP, gross_profit: gpP, expenses: r2((exps || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0)),
      outstanding_invoices: r2((openInv || []).reduce((s: number, i: any) => s + (Number(i.total) - Number(i.amount_paid || 0)), 0)),
      overdue_invoices: (openInv || []).filter((i: any) => i.due_date && new Date(i.due_date).getTime() < now).length,
      inventory_value: invValue, inventory_value_lrd: Math.round(invValue * lrd), open_po_commitments: r2(poCommit),
      net_profit_note: "Net profit isn't shown: it needs complete expense and cost records. Gross profit uses landed cost." },
    at_risk: atRisk, import_plan: importPlan,
    import_total: r2(importPlan.reduce((s, f) => s + f.est_cost_after_transfers, 0)),
    transfers: forecasts.filter((f) => f.transfers.length).map((f) => ({ name: f.name, sku: f.sku, moves: f.transfers })),
    products: productPeriods, services: servicePeriods, growth, slow,
    stockouts: forecasts.filter((f) => f.on_hand <= 0 && f.units_90d > 0).map((f) => ({ name: f.name, sku: f.sku, units_90d: f.units_90d })),
    branches: branchCmp, accuracy, data_quality: quality,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Please sign in." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ error: "Please sign in." }, 401);
    const uid = userData.user.id;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request." }, 400);
    const mode = parsed.data.mode ?? "ask";
    const question = parsed.data.question ?? "";
    if (mode === "ask" && question.length < 3) return json({ error: "Please type a question (3–500 characters)." }, 400);
    const branchId = parsed.data.branchId ?? null;
    const days = parsed.data.days ?? 30;

    const { data: hq } = await supabase.rpc("is_hq", { p_user_id: uid });
    let allowed: string[] | null = null;
    if (!hq) {
      const { data: b } = await supabase.rpc("get_user_branches", { p_user_id: uid });
      allowed = ((b as unknown as any[]) || []).map((x: any) => (typeof x === "string" ? x : x.get_user_branches));
      if (branchId && !allowed.includes(branchId)) return json({ error: "You don't have access to this branch." }, 403);
      if (!branchId && allowed.length === 0) return json({ error: "No branch is assigned to your account yet." }, 403);
    }
    const scope = branchId ? [branchId] : allowed;
    const report = await buildReport(supabase, uid, scope, branchId, days);
    if (mode === "report") return json({ report });

    // Compact context for the AI — every number comes from the report above.
    const slim = (rows: any[], n: number) => rows.slice(0, n);
    const p = report.products;
    const context = {
      ...report,
      at_risk: slim(report.at_risk, 25).map((f: any) => ({ name: f.name, sku: f.sku, on_hand: f.on_hand, daily: f.dailyRate, monthly: f.monthlyRate, lead_days: f.leadDays, demand_over_lead: f.demandLead, incoming: f.incomingQty, next_arrival: f.nextArrival, stockout: f.stockoutDate, stock_at_arrival: f.projectedAtArrival, reorder_date: f.reorderDate, suggest_qty: f.suggestQty, est_cost: f.estCost, risk: f.risk, reason: f.reason, estimate: f.estimate, transfers: f.transfers })),
      import_plan: slim(report.import_plan, 25).map((f: any) => ({ name: f.name, supplier: f.supplier, order_qty: f.net_order_qty, est_cost: f.est_cost_after_transfers, reorder_date: f.reorderDate, why: f.reason, delay: f.delay_consequence, covered_by_transfer: f.transferable })),
      products: Object.fromEntries(Object.entries(p).map(([k, rows]) => [k, {
        top_units: slim([...rows].sort((a, b) => b.units - a.units), 10),
        top_revenue: slim([...rows].sort((a, b) => b.revenue - a.revenue), 10),
        top_profit: slim([...rows].filter((r) => r.gross_profit != null).sort((a, b) => b.gross_profit - a.gross_profit), 10),
      }])),
      services: Object.fromEntries(Object.entries(report.services).map(([k, rows]) => [k, slim([...rows].sort((a, b) => b.revenue - a.revenue), 10)])),
      growth: slim([...report.growth].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)), 15),
      slow: slim(report.slow, 15), data_quality: slim(report.data_quality, 25),
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({ baseURL: GATEWAY, apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: runIdFetch.fetch });

    let gatewayError: { status?: number; message?: string } | null = null;
    const result = streamText({
      model: provider.responses(MODEL),
      system:
        "You are the business analyst inside Afrimore Business Management System, for a multi-branch business in Liberia that imports from China (default lead time 120 days). " +
        "All figures in DATA were calculated by the system — quote them, never recalculate or invent numbers. Amounts are USD; only show LRD using DATA.currency.lrd_rate and say so. " +
        "Units sold, revenue, gross profit and margin are different — don't confuse them. Gross profit uses landed cost; never state net profit. " +
        "Draft/unconfirmed purchase orders are not incoming stock. Prefer branch transfers over imports when DATA.transfers shows surplus. " +
        "Format: one-line direct answer; 2–6 bullets with specific figures and the period analyzed (history_days for forecasts, period_days for sales); 1–3 actions under 'What to do'; " +
        "a short 'Assumptions' line (label forecasts as estimates when estimate=true or data_quality shows gaps). If DATA can't answer, say so and say which records are missing. Plain markdown, no tables.",
      messages: [{ role: "user", content: `DATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}` }],
      abortSignal: req.signal,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
      onError: ({ error }: any) => { gatewayError = { status: error?.statusCode, message: error?.responseBody || error?.message }; },
    });
    let text = "";
    try { text = await result.text; } catch (e: any) { gatewayError ??= { status: e?.statusCode, message: e?.message }; }
    if (!text) {
      const st = (gatewayError as any)?.status;
      console.error("branch-insights gateway error", gatewayError);
      if (st === 429) return json({ error: "Too many questions right now — please wait a minute and try again." }, 429);
      if (st === 402) return json({ error: "AI credits have run out. The workspace owner needs to add credits." }, 402);
      if (st === 403) return json({ error: "AI access is blocked for this workspace. Ask the workspace admin." }, 403);
      return json({ error: "The AI couldn't answer right now. Please try again." }, 502);
    }
    return json({ answer: text, summary: { revenue: report.finance.revenue, transactions: lines_count(report), branch: report.branch, period: `last ${days} days`, calculated_at: report.calculated_at } });
  } catch (e: any) {
    console.error("branch-insights failed", e);
    return json({ error: e?.message || "Something went wrong." }, 500);
  }
});

function lines_count(report: any) {
  return (report.products["30d"] || []).reduce((s: number, r: any) => s + r.units, 0);
}
