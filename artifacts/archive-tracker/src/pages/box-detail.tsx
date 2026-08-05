import { useState, useEffect } from "react";
import { useRoute, useSearch, Link } from "wouter";
import {
  useGetBox, useGetBoxWorkflow, useGetBoxTicket, useUpdateBoxWorkflow,
  useUpdateBox, useDeleteBox,
  getGetBoxQueryKey, getGetBoxWorkflowQueryKey, getGetBoxTicketQueryKey, getListBoxesQueryKey,
  useListUsers,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { BoxStatusBadge, WorkflowStatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Ticket, CheckCircle2, Clock, Circle, ChevronRight,
  Calendar, MapPin, Package, User, FileText, QrCode, AlertTriangle, Pencil, ExternalLink, Lock, ShieldCheck,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { STEP_LABELS } from "@/lib/steps";
import { useAuth } from "@/contexts/auth";

function getDeadlineStatus(deadline: Date | string | null | undefined, boxStatus: string) {
  if (!deadline || boxStatus === "completed" || boxStatus === "returned") return null;
  const d = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = differenceInCalendarDays(d, today);
  if (diffDays < 0) return { type: "overdue", label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`, days: diffDays };
  if (diffDays === 0) return { type: "today", label: "Due today", days: 0 };
  if (diffDays <= 3) return { type: "soon", label: `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}`, days: diffDays };
  return { type: "ok", label: format(d, "MMM d, yyyy"), days: diffDays };
}

const STEPS = ["cleaning", "cataloging", "scanning", "qc", "repacking", "returning"] as const;

const SPLIT_STEP_CONFIG: Record<string, { primary: string; secondary: string }> = {
  cataloging: { primary: "Cataloged",  secondary: "Double / Not Related" },
  scanning:   { primary: "Scanned",    secondary: "Not for Scan" },
  qc:         { primary: "Scanned",    secondary: "Not Scanned" },
};

function WorkflowStepCard({
  step,
  boxId,
  users,
  onUpdated,
  staffIdentity,
}: {
  step: { id: number; stepName: string; stepOrder: number; status: string; assignedUserId?: number | null; assignedUserName?: string | null; performedByAdminName?: string | null; startedAt?: string | null; completedAt?: string | null; notes?: string | null; itemCount?: number | null; itemCountSecondary?: number | null; copyForClient?: string | null; storagePrepared?: string | null; hddReady?: string | null; documentHandover?: string | null; clientCopyReceived?: string | null; hddReceivedByClient?: string | null; handoverDocumentSigned?: string | null; unreturnedMaterials?: string | null; updatedAt: string };
  boxId: number;
  users: Array<{ id: number; name: string }>;
  onUpdated: () => void;
  staffIdentity?: { userId: number; workflowStep: string | null; workflowSteps?: string[] } | null;
}) {
  const isStaffView = !!staffIdentity;
  const assignedSteps = staffIdentity?.workflowSteps ?? (staffIdentity?.workflowStep ? [staffIdentity.workflowStep] : []);
  const canActOnThisStep = !isStaffView || assignedSteps.includes(step.stepName);
  const splitConfig = SPLIT_STEP_CONFIG[step.stepName] ?? null;

  const { user: adminUser } = useAuth();

  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(step.status);
  const [selectedUser, setSelectedUser] = useState(step.assignedUserId?.toString() ?? "");
  const [selectedUserError, setSelectedUserError] = useState("");
  const [notes, setNotes] = useState(step.notes ?? "");
  const [itemCount, setItemCount] = useState(step.itemCount?.toString() ?? "");
  const [itemCountSecondary, setItemCountSecondary] = useState(step.itemCountSecondary?.toString() ?? "");
  const [itemCountError, setItemCountError] = useState("");
  const [itemCountSecondaryError, setItemCountSecondaryError] = useState("");
  const isQcStep = step.stepName === "qc";
  const isRepackingStep = step.stepName === "repacking";
  const isReturningStep = step.stepName === "returning";
  const [copyForClient, setCopyForClient] = useState(step.copyForClient ?? "");
  const [storagePrepared, setStoragePrepared] = useState(step.storagePrepared ?? "");
  const [copyForClientError, setCopyForClientError] = useState("");
  const [storagePreparedError, setStoragePreparedError] = useState("");
  const [hddReady, setHddReady] = useState(step.hddReady ?? "");
  const [documentHandover, setDocumentHandover] = useState(step.documentHandover ?? "");
  const [hddReadyError, setHddReadyError] = useState("");
  const [documentHandoverError, setDocumentHandoverError] = useState("");
  const [clientCopyReceived, setClientCopyReceived] = useState(step.clientCopyReceived ?? "");
  const [hddReceivedByClient, setHddReceivedByClient] = useState(step.hddReceivedByClient ?? "");
  const [handoverDocumentSigned, setHandoverDocumentSigned] = useState(step.handoverDocumentSigned ?? "");
  const [unreturnedMaterials, setUnreturnedMaterials] = useState(step.unreturnedMaterials ?? "");
  const [clientCopyReceivedError, setClientCopyReceivedError] = useState("");
  const [hddReceivedByClientError, setHddReceivedByClientError] = useState("");
  const [handoverDocumentSignedError, setHandoverDocumentSignedError] = useState("");
  const [unreturnedMaterialsError, setUnreturnedMaterialsError] = useState("");
  const { toast } = useToast();

  const updateMutation = useUpdateBoxWorkflow({
    mutation: {
      onSuccess: () => {
        toast({ title: `Step "${STEP_LABELS[step.stepName]}" updated` });
        onUpdated();
        setOpen(false);
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

  const statusIcon = {
    pending: <Circle size={18} className="text-muted-foreground" />,
    in_progress: <Clock size={18} className="text-amber-500 animate-pulse" />,
    completed: <CheckCircle2 size={18} className="text-emerald-500" />,
    skipped: <ChevronRight size={18} className="text-muted-foreground" />,
  }[step.status] ?? <Circle size={18} />;

  const resolvedAssignedUserId = isStaffView
    ? staffIdentity.userId
    : (selectedUser !== "" && selectedUser !== "__admin__" ? parseInt(selectedUser, 10) : null);

  return (
    <div className={`flex gap-4 p-4 rounded-lg border ${step.status === "completed" ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20" : step.status === "in_progress" ? "border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20" : "border-border bg-muted/20"}`}>
      <div className="mt-0.5">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{STEP_LABELS[step.stepName]}</span>
          <WorkflowStatusBadge status={step.status} />
          {step.assignedUserName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User size={11} /> {step.assignedUserName}
            </span>
          )}
          {step.performedByAdminName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck size={11} /> {step.performedByAdminName}
            </span>
          )}
        </div>
        {(step.startedAt || step.completedAt) && (
          <p className="text-xs text-muted-foreground mt-1">
            {step.startedAt && `Started: ${format(new Date(step.startedAt), "MMM d, yyyy HH:mm")}`}
            {step.startedAt && step.completedAt && ` — `}
            {step.completedAt && `Completed: ${format(new Date(step.completedAt), "MMM d, yyyy HH:mm")}`}
          </p>
        )}
        {/* Step details grid — always visible */}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {/* Item counts */}
          {splitConfig ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{splitConfig.primary}</span>
                <span className="text-xs font-medium">{step.itemCount != null ? step.itemCount : <span className="text-muted-foreground/50">—</span>}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{splitConfig.secondary}</span>
                <span className="text-xs font-medium">{step.itemCountSecondary != null ? step.itemCountSecondary : <span className="text-muted-foreground/50">—</span>}</span>
              </div>
              {step.itemCount != null && step.itemCountSecondary != null && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Total</span>
                  <span className="text-xs font-semibold">{step.itemCount + step.itemCountSecondary}</span>
                </div>
              )}
            </>
          ) : (
            <div className="col-span-2 flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-24 shrink-0">Item count</span>
              <span className="text-xs font-medium">{step.itemCount != null ? step.itemCount : <span className="text-muted-foreground/50">—</span>}</span>
            </div>
          )}

          {/* QC-specific fields */}
          {step.stepName === "qc" && (() => {
            const copyLabel = step.copyForClient === "ready" ? "Ready" : step.copyForClient === "later" ? "Later" : step.copyForClient === "not_yet" ? "Not Yet" : step.copyForClient === "no" ? "Not Required" : null;
            const storageLabel = step.storagePrepared === "ptad" ? "PTAD" : step.storagePrepared === "client" ? "Client" : step.storagePrepared === "no" ? "Not Required" : null;
            return (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Copy for client</span>
                  {copyLabel
                    ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.copyForClient === "ready" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : step.copyForClient === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>{copyLabel}</span>
                    : <span className="text-xs text-muted-foreground/50">—</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Storage</span>
                  {storageLabel
                    ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.storagePrepared === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"}`}>{storageLabel}</span>
                    : <span className="text-xs text-muted-foreground/50">—</span>}
                </div>
              </>
            );
          })()}

          {/* Repacking-specific fields */}
          {step.stepName === "repacking" && (() => {
            const hddLabel = step.hddReady === "yes" ? "Yes" : step.hddReady === "later" ? "Later" : step.hddReady === "not_yet" ? "Not Yet" : step.hddReady === "no" ? "Not Required" : null;
            const handoverLabel = step.documentHandover === "yes" ? "Yes" : step.documentHandover === "not_yet" ? "Not Yet" : step.documentHandover === "no" ? "Not Required" : null;
            return (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">HDD ready</span>
                  {hddLabel
                    ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.hddReady === "yes" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : step.hddReady === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"}`}>{hddLabel}</span>
                    : <span className="text-xs text-muted-foreground/50">—</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Doc handover</span>
                  {handoverLabel
                    ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${step.documentHandover === "yes" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : step.documentHandover === "no" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>{handoverLabel}</span>
                    : <span className="text-xs text-muted-foreground/50">—</span>}
                </div>
              </>
            );
          })()}

          {/* Returning-specific fields */}
          {step.stepName === "returning" && (() => {
            const yesNo = (val: string | null | undefined, invertGood?: boolean) => {
              if (!val) return <span className="text-xs text-muted-foreground/50">—</span>;
              if (val === "not_required") return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Not Required</span>;
              const isGood = invertGood ? val === "no" : val === "yes";
              return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isGood ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>{val === "yes" ? "Yes" : "No"}</span>;
            };
            return (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Client copy</span>
                  {yesNo(step.clientCopyReceived)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">HDD received</span>
                  {yesNo(step.hddReceivedByClient)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Doc signed</span>
                  {yesNo(step.handoverDocumentSigned)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Unreturned</span>
                  {yesNo(step.unreturnedMaterials, true)}
                </div>
              </>
            );
          })()}
        </div>
        {step.notes && <p className="text-xs text-muted-foreground mt-2 italic border-t border-border/50 pt-2">{step.notes}</p>}
      </div>

      {/* Staff: show lock badge on steps that aren't theirs */}
      {isStaffView && !canActOnThisStep && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground px-2 flex-shrink-0">
          <Lock size={11} />
          Unassigned
        </span>
      )}

      {/* Update dialog — shown for admins always, staff only on their step */}
      {canActOnThisStep && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-shrink-0" data-testid={`button-update-step-${step.stepName}`}>
              Update
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update: {STEP_LABELS[step.stepName]}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Assign To: only shown for admins; staff are auto-assigned to themselves */}
              {!isStaffView && (
                <div>
                  <Label className="flex items-center gap-1">
                    Assign To
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedUser} onValueChange={v => { setSelectedUser(v); setSelectedUserError(""); }}>
                    <SelectTrigger className={`mt-1 ${selectedUserError ? "border-destructive" : ""}`}>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminUser && (
                        <SelectItem value="__admin__">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck size={12} className="text-primary" />
                            {adminUser.displayName} (Admin)
                          </span>
                        </SelectItem>
                      )}
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUserError && (
                    <p className="text-xs text-destructive mt-1">{selectedUserError}</p>
                  )}
                </div>
              )}
              {splitConfig ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="flex items-center gap-1">
                        {splitConfig.primary}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={itemCount}
                        onChange={e => { setItemCount(e.target.value); setItemCountError(""); }}
                        placeholder="0"
                        className={`mt-1 ${itemCountError ? "border-destructive" : ""}`}
                      />
                      {itemCountError && <p className="text-xs text-destructive mt-1">{itemCountError}</p>}
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        {splitConfig.secondary}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={itemCountSecondary}
                        onChange={e => { setItemCountSecondary(e.target.value); setItemCountSecondaryError(""); }}
                        placeholder="0"
                        className={`mt-1 ${itemCountSecondaryError ? "border-destructive" : ""}`}
                      />
                      {itemCountSecondaryError && <p className="text-xs text-destructive mt-1">{itemCountSecondaryError}</p>}
                    </div>
                  </div>
                  {itemCount !== "" && itemCountSecondary !== "" && !isNaN(parseInt(itemCount)) && !isNaN(parseInt(itemCountSecondary)) && (
                    <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                      Total: <span className="font-semibold text-foreground">{parseInt(itemCount) + parseInt(itemCountSecondary)}</span> items
                    </p>
                  )}
                  {/* QC-only additional fields */}
                  {isQcStep && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <Label className="flex items-center gap-1">
                          Copy for client?
                          <span className="text-destructive">*</span>
                        </Label>
                        <Select value={copyForClient} onValueChange={v => { setCopyForClient(v); setCopyForClientError(""); }}>
                          <SelectTrigger className={`mt-1 ${copyForClientError ? "border-destructive" : ""}`}>
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
                        <Label className="flex items-center gap-1">
                          Storage prepared?
                          <span className="text-destructive">*</span>
                        </Label>
                        <Select value={storagePrepared} onValueChange={v => { setStoragePrepared(v); setStoragePreparedError(""); }}>
                          <SelectTrigger className={`mt-1 ${storagePreparedError ? "border-destructive" : ""}`}>
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
                </div>
              ) : (
                <div>
                  <Label className="flex items-center gap-1">
                    Item Count
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={itemCount}
                    onChange={e => { setItemCount(e.target.value); setItemCountError(""); }}
                    placeholder="Enter number of items"
                    className={`mt-1 ${itemCountError ? "border-destructive" : ""}`}
                  />
                  {itemCountError && (
                    <p className="text-xs text-destructive mt-1">{itemCountError}</p>
                  )}
                </div>
              )}
              {/* Returning-only additional fields */}
              {isReturningStep && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1">
                      Client copy received?
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={clientCopyReceived} onValueChange={v => { setClientCopyReceived(v); setClientCopyReceivedError(""); }}>
                      <SelectTrigger className={`mt-1 ${clientCopyReceivedError ? "border-destructive" : ""}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="not_required">Not Required</SelectItem>
                      </SelectContent>
                    </Select>
                    {clientCopyReceivedError && <p className="text-xs text-destructive mt-1">{clientCopyReceivedError}</p>}
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      HDD received by client?
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={hddReceivedByClient} onValueChange={v => { setHddReceivedByClient(v); setHddReceivedByClientError(""); }}>
                      <SelectTrigger className={`mt-1 ${hddReceivedByClientError ? "border-destructive" : ""}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="not_required">Not Required</SelectItem>
                      </SelectContent>
                    </Select>
                    {hddReceivedByClientError && <p className="text-xs text-destructive mt-1">{hddReceivedByClientError}</p>}
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      Handover document signed?
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={handoverDocumentSigned} onValueChange={v => { setHandoverDocumentSigned(v); setHandoverDocumentSignedError(""); }}>
                      <SelectTrigger className={`mt-1 ${handoverDocumentSignedError ? "border-destructive" : ""}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="not_required">Not Required</SelectItem>
                      </SelectContent>
                    </Select>
                    {handoverDocumentSignedError && <p className="text-xs text-destructive mt-1">{handoverDocumentSignedError}</p>}
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      Unreturned materials?
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={unreturnedMaterials} onValueChange={v => { setUnreturnedMaterials(v); setUnreturnedMaterialsError(""); }}>
                      <SelectTrigger className={`mt-1 ${unreturnedMaterialsError ? "border-destructive" : ""}`}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                    {unreturnedMaterialsError && <p className="text-xs text-destructive mt-1">{unreturnedMaterialsError}</p>}
                  </div>
                </div>
              )}
              {/* Repacking-only additional fields */}
              {isRepackingStep && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1">
                      HDD ready?
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={hddReady} onValueChange={v => { setHddReady(v); setHddReadyError(""); }}>
                      <SelectTrigger className={`mt-1 ${hddReadyError ? "border-destructive" : ""}`}>
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
                    <Label className="flex items-center gap-1">
                      Document handover?
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select value={documentHandover} onValueChange={v => { setDocumentHandover(v); setDocumentHandoverError(""); }}>
                      <SelectTrigger className={`mt-1 ${documentHandoverError ? "border-destructive" : ""}`}>
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
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              {isRepackingStep && selectedStatus === "completed" && documentHandover === "not_yet" && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  Document handover must not be "Not Yet" to mark as Completed.
                </p>
              )}
              <Button
                className="w-full"
                disabled={updateMutation.isPending}
                onClick={() => {
                  if (!isStaffView && !selectedUser) {
                    setSelectedUserError("Please select a team member");
                    return;
                  }
                  if (!itemCount || itemCount.trim() === "") {
                    setItemCountError(splitConfig ? `${splitConfig.primary} count is required` : "Item count is required");
                    return;
                  }
                  const count = parseInt(itemCount, 10);
                  if (isNaN(count) || count < 0) {
                    setItemCountError("Enter a valid number (0 or above)");
                    return;
                  }
                  let countSecondary: number | undefined;
                  if (splitConfig) {
                    if (!itemCountSecondary || itemCountSecondary.trim() === "") {
                      setItemCountSecondaryError(`${splitConfig.secondary} count is required`);
                      return;
                    }
                    const s = parseInt(itemCountSecondary, 10);
                    if (isNaN(s) || s < 0) {
                      setItemCountSecondaryError("Enter a valid number (0 or above)");
                      return;
                    }
                    countSecondary = s;
                  }
                  if (isQcStep) {
                    if (!copyForClient) { setCopyForClientError("Required"); return; }
                    if (selectedStatus === "completed" && copyForClient === "not_yet") {
                      setCopyForClientError("Must not be 'Not Yet' to mark as Completed"); return;
                    }
                    if (!storagePrepared) { setStoragePreparedError("Required"); return; }
                  }
                  if (isRepackingStep) {
                    if (!hddReady) { setHddReadyError("Required"); return; }
                    if (selectedStatus === "completed" && hddReady === "not_yet") {
                      setHddReadyError("Must be 'Yes', 'Later', or 'Not Required' to mark as Completed");
                      return;
                    }
                    if (!documentHandover) { setDocumentHandoverError("Required"); return; }
                    if (selectedStatus === "completed" && documentHandover === "not_yet") {
                      setDocumentHandoverError("Must be 'Yes' or 'Not Required' to mark as Completed");
                      return;
                    }
                  }
                  if (isReturningStep) {
                    if (!clientCopyReceived) { setClientCopyReceivedError("Required"); return; }
                    if (!hddReceivedByClient) { setHddReceivedByClientError("Required"); return; }
                    if (!handoverDocumentSigned) { setHandoverDocumentSignedError("Required"); return; }
                    if (!unreturnedMaterials) { setUnreturnedMaterialsError("Required"); return; }
                    if (selectedStatus === "completed") {
                      if (clientCopyReceived !== "yes" && clientCopyReceived !== "not_required") { setClientCopyReceivedError("Must be 'Yes' or 'Not Required' to mark as Completed"); return; }
                      if (hddReceivedByClient !== "yes" && hddReceivedByClient !== "not_required") { setHddReceivedByClientError("Must be 'Yes' or 'Not Required' to mark as Completed"); return; }
                      if (handoverDocumentSigned !== "yes" && handoverDocumentSigned !== "not_required") { setHandoverDocumentSignedError("Must be 'Yes' or 'Not Required' to mark as Completed"); return; }
                      if (unreturnedMaterials !== "no") { setUnreturnedMaterialsError("Must be 'No' (no leftover items) to mark as Completed"); return; }
                    }
                  }
                  updateMutation.mutate({
                    id: boxId,
                    data: {
                      stepName: step.stepName as typeof STEPS[number],
                      status: selectedStatus as "pending" | "in_progress" | "completed" | "skipped",
                      assignedUserId: resolvedAssignedUserId,
                      notes: notes || null,
                      itemCount: count,
                      ...(countSecondary !== undefined ? { itemCountSecondary: countSecondary } : {}),
                      ...(isQcStep ? { copyForClient: copyForClient || null, storagePrepared: storagePrepared || null } : {}),
                      ...(isRepackingStep ? { hddReady: hddReady || null, documentHandover: documentHandover || null } : {}),
                      ...(isReturningStep ? { clientCopyReceived: clientCopyReceived || null, hddReceivedByClient: hddReceivedByClient || null, handoverDocumentSigned: handoverDocumentSigned || null, unreturnedMaterials: unreturnedMaterials || null } : {}),
                    },
                  });
                }}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

const MATERIAL_TYPES = [
  { value: "newspaper", label: "Newspaper" },
  { value: "maps", label: "Maps" },
  { value: "books", label: "Books" },
  { value: "magazine", label: "Magazine" },
  { value: "archives", label: "Archives" },
  { value: "heritage_items", label: "Heritage Items" },
] as const;

const PRIORITY_LEVELS = [
  { value: "P0", label: "P0 — Very Urgent" },
  { value: "P1", label: "P1 — Urgent" },
  { value: "P2", label: "P2 — Medium" },
  { value: "P3", label: "P3 — Low" },
] as const;

const CUSTODY_TYPES = [
  { value: "loan", label: "On Loan (Borrowed)" },
  { value: "ptad", label: "PTAD (Acquired)" },
  { value: "project", label: "Project (Temporary)" },
] as const;

const editSchema = z.object({
  clientName: z.string().min(1, "Project name is required"),
  collectionsOwner: z.string().optional(),
  placeOfOrigin: z.string().optional(),
  status: z.enum(["received", "in_progress", "completed", "returned"]).optional(),
  materialTypes: z.array(z.enum(["newspaper", "maps", "books", "magazine", "archives", "heritage_items"])).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  custodyType: z.enum(["loan", "ptad", "project"]).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  archiveYear: z.string().optional(),
  totalBoxes: z.coerce.number().int().min(1).optional().or(z.literal("")),
  totalItems: z.coerce.number().int().min(1).optional().or(z.literal("")),
  unknownItems: z.boolean().optional(),
  cost: z.coerce.number().min(0).optional().or(z.literal("")),
  notes: z.string().optional(),
  photoLink: z.string().optional(),
  deadline: z.string().optional(),
  inDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.collectionsOwner?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Collections owner is required", path: ["collectionsOwner"] });
  }
  if (data.totalBoxes === undefined || data.totalBoxes === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Total boxes is required", path: ["totalBoxes"] });
  }
  if (!data.unknownItems && (data.totalItems === undefined || data.totalItems === "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Total items is required (or check Unknown)", path: ["totalItems"] });
  }
});

type EditFormValues = z.infer<typeof editSchema>;

function formatRupiah(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type BoxData = {
  id: number;
  clientName: string;
  collectionsOwner?: string | null;
  placeOfOrigin?: string | null;
  status: string;
  materialTypes?: string[] | null;
  priority?: string | null;
  custodyType?: string | null;
  description?: string | null;
  location?: string | null;
  archiveYear?: string | null;
  totalBoxes?: number | null;
  totalItems?: number | null;
  cost?: string | null;
  notes?: string | null;
  photoLink?: string | null;
  deadline?: string | null;
  inDate?: string | null;
};

function EditDetailsDialog({ box, onUpdated, autoOpen = false }: { box: BoxData; onUpdated: () => void; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  const [displayCost, setDisplayCost] = useState(
    box.cost ? formatRupiah(String(Math.round(parseFloat(box.cost)))) : ""
  );
  const [unknownItems, setUnknownItems] = useState(box.totalItems == null && box.totalBoxes != null);
  const { toast } = useToast();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: {
      clientName: box.clientName,
      collectionsOwner: box.collectionsOwner ?? "",
      placeOfOrigin: box.placeOfOrigin ?? "",
      status: (box.status as EditFormValues["status"]) ?? undefined,
      materialTypes: (box.materialTypes as EditFormValues["materialTypes"]) ?? [],
      priority: (box.priority as EditFormValues["priority"]) ?? undefined,
      custodyType: (box.custodyType as EditFormValues["custodyType"]) ?? undefined,
      description: box.description ?? "",
      location: box.location ?? "",
      archiveYear: box.archiveYear ?? "",
      totalBoxes: box.totalBoxes ?? "",
      totalItems: box.totalItems ?? "",
      unknownItems: box.totalItems == null && box.totalBoxes != null,
      cost: box.cost ? parseFloat(box.cost) : "",
      notes: box.notes ?? "",
      photoLink: box.photoLink ?? "",
      deadline: box.deadline ? new Date(box.deadline).toISOString().slice(0, 10) : "",
      inDate: box.inDate ? new Date(box.inDate).toISOString().slice(0, 10) : "",
    },
  });

  const updateMutation = useUpdateBox({
    mutation: {
      onSuccess: () => {
        toast({ title: "Item details updated" });
        setOpen(false);
        onUpdated();
      },
      onError: () => {
        toast({ title: "Failed to update item", variant: "destructive" });
      },
    },
  });

  function onSubmit(values: EditFormValues) {
    updateMutation.mutate({
      id: box.id,
      data: {
        clientName: values.clientName,
        collectionsOwner: values.collectionsOwner || null,
        placeOfOrigin: values.placeOfOrigin || null,
        status: values.status,
        materialTypes: values.materialTypes,
        priority: values.priority,
        custodyType: values.custodyType,
        description: values.description || undefined,
        location: values.location || undefined,
        archiveYear: values.archiveYear || undefined,
        totalBoxes: values.totalBoxes !== "" ? Number(values.totalBoxes) : undefined,
        totalItems: values.unknownItems ? null : (values.totalItems !== "" ? Number(values.totalItems) : undefined),
        cost: values.cost !== "" ? Number(values.cost) : null,
        notes: values.notes || undefined,
        photoLink: values.photoLink || null,
        deadline: values.deadline ? new Date(values.deadline) as unknown as null : null,
        inDate: values.inDate ? new Date(values.inDate) as unknown as null : null,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setDisplayCost(box.cost ? formatRupiah(String(Math.round(parseFloat(box.cost)))) : ""); form.reset(); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil size={14} /> Edit Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Item Details</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">

            <FormField control={form.control} name="clientName" render={({ field }) => (
              <FormItem>
              <FormLabel>Project Name <span className="text-destructive">*</span></FormLabel>
              <FormControl><Input placeholder="Project or department name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="collectionsOwner" render={({ field }) => (
              <FormItem>
                <FormLabel>Collections Owner <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Owner or custodian name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="placeOfOrigin" render={({ field }) => (
              <FormItem>
                <FormLabel>Place of Origin</FormLabel>
                <FormControl><Input placeholder="e.g. Jakarta, Surabaya" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="materialTypes" render={({ field }) => (
              <FormItem>
                <FormLabel>Material Type</FormLabel>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {MATERIAL_TYPES.map(t => (
                    <div key={t.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-mt-${t.value}`}
                        checked={field.value?.includes(t.value)}
                        onCheckedChange={(checked) => {
                          const cur = field.value ?? [];
                          field.onChange(checked ? [...cur, t.value] : cur.filter(v => v !== t.value));
                        }}
                      />
                      <label htmlFor={`edit-mt-${t.value}`} className="text-sm cursor-pointer">{t.label}</label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIORITY_LEVELS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div />
            </div>

            <FormField control={form.control} name="custodyType" render={({ field }) => (
              <FormItem>
                <FormLabel>Custody Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CUSTODY_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Brief description of contents" {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Depot PTAD</FormLabel>
                  <FormControl><Input placeholder="e.g. Lantai 1, Rak 3" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Price / Cost</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        className="pl-9"
                        value={displayCost}
                        onChange={(e) => {
                          const formatted = formatRupiah(e.target.value);
                          const raw = formatted.replace(/\./g, "");
                          setDisplayCost(formatted);
                          field.onChange(raw === "" ? "" : Number(raw));
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="archiveYear" render={({ field }) => (
              <FormItem>
                <FormLabel>Periode</FormLabel>
                <FormControl><Input placeholder="1854-1930" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="totalBoxes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Boxes <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="totalItems" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Total Items <span className="text-destructive">*</span></FormLabel>
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                      <Checkbox
                        checked={unknownItems}
                        onCheckedChange={(v) => {
                          setUnknownItems(!!v);
                          form.setValue("unknownItems", !!v);
                          if (v) form.setValue("totalItems", "");
                        }}
                      />
                      Unknown
                    </label>
                  </div>
                  <FormControl><Input type="number" min={0} placeholder="0" disabled={unknownItems} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="inDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Received</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="deadline" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deadline</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Special handling instructions, remarks..." {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="photoLink" render={({ field }) => (
              <FormItem>
                <FormLabel>Photo Proof Link</FormLabel>
                <FormControl><Input placeholder="Paste Google Drive link..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ETicketDialog({ boxId }: { boxId: number }) {
  const [open, setOpen] = useState(false);
  const { data: ticket, isLoading } = useGetBoxTicket(boxId, {
    query: { enabled: open, queryKey: getGetBoxTicketQueryKey(boxId) },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-generate-ticket">
          <Ticket size={16} className="mr-2" />
          Generate E-Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode size={18} />
            E-Ticket — {ticket?.boxCode}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="h-60 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : ticket ? (
          <div className="space-y-5" id="ticket-print-area">
            <div className="flex gap-6 items-start">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wide">Box Code</span>
                    <span className="font-mono font-bold text-base">{ticket.boxCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wide">Ticket Code</span>
                    <span className="font-mono text-xs">{ticket.ticketCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wide">Client</span>
                    <span className="font-medium">{ticket.clientName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wide">Status</span>
                    <BoxStatusBadge status={ticket.status} />
                  </div>
                  {ticket.location && (
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wide">Location</span>
                      <span>{ticket.location}</span>
                    </div>
                  )}
                  {ticket.archiveYear && (
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wide">Year</span>
                      <span>{ticket.archiveYear}</span>
                    </div>
                  )}
                  {ticket.totalItems && (
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wide">Items</span>
                      <span>{ticket.totalItems}</span>
                    </div>
                  )}
                  {ticket.inDate && (
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wide">In Date</span>
                      <span>{format(new Date(ticket.inDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <img
                  src={ticket.qrCodeUrl}
                  alt="QR Code"
                  className="w-36 h-36 border border-border rounded"
                  data-testid="ticket-qr-code"
                />
                <p className="text-xs text-muted-foreground text-center mt-1">Scan to update</p>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Workflow Steps</p>
              <div className="space-y-1">
                {ticket.workflowSteps.map(step => (
                  <div key={step.id} className="flex items-center gap-2 text-sm">
                    {step.status === "completed" ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : step.status === "in_progress" ? (
                      <Clock size={14} className="text-amber-500" />
                    ) : (
                      <Circle size={14} className="text-muted-foreground/40" />
                    )}
                    <span className={step.status === "completed" ? "text-foreground" : "text-muted-foreground"}>
                      {STEP_LABELS[step.stepName]}
                    </span>
                    {step.status === "completed" && step.completedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(step.completedAt), "MMM d")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => ticket?.ticketCode && window.open(`/label/${ticket.ticketCode}`, "_blank")}
              data-testid="button-print-ticket"
            >
              Print
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function BoxDetailPage() {
  const [, params] = useRoute("/boxes/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const search = useSearch();
  const autoOpenEdit = new URLSearchParams(search).get("edit") === "true";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: staffIdentity } = useQuery({
    queryKey: ["auth-me-identity"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/auth/me/identity`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json() as Promise<{ userId: number | null; workflowStep: string | null; workflowSteps: string[]; roleName: string | null }>;
    },
    enabled: !!user && !isAdmin,
  });

  const { data: box, isLoading } = useGetBox(id, {
    query: { enabled: !!id, queryKey: getGetBoxQueryKey(id) },
  });
  const { data: steps, isLoading: stepsLoading } = useGetBoxWorkflow(id, {
    query: { enabled: !!id, queryKey: getGetBoxWorkflowQueryKey(id) },
  });
  const { data: users } = useListUsers();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBoxQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetBoxWorkflowQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListBoxesQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-60 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!box) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Box not found</p>
        <Link href="/boxes"><Button className="mt-4" variant="outline">Back to Boxes</Button></Link>
      </div>
    );
  }

  const deadlineStatus = getDeadlineStatus(box.deadline, box.status);

  return (
    <div className="space-y-5" data-testid="box-detail-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/boxes">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground tracking-tight font-mono">{box.boxCode}</h1>
            <BoxStatusBadge status={box.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{box.clientName}{box.collectionsOwner ? ` · ${box.collectionsOwner}` : ""}</p>
        </div>
        {isAdmin && <EditDetailsDialog box={box} onUpdated={invalidate} autoOpen={autoOpenEdit} />}
        <ETicketDialog boxId={id} />
      </div>

      {/* Deadline Alert Banner */}
      {deadlineStatus && (deadlineStatus.type === "overdue" || deadlineStatus.type === "today") && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium">
            {deadlineStatus.type === "today" ? "This box is due today!" : `This box is ${deadlineStatus.label}. Immediate attention required.`}
          </span>
        </div>
      )}
      {deadlineStatus && deadlineStatus.type === "soon" && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
          <Clock size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium">{deadlineStatus.label} — please ensure processing is on track.</span>
        </div>
      )}

      {/* Box Info */}
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Package size={16} className="text-primary" /> Box Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {box.collectionsOwner && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Collections Owner</span>
                <p className="font-medium">{box.collectionsOwner}</p>
              </div>
            )}
            {box.materialTypes && box.materialTypes.length > 0 && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Material Type</span>
                <p className="font-medium capitalize">{box.materialTypes.map(t => t.replace("_", " ")).join(", ")}</p>
              </div>
            )}
            {box.placeOfOrigin && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Place of Origin</span>
                <p className="font-medium">{box.placeOfOrigin}</p>
              </div>
            )}
            {box.priority && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Priority</span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
                  box.priority === "P0" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                  box.priority === "P1" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" :
                  box.priority === "P2" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {box.priority} — {box.priority === "P0" ? "Very Urgent" : box.priority === "P1" ? "Urgent" : box.priority === "P2" ? "Medium" : "Low"}
                </span>
              </div>
            )}
            {box.custodyType && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Custody Type</span>
                <p className="font-medium">{box.custodyType === "loan" ? "On Loan" : box.custodyType === "ptad" ? "PTAD" : box.custodyType === "project" ? "Project" : box.custodyType}</p>
              </div>
            )}
            {box.description && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-wide mb-1">
                  <FileText size={11} /> Description
                </span>
                <p>{box.description}</p>
              </div>
            )}
            {box.location && (
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-wide mb-1">
                  <MapPin size={11} /> Depot PTAD
                </span>
                <p className="font-medium">{box.location}</p>
              </div>
            )}
            {box.archiveYear && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Archive Year</span>
                <p className="font-medium">{box.archiveYear}</p>
              </div>
            )}
            {box.totalBoxes !== undefined && box.totalBoxes !== null && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Total Boxes</span>
                <p className="font-medium">{box.totalBoxes}</p>
              </div>
            )}
            {box.totalItems !== undefined && box.totalItems !== null ? (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Total Items</span>
                <p className="font-medium">{box.totalItems}</p>
              </div>
            ) : box.totalBoxes !== undefined && box.totalBoxes !== null ? (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Total Items</span>
                <p className="font-medium text-muted-foreground italic">Unknown</p>
              </div>
            ) : null}
            {isAdmin && box.cost && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Price / Cost</span>
                <p className="font-semibold text-foreground">
                  {parseFloat(box.cost).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
            {box.inDate && (
              <div>
                <span className="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-wide mb-1">
                  <Calendar size={11} /> In Date
                </span>
                <p className="font-medium">{format(new Date(box.inDate), "MMM d, yyyy")}</p>
              </div>
            )}
            {box.deadline && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Deadline</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{format(new Date(box.deadline), "MMM d, yyyy")}</p>
                  {deadlineStatus && deadlineStatus.type !== "ok" && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      deadlineStatus.type === "overdue" || deadlineStatus.type === "today"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                    }`}>
                      {deadlineStatus.label}
                    </span>
                  )}
                </div>
              </div>
            )}
            {box.outDate && (
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Out Date</span>
                <p className="font-medium">{format(new Date(box.outDate), "MMM d, yyyy")}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Ticket Code</span>
              <p className="font-mono text-xs bg-muted px-2 py-0.5 rounded inline-block">{box.ticketCode}</p>
            </div>
            {box.notes && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Notes</span>
                <p className="text-muted-foreground italic">{box.notes}</p>
              </div>
            )}
            {box.photoLink && (
              <div className="col-span-2 md:col-span-3">
                <span className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">Photo Proof</span>
                <a
                  href={box.photoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                >
                  <ExternalLink size={13} /> View Photo Proof
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Item count mismatch warning */}
          {(() => {
            const counted = (steps ?? []).filter(s => s.itemCount != null);
            const unique = new Set(counted.map(s => s.itemCount));
            if (counted.length >= 2 && unique.size > 1) {
              return (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-sm">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠</span>
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-300">Item count mismatch</p>
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                      Different item counts were recorded across workflow steps:&nbsp;
                      {(steps ?? [])
                        .filter(s => s.itemCount != null)
                        .map(s => `${STEP_LABELS[s.stepName]} (${s.itemCount})`)
                        .join(", ")}
                      . Please verify and correct the counts.
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          {stepsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))
          ) : steps?.map(step => (
            <WorkflowStepCard
              key={step.id}
              step={step}
              boxId={id}
              users={users ?? []}
              onUpdated={invalidate}
              staffIdentity={!isAdmin && staffIdentity?.userId ? staffIdentity as { userId: number; workflowStep: string | null } : null}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
