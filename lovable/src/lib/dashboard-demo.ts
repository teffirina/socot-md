// Presentation-only fixtures. Never written to company records.
export const demoMonths = [
  { label: "mai", name: "Mai", sales: 112, expenses: 86, profit: 26 },
  { label: "iun.", name: "Iunie", sales: 124, expenses: 91, profit: 33 },
  { label: "iul.", name: "Iulie", sales: 98, expenses: 88, profit: 10 },
  { label: "aug.", name: "August", sales: 105, expenses: 79, profit: 26 },
  { label: "sept.", name: "Septembrie", sales: 131, expenses: 95, profit: 36 },
  { label: "oct.", name: "Octombrie", sales: 142, expenses: 97, profit: 45 },
];
export const demoExpenses = [
  ["Salarii și contribuții", 4120000], ["Costul mărfurilor", 2860000],
  ["Chirie", 1200000], ["Utilități", 690000], ["Transport", 510000], ["Altele", 320000],
] as const;
export const demoDocuments = [
  { date: "15.10.2026", name: "Factură fiscală AA 0001427", partner: "[Client] SRL", accounts: "Dt 221 · Ct 611", amount: 600000, state: "Contabilizat" },
  { date: "14.10.2026", name: "Ordin de plată nr. 318", partner: "[Furnizor] SA", accounts: "Dt 521 · Ct 242", amount: -125000, state: "Verificat" },
  { date: "14.10.2026", name: "Bon de consum nr. 77", partner: "Depozit central", accounts: "Dt 714 · Ct 211", amount: 234080, state: "Ciornă" },
  { date: "02.10.2026", name: "Factură fiscală AA 0001398", partner: "[Client] SRL", accounts: "Dt 221 · Ct 611", amount: 1248000, state: "Restanță" },
];
export const dashboardMoney = (bani: number, currency = true) => {
  const absolute = Math.abs(bani);
  const whole = Math.floor(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${bani < 0 ? "−" : ""}${whole},${String(absolute % 100).padStart(2, "0")}${currency ? " MDL" : ""}`;
};
export const dashboardDate = (date: string) => date.split("-").reverse().join(".");