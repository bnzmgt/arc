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
import { Input } from "@/components/ui/input";
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
  ShieldCheck,
} from "lucide-react";

import { format } from "date-fns";
import { STEP_LABELS } from "@/lib/steps";

const SPLIT_STEP_CONFIG: Record<string, { primary: string; secondary: string }> = {
  cataloging: { primary: "Cataloged",  secondary: "Double / Not Related" },
  scanning:   { primary: "Scanned",    secondary: "Not for Scan" },
  qc:         { primary: "Scanned",    secondary: "Not Scanned" },
};

interface ScanUser {
  id: number;
  name: string;
  workflowStep?: string | null;
  roleName?: string | null;
  active?: string | boolean;
}

interface StepCurrentData {
  status?: string | null;
  notes?: string | null;
  itemCount?: number | null;
  itemCountSecondary?: number | null;
  copyForClient?: string | null;
  storagePrepared?: string | null;
  hddReady?: string | null;
  documentHandover?: string | null;
  clientCopyReceived?: string | null;
  hddReceivedByClient?: string | null;
  handoverDocumentSigned?: string | null;
  unreturnedMaterials?: string | null;
}

interface StepUpdateFormProps {
  stepName: string;
  boxId: number;
  userId: number | null;
  ticketCode: string;
  currentStepData?: StepCurrentData;
  onSuccess: (stepName: string) => void;
  onCancel: () => void;
}

