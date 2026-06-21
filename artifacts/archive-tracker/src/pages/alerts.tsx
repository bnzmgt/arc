import { useGetUrgentAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { STEP_LABELS } from "@/lib/steps";
import { useLocation } from "wouter";

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  P1: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  P2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  P3: "bg-muted text-muted-foreground",
};

type GroupedDiscrepancy = {
  id: number;
  boxCode: string;
  clientName: string;
  totalItems: number;
  steps: { stepName: string; stepItemCount: number }[];
};

function groupDiscrepancies(items: { id: number; boxCode: string; clientName: string; totalItems: number; stepName: string; stepItemCount: number }[]): GroupedDiscrepancy[] {
  const map = new Map<number, GroupedDiscrepancy>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, { id: item.id, boxCode: item.boxCode, clientName: item.clientName, totalItems: item.totalItems, steps: [] });
    }
    map.get(item.id)!.steps.push({ stepName: item.stepName, stepItemCount: item.stepItemCount });
  }
  return Array.from(map.values());
}

export default function AlertsPage() {
  const [, navigate] = useLocation();
  const { data: alerts, isLoading } = useGetUrgentAlerts();

  const overdueCount = alerts?.overdueBoxes.length ?? 0;
  const grouped = alerts ? groupDiscrepancies(alerts.itemDiscrepancies) : [];
  const discrepancyCount = grouped.length;
  const hasAlerts = overdueCount > 0 || discrepancyCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Overdue boxes and item count discrepancies</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
        </div>
      ) : !hasAlerts ? (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />
          <div>
            <p className="font-semibold">All clear</p>
            <p className="text-sm opacity-80">No overdue boxes or item count mismatches found.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overdue boxes */}
          {overdueCount > 0 && (
            <Card className="border border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  {overdueCount} Overdue {overdueCount === 1 ? "Box" : "Boxes"} — Not Yet Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-2">
                  {alerts!.overdueBoxes.map(box => (
                    <div
                      key={box.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white dark:bg-red-950/30 border border-red-100 dark:border-red-900 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                      onClick={() => navigate(`/boxes/${box.id}`)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-xs font-semibold text-foreground shrink-0">{box.boxCode}</span>
                        <span className="text-sm text-muted-foreground truncate">{box.clientName}</span>
                        {box.priority && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_COLORS[box.priority] ?? ""}`}>
                            {box.priority}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        {box.currentStep && (
                          <span className="hidden sm:inline text-xs text-muted-foreground">
                            Step: <span className="font-medium text-foreground">{STEP_LABELS[box.currentStep] ?? box.currentStep}</span>
                          </span>
                        )}
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">
                          {formatDistanceToNow(new Date(box.deadline!), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Item count discrepancies — one row per box */}
          {discrepancyCount > 0 && (
            <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {discrepancyCount} {discrepancyCount === 1 ? "Box" : "Boxes"} with Item Count Mismatches
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-2">
                  {grouped.map(box => (
                    <div
                      key={box.id}
                      className="py-2.5 px-3 rounded-lg bg-white dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors"
                      onClick={() => navigate(`/boxes/${box.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-semibold text-foreground shrink-0">{box.boxCode}</span>
                          <span className="text-sm text-muted-foreground truncate">{box.clientName}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0">declared {box.totalItems}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {box.steps.map(s => (
                          <span
                            key={s.stepName}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          >
                            <span className="font-medium">{STEP_LABELS[s.stepName] ?? s.stepName}</span>
                            <span className="opacity-60">·</span>
                            <span>{s.stepItemCount} recorded</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
