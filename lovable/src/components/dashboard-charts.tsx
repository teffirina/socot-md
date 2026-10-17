import { demoExpenses, demoMonths, dashboardMoney } from "@/lib/dashboard-demo";

export function DashboardCharts() {
  return <div className="flex flex-wrap gap-5">
    <section className="dashboard-panel min-w-0 flex-[999_1_520px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2>Venituri și cheltuieli</h2><p className="mt-1 text-xs text-muted-foreground">Mai – octombrie 2026, mii MDL · octombrie până la 17.10</p></div>
        <div><p className="eyebrow">Rezultat · octombrie</p><p className="mt-1 font-display text-[22px] font-semibold tabular">45 000,00 MDL</p></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-chart-1"/>Venituri · Ct 611</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-chart-2"/>Cheltuieli · Ct 711–714</span></div>
      <svg className="mt-4 h-[220px] w-full overflow-visible font-mono text-[11px]" viewBox="0 0 570 220" role="img" aria-label="Venituri și cheltuieli, mii MDL: mai 112 și 86; iunie 124 și 91; iulie 98 și 88; august 105 și 79; septembrie 131 și 95; octombrie 142 și 97.">
        {[0,40,80,120,160].map(v => <g key={v}><line x1="32" x2="565" y1={190-v} y2={190-v} className={v === 0 ? "stroke-chart-5" : "stroke-chart-4"}/><text x="22" y={194-v} textAnchor="end" className="fill-muted-foreground">{v}</text></g>)}
        {demoMonths.map((m,i) => <g key={m.label}><rect x={59+i*85} y={190-m.sales} width="18" height={m.sales} rx="4" className="fill-chart-1 chart-bar" tabIndex={0}><title>{m.name} · venituri {dashboardMoney(m.sales*100000)}</title></rect><rect x={79+i*85} y={190-m.expenses} width="18" height={m.expenses} rx="4" className="fill-chart-2 chart-bar" tabIndex={0}><title>{m.name} · cheltuieli {dashboardMoney(m.expenses*100000)}</title></rect><text x={78+i*85} y="214" textAnchor="middle" className={`fill-muted-foreground ${i===5 ? "font-semibold" : ""}`}>{m.label}</text>{i===5 && <text x={78+i*85} y={180-m.sales} textAnchor="middle" className="fill-foreground">142 · 97</text>}</g>)}
      </svg>
      <div className="mt-3 rounded-xl bg-highlight p-4">
        <div className="flex flex-wrap justify-between gap-2 text-xs"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-chart-3"/>Profit, mii MDL</span><span className="font-medium">Total pe 6 luni: 176 000,00 MDL</span></div>
        <svg className="mt-3 h-[126px] w-full font-mono text-[11px]" viewBox="0 0 570 126" role="img" aria-label="Profit, mii MDL: mai 26, iunie 33, iulie 10, august 26, septembrie 36, octombrie 45. Total 176 000 MDL.">
          {[0,25,50].map(v => <g key={v}><line x1="32" x2="565" y1={102-v*1.5} y2={102-v*1.5} className="stroke-highlight-border"/><text x="22" y={106-v*1.5} textAnchor="end" className="fill-muted-foreground">{v}</text></g>)}
          {demoMonths.map((m,i) => <g key={m.label}><rect x={59+i*85} y={102-m.profit*1.5} width="38" height={m.profit*1.5} rx="4" className="fill-chart-3 chart-bar" tabIndex={0}><title>{m.name} · profit {dashboardMoney(m.profit*100000)}</title></rect><text x={78+i*85} y={95-m.profit*1.5} textAnchor="middle" className="fill-foreground">{m.profit}</text><text x={78+i*85} y="123" textAnchor="middle" className={`fill-muted-foreground ${i===5 ? "font-semibold" : ""}`}>{m.label}</text></g>)}
        </svg>
      </div>
    </section>
    <section className="dashboard-panel min-w-0 flex-[1_1_280px]">
      <h2>Structura cheltuielilor</h2><p className="mt-1 text-xs text-muted-foreground">Octombrie 2026 · total 97 000,00 MDL</p>
      <div className="mt-7 space-y-6" role="img" aria-label={demoExpenses.map(([n,v])=>`${n}: ${dashboardMoney(v)}`).join("; ")}>
        {demoExpenses.map(([name,value]) => <div key={name}><div className="mb-2 flex flex-wrap justify-between gap-2 text-[13px]"><span>{name}</span><span className="font-mono text-xs tabular">{dashboardMoney(value,false)}</span></div><svg viewBox="0 0 412 10" className="h-2.5 w-full" preserveAspectRatio="none" aria-hidden="true"><rect width="412" height="10" rx="5" className="fill-chart-4"/><rect width={value/10000} height="10" rx="5" className="fill-chart-1"/></svg></div>)}
      </div>
    </section>
  </div>;
}