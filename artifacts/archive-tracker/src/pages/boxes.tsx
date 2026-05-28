import { useState } from "react";
import { useLocation } from "wouter";
import { useListBoxes, useDeleteBox, getListBoxesQueryKey } from "@workspace/api-client-react";
import type { Box } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BoxStatusBadge } from "@/components/status-badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, Clock, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";
import { STEP_LABELS, STEP_COLORS } from "@/lib/steps";
import { useAuth } from "@/contexts/auth";
import * as XLSX from "xlsx";

type ExportFilter = "all" | "owned" | "loan";

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  in_progress: "In Progress",
  completed: "Completed",
  returned: "Returned",
};

const CUSTODY_LABELS: Record<string, string> = {
  owned: "Owned",
  loan: "On Loan",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 — Very Urgent",
  P1: "P1 — Urgent",
  P2: "P2 — Medium",
  P3: "P3 — Low",
};

const MATERIAL_LABELS: Record<string, string> = {
  newspaper: "Newspaper",
  maps: "Maps",
  books: "Books",
  magazine: "Magazine",
  archives: "Archives",
  heritage_items: "Heritage Items",
};

function formatDate(val: string | null | undefined) {
  if (!val) return "";
  try { return format(new Date(val), "d MMM yyyy"); } catch { return val; }
}