function StepUpdateForm({ stepName, boxId, userId, ticketCode, currentStepData, onSuccess, onCancel }: StepUpdateFormProps) {
  const splitConfig = SPLIT_STEP_CONFIG[stepName] ?? null;
  const isQcStep = stepName === "qc";
  const isRepackingStep = stepName === "repacking";
  const isReturningStep = stepName === "returning";

  const [status, setStatus] = useState(currentStepData?.status ?? "in_progress");
  const [notes, setNotes] = useState(currentStepData?.notes ?? "");
  const [itemCount, setItemCount] = useState(currentStepData?.itemCount != null ? String(currentStepData.itemCount) : "");
  const [itemCountSecondary, setItemCountSecondary] = useState(currentStepData?.itemCountSecondary != null ? String(currentStepData.itemCountSecondary) : "");
  const [itemCountError, setItemCountError] = useState("");
  const [itemCountSecondaryError, setItemCountSecondaryError] = useState("");
  // QC
  const [copyForClient, setCopyForClient] = useState(currentStepData?.copyForClient ?? "");
  const [storagePrepared, setStoragePrepared] = useState(currentStepData?.storagePrepared ?? "");
  const [copyForClientError, setCopyForClientError] = useState("");
  const [storagePreparedError, setStoragePreparedError] = useState("");
  // Repacking
  const [hddReady, setHddReady] = useState(currentStepData?.hddReady ?? "");
  const [documentHandover, setDocumentHandover] = useState(currentStepData?.documentHandover ?? "");
  const [hddReadyError, setHddReadyError] = useState("");
  const [documentHandoverError, setDocumentHandoverError] = useState("");
  // Returning
  const [clientCopyReceived, setClientCopyReceived] = useState(currentStepData?.clientCopyReceived ?? "");
  const [hddReceivedByClient, setHddReceivedByClient] = useState(currentStepData?.hddReceivedByClient ?? "");
  const [handoverDocumentSigned, setHandoverDocumentSigned] = useState(currentStepData?.handoverDocumentSigned ?? "");
  const [unreturnedMaterials, setUnreturnedMaterials] = useState(currentStepData?.unreturnedMaterials ?? "");
  const [clientCopyReceivedError, setClientCopyReceivedError] = useState("");
  const [hddReceivedByClientError, setHddReceivedByClientError] = useState("");
  const [handoverDocumentSignedError, setHandoverDocumentSignedError] = useState("");
  const [unreturnedMaterialsError, setUnreturnedMaterialsError] = useState("");

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

      {/* Item counts */}
      {splitConfig ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {splitConfig.primary}<span className="text-destructive">*</span>
              </Label>
              <Input type="number" min={0} value={itemCount}
                onChange={(e) => { setItemCount(e.target.value); setItemCountError(""); }}
                placeholder="0" className={`mt-1 h-9 text-sm ${itemCountError ? "border-destructive" : ""}`} />
              {itemCountError && <p className="text-xs text-destructive mt-1">{itemCountError}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {splitConfig.secondary}<span className="text-destructive">*</span>
              </Label>
              <Input type="number" min={0} value={itemCountSecondary}
                onChange={(e) => { setItemCountSecondary(e.target.value); setItemCountSecondaryError(""); }}
                placeholder="0" className={`mt-1 h-9 text-sm ${itemCountSecondaryError ? "border-destructive" : ""}`} />
              {itemCountSecondaryError && <p className="text-xs text-destructive mt-1">{itemCountSecondaryError}</p>}
            </div>
          </div>
          {itemCount !== "" && itemCountSecondary !== "" && !isNaN(parseInt(itemCount)) && !isNaN(parseInt(itemCountSecondary)) && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
              Total: <span className="font-semibold text-foreground">{parseInt(itemCount) + parseInt(itemCountSecondary)}</span> items
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            Item Count<span className="text-destructive">*</span>
          </Label>
          <Input type="number" min={0} value={itemCount}
            onChange={(e) => { setItemCount(e.target.value); setItemCountError(""); }}
            placeholder="Enter number of items"
            className={`mt-1 h-9 text-sm ${itemCountError ? "border-destructive" : ""}`} />
          {itemCountError && <p className="text-xs text-destructive mt-1">{itemCountError}</p>}
        </div>
      )}

      {/* QC fields */}
      {isQcStep && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Copy for client?<span className="text-destructive">*</span>
            </Label>
            <Select value={copyForClient} onValueChange={v => { setCopyForClient(v); setCopyForClientError(""); }}>
              <SelectTrigger className={`mt-1 h-9 text-sm ${copyForClientError ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="later">Later</SelectItem>
                <SelectItem value="not_yet">Not Yet</SelectItem>
                <SelectItem value="no">Not Required</SelectItem>
              </SelectContent>
            </Select>
            {copyForClientError && <p className="text-xs text-destructive mt-1">{copyForClientError}</p>}
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Storage prepared?<span className="text-destructive">*</span>
            </Label>
            <Select value={storagePrepared} onValueChange={v => { setStoragePrepared(v); setStoragePreparedError(""); }}>
              <SelectTrigger className={`mt-1 h-9 text-sm ${storagePreparedError ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ptad">PTAD</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="no">Not Required</SelectItem>
              </SelectContent>
            </Select>
            {storagePreparedError && <p className="text-xs text-destructive mt-1">{storagePreparedError}</p>}
          </div>
        </div>
      )}

      {/* Repacking fields */}
      {isRepackingStep && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              HDD ready?<span className="text-destructive">*</span>
            </Label>
            <Select value={hddReady} onValueChange={v => { setHddReady(v); setHddReadyError(""); }}>
              <SelectTrigger className={`mt-1 h-9 text-sm ${hddReadyError ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="later">Later</SelectItem>
                <SelectItem value="not_yet">Not Yet</SelectItem>
                <SelectItem value="no">Not Required</SelectItem>
              </SelectContent>
            </Select>
            {hddReadyError && <p className="text-xs text-destructive mt-1">{hddReadyError}</p>}
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Document handover?<span className="text-destructive">*</span>
            </Label>
            <Select value={documentHandover} onValueChange={v => { setDocumentHandover(v); setDocumentHandoverError(""); }}>
              <SelectTrigger className={`mt-1 h-9 text-sm ${documentHandoverError ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="not_yet">Not Yet</SelectItem>
                <SelectItem value="no">Not Required</SelectItem>
              </SelectContent>
            </Select>
            {documentHandoverError && <p className="text-xs text-destructive mt-1">{documentHandoverError}</p>}
          </div>
        </div>
      )}

      {/* Returning fields */}
      {isReturningStep && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Client copy received?", val: clientCopyReceived, set: setClientCopyReceived, err: clientCopyReceivedError, setErr: setClientCopyReceivedError, showNotRequired: true },
            { label: "HDD received by client?", val: hddReceivedByClient, set: setHddReceivedByClient, err: hddReceivedByClientError, setErr: setHddReceivedByClientError, showNotRequired: true },
            { label: "Handover doc signed?", val: handoverDocumentSigned, set: setHandoverDocumentSigned, err: handoverDocumentSignedError, setErr: setHandoverDocumentSignedError, showNotRequired: true },
            { label: "Unreturned materials?", val: unreturnedMaterials, set: setUnreturnedMaterials, err: unreturnedMaterialsError, setErr: setUnreturnedMaterialsError, showNotRequired: false },
          ].map(({ label, val, set, err, setErr, showNotRequired }) => (
            <div key={label}>
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {label}<span className="text-destructive">*</span>
              </Label>
              <Select value={val} onValueChange={v => { set(v); setErr(""); }}>
                <SelectTrigger className={`mt-1 h-9 text-sm ${err ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  {showNotRequired && <SelectItem value="not_required">Not Required</SelectItem>}
                </SelectContent>
              </Select>
              {err && <p className="text-xs text-destructive mt-1">{err}</p>}
            </div>
          ))}
        </div>
      )}

      <div>
        <Label className="text-xs font-medium text-muted-foreground">Notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..." rows={2} className="mt-1 text-sm resize-none" />
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1 h-9"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => {
            if (!itemCount || itemCount.trim() === "") {
              setItemCountError(splitConfig ? `${splitConfig.primary} count is required` : "Item count is required");
              return;
            }
            const count = parseInt(itemCount, 10);
            if (isNaN(count) || count < 0) { setItemCountError("Enter a valid number (0 or above)"); return; }
            let countSecondary: number | undefined;
            if (splitConfig) {
              if (!itemCountSecondary || itemCountSecondary.trim() === "") {
                setItemCountSecondaryError(`${splitConfig.secondary} count is required`); return;
              }
              const s = parseInt(itemCountSecondary, 10);
              if (isNaN(s) || s < 0) { setItemCountSecondaryError("Enter a valid number (0 or above)"); return; }
              countSecondary = s;
            }
            if (isQcStep) {
              if (!copyForClient) { setCopyForClientError("Required"); return; }
              if (status === "completed" && copyForClient === "not_yet") {
                setCopyForClientError("Must not be 'Not Yet' to mark as Completed"); return;
              }
              if (!storagePrepared) { setStoragePreparedError("Required"); return; }
            }
            if (isRepackingStep) {
              if (!hddReady) { setHddReadyError("Required"); return; }
              if (status === "completed" && hddReady === "not_yet") {
                setHddReadyError("Must be 'Yes', 'Later', or 'Not Required' to mark as Completed"); return;
              }
              if (!documentHandover) { setDocumentHandoverError("Required"); return; }
              if (status === "completed" && documentHandover === "not_yet") {
                setDocumentHandoverError("Must be 'Yes' or 'Not Required' to mark as Completed"); return;
              }
            }
            if (isReturningStep) {
              if (!clientCopyReceived) { setClientCopyReceivedError("Required"); return; }
              if (!hddReceivedByClient) { setHddReceivedByClientError("Required"); return; }
              if (!handoverDocumentSigned) { setHandoverDocumentSignedError("Required"); return; }
              if (!unreturnedMaterials) { setUnreturnedMaterialsError("Required"); return; }
              if (status === "completed") {
                if (clientCopyReceived !== "yes" && clientCopyReceived !== "not_required") { setClientCopyReceivedError("Must be 'Yes' or 'Not Required' to complete"); return; }
                if (hddReceivedByClient !== "yes" && hddReceivedByClient !== "not_required") { setHddReceivedByClientError("Must be 'Yes' or 'Not Required' to complete"); return; }
                if (handoverDocumentSigned !== "yes" && handoverDocumentSigned !== "not_required") { setHandoverDocumentSignedError("Must be 'Yes' or 'Not Required' to complete"); return; }
                if (unreturnedMaterials !== "no") { setUnreturnedMaterialsError("Must be 'No' to complete"); return; }
              }
            }
            mutation.mutate({
              id: boxId,
              data: {
                stepName: stepName as Parameters<typeof mutation.mutate>[0]["data"]["stepName"],
                status: status as "pending" | "in_progress" | "completed" | "skipped",
                assignedUserId: userId ?? undefined,
                notes: notes.trim() || null,
                itemCount: count,
                ...(countSecondary !== undefined ? { itemCountSecondary: countSecondary } : {}),
                ...(isQcStep ? { copyForClient: copyForClient || null, storagePrepared: storagePrepared || null } : {}),
                ...(isRepackingStep ? { hddReady: hddReady || null, documentHandover: documentHandover || null } : {}),
                ...(isReturningStep ? { clientCopyReceived: clientCopyReceived || null, hddReceivedByClient: hddReceivedByClient || null, handoverDocumentSigned: handoverDocumentSigned || null, unreturnedMaterials: unreturnedMaterials || null } : {}),
              },
            });
          }}
          data-testid={`button-submit-${stepName}`}
        >
          {mutation.isPending ? "Saving…" : "Save Update"}
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onCancel}>Cancel</Button>
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
  const isAdmin = user?.accountLevel === "superadmin" || user?.accountLevel === "admin" || user?.accountLevel === "staff_admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-5 pb-4">
        <div className="max-w-lg mx-auto">
          <a
            href="/"
            className="inline-flex items-center gap-2 mb-1 opacity-75 hover:opacity-100 transition-opacity"
          >
            <Archive size={15} />
            <span className="text-xs font-medium">Arciflow</span>
          </a>
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
            {box.totalBoxes != null && (
              <div>
                <p className="text-xs text-muted-foreground">Boxes</p>
                <p className="font-medium">{box.totalBoxes}</p>
              </div>
            )}
            {box.totalItems != null ? (
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="font-medium">{box.totalItems}</p>
              </div>
            ) : box.totalBoxes != null ? (
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="font-medium italic text-muted-foreground">Unknown</p>
              </div>
            ) : null}
            {box.inDate && (
              <div>
                <p className="text-xs text-muted-foreground">Received</p>
                <p className="font-medium">{format(new Date(box.inDate), "MMM d, yyyy")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Current Step</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-medium">{STEP_LABELS[box.currentStep] ?? box.currentStep}</p>
                {(() => {
                  const currentStepData = workflowSteps.find(s => s.stepName === box.currentStep);
                  if (currentStepData?.status === "completed" || box.status === "completed") {
                    return (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 size={10} /> Completed
                      </span>
                    );
                  }
                  if (currentStepData?.status === "in_progress") {
                    return (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        <Clock size={10} /> In Progress
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
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
              // Check if prerequisite steps are done (independent of this step's own status)
              let prerequisitesMet: boolean;
              if (step.stepOrder <= 4) {
                prerequisitesMet = true;
              } else if (step.stepOrder === 5) {
                const firstFour = workflowSteps.filter((s) => s.stepOrder <= 4);
                prerequisitesMet = firstFour.every((s) => s.status === "completed" || s.status === "skipped");
              } else {
                const repacking = workflowSteps.find((s) => s.stepOrder === 5);
                prerequisitesMet = !!repacking && (repacking.status === "completed" || repacking.status === "skipped");
              }
              // Completed steps can always be re-edited (allow corrections); pending steps need prerequisites met
              const sequenceOk = step.status === "completed" || step.status === "in_progress" || prerequisitesMet;
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
                      {step.performedByAdminName && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <ShieldCheck size={11} /> {step.performedByAdminName}
                        </p>
                      )}
                      {(step.startedAt || step.completedAt) && (
                        <p className="text-xs text-muted-foreground">
                          {step.startedAt && `Started: ${format(new Date(step.startedAt), "MMM d, HH:mm")}`}
                          {step.startedAt && step.completedAt && ` — `}
                          {step.completedAt && `Completed: ${format(new Date(step.completedAt), "MMM d, HH:mm")}`}
                        </p>
                      )}
                      {/* Step details grid */}
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {(() => {
                          const sc = SPLIT_STEP_CONFIG[step.stepName];
                          if (sc) return (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground w-20 shrink-0">{sc.primary}</span>
                                <span className="text-xs font-medium">{step.itemCount != null ? step.itemCount : <span className="text-muted-foreground/40">—</span>}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground w-20 shrink-0">{sc.secondary}</span>
                                <span className="text-xs font-medium">{step.itemCountSecondary != null ? step.itemCountSecondary : <span className="text-muted-foreground/40">—</span>}</span>
                              </div>
                              {step.itemCount != null && step.itemCountSecondary != null && (
                                <div className="col-span-2 flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground w-20 shrink-0">Total</span>
                                  <span className="text-xs font-semibold">{step.itemCount + step.itemCountSecondary}</span>
                                </div>
                              )}
                            </>
                          );
                          return (
                            <div className="col-span-2 flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">Item count</span>
                              <span className="text-xs font-medium">{step.itemCount != null ? step.itemCount : <span className="text-muted-foreground/40">—</span>}</span>
                            </div>
                          );
                        })()}
                        {/* QC fields */}
                        {step.stepName === "qc" && (() => {
                          const copyLabel = step.copyForClient === "ready" ? "Ready" : step.copyForClient === "later" ? "Later" : step.copyForClient === "not_yet" ? "Not Yet" : step.copyForClient === "no" ? "Not Required" : null;
                          const storageLabel = step.storagePrepared === "ptad" ? "PTAD" : step.storagePrepared === "client" ? "Client" : step.storagePrepared === "no" ? "Not Required" : null;
                          return (<>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">Copy for client</span>
                              {copyLabel ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.copyForClient === "ready" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : step.copyForClient === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>{copyLabel}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">Storage</span>
                              {storageLabel ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.storagePrepared === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"}`}>{storageLabel}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                          </>);
                        })()}
                        {/* Repacking fields */}
                        {step.stepName === "repacking" && (() => {
                          const hddLabel = step.hddReady === "yes" ? "Yes" : step.hddReady === "later" ? "Later" : step.hddReady === "not_yet" ? "Not Yet" : step.hddReady === "no" ? "Not Required" : null;
                          const handoverLabel = step.documentHandover === "yes" ? "Yes" : step.documentHandover === "not_yet" ? "Not Yet" : step.documentHandover === "no" ? "Not Required" : null;
                          return (<>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">HDD ready</span>
                              {hddLabel ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.hddReady === "yes" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : step.hddReady === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>{hddLabel}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-20 shrink-0">Doc handover</span>
                              {handoverLabel ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.documentHandover === "yes" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : step.documentHandover === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>{handoverLabel}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                          </>);
                        })()}
                        {/* Returning fields */}
                        {step.stepName === "returning" && (() => {
                          const yesNo = (val: string | null | undefined, invertGood?: boolean) => {
                            if (!val) return <span className="text-xs text-muted-foreground/40">—</span>;
                            if (val === "not_required") return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Not Required</span>;
                            const isGood = invertGood ? val === "no" : val === "yes";
                            return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isGood ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>{val === "yes" ? "Yes" : "No"}</span>;
                          };
                          return (<>
                            <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-20 shrink-0">Client copy</span>{yesNo(step.clientCopyReceived)}</div>
                            <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-20 shrink-0">HDD received</span>{yesNo(step.hddReceivedByClient)}</div>
                            <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-20 shrink-0">Doc signed</span>{yesNo(step.handoverDocumentSigned)}</div>
                            <div className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground w-20 shrink-0">Unreturned</span>{yesNo(step.unreturnedMaterials, true)}</div>
                          </>);
                        })()}
                      </div>
                      {step.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1.5 border-t border-border/50 pt-1.5">{step.notes}</p>
                      )}
                    </div>
                    <WorkflowStatusBadge status={step.status} />
                  </div>

                  <div className="mt-2 ml-[31px]">
                    {/* Sequence blocked — only show for pending steps whose prerequisites aren't met */}
                    {!prerequisitesMet && step.status === "pending" && (
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
                        {step.status === "completed" ? "Edit This Step" : "Update This Step"}
                      </Button>
                    )}

                    {/* Update form */}
                    {user && isUpdating && (identity || isAdmin) && (
                      <StepUpdateForm
                        stepName={step.stepName}
                        boxId={box.id}
                        userId={identity?.id ?? null}
                        ticketCode={ticketCode}
                        currentStepData={step}
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
