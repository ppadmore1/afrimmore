import { useState } from "react";
import { Input } from "@/components/ui/input";
import { getLrdRate, setLrdRate, fmtLrd, usdToLrd } from "@/lib/currency";

/** Split cash tender: customer may pay part in USD and part in LRD. */
export function DualCurrencyCash({ total, onUsdTotalChange }: { total: number; onUsdTotalChange: (usd: number) => void }) {
  const [usd, setUsd] = useState("");
  const [lrd, setLrd] = useState("");
  const [rate, setRate] = useState(getLrdRate());

  const update = (u: string, l: string, r: number) => {
    const sum = (parseFloat(u) || 0) + (parseFloat(l) || 0) / r;
    if (sum > 0) onUsdTotalChange(sum);
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/30 p-3">
      <div className="flex justify-between text-xs opacity-80">
        <span>Total in LRD: <b>{fmtLrd(usdToLrd(total, rate))}</b></span>
        <label className="flex items-center gap-1">
          1 USD =
          <input
            type="number"
            className="w-16 rounded bg-transparent border border-border/40 px-1 text-right"
            value={rate}
            onChange={(e) => {
              const r = parseFloat(e.target.value);
              if (r > 0) { setRate(r); setLrdRate(r); update(usd, lrd, r); }
            }}
          />
          LRD
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Cash USD $" value={usd}
          onChange={(e) => { setUsd(e.target.value); update(e.target.value, lrd, rate); }} />
        <Input type="number" placeholder="Cash LRD L$" value={lrd}
          onChange={(e) => { setLrd(e.target.value); update(usd, e.target.value, rate); }} />
      </div>
      <p className="text-[11px] opacity-70">Split payment: enter USD and/or LRD received.</p>
    </div>
  );
}
