import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { z } from "npm:zod@3";
import { createLovableAiGatewayRunIdFetch } from "../_shared/run-id.ts";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const Body = z.object({
  question: z.string().trim().min(3).max(500),
  branchId: z.string().uuid().nullable().optional(),
  days: z.number().int().min(1).max(90).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Please sign in." }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ error: "Please sign in." }, 401);
    const uid = userData.user.id;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Please type a question (3–500 characters)." }, 400);
    const { question, branchId = null } = parsed.data;
    const days = parsed.data.days ?? 30;

    // Which branches may this user see?
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
    let allowed: string[] | null = null;
    if (!isAdmin) {
      const { data: b } = await supabase.rpc("get_user_branches", { p_user_id: uid });
      allowed = ((b as unknown as string[]) || []).map((x: any) => (typeof x === "string" ? x : x.get_user_branches));
      if (branchId && !allowed.includes(branchId)) return json({ error: "You don't have access to this branch." }, 403);
      if (!branchId && allowed.length === 0) return json({ error: "No branch is assigned to your account yet." }, 403);
    }
    const scope = branchId ? [branchId] : allowed;

    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: branches } = await supabase.from("branches").select("id,name");
    const bName = new Map((branches || []).map((b: any) => [b.id, b.name]));

    let sq = supabase.from("pos_sales").select("id,total,payment_method,created_at,branch_id,created_by,status").gte("created_at", since).limit(5000);
    if (scope) sq = sq.in("branch_id", scope);
    const { data: sales, error: sErr } = await sq;
    if (sErr) throw sErr;
    const saleIds = (sales || []).map((s: any) => s.id);

    const items: any[] = [];
    for (let i = 0; i < saleIds.length; i += 300) {
      const { data } = await supabase.from("pos_sale_items").select("sale_id,product_name,quantity,total").in("sale_id", saleIds.slice(i, i + 300));
      items.push(...(data || []));
    }

    let stq = supabase.from("product_branches").select("branch_id,stock_quantity,low_stock_threshold,products(name,unit_price,cost_price)").limit(2000);
    if (scope) stq = stq.in("branch_id", scope);
    const { data: stock } = await stq;

    const { data: profs } = await supabase.from("profiles").select("id,full_name,email");
    const pName = new Map((profs || []).map((p: any) => [p.id, p.full_name || p.email]));

    // Aggregate
    const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
    const group = (arr: any[], key: (x: any) => string, val: (x: any) => number) => {
      const m: Record<string, { total: number; count: number }> = {};
      for (const x of arr) { const k = key(x); m[k] ??= { total: 0, count: 0 }; m[k].total += val(x); m[k].count++; }
      return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { total: Math.round(v.total * 100) / 100, count: v.count }]));
    };
    const completed = (sales || []).filter((s: any) => s.status !== "cancelled" && s.status !== "voided");
    const prodAgg: Record<string, { qty: number; revenue: number }> = {};
    for (const it of items) { const k = it.product_name || "Unknown"; prodAgg[k] ??= { qty: 0, revenue: 0 }; prodAgg[k].qty += Number(it.quantity) || 0; prodAgg[k].revenue += Number(it.total) || 0; }
    const products = Object.entries(prodAgg).sort((a, b) => b[1].revenue - a[1].revenue);

    const context = {
      period: `last ${days} days`,
      branch: branchId ? bName.get(branchId) : (scope ? "your assigned branches" : "all branches"),
      currency: "USD (1 USD ≈ 195 LRD)",
      totals: { revenue: sum(completed.map((s: any) => Number(s.total) || 0)), transactions: completed.length },
      by_branch: group(completed, (s) => bName.get(s.branch_id) || "Unassigned", (s) => Number(s.total) || 0),
      by_payment_method: group(completed, (s) => s.payment_method, (s) => Number(s.total) || 0),
      by_day: group(completed, (s) => s.created_at.slice(0, 10), (s) => Number(s.total) || 0),
      by_weekday: group(completed, (s) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(s.created_at).getUTCDay()], (s) => Number(s.total) || 0),
      by_cashier: group(completed, (s) => pName.get(s.created_by) || "Unknown", (s) => Number(s.total) || 0),
      top_products: products.slice(0, 15).map(([n, v]) => ({ name: n, qty: v.qty, revenue: Math.round(v.revenue * 100) / 100 })),
      slow_products: products.slice(-5).map(([n, v]) => ({ name: n, qty: v.qty })),
      stock: (stock || []).map((s: any) => ({
        branch: bName.get(s.branch_id), product: s.products?.name, qty: s.stock_quantity,
        low_threshold: s.low_stock_threshold ?? 10, price: s.products?.unit_price, cost: s.products?.cost_price,
      })),
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: GATEWAY, apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    let gatewayError: { status?: number; message?: string } | null = null;
    const result = streamText({
      model: provider.responses(MODEL),
      system:
        "You are a retail business analyst for Afrimore, a multi-branch retailer in Liberia. Answer the branch manager's question using ONLY the data provided. " +
        "Be concise: a one-line direct answer, then 2–5 short bullet points with specific numbers, then 1–3 concrete actions under 'What to do'. " +
        "Use $ for USD. If the data can't answer the question, say so plainly and suggest what to check. Plain markdown, no tables.",
      messages: [{ role: "user", content: `DATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}` }],
      abortSignal: req.signal,
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
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
    return json({ answer: text, summary: { revenue: context.totals.revenue, transactions: context.totals.transactions, branch: context.branch, period: context.period } });
  } catch (e: any) {
    console.error("branch-insights failed", e);
    return json({ error: e?.message || "Something went wrong." }, 500);
  }
});
