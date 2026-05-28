import { useState, useEffect } from "react";
import { useListRoles, getListRolesQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, KeyRound, ShieldOff, RefreshCw, Eye, EyeOff } from "lucide-react";

import { STEP_COLORS } from "@/lib/steps";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type RoleInfo = { id: number; name: string; workflowStep: string };
type UserRow = {
  id: number;
  name: string;
  email?: string | null;
  active: string | boolean;
  roles: RoleInfo[];
  hasAccount?: boolean;
  accountUsername?: string | null;
  accountActive?: boolean | null;
};

const USERS_QUERY_KEY = ["users-list"];

function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/users`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch users");
      return r.json();
    },
  });
}

function PasswordInput({ placeholder, value, onChange }: { placeholder?: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} className="pr-10" />
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function RoleCheckboxes({ roles, selected, onChange }: {
  roles: RoleInfo[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }
  return (
    <div className="space-y-2">
      {roles.map(role => (
        <label key={role.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
          <Checkbox
            checked={selected.includes(role.id)}
            onCheckedChange={() => toggle(role.id)}
          />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{role.name}</span>
            <Badge variant="outline" className={`text-xs shrink-0 ${STEP_COLORS[role.workflowStep] ?? ""}`}>
              {role.workflowStep}
            </Badge>
          </div>
        </label>
      ))}
      {roles.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">No roles defined yet</p>
      )}
    </div>
  );
}

function MemberForm({
  initial,
  roles,
  onClose,
  onRefresh,
}: {
  initial?: UserRow;
  roles: RoleInfo[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [selectedRoles, setSelectedRoles] = useState<number[]>(initial?.roles.map(r => r.id) ?? []);
  const [active, setActive] = useState<string>(initial ? (initial.active === true || initial.active === "true" ? "true" : "false") : "true");
  const [grantLogin, setGrantLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email";
    if (grantLogin && !initial?.hasAccount) {
      if (loginUsername.trim().length < 2) errs.loginUsername = "Min. 2 characters";
      else if (!/^[a-z0-9_]+$/.test(loginUsername.trim())) errs.loginUsername = "Lowercase letters, numbers, underscores only";
      if (loginPassword.length < 4) errs.loginPassword = "Min. 4 characters";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim() || null,
        roleIds: selectedRoles,
        active: active === "true",
      };
      if (!initial && grantLogin && loginUsername && loginPassword) {
        body.loginUsername = loginUsername.trim().toLowerCase();
        body.loginPassword = loginPassword;
      }

      const url = initial ? `${BASE}/api/users/${initial.id}` : `${BASE}/api/users`;
      const r = await fetch(url, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to save");
      }

      toast({ title: initial ? "Member updated" : "Member added" });
      onRefresh();
      onClose();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Full Name *</Label>
        <Input placeholder="e.g. Maria Santos" value={name} onChange={e => setName(e.target.value)} data-testid="input-user-name" />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Email</Label>
        <Input type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      {/* Roles */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Roles <span className="text-muted-foreground font-normal">(select all that apply)</span></Label>
        <RoleCheckboxes roles={roles} selected={selectedRoles} onChange={setSelectedRoles} />
      </div>

      {/* Status (edit only) */}
      {initial && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={active} onValueChange={setActive}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Login access (create only) */}
      {!initial && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-orange-500" />
                Grant Login Access
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Allow this person to sign in to the app</p>
            </div>
            <Switch checked={grantLogin} onCheckedChange={setGrantLogin} />
          </div>
          {grantLogin && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-sm">Username</Label>
                <Input placeholder="e.g. maria_santos" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} autoComplete="off" />
                {errors.loginUsername && <p className="text-xs text-destructive">{errors.loginUsername}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Password</Label>
                <PasswordInput placeholder="Min. 4 characters" value={loginPassword} onChange={setLoginPassword} />
                {errors.loginPassword && <p className="text-xs text-destructive">{errors.loginPassword}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full" data-testid="button-submit-user">
        {loading ? "Saving..." : initial ? "Save Changes" : "Add Team Member"}
      </Button>
    </form>
  );
}

function ManageAccountDialog({ user, open, onOpenChange, onRefresh }: {
  user: UserRow; open: boolean; onOpenChange: (v: boolean) => void; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [username, setUsername] = useState(user.accountUsername ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (username.trim().length < 2) errs.username = "Min. 2 characters";
    else if (!/^[a-z0-9_]+$/.test(username.trim())) errs.username = "Lowercase, numbers, underscores only";
    if (password.length < 4) errs.password = "Min. 4 characters";
    return errs;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/users/${user.id}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed");
      }
      toast({ title: user.hasAccount ? "Credentials updated" : "Login account created" });
      onRefresh(); onOpenChange(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleToggleActive() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/users/${user.id}/account/active`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ active: !user.accountActive }),
      });
      if (!r.ok) throw new Error("Failed");
      toast({ title: user.accountActive ? "Login suspended" : "Login restored" });
      onRefresh(); onOpenChange(false);
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function handleRevoke() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/users/${user.id}/account`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      toast({ title: "Login access removed" });
      onRefresh(); onOpenChange(false); setDelConfirm(false);
    } catch { toast({ title: "Error removing login", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-500" />
              Login Access — {user.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {user.hasAccount && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">@{user.accountUsername}</p>
                  <p className="text-xs text-muted-foreground">Current username</p>
                </div>
                <Badge variant="outline" className={user.accountActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"}>
                  {user.accountActive ? "Active" : "Suspended"}
                </Badge>
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{user.hasAccount ? "Change Username" : "Username"}</Label>
                <Input placeholder="e.g. maria_santos" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{user.hasAccount ? "New Password" : "Password"}</Label>
                <PasswordInput placeholder="Min. 4 characters" value={password} onChange={setPassword} />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {user.hasAccount ? "Update Credentials" : "Create Login Account"}
              </Button>
            </form>
            {user.hasAccount && (
              <div className="flex gap-2 pt-1 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1" disabled={loading} onClick={handleToggleActive}>
                  <ShieldOff className="w-4 h-4 mr-1.5" />
                  {user.accountActive ? "Suspend Login" : "Restore Login"}
                </Button>
                <Button variant="outline" size="sm"
                  className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={loading} onClick={() => setDelConfirm(true)}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Revoke Access
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={delConfirm} onOpenChange={setDelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Login Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{user.name}</strong>'s ability to log in. Their work history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRevoke}>
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function TeamPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [accountUser, setAccountUser] = useState<UserRow | null>(null);

  const { data: users, isLoading } = useUsers();
  const { data: roles } = useListRoles({ query: { queryKey: getListRolesQueryKey() } });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

  async function handleDelete(id: number) {
    try {
      const r = await fetch(`${BASE}/api/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      toast({ title: "Team member removed" });
      refresh();
      setDeleteId(null);
    } catch {
      toast({ title: "Failed to remove team member", variant: "destructive" });
    }
  }

  const typedRoles = (roles ?? []) as RoleInfo[];

  return (
    <div className="space-y-5" data-testid="team-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members, roles, and login access</p>
        </div>
        <Button onClick={() => setOpenCreate(true)} data-testid="button-new-user">
          <Plus size={16} className="mr-2" />
          Add Member
        </Button>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader className="[&_tr]:border-slate-200 dark:[&_tr]:border-slate-700">
            <TableRow className="bg-muted/30">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-slate-100 dark:[&_tr]:border-slate-800">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {[1,2,3,4,5,6].map(j => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>)}
                </TableRow>
              ))
            ) : !users || users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No team members yet</p>
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-semibold">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.email ?? "—"}</TableCell>
                  <TableCell>
                    {user.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map(r => (
                          <Badge key={r.id} variant="outline" className={`text-xs ${STEP_COLORS[r.workflowStep] ?? ""}`}>
                            {r.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      user.active === true || user.active === "true"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-muted text-muted-foreground"
                    }>
                      {user.active === true || user.active === "true" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.hasAccount ? (
                      <Badge
                        variant="outline"
                        className={`cursor-pointer text-xs ${user.accountActive
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-orange-50 text-orange-700 border-orange-200"}`}
                        onClick={() => setAccountUser(user)}
                      >
                        <KeyRound className="w-3 h-3 mr-1" />
                        {user.accountActive ? `@${user.accountUsername}` : "Suspended"}
                      </Badge>
                    ) : (
                      <button
                        className="text-xs text-muted-foreground hover:text-orange-600 flex items-center gap-1 transition-colors"
                        onClick={() => setAccountUser(user)}
                      >
                        <Plus className="w-3 h-3" /> Add login
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setEditUser(user)} title="Edit member"
                        data-testid={`button-edit-user-${user.id}`}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setAccountUser(user)} title="Manage login">
                        <KeyRound size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(user.id)} title="Remove member"
                        data-testid={`button-delete-user-${user.id}`}>
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

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <MemberForm roles={typedRoles} onClose={() => setOpenCreate(false)} onRefresh={refresh} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Team Member</DialogTitle></DialogHeader>
          {editUser && (
            <MemberForm
              initial={editUser}
              roles={typedRoles}
              onClose={() => setEditUser(null)}
              onRefresh={refresh}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Account management dialog */}
      {accountUser && (
        <ManageAccountDialog
          user={accountUser}
          open={!!accountUser}
          onOpenChange={v => !v && setAccountUser(null)}
          onRefresh={refresh}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this team member. Their login account (if any) will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && handleDelete(deleteId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
