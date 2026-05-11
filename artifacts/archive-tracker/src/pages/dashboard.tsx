import { useGetDashboardStats, useGetWorkflowProgress, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Archive, TrendingUp, CheckCircle2, RotateCcw, PackageOpen, Clock } from "lucide-react";
import { format } from "date-fns";
import { STEP_LABELS } from "@/lib/steps";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: progress, isLoading: progressLoading } = useGetWorkflowProgress();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  const statCards = [
    { label: "Total Boxes", value: stats?.totalBoxes ?? 0, icon: Archive, color: "text-blue-600" },
    { label: "In Progress", value: stats?.activeBoxes ?? 0, icon: TrendingUp, color: "text-amber-600" },
    { label: "Completed", value: stats?.completedBoxes ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Returned", value: stats?.returnedBoxes ?? 0, icon: RotateCcw, color: "text-violet-600" },
    { label: "Total Items", value: stats?.totalItems ?? 0, icon: PackageOpen, color: "text-rose-600" },
    { label: "Active Processing", value: stats?.boxesInProgress ?? 0, icon: Clock, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Archive operations at a glance</p>
      </div>

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
