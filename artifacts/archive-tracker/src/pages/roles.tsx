import { useState } from "react";
import {
  useListRoles, useCreateRole, useUpdateRole, useDeleteRole,
  getListRolesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

import { STEP_LABELS, STEP_COLORS } from "@/lib/steps";

const WORKFLOW_STEPS = ["cleaning", "cataloging", "scanning", "qc", "repacking", "returning", "admin"] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  workflowStep: z.enum(WORKFLOW_STEPS),
  description: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

function RoleForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", workflowStep: "cleaning", description: "", ...defaultValues },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Scanning Team" {...field} data-testid="input-role-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workflowStep"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workflow Step *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-workflow-step">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WORKFLOW_STEPS.map(step => (
                    <SelectItem key={step} value={step}>{STEP_LABELS[step]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description..." rows={2} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-role">
          {isPending ? "Saving..." : "Save Role"}
        </Button>
      </form>
    </Form>
  );
}

export default function RolesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [editRole, setEditRole] = useState<{ id: number; name: string; workflowStep: string; description?: string | null } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: roles, isLoading } = useListRoles({
    query: { queryKey: getListRolesQueryKey() },
  });

  const createMutation = useCreateRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
        toast({ title: "Role created" });
        setOpenCreate(false);
      },
      onError: () => toast({ title: "Failed to create role", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
        toast({ title: "Role updated" });
        setEditRole(null);
      },
      onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
        toast({ title: "Role deleted" });
        setDeleteId(null);
      },
      onError: () => toast({ title: "Failed to delete role", variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-5" data-testid="roles-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Define team roles and their workflow permissions</p>
        </div>
        <Button onClick={() => setOpenCreate(true)} data-testid="button-new-role">
          <Plus size={16} className="mr-2" />
          New Role
        </Button>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader className="[&_tr]:border-slate-200 dark:[&_tr]:border-slate-700">
            <TableRow className="bg-muted/30">
              <TableHead>Role Name</TableHead>
              <TableHead>Workflow Step</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-slate-100 dark:[&_tr]:border-slate-800">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {[1,2,3,4].map(j => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>)}
                </TableRow>
              ))
            ) : roles?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <Shield size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No roles defined yet</p>
                </TableCell>
              </TableRow>
            ) : (
              roles?.map(role => (
                <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                  <TableCell className="font-semibold">{role.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STEP_COLORS[role.workflowStep] ?? ""}>
                      {STEP_LABELS[role.workflowStep] ?? role.workflowStep}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{role.description ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setEditRole(role)}
                        data-testid={`button-edit-role-${role.id}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(role.id)}
                        data-testid={`button-delete-role-${role.id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Role</DialogTitle></DialogHeader>
          <RoleForm
            onSubmit={values => createMutation.mutate({
              data: {
                name: values.name,
                workflowStep: values.workflowStep,
                description: values.description ?? null,
              },
            })}
            isPending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRole} onOpenChange={v => !v && setEditRole(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Role</DialogTitle></DialogHeader>
          {editRole && (
            <RoleForm
              defaultValues={{
                name: editRole.name,
                workflowStep: editRole.workflowStep as typeof WORKFLOW_STEPS[number],
                description: editRole.description,
              }}
              onSubmit={values => updateMutation.mutate({
                id: editRole.id,
                data: { name: values.name, workflowStep: values.workflowStep, description: values.description ?? null },
              })}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this role? Team members assigned to this role will be unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
