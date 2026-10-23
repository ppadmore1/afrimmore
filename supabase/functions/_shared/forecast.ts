// Pure, deterministic inventory & profit calculations used by AI Insights.
// No imports so it runs in Deno (edge function), the browser and bun tests.

export const DEFAULT_LEAD_DAYS = 120;
export const DEFAULT_SAFETY_DAYS = 14;
export const DEFAULT_COVER_DAYS = 90; // stock a new order should cover after it arrives

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

export function landedUnitCost(purchase: string | number, freight: string | number, customs: string | number, transport: string | number): number {
  const n = (v: string | number) => Number(v) || 0;
  return r2(n(purchase) + n(freight) + n(customs) + n(transport));
}

export interface Incoming { qty: number; date: string | null } // confirmed POs only

export interface ForecastInput {
  onHand: number;          // stock on hand (all locations in scope)
  reserved?: number;       // committed to customers, not yet shipped
  inTransit?: number;      // dispatched branch transfers into scope
  incoming?: Incoming[];   // confirmed purchase order quantities still to arrive
  unitsSold: number;       // units sold in the history window
  historyDays: number;     // length of the history window
  inStockDays?: number;    // days in window the item had stock (stockout correction)
  leadDays?: number | null;
  safetyDays?: number | null;
  coverDays?: number;
  unitCost?: number;
  moq?: number | null;
  carton?: number | null;
  today?: Date;
}

export type Risk = "high" | "medium" | "low" | "none";

export interface ForecastResult {
  dailyRate: number; monthlyRate: number; leadDays: number; safetyDays: number;
  demandLead: number; safetyStock: number; reorderPoint: number;
  available: number; incomingQty: number; nextArrival: string | null;
  stockoutDate: string | null; projectedAtArrival: number;
  reorderDate: string | null; suggestQty: number; estCost: number;
  risk: Risk; reason: string; estimate: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function forecastItem(i: ForecastInput): ForecastResult {
  const today = i.today ?? new Date();
  const leadDays = i.leadDays && i.leadDays > 0 ? i.leadDays : DEFAULT_LEAD_DAYS;
  const safetyDays = i.safetyDays != null && i.safetyDays >= 0 ? i.safetyDays : DEFAULT_SAFETY_DAYS;
  const coverDays = i.coverDays ?? DEFAULT_COVER_DAYS;
  const effDays = Math.max(1, Math.min(i.historyDays, i.inStockDays ?? i.historyDays));
  const dailyRate = i.unitsSold > 0 ? i.unitsSold / effDays : 0;
  const incoming = (i.incoming || []).filter((x) => x.qty > 0);
  const incomingQty = incoming.reduce((s, x) => s + x.qty, 0);
  const onHandFree = Math.max(0, i.onHand - (i.reserved || 0));
  const pipeline = onHandFree + (i.inTransit || 0);
  const available = pipeline + incomingQty;
  const demandLead = dailyRate * leadDays;
  const safetyStock = dailyRate * safetyDays;
  const reorderPoint = demandLead + safetyStock;
  const dates = incoming.map((x) => x.date).filter(Boolean).sort() as string[];
  const nextArrival = dates[0] ?? null;

  // Day-by-day simulation of stock, crediting confirmed arrivals on their date.
  let stockoutDate: string | null = null;
  if (dailyRate > 0) {
    let stock = pipeline;
    const byDay = new Map<number, number>();
    for (const x of incoming) {
      const d = x.date ? Math.max(0, Math.ceil((new Date(x.date).getTime() - today.getTime()) / DAY)) : leadDays;
      byDay.set(d, (byDay.get(d) || 0) + x.qty);
    }
    for (let d = 1; d <= 730; d++) {
      stock += byDay.get(d) || 0;
      stock -= dailyRate;
      if (stock < 0) { stockoutDate = iso(new Date(today.getTime() + d * DAY)); break; }
    }
  }

  const projectedAtArrival = available - demandLead;
  let suggestQty = 0;
  if (dailyRate > 0 && available < reorderPoint + dailyRate * coverDays) {
    suggestQty = Math.ceil(reorderPoint + dailyRate * coverDays - available);
    if (i.moq && suggestQty < i.moq) suggestQty = i.moq;
    if (i.carton && i.carton > 1) suggestQty = Math.ceil(suggestQty / i.carton) * i.carton;
  }
  // Only recommend when stock would fall below the reorder point within the next 60 days.
  const daysUntilReorder = dailyRate > 0 ? (available - reorderPoint) / dailyRate : Infinity;
  if (daysUntilReorder > 60) suggestQty = 0;
  const reorderDate = dailyRate > 0 ? iso(new Date(today.getTime() + Math.max(0, Math.floor(daysUntilReorder)) * DAY)) : null;

  let risk: Risk = "none"; let reason = "No sales in the period, so no demand to forecast.";
  if (dailyRate > 0) {
    const daysToStockout = stockoutDate ? (new Date(stockoutDate).getTime() - today.getTime()) / DAY : Infinity;
    if (daysToStockout <= leadDays) { risk = "high"; reason = `Runs out in about ${Math.round(daysToStockout)} days — before a new order (${leadDays}-day lead time) could arrive.`; }
    else if (daysUntilReorder <= 30) { risk = "medium"; reason = `Stock reaches the reorder point within ${Math.max(0, Math.round(daysUntilReorder))} days.`; }
    else { risk = "low"; reason = "Stock and confirmed orders cover the lead time plus safety stock."; }
  }
  return {
    dailyRate: r2(dailyRate), monthlyRate: r2(dailyRate * 30), leadDays, safetyDays,
    demandLead: Math.round(demandLead), safetyStock: Math.round(safetyStock), reorderPoint: Math.round(reorderPoint),
    available, incomingQty, nextArrival, stockoutDate, projectedAtArrival: Math.round(projectedAtArrival),
    reorderDate, suggestQty, estCost: r2(suggestQty * (i.unitCost || 0)), risk, reason,
    estimate: i.historyDays < 60 || i.unitsSold < 10,
  };
}

export function grossProfit(revenue: number, units: number, unitCost: number | null | undefined) {
  if (unitCost == null || unitCost <= 0) return { profit: null as number | null, margin: null as number | null };
  const profit = r2(revenue - units * unitCost);
  return { profit, margin: revenue > 0 ? r2((profit / revenue) * 100) : null };
}

export interface BranchStock { branchId: string; branch: string; onHand: number; dailyRate: number }

/** Suggest moving surplus from slow branches to branches that will run short within the lead time. */
export function suggestTransfers(rows: BranchStock[], leadDays = DEFAULT_LEAD_DAYS, safetyDays = DEFAULT_SAFETY_DAYS) {
  const need = rows.map((r) => ({ ...r, gap: Math.ceil(r.dailyRate * (leadDays + safetyDays) - r.onHand) }));
  const short = need.filter((r) => r.gap > 0 && r.dailyRate > 0).sort((a, b) => b.gap - a.gap);
  const surplus = need.filter((r) => r.gap < 0).map((r) => ({ ...r, spare: Math.floor(-r.gap) })).sort((a, b) => b.spare - a.spare);
  const out: { from: string; to: string; qty: number }[] = [];
  for (const s of short) {
    let gap = s.gap;
    for (const p of surplus) {
      if (gap <= 0) break;
      if (p.spare <= 0 || p.branchId === s.branchId) continue;
      const qty = Math.min(gap, p.spare);
      out.push({ from: p.branch, to: s.branch, qty });
      p.spare -= qty; gap -= qty;
    }
  }
  return out;
}
