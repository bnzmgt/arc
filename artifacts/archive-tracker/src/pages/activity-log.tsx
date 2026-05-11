import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ClipboardList, User, Box, ArrowRight, Filter, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { STEP_LABELS, STEP_COLORS } from "@/lib/steps";

interface ActivityRow {
  id: number;
  boxId: number;
  boxCode: string;
  clientName: string;
  action: string;
  stepName: string | null;
  performedBy: string | null;
  timestamp: string;
}

interface ActivityResponse {
  rows: ActivityRow[];
  total: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchActivityLog(step: string, page: number): Promise<ActivityResponse> {
  const params = new URLSearchParams({ limit: "50", offset: String(page * 50) });
  if (step && step !== "all") params.set("step", step);
  const res = await fetch(`${BASE}/api/stats/activity-log?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function ActivityLogPage() {
  const [stepFilter, setStepFilter] = useState("all");
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["activity-log", stepFilter, page],
    queryFn: () => fetchActivityLog(stepFilter, page),
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-500" />
            Activity Log
          </h1>
          <p className="mt-0.5 text-slate-500 text-sm">
            Full audit trail of every change made in the system
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        <Select
          value={stepFilter}
          onValueChange={(v) => { setStepFilter(v); setPage(0); }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Steps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Steps</SelectItem>
            {Object.entries(STEP_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {total > 0 && (
          <span className="text-sm text-slate-500 ml-auto">
            {total} event{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <ClipboardList className="w-10 h-10 text-slate-300" />
            <p className="text-sm">No events found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold w-36">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold">Box</th>
                <th className="px-4 py-3 text-left font-semibold">Step</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    <div className="text-xs">{format(new Date(row.timestamp), "d MMM yyyy")}</div>
                    <div className="text-xs text-slate-400">{format(new Date(row.timestamp), "HH:mm:ss")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/boxes/${row.boxId}`}
                      className="group flex items-center gap-1 w-fit"
                    >
                      <Box className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-500 flex-shrink-0" />
                      <span className="font-mono font-semibold text-slate-800 group-hover:text-orange-600 text-xs">
                        {row.boxCode}
                      </span>
                    </Link>
                    <p className="text-xs text-slate-500 truncate max-w-[140px]">{row.clientName}</p>
                  </td>
                  <td className="px-4 py-3">
                    {row.stepName ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STEP_COLORS[row.stepName] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {STEP_LABELS[row.stepName] ?? row.stepName}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.action}</td>
                  <td className="px-4 py-3">
                    {row.performedBy ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-slate-500" />
                        </div>
                        <span className="text-slate-700">{row.performedBy}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">System</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
