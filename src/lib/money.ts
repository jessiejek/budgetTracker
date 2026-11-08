export const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthKey = (date: string) => date.slice(0, 7) + "-01";
export function parseAmount(value: string): number {
  const n = Number(value);
  if (
    !/^\d+(\.\d{1,2})?$/.test(value) ||
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 999999999.99
  )
    throw new Error(
      "Enter an amount between ₱0.01 and ₱999,999,999.99 (up to 2 decimal places).",
    );
  return Math.round(n * 100) / 100;
}
