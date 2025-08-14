// src/utils/date.js
export const fmtDate = (d) => new Date(d).toLocaleDateString();
export const todayStr = () => new Date().toISOString().slice(0, 10);

export function daysUntil(dateStr) {
  if (!dateStr) return NaN;
  const d = new Date(dateStr);
  const t = new Date();
  return Math.floor(
    (d - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000
  );
}
