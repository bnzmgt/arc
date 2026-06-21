import { useState } from "react";
import { useGetDashboardStats, useGetWorkflowProgress, useGetRecentActivity, useGetPeriodProgress, useGetUrgentAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Archive, TrendingUp, CheckCircle2, RotateCcw, PackageOpen, Clock, PackagePlus, ListChecks, Bell, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { STEP_LABELS } from "@/lib/steps";
import { useLocation } from "wouter";

type Period = "week" | "month" | "year";
const PERIOD_LABELS: Record<Period, string> = { week: "This Week", month: "This Month", year: "This Year" };

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: progress, isLoading: progressLoading } = useGetWorkflowProgress();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: alerts, isLoading: alertsLoading } = useGetUrgentAlerts();

  const [period, setPeriod] = useState<Period>("week");
  const { data: periodStats, isLoading: periodLoading } = useGetPeriodProgress({ period });

  const statCards = [
    { label: "Total Boxes", value: stats?.totalBoxes ?? 0, icon: Archive, color: "text-blue-600" },
    { label: "Active Processing", value: stats?.activeBoxes ?? 0, icon: TrendingUp, color: "text-amber-600" },
    { label: "Completed", value: stats?.completedBoxes ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Returned", value: stats?.returnedBoxes ?? 0, icon: RotateCcw, color: "text-violet-600" },
    { label: "Total Items", value: stats?.totalItems ?? 0, icon: PackageOpen, color: "text-rose-600" },
    { label: "In Progress", value: stats?.boxesInProgress ?? 0, icon: Clock, color: "text-orange-600" },
  ];

  const periodCards = [
    { label: "Items Received", value: periodStats?.received ?? 0, icon: PackagePlus, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
    { label: "Items Completed", value: periodStats?.completed ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "Items Returned", value: periodStats?.returned ?? 0, icon: RotateCcw, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40" },
    { label: "Steps Completed", value: periodStats?.stepsCompleted ?? 0, icon: ListChecks, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/40" },
  ];

  const overdueCount = alerts?.overdueBoxes.length ?? 0;
  const discrepancyCount = alerts?.itemDiscrepancies.length ?? 0;
  const totalAlerts = overdueCount + discrepancyCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Archive operations at a glance</p>
      </div>

      {/* Alerts summary banner */}
      {!alertsLoading && (
        <button
          onClick={() => navigate("/alerts")}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm transition-colors ${
            totalAlerts > 0
              ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell size={15} className="flex-shrink-0" />
            {totalAlerts > 0 ? (
              <span className="font-medium">
                {totalAlerts} active {totalAlerts === 1 ? "alert" : "alerts"}
                {overdueCount > 0 && ` — ${overdueCount} overdue`}
                {discrepancyCount > 0 && ` — ${discrepancyCount} count ${discrepancyCount === 1 ? "mismatch" : "mismatches"}`}
              </span>
            ) : (
              <span className="font-medium">No urgent alerts — all boxes are on track</span>
            )}
          </div>
          <ChevronRight size={14} className="flex-shrink-0 opacity-60" />
        </button>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${color}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  {statsLoading ? (
                    <div className="h-6 w-12 bg-muted rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Period Progress */}
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold">Progress Tracking</CardTitle>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {(["week", "month", "year"] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    period === p
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {periodCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-lg p-4 ${bg}`}>
                <div className={`${color} mb-2`}>
                  <Icon size={18} />
                </div>
                {periodLoading ? (
                  <div className="h-7 w-10 bg-muted/60 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Workflow Progress */}
        <Card className="border border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Workflow Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {progressLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))
            ) : (
              progress?.map((item) => {
                const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <div key={item.stepName} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{STEP_LABELS[item.stepName] ?? item.stepName}</span>
                      <div className="flex items-center gap-2">
                        {item.inProgress > 0 && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 py-0">
                            {item.inProgress} active
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">{item.completed}/{item.total}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded mb-2 animate-pulse" />
              ))
            ) : activity?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activity?.map((item) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-foreground font-medium truncate">{item.boxCode} — {item.clientName}</p>
                      <p className="text-muted-foreground">{item.action}</p>
                      {item.performedBy && (
                        <p className="text-xs text-muted-foreground">by {item.performedBy}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70">
                        {format(new Date(item.timestamp), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
