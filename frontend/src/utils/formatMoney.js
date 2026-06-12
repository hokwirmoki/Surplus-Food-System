export function formatMoney(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
}

export function formatUGX(value) {
  return `${formatMoney(value)} UGX`;
}
