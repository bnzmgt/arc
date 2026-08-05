import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Archive, Server, Database, Shield, CheckCircle2 } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export default function SettingsPage() {
  const { data: health, isLoading } = useHealthCheck();

  return (
    <div className="space-y-5 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">About</h1>
        <p className="text-sm text-muted-foreground mt-1">System configuration and status</p>
      </div>
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server size={16} className="text-primary" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm">
              <Archive size={15} className="text-muted-foreground" />
              <span>API Server</span>
            </div>
            {isLoading ? (
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 size={11} className="mr-1" />
                {health?.status ?? "Online"}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm">
              <Database size={15} className="text-muted-foreground" />
              <span>Database</span>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 size={11} className="mr-1" />
              Connected
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm">
              <Shield size={15} className="text-muted-foreground" />
              <span>Workflow Engine</span>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 size={11} className="mr-1" />
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Workflow Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Steps 1–4 (Cleaning, Cataloging, Scanning, QC) run in parallel — any can be updated independently at the same time. Repacking requires all 4 steps to be completed first. Returning requires Repacking to be completed.
          </p>
          <ol className="space-y-2">
            {["Cleaning", "Cataloging", "Scanning", "Quality Control", "Repacking", "Returning"].map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">About Arciflow</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Arciflow — Archive Tracking & Workflow Management System</p>
          <p>Version 1.4.0</p>
          <p className="mt-3">
            Scan QR codes on printed labels to update workflow status from the field.
            Admins manage full CRUD and workflow control from this dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
