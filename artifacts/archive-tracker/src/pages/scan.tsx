import { useState } from "react";
import { useRoute } from "wouter";
import {
  useGetByTicketCode,
  useUpdateBoxWorkflow,
  getGetByTicketCodeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BoxStatusBadge, WorkflowStatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  CheckCircle2,
  Clock,
  Circle,
  Archive,
  AlertTriangle,
  UserCheck,
  Lock,
  ChevronDown,
  X,
  LogIn,
  LogOut,
  ExternalLink,
} from "lucide-react";

import { format } from "date-fns";
import { STEP_LABELS } from "@/lib/steps";
 
interface ScanUser {
  id: number;
  name: string;
  workflowStep?: string | null;
  roleName?: string | null;
  active?: string | boolean;
}

interface StepUpdateFormProps {
  stepName: string;
  boxId: number;
  userId: number | null;
  ticketCode: string;
  onSuccess: (stepName: string) => void;
  onCancel: () => void;
}

function StepUpdateForm({ stepName, boxId, userId, ticketCode, onSuccess, onCancel }: StepUpdateFormProps) {
  const [status, setStatus] = useState("in_progress");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useUpdateBoxWorkflow({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getGetByTicketCodeQueryKey(ticketCode) });
        onSuccess(updated.stepName);
        toast({ title: `Step "${STEP_LABELS[updated.stepName] ?? updated.stepName}" updated successfully` });
      },
      onError: (err: unknown) => {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        toast({
          title: "Update failed",
          description: msg ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  return (
    <div className="mt-3 space-y-3 pt-3 border-t border-border">
      <div>
        <Label className="text-xs font-medium text-muted-foreground">New Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="mt-1 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={2}
          className="mt-1 text-sm resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1 h-9"
          size="sm"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              id: boxId,
              data: {
                stepName: stepName as Parameters<typeof mutation.mutate>[0]["data"]["stepName"],
                status: status as "pending" | "in_progress" | "completed" | "skipped",
                assignedUserId: userId ?? undefined,
                notes: notes.trim() || null,
              },
            })
          }
          data-testid={`button-submit-${stepName}`}
        >
          {mutation.isPending ? "Saving…" : "Save Update"}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}


