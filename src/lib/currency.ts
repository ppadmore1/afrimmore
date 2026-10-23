const KEY = "afrimmore_usd_lrd_rate";
export const DEFAULT_LRD_RATE = 195;

export function getLrdRate(): number {
  const v = parseFloat(localStorage.getItem(KEY) || "");
  return v > 0 ? v : DEFAULT_LRD_RATE;
}
export function setLrdRate(rate: number) {
  if (rate > 0) localStorage.setItem(KEY, String(rate));
}
export const usdToLrd = (usd: number, rate = getLrdRate()) => usd * rate;
export const lrdToUsd = (lrd: number, rate = getLrdRate()) => lrd / rate;
export const fmtLrd = (n: number) => `L$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
