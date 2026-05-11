import { useMemo, useState } from "react";
import { useListBoxes, getListBoxesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, getMonth, getYear } from "date-fns";
import { Download, Search, TrendingUp, DollarSign, ShoppingCart, Calendar } from "lucide-react";
import * as XLSX from "xlsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CUSTODY_COLORS: Record<string, string> = { loan: "#f97316", owned: "#3b82f6" };
const BAR_COLOR = "#f97316";

function parseCost(cost: string | null | undefined): number {
  if (!cost) return 0;
  const n = parseFloat(cost);
  return isNaN(n) ? 0 : n;
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

export default function AcquisitionsPage() {
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());

  const { data: allBoxes, isLoading } = useListBoxes({}, {
    query: { queryKey: getListBoxesQueryKey({}) },
  });

  // Only boxes with a cost
  const costBoxes = useMemo(() => (allBoxes ?? []).filter(b => parseCost(b.cost) > 0), [allBoxes]);

  // Summary numbers
  const totalSpend = useMemo(() => costBoxes.reduce((s, b) => s + parseCost(b.cost), 0), [costBoxes]);
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth();

  const yearlySpend = useMemo(
    () => costBoxes.filter(b => getYear(new Date(b.createdAt)) === thisYear)
                   .reduce((s, b) => s + parseCost(b.cost), 0),
    [costBoxes, thisYear]
  );
  const monthlySpend = useMemo(
    () => costBoxes.filter(b => {
      const d = new Date(b.createdAt);
      return getYear(d) === thisYear && getMonth(d) === thisMonth;
    }).reduce((s, b) => s + parseCost(b.cost), 0),
    [costBoxes, thisYear, thisMonth]
  );

  // Monthly bar chart data for selected year
  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], spend: 0 }));
    costBoxes
      .filter(b => getYear(new Date(b.createdAt)) === yearFilter)
      .forEach(b => {
        const m = getMonth(new Date(b.createdAt));
        buckets[m].spend += parseCost(b.cost);
      });
    return buckets;
  }, [costBoxes, yearFilter]);

  // Custody type pie chart
  const custodyData = useMemo(() => {
    const map: Record<string, number> = { loan: 0, owned: 0, "—": 0 };
    costBoxes.forEach(b => {
      const key = b.custodyType ?? "—";
      map[key] = (map[key] ?? 0) + parseCost(b.cost);
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name === "loan" ? "On Loan" : name === "owned" ? "Owned" : "Unknown", value, raw: name }));
  }, [costBoxes]);

  // Available years for filter
  const years = useMemo(() => {
    const set = new Set<number>(costBoxes.map(b => getYear(new Date(b.createdAt))));
    if (!set.size) set.add(thisYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [costBoxes, thisYear]);

  // Filtered table rows
  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    return costBoxes.filter(b =>
      !q ||
      b.boxCode.toLowerCase().includes(q) ||
      b.clientName.toLowerCase().includes(q) ||
      (b.materialTypes ?? []).join(", ").toLowerCase().includes(q)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [costBoxes, search]);

  // Excel export
  function handleExport() {
    const rows = tableRows.map(b => ({
      "Box Code": b.boxCode,
      "Client":   b.clientName,
      "Type":     (b.materialTypes ?? []).join(", "),
      "Custody":  b.custodyType ?? "",
      "Status":   b.status,
      "Cost ($)": parseCost(b.cost),
      "Date":     format(new Date(b.createdAt), "yyyy-MM-dd"),
      "Notes":    b.notes ?? "",
    }));

    const summary = [
      {},
      { "Box Code": "SUMMARY" },
      { "Box Code": "Total All-Time", "Cost ($)": totalSpend },
      { "Box Code": `Total ${thisYear}`, "Cost ($)": yearlySpend },
      { "Box Code": `This Month (${MONTHS[thisMonth]} ${thisYear})`, "Cost ($)": monthlySpend },
    ];

    const ws = XLSX.utils.json_to_sheet([...rows, ...summary]);
    ws["!cols"] = [16, 24, 14, 12, 14, 12, 14, 30].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Acquisitions");
    XLSX.writeFile(wb, `acquisitions-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  return (
    <div className="space-y-6" data-testid="acquisitions-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Acquisitions</h1>
          <p className="text-sm text-muted-foreground mt-1">Track spending on loans and purchased items</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2" data-testid="button-export-excel">
          <Download size={15} />
          Export Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/40">
                <DollarSign size={18} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">All-Time Spend</p>
                <p className="text-xl font-bold text-foreground">{isLoading ? "…" : fmt(totalSpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40">
                <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">This Year ({thisYear})</p>
                <p className="text-xl font-bold text-foreground">{isLoading ? "…" : fmt(yearlySpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
                <Calendar size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">This Month ({MONTHS[thisMonth]})</p>
                <p className="text-xl font-bold text-foreground">{isLoading ? "…" : fmt(monthlySpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Monthly Spend</CardTitle>
            <div className="flex gap-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setYearFilter(y)}
                  className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                    yearFilter === y
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground bg-muted"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {costBoxes.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No cost data yet — add prices when creating boxes
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v === 0 ? "0" : `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "Spend"]}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="spend" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Custody pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Spend by Custody Type</CardTitle>
          </CardHeader>
          <CardContent>
            {custodyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm text-center">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={custodyData}
                    cx="50%"
                    cy="45%"
                    outerRadius={72}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {custodyData.map((entry, i) => (
                      <Cell key={i} fill={CUSTODY_COLORS[entry.raw] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart size={15} className="text-muted-foreground" />
            Items with Cost ({tableRows.length})
          </CardTitle>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              data-testid="input-search-acquisitions"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="[&_tr]:border-slate-200 dark:[&_tr]:border-slate-700">
              <TableRow className="bg-muted/30">
                <TableHead>Item Code</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Custody</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr]:border-slate-100 dark:[&_tr]:border-slate-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : tableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <ShoppingCart size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">
                      {search ? "No matching items" : "No items with cost yet — add a price when creating a box"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map(box => (
                  <TableRow key={box.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-sm font-medium">{box.boxCode}</TableCell>
                    <TableCell className="font-medium">{box.clientName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {box.collectionsOwner ?? "—"}
                    </TableCell>
                    <TableCell>
                      {box.custodyType ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          box.custodyType === "loan"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        }`}>
                          {box.custodyType === "loan" ? "On Loan" : "Owned"}
                        </span>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {box.status.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(box.createdAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {fmt(parseCost(box.cost))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {tableRows.length > 0 && (
            <div className="flex justify-end px-4 py-3 border-t border-border bg-muted/20">
              <span className="text-sm font-semibold text-foreground">
                Total: {fmt(tableRows.reduce((s, b) => s + parseCost(b.cost), 0))}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
