import { describe, expect, test } from "bun:test";
import { forecastItem, grossProfit, landedUnitCost, suggestTransfers } from "./forecast";

const today = new Date("2026-10-23T00:00:00Z");

describe("landed cost & profit", () => {
  test("laptop: $400 + $35 freight + $12 customs + $3 transport = $450", () => {
    expect(landedUnitCost(400, 35, 12, 3)).toBe(450);
  });
  test("10 laptops sold at $600 with $450 landed cost = $1,500 profit, 25% margin", () => {
    expect(grossProfit(6000, 10, 450)).toEqual({ profit: 1500, margin: 25 });
  });
  test("missing cost gives no profit instead of a made-up one", () => {
    expect(grossProfit(6000, 10, null).profit).toBeNull();
  });
});

describe("120-day forecast", () => {
  test("defaults to a 120-day lead time", () => {
    expect(forecastItem({ onHand: 0, unitsSold: 0, historyDays: 30, today }).leadDays).toBe(120);
  });
  test("1 unit/day with 50 on hand is high risk and runs out on day 51", () => {
    const f = forecastItem({ onHand: 50, unitsSold: 30, historyDays: 30, today, unitCost: 450 });
    expect(f.risk).toBe("high");
    expect(f.stockoutDate).toBe("2026-12-13");
    expect(f.reorderPoint).toBe(134); // 120 + 14 safety
    expect(f.suggestQty).toBe(174);   // 134 + 90 cover - 50
    expect(f.estCost).toBe(78300);
  });
  test("no purchase when stock is sufficient", () => {
    const f = forecastItem({ onHand: 1000, unitsSold: 30, historyDays: 30, today });
    expect(f.suggestQty).toBe(0);
    expect(f.risk).toBe("low");
  });
  test("confirmed incoming orders reduce the suggestion", () => {
    const f = forecastItem({ onHand: 50, unitsSold: 30, historyDays: 30, today, incoming: [{ qty: 100, date: "2026-11-30" }] });
    expect(f.suggestQty).toBe(74);
  });
  test("reserved stock is not counted as available", () => {
    expect(forecastItem({ onHand: 50, reserved: 20, unitsSold: 30, historyDays: 30, today }).available).toBe(30);
  });
  test("stockout days don't understate demand", () => {
    expect(forecastItem({ onHand: 0, unitsSold: 30, historyDays: 60, inStockDays: 30, today }).dailyRate).toBe(1);
  });
  test("rounds up to supplier minimum order and carton size", () => {
    const f = forecastItem({ onHand: 50, unitsSold: 30, historyDays: 30, today, moq: 200, carton: 24 });
    expect(f.suggestQty).toBe(216);
  });
});

test("transfers surplus from a slow branch before importing", () => {
  const t = suggestTransfers([
    { branchId: "a", branch: "Main", onHand: 10, dailyRate: 1 },
    { branchId: "b", branch: "Gardnersville", onHand: 300, dailyRate: 0.1 },
  ]);
  expect(t).toEqual([{ from: "Gardnersville", to: "Main", qty: 124 }]);
});
