import { useMemo, useState } from "react";
import { useListBoxes, getListBoxesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, getMonth, getYear } from "date-fns";
import { Download, Search, TrendingUp, Banknote, ShoppingCart, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const CUSTODY_COLORS: Record<string, string> = { loan: "#f97316", owned: "#3b82f6" };
const BAR_COLOR = "#f97316";

const MATERIAL_LABELS: Record<string, string> = {
  newspaper: "Newspaper", maps: "Maps", books: "Books",
  magazine: "Magazine", archives: "Archives", heritage_items: "Heritage Items",
};
const CUSTODY_LABELS: Record<string, string> = { ptad: "PTAD", loan: "On Loan", project: "Project" };
const STATUS_LABELS: Record<string, string> = {
  received: "Received", in_progress: "In Progress",
  completed: "Completed", returned: "Returned",
};

const COL_WIDTHS = [16, 26, 22, 12, 28, 14, 14, 20, 32].map(w => ({ wch: w }));

type BoxItem = {
  id: number; boxCode: string; clientName: string; collectionsOwner?: string | null;
  custodyType?: string | null; materialTypes?: string[] | null; status: string;
  inDate?: string | null; cost?: string | null; notes?: string | null; createdAt: string;
};

type ExcelRow = Record<string, string>;

const EMPTY_ROW: ExcelRow = {
  "Box Code": "", "Project Name": "", "Collections Owner": "",
  "Custody Type": "", "Material Types": "", "Status": "",
  "Date In": "", "Cost (Rp)": "", "Notes": "",
};

function parseCost(cost: string | null | undefined): number {
  if (!cost) return 0;
  const n = parseFloat(cost);
  return isNaN(n) ? 0 : n;
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

/** Use inDate if set (when the item was physically acquired), otherwise fall back to createdAt */
function getAcquisitionDate(b: BoxItem): Date {
  return new Date(b.inDate ?? b.createdAt);
}

function boxToRow(b: BoxItem): ExcelRow {
  return {
    "Box Code":          b.boxCode,
    "Project Name":      b.clientName,
    "Collections Owner": b.collectionsOwner ?? "",
    "Custody Type":      b.custodyType ? (CUSTODY_LABELS[b.custodyType] ?? b.custodyType) : "",
    "Material Types":    (b.materialTypes ?? []).map(m => MATERIAL_LABELS[m] ?? m).join(", "),
    "Status":            STATUS_LABELS[b.status] ?? b.status,
    "Date In":           b.inDate ? format(new Date(b.inDate), "d MMM yyyy") : "",
    "Cost (Rp)":         fmt(parseCost(b.cost)),
    "Notes":             b.notes ?? "",
  };
}

function sectionRow(label: string): ExcelRow {
  return { ...EMPTY_ROW, "Box Code": label };
}

function totalRow(label: string, amount: number): ExcelRow {
  return { ...EMPTY_ROW, "Box Code": label, "Cost (Rp)": fmt(amount) };
}

function makeSheet(rows: ExcelRow[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = COL_WIDTHS;
  return ws;
}

function buildMonthSheet(boxes: BoxItem[], month: number, year: number): XLSX.WorkSheet {
  const items = boxes.filter(b => {
    const d = getAcquisitionDate(b);
    return getYear(d) === year && getMonth(d) === month;
  });
  const total = items.reduce((s, b) => s + parseCost(b.cost), 0);
  return makeSheet([
    ...items.map(boxToRow),
    EMPTY_ROW,
    totalRow(`TOTAL — ${MONTHS_FULL[month]} ${year}`, total),
  ]);
}

function buildYearSheet(boxes: BoxItem[], year: number): XLSX.WorkSheet {
  const yearItems = boxes.filter(b => getYear(getAcquisitionDate(b)) === year);
  const rows: ExcelRow[] = [];
  let grandTotal = 0;

  for (let m = 0; m < 12; m++) {
    const monthItems = yearItems.filter(b => getMonth(getAcquisitionDate(b)) === m);
    if (monthItems.length === 0) continue;
    const monthTotal = monthItems.reduce((s, b) => s + parseCost(b.cost), 0);
    grandTotal += monthTotal;
    rows.push(sectionRow(`── ${MONTHS_FULL[m]} ${year} ──`));
    monthItems.forEach(b => rows.push(boxToRow(b)));
    rows.push(totalRow(`  Subtotal ${MONTHS_FULL[m]}`, monthTotal));
    rows.push(EMPTY_ROW);
  }

  rows.push(totalRow(`GRAND TOTAL ${year}`, grandTotal));
  return makeSheet(rows);
}

export default function CollectionsCostPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());

  const [exportOpen, setExportOpen] = useState(false);
  const [exportType, setExportType] = useState<"monthly" | "yearly" | "alltime">("alltime");
  const [exportYear, setExportYear] = useState<string>(String(new Date().getFullYear()));
  // Empty set = all months; populated set = specific months selected
  const [exportMonths, setExportMonths] = useState<Set<number>>(new Set());

  const { data: allBoxes, isLoading } = useListBoxes({}, {
    query: { queryKey: getListBoxesQueryKey({}) },
  });

  const costBoxes = useMemo(() => (allBoxes ?? []).filter(b => parseCost(b.cost) > 0), [allBoxes]);

  const totalSpend = useMemo(() => costBoxes.reduce((s, b) => s + parseCost(b.cost), 0), [costBoxes]);
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth();

  const yearlySpend = useMemo(
    () => costBoxes.filter(b => getYear(getAcquisitionDate(b)) === thisYear)
                   .reduce((s, b) => s + parseCost(b.cost), 0),
    [costBoxes, thisYear]
  );
  const monthlySpend = useMemo(
    () => costBoxes.filter(b => {
      const d = getAcquisitionDate(b);
      return getYear(d) === thisYear && getMonth(d) === thisMonth;
    }).reduce((s, b) => s + parseCost(b.cost), 0),
    [costBoxes, thisYear, thisMonth]
  );

  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], spend: 0 }));
    costBoxes
      .filter(b => getYear(getAcquisitionDate(b)) === yearFilter)
      .forEach(b => {
        const m = getMonth(getAcquisitionDate(b));
        buckets[m].spend += parseCost(b.cost);
      });
    return buckets;
  }, [costBoxes, yearFilter]);

  const custodyData = useMemo(() => {
    const map: Record<string, number> = { loan: 0, owned: 0, "—": 0 };
    costBoxes.forEach(b => {
      const key = b.custodyType ?? "—";
      map[key] = (map[key] ?? 0) + parseCost(b.cost);
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: CUSTODY_LABELS[name] ?? name, value, raw: name }));
  }, [costBoxes]);

  const years = useMemo(() => {
    const set = new Set<number>(costBoxes.map(b => getYear(getAcquisitionDate(b))));
    if (!set.size) set.add(thisYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [costBoxes, thisYear]);

  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    return costBoxes.filter(b =>
      !q ||
      b.boxCode.toLowerCase().includes(q) ||
      b.clientName.toLowerCase().includes(q) ||
      (b.materialTypes ?? []).join(", ").toLowerCase().includes(q)
    ).sort((a, b) => getAcquisitionDate(b).getTime() - getAcquisitionDate(a).getTime());
  }, [costBoxes, search]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleMonth(m: number) {
    setExportMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  function runExport() {
    const wb = XLSX.utils.book_new();
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const yr = parseInt(exportYear);

    if (exportType === "monthly") {
      // Determine which months to export: empty = all
      const monthsToExport = exportMonths.size === 0
        ? Array.from({ length: 12 }, (_, i) => i)
        : Array.from(exportMonths).sort((a, b) => a - b);

      const summaryRows: ExcelRow[] = [
        sectionRow(`Monthly Report — ${yr}`),
        EMPTY_ROW,
        { ...EMPTY_ROW, "Box Code": "Month", "Cost (Rp)": "Total Spend" },
      ];
      let hasAny = false;

      for (const m of monthsToExport) {
        const items = costBoxes.filter(b => {
          const d = getAcquisitionDate(b);
          return getYear(d) === yr && getMonth(d) === m;
        });
        if (items.length === 0) continue;
        hasAny = true;
        const ws = buildMonthSheet(costBoxes, m, yr);
        XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[m]} ${yr}`);
        const monthTotal = items.reduce((s, b) => s + parseCost(b.cost), 0);
        summaryRows.push({ ...EMPTY_ROW, "Box Code": `${MONTHS_FULL[m]} ${yr}`, "Cost (Rp)": fmt(monthTotal) });
      }

      if (!hasAny) {
        XLSX.utils.book_append_sheet(wb, makeSheet([sectionRow(`No data for selected period`)]), "No Data");
      } else {
        const selectionTotal = costBoxes
          .filter(b => {
            const d = getAcquisitionDate(b);
            return getYear(d) === yr && monthsToExport.includes(getMonth(d));
          })
          .reduce((s, b) => s + parseCost(b.cost), 0);
        summaryRows.push(EMPTY_ROW);
        summaryRows.push(totalRow("TOTAL (selected months)", selectionTotal));
        XLSX.utils.book_append_sheet(wb, makeSheet(summaryRows), `Summary ${yr}`);
      }

      const suffix = exportMonths.size === 0 ? "all-months"
        : Array.from(exportMonths).sort((a, b) => a - b).map(m => MONTHS[m].toLowerCase()).join("-");
      XLSX.writeFile(wb, `acquisitions-monthly-${yr}-${suffix}-${dateStr}.xlsx`);

    } else if (exportType === "yearly") {
      const summaryRows: ExcelRow[] = [
        sectionRow(`Yearly Report — ${yr}`),
        EMPTY_ROW,
        { ...EMPTY_ROW, "Box Code": "Month", "Cost (Rp)": "Total Spend" },
      ];
      let grandTotal = 0;
      for (let m = 0; m < 12; m++) {
        const items = costBoxes.filter(b => {
          const d = getAcquisitionDate(b);
          return getYear(d) === yr && getMonth(d) === m;
        });
        if (items.length === 0) continue;
        const ws = buildMonthSheet(costBoxes, m, yr);
        XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[m]} ${yr}`);
        const monthTotal = items.reduce((s, b) => s + parseCost(b.cost), 0);
        grandTotal += monthTotal;
        summaryRows.push({ ...EMPTY_ROW, "Box Code": `${MONTHS_FULL[m]} ${yr}`, "Cost (Rp)": fmt(monthTotal) });
      }
      summaryRows.push(EMPTY_ROW);
      summaryRows.push(totalRow(`GRAND TOTAL ${yr}`, grandTotal));
      XLSX.utils.book_append_sheet(wb, makeSheet(summaryRows), `Summary ${yr}`);
      XLSX.writeFile(wb, `acquisitions-yearly-${yr}-${dateStr}.xlsx`);

    } else {
      const summaryRows: ExcelRow[] = [
        sectionRow("All-Time Summary"),
        EMPTY_ROW,
        { ...EMPTY_ROW, "Box Code": "Year", "Cost (Rp)": "Total Spend" },
      ];
      const sortedYears = [...years].sort((a, b) => a - b);
      for (const y of sortedYears) {
        const ws = buildYearSheet(costBoxes, y);
        XLSX.utils.book_append_sheet(wb, ws, String(y));
        const yrTotal = costBoxes.filter(b => getYear(getAcquisitionDate(b)) === y)
                                 .reduce((s, b) => s + parseCost(b.cost), 0);
        summaryRows.push({ ...EMPTY_ROW, "Box Code": String(y), "Cost (Rp)": fmt(yrTotal) });
      }
      summaryRows.push(EMPTY_ROW);
      summaryRows.push(totalRow("ALL-TIME TOTAL", totalSpend));
      XLSX.utils.book_append_sheet(wb, makeSheet(summaryRows), "Summary");
      XLSX.writeFile(wb, `acquisitions-alltime-${dateStr}.xlsx`);
    }

    setExportOpen(false);
  }

  return (
    <div className="space-y-6" data-testid="acquisitions-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Collections Cost</h1>
          <p className="text-sm text-muted-foreground mt-1">Track spending on loans and purchased items</p>
        </div>
        <Button onClick={() => setExportOpen(true)} variant="outline" className="gap-2" data-testid="button-export-excel">
          <Download size={15} />
          Export Excel
        </Button>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={open => { setExportOpen(open); if (!open) setExportMonths(new Set()); }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Export Report</DialogTitle>
            <DialogDescription className="sr-only">Choose a report type and options, then click Download.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <RadioGroup
              value={exportType}
              onValueChange={v => { setExportType(v as typeof exportType); setExportMonths(new Set()); }}
              className="space-y-2"
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors">
                <RadioGroupItem value="monthly" id="exp-monthly" className="mt-0.5" />
                <Label htmlFor="exp-monthly" className="cursor-pointer">
                  <span className="font-medium text-sm">Monthly Report</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Select one or more months — each gets its own sheet</p>
                </Label>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors">
                <RadioGroupItem value="yearly" id="exp-yearly" className="mt-0.5" />
                <Label htmlFor="exp-yearly" className="cursor-pointer">
                  <span className="font-medium text-sm">Yearly Report</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Items grouped by month with subtotals and grand total</p>
                </Label>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors">
                <RadioGroupItem value="alltime" id="exp-alltime" className="mt-0.5" />
                <Label htmlFor="exp-alltime" className="cursor-pointer">
                  <span className="font-medium text-sm">All-Time Report</span>
                  <p className="text-xs text-muted-foreground mt-0.5">One tab per year + Summary sheet with year totals</p>
                </Label>
              </div>
            </RadioGroup>

            {exportType !== "alltime" && (
              <div className="space-y-3 pt-1 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year</Label>
                  <Select value={exportYear} onValueChange={setExportYear}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {exportType === "monthly" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Months
                        {exportMonths.size > 0 && (
                          <span className="ml-1.5 normal-case font-normal">({exportMonths.size} selected)</span>
                        )}
                      </Label>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setExportMonths(new Set())}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          All
                        </button>
                        <span className="text-muted-foreground text-xs">·</span>
                        <button
                          onClick={() => setExportMonths(new Set(Array.from({ length: 12 }, (_, i) => i)))}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {MONTHS.map((name, i) => (
                        <button
                          key={i}
                          onClick={() => toggleMonth(i)}
                          className={`text-xs py-1.5 rounded-md font-medium border transition-colors ${
                            exportMonths.size === 0 || exportMonths.has(i)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {exportMonths.size === 0 ? "All months will be exported" : "Only highlighted months will be exported"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={runExport} className="gap-2">
              <Download size={14} />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/40">
                <Banknote size={18} className="text-orange-600 dark:text-orange-400" />
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
                    tickFormatter={v => v === 0 ? "0" : `Rp${(v / 1_000_000).toFixed(0)}jt`}
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
              onChange={e => { setSearch(e.target.value); setPage(1); }}
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
                <TableHead>Date In</TableHead>
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
                pagedRows.map(box => (
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
                          {CUSTODY_LABELS[box.custodyType] ?? box.custodyType}
                        </span>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {box.status.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {box.inDate
                        ? format(new Date(box.inDate), "d MMM yyyy")
                        : format(new Date(box.createdAt), "d MMM yyyy")}
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
            <>
              {/* Pagination controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={v => { setPageSize(Number(v)); setPage(1); }}
                  >
                    <SelectTrigger className="h-7 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[12, 25, 50, 100].map(n => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, tableRows.length)} of {tableRows.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft size={13} />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <Button key={p} variant={p === safePage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(p as number)}>
                          {p}
                        </Button>
                      )
                    )}
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                    <ChevronRight size={13} />
                  </Button>
                </div>
              </div>
              {/* Total footer */}
              <div className="flex justify-end px-4 py-3 border-t border-border">
                <span className="text-sm font-semibold text-foreground">
                  Total: {fmt(tableRows.reduce((s, b) => s + parseCost(b.cost), 0))}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