function formatRupiah(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const n = parseFloat(String(val));
  if (isNaN(n)) return String(val);
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function boxToRow(box: Box) {
  return {
    "Box Code": box.boxCode,
    "Custody Type": box.custodyType ? (CUSTODY_LABELS[box.custodyType] ?? box.custodyType) : "",
    "Project Name": box.clientName,
    "Collections Owner": box.collectionsOwner ?? "",
    "Place of Origin": box.placeOfOrigin ?? "",
    "Depot PTAD (Location)": box.location ?? "",
    "Archive Year": box.archiveYear ?? "",
    "Total Items": box.totalItems ?? "",
    "Material Types": (box.materialTypes ?? []).map(m => MATERIAL_LABELS[m] ?? m).join(", "),
    "Priority": box.priority ? (PRIORITY_LABELS[box.priority] ?? box.priority) : "",
    "Description": box.description ?? "",
    "Notes": box.notes ?? "",
    "Date In": formatDate(box.inDate),
    "Deadline": formatDate(box.deadline),
    "Date Out": formatDate(box.outDate),
    "Cost": box.cost ? formatRupiah(box.cost) : "",
  };
}

function exportToExcel(boxes: Box[], filter: ExportFilter) {
  const filtered = filter === "owned"
    ? boxes.filter(b => b.custodyType === "owned")
    : filter === "loan"
    ? boxes.filter(b => b.custodyType === "loan")
    : boxes;

  const rows = filtered.map(boxToRow);

  // Blank separator row then total cost row at the bottom
  const totalCost = filtered.reduce((sum, b) => {
    const n = parseFloat(b.cost ?? "");
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const emptyRow: Record<string, string | number> = {};
  Object.keys(rows[0] ?? {}).forEach(k => { emptyRow[k] = ""; });

  const totalRow: Record<string, string | number> = {};
  Object.keys(rows[0] ?? {}).forEach(k => { totalRow[k] = ""; });
  totalRow["Box Code"] = "TOTAL";
  totalRow["Cost"] = formatRupiah(totalCost);

  const ws = XLSX.utils.json_to_sheet([...rows, emptyRow, totalRow]);

  // Auto-fit column widths
  const allRows = [...rows, totalRow];
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...allRows.map(r => String(r[key as keyof typeof r] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  const sheetName = filter === "owned" ? "Owned Boxes" : filter === "loan" ? "Loan Boxes" : "All Boxes";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const suffix = filter === "owned" ? "_owned" : filter === "loan" ? "_loan" : "_all";
  const dateStr = format(new Date(), "yyyy-MM-dd");
  XLSX.writeFile(wb, `arciflow_boxes${suffix}_${dateStr}.xlsx`);
}

function getDeadlineStatus(deadline: Date | string | null | undefined, boxStatus: string) {
  if (!deadline || boxStatus === "completed" || boxStatus === "returned") return null;
  const d = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = differenceInCalendarDays(d, today);
  if (diffDays < 0) return { type: "overdue", label: `${Math.abs(diffDays)}d overdue`, days: diffDays };
  if (diffDays === 0) return { type: "today", label: "Due today", days: 0 };
  if (diffDays <= 3) return { type: "soon", label: `Due in ${diffDays}d`, days: diffDays };
  return { type: "ok", label: format(d, "d MMM yyyy"), days: diffDays };
}

function DeadlineBadge({ deadline, boxStatus }: { deadline?: string | null; boxStatus: string }) {
  const status = getDeadlineStatus(deadline, boxStatus);
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;
  if (status.type === "overdue") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
      <AlertTriangle size={10} /> {status.label}
    </span>
  );
  if (status.type === "today") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
      <Clock size={10} /> {status.label}
    </span>
  );
  if (status.type === "soon") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
      <Clock size={10} /> {status.label}
    </span>
  );
  return <span className="text-muted-foreground text-sm">{status.label}</span>;
}

type TabKey = "active" | "completed" | "returned" | "all";

export default function BoxesPage() {
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("active");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Always fetch all boxes; filter client-side so tab counts are always accurate
  const params = { search: search || undefined };
  const { data: allBoxes, isLoading } = useListBoxes(params, {
    query: { queryKey: getListBoxesQueryKey(params) },
  });

  const deleteMutation = useDeleteBox({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBoxesQueryKey() });
        toast({ title: "Box deleted successfully" });
        setDeleteId(null);
      },
      onError: () => {
        toast({ title: "Failed to delete box", variant: "destructive" });
      },
    },
  });

  // Counts per tab (always across full result set)
  const activeBoxes   = allBoxes?.filter(b => b.status === "received" || b.status === "in_progress") ?? [];
  const completedBoxes = allBoxes?.filter(b => b.status === "completed") ?? [];
  const returnedBoxes  = allBoxes?.filter(b => b.status === "returned") ?? [];

  const boxes = tab === "active"    ? activeBoxes
              : tab === "completed" ? completedBoxes
              : tab === "returned"  ? returnedBoxes
              : allBoxes ?? [];

  // Deadline alerts (active boxes only)
  const overdueBoxes = activeBoxes.filter(b => {
    const s = getDeadlineStatus(b.deadline, b.status);
    return s?.type === "overdue" || s?.type === "today";
  });
  const dueSoonBoxes = activeBoxes.filter(b => {
    const s = getDeadlineStatus(b.deadline, b.status);
    return s?.type === "soon";
  });

  const tabs: { key: TabKey; label: string; count: number; color?: string }[] = [
    { key: "active",    label: "Active",    count: activeBoxes.length },
    { key: "completed", label: "Completed (Owned)", count: completedBoxes.length, color: "text-emerald-600" },
    { key: "returned",  label: "Returned (Loan)",  count: returnedBoxes.length,  color: "text-slate-500" },
    { key: "all",       label: "All",       count: allBoxes?.length ?? 0 },
  ];

  return (
    <div className="space-y-5" data-testid="boxes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Archive Boxes</h1>
          <p className="text-sm text-muted-foreground mt-1">{allBoxes?.length ?? 0} boxes total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown — visible to all logged-in users */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoading || !allBoxes?.length}>
                <Download size={15} className="mr-2" />
                Export Excel
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Choose what to export
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportToExcel(allBoxes ?? [], "all")}>
                All Boxes
                <span className="ml-auto text-xs text-muted-foreground">{allBoxes?.length ?? 0}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(allBoxes ?? [], "owned")}>
                Owned Only
                <span className="ml-auto text-xs text-muted-foreground">
                  {allBoxes?.filter(b => b.custodyType === "owned").length ?? 0}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(allBoxes ?? [], "loan")}>
                On Loan Only
                <span className="ml-auto text-xs text-muted-foreground">
                  {allBoxes?.filter(b => b.custodyType === "loan").length ?? 0}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <Button onClick={() => navigate("/boxes/new")} data-testid="button-new-box">
              <Plus size={16} className="mr-2" />
              New Box
            </Button>
          )}
        </div>
      </div>

      {/* Deadline Alerts (active only) */}
      {!isLoading && (overdueBoxes.length > 0 || dueSoonBoxes.length > 0) && (
        <div className="space-y-2">
          {overdueBoxes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span className="text-sm font-medium">
                {overdueBoxes.length} box{overdueBoxes.length > 1 ? "es are" : " is"} past deadline:{" "}
                {overdueBoxes.map(b => b.boxCode).join(", ")}
              </span>
            </div>
          )}
          {dueSoonBoxes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
              <Clock size={16} className="flex-shrink-0" />
              <span className="text-sm font-medium">
                {dueSoonBoxes.length} box{dueSoonBoxes.length > 1 ? "es are" : " is"} due within 3 days:{" "}
                {dueSoonBoxes.map(b => b.boxCode).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                tab === t.key
                  ? t.color ?? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              } ${tab === t.key && t.count > 0 ? "bg-primary/10 text-primary" : ""}`}>
                {isLoading ? "—" : t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search boxes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader className="[&_tr]:border-slate-200 dark:[&_tr]:border-slate-700">
            <TableRow className="bg-muted/30">
              <TableHead>Item Code</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Current Step</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-slate-100 dark:[&_tr]:border-slate-800">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : boxes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p>
                    {tab === "completed" ? "No completed boxes yet" :
                     tab === "returned"  ? "No returned boxes yet" :
                     tab === "active"    ? "No active boxes" :
                     "No boxes found"}
                  </p>
                  {tab === "active" && isAdmin && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/boxes/new")}>
                      Add your first box
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              boxes.map(box => {
                const deadlineStatus = getDeadlineStatus(box.deadline, box.status);
                const isUrgent = deadlineStatus?.type === "overdue" || deadlineStatus?.type === "today";
                return (
                  <TableRow
                    key={box.id}
                    className={`cursor-pointer hover:bg-muted/20 ${isUrgent ? "bg-red-50/50 dark:bg-red-950/25" : ""}`}
                    data-testid={`row-box-${box.id}`}
                    onClick={() => navigate(`/boxes/${box.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium text-foreground">{box.boxCode}</TableCell>
                    <TableCell className="font-medium">{box.clientName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {box.collectionsOwner ?? "—"}
                    </TableCell>
                    <TableCell>
                      {box.priority ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          box.priority === "P0" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                          box.priority === "P1" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" :
                          box.priority === "P2" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" :
                          "bg-muted text-muted-foreground"
                        }`}>{box.priority}</span>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STEP_COLORS[box.currentStep] ?? "bg-muted text-muted-foreground"}`}>
                        {STEP_LABELS[box.currentStep] ?? box.currentStep}
                      </span>
                    </TableCell>
                    <TableCell><BoxStatusBadge status={box.status} /></TableCell>
                    <TableCell>
                      <DeadlineBadge deadline={box.deadline} boxStatus={box.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`button-edit-${box.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/boxes/${box.id}?edit=true`);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(box.id);
                            }}
                            data-testid={`button-delete-${box.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Box</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will permanently delete this box and all its workflow history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