export default function ScanPage() {
  const [, params] = useRoute("/scan/:ticketCode");
  const ticketCode = params?.ticketCode ?? "";
  const [activeUpdateStep, setActiveUpdateStep] = useState<string | null>(null);
  const [successStep, setSuccessStep] = useState<string | null>(null);
  const { user, loading: authLoading, logout } = useAuth();

  const { data, isLoading, error } = useGetByTicketCode(ticketCode, {
    query: {
      enabled: !!ticketCode,
      queryKey: getGetByTicketCodeQueryKey(ticketCode),
      staleTime: 30_000,
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="mx-auto mb-3 text-destructive" />
          <h1 className="text-xl font-bold mb-2">Box Not Found</h1>
          <p className="text-muted-foreground text-sm">
            Ticket <span className="font-mono font-medium">{ticketCode}</span> does not match any box.
          </p>
        </div>
      </div>
    );
  }

  const { box, workflowSteps, users } = data;
  const activeUsers: ScanUser[] = (users as ScanUser[]).filter(
    (u) => u.active === "true" || u.active === true
  );
  // Find all role entries for the logged-in user (a user can have multiple roles)
  const identityRows = user
    ? activeUsers.filter((u) => u.name === user.displayName)
    : [];
  const identity = identityRows[0] ?? null;
  // Collect all workflow steps across all roles this user has
  const identitySteps = identityRows
    .map((u) => u.workflowStep)
    .filter((s): s is string => !!s);
  const isAdmin = user?.accountLevel === "superadmin" || user?.accountLevel === "admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-5 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1 opacity-75">
            <Archive size={15} />
            <span className="text-xs font-medium">Arciflow</span>
          </div>
          <h1 className="text-2xl font-bold font-mono leading-tight">{box.boxCode}</h1>
          <p className="text-sm opacity-75 mt-0.5">{box.clientName}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Identity strip */}
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-emerald-200 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
            <UserCheck size={15} className="text-emerald-700 dark:text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 truncate">
              {identity?.name ?? user?.displayName ?? "Signed in user"}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {authLoading
              ? "Loading account..."
              : user
              ? isAdmin
                ? "Signed in"
                : identitySteps.length > 0
                ? `Can update: ${identitySteps.map(s => STEP_LABELS[s] ?? s).join(", ")}`
                : identity?.roleName ?? "No step assignment"
              : "Sign in required"}
            </p>
          </div>
          {user ? (
            <button
              onClick={() => { setActiveUpdateStep(null); logout(); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-full px-3 py-1.5 transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={12} />
              Sign out
            </button>
          ) : (
            <a
              href={`/login?redirect=/scan/${ticketCode}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-full px-3 py-1.5 transition-colors"
            >
              <LogIn size={12} />
              Sign in
            </a>
          )}
        </div>

        {/* Box Info */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Box Status</span>
            <BoxStatusBadge status={box.status} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {box.location && (
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{box.location}</p>
              </div>
            )}
            {box.totalItems != null && (
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="font-medium">{box.totalItems}</p>
              </div>
            )}
            {box.inDate && (
              <div>
                <p className="text-xs text-muted-foreground">Received</p>
                <p className="font-medium">{format(new Date(box.inDate), "MMM d, yyyy")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Current Step</p>
              <p className="font-medium">{STEP_LABELS[box.currentStep] ?? box.currentStep}</p>
            </div>
          </div>
          {box.notes && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Note:</span> {box.notes}
              </p>
            </div>
          )}
          {box.photoLink && (
            <a
              href={box.photoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink size={12} /> View Photo Proof
            </a>
          )}
        </div>

        {/* Success notice */}
        {successStep && (
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <p className="text-emerald-800 dark:text-emerald-200 text-sm font-medium">
              "{STEP_LABELS[successStep] ?? successStep}" step updated.
            </p>
            <button
              onClick={() => setSuccessStep(null)}
              className="ml-auto text-emerald-500 hover:text-emerald-700"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Workflow Steps */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Workflow Steps
          </p>
          <div className="space-y-2">
            {workflowSteps.map((step) => {
              let sequenceOk: boolean;
              if (step.status === "completed") {
                sequenceOk = false;
              } else if (step.stepOrder <= 4) {
                // Steps 1–4 are parallel — always unlocked
                sequenceOk = true;
              } else if (step.stepOrder === 5) {
                // Repacking: all 4 processing steps must be done
                const firstFour = workflowSteps.filter((s) => s.stepOrder <= 4);
                sequenceOk = firstFour.every((s) => s.status === "completed" || s.status === "skipped");
              } else {
                // Returning: repacking must be done
                const repacking = workflowSteps.find((s) => s.stepOrder === 5);
                sequenceOk = !!repacking && (repacking.status === "completed" || repacking.status === "skipped");
              }
              const roleOk = isAdmin || (!!identity && identitySteps.includes(step.stepName));
              const canUpdate = sequenceOk && roleOk;
              const isUpdating = activeUpdateStep === step.stepName;

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    step.status === "completed"
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                      : step.status === "in_progress"
                      ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {step.status === "completed" ? (
                        <CheckCircle2 size={19} className="text-emerald-500" />
                      ) : step.status === "in_progress" ? (
                        <Clock size={19} className="text-amber-500 animate-pulse" />
                      ) : (
                        <Circle size={19} className="text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug">
                        {STEP_LABELS[step.stepName] ?? step.stepName}
                      </p>
                      {step.assignedUserName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.assignedUserName}
                        </p>
                      )}
                      {step.completedAt && (
                        <p className="text-xs text-muted-foreground">
                          Done {format(new Date(step.completedAt), "MMM d, HH:mm")}
                        </p>
                      )}
                      {step.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">{step.notes}</p>
                      )}
                    </div>
                    <WorkflowStatusBadge status={step.status} />
                  </div>

                  <div className="mt-2 ml-[31px]">
                    {/* Sequence blocked */}
                    {!sequenceOk && step.status !== "completed" && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle size={11} />
                        {step.stepOrder === 5
                          ? "All 4 processing steps must be completed first"
                          : step.stepOrder === 6
                          ? "Repacking must be completed first"
                          : "Previous step not completed yet"}
                      </div>
                    )}

                    {/* Role blocked */}
                    {sequenceOk && !roleOk && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-lg px-2.5 py-1.5 w-fit">
                        <Lock size={11} className="flex-shrink-0" />
                        Handled by {STEP_LABELS[step.stepName] ?? step.stepName} Team
                      </div>
                    )}

                    {/* Update button */}
                    {!user && (
                      <a
                        href={`/login?redirect=/scan/${ticketCode}`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <LogIn size={11} />
                        Sign in to update this step
                      </a>
                    )}

                    {user && canUpdate && !isUpdating && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => setActiveUpdateStep(step.stepName)}
                        data-testid={`button-update-${step.stepName}`}
                      >
                        <ChevronDown size={13} className="mr-1.5" />
                        Update This Step
                      </Button>
                    )}

                    {/* Update form */}
                    {user && isUpdating && (identity || isAdmin) && (
                      <StepUpdateForm
                        stepName={step.stepName}
                        boxId={box.id}
                        userId={identity?.id ?? null}
                        ticketCode={ticketCode}
                        onSuccess={(sn) => {
                          setActiveUpdateStep(null);
                          setSuccessStep(sn);
                        }}
                        onCancel={() => setActiveUpdateStep(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4 font-mono">{ticketCode}</p>
      </div>
      <Toaster />
    </div>
  );
}
