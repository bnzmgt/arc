import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { Plus, Pencil, Trash2, ShieldCheck, Crown, User, Eye, EyeOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Account = {
  id: number;
  username: string;
  displayName: string;
  active: boolean;
  accountLevel: string;
  userId: number | null;
  createdAt: string;
};

const LEVEL_META: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  superadmin: {
    label: "Super Admin",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <Crown className="w-3 h-3" />,
  },
  admin: {
    label: "Admin",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  user: {
    label: "Staff",
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <User className="w-3 h-3" />,
  },
};

const ACCOUNTS_KEY = ["admin-accounts"];

function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin-accounts`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch accounts");
      return r.json();
    },
  });
}

function PasswordInput({ placeholder, value, onChange }: {
  placeholder?: string; value: string; onChange: (v: string) => void;
}) {
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

function CreateAccountDialog({ open, onOpenChange, onRefresh }: {
  open: boolean; onOpenChange: (v: boolean) => void; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [level, setLevel] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setUsername(""); setPassword(""); setDisplayName(""); setLevel("admin"); setErrors({});
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (username.trim().length < 2) errs.username = "Min. 2 characters";
    else if (!/^[a-z0-9_]+$/.test(username.trim())) errs.username = "Lowercase, numbers, underscores only";
    if (password.length < 4) errs.password = "Min. 4 characters";
    if (!displayName.trim()) errs.displayName = "Display name is required";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim().toLowerCase(), password, displayName: displayName.trim(), accountLevel: level }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Account created" });
      onRefresh(); onOpenChange(false); reset();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Admin Account</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Display Name *</Label>
            <Input placeholder="e.g. Jane Doe" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="off" />
            {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Username *</Label>
            <Input placeholder="e.g. jane_doe" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
            {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Password *</Label>
            <PasswordInput placeholder="Min. 4 characters" value={password} onChange={setPassword} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Access Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="superadmin">Super Admin — full access</SelectItem>
                <SelectItem value="admin">Admin — manage boxes, team, roles</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Staff-level accounts are created through the Team page.</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountDialog({ account, open, onOpenChange, onRefresh }: {
  account: Account; open: boolean; onOpenChange: (v: boolean) => void; onRefresh: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSelf = account.id === user?.id;
  const isStaffAccount = account.userId !== null;
  const [displayName, setDisplayName] = useState(account.displayName);
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState("");
  const safeLevel = account.accountLevel === "user" ? "admin" : account.accountLevel;
  const [level, setLevel] = useState(safeLevel);
  const [active, setActive] = useState(account.active);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, unknown> = {};
    if (displayName.trim() && displayName.trim() !== account.displayName) updates.displayName = displayName.trim();
    if (username.trim() && username.trim() !== account.username) updates.username = username.trim().toLowerCase();
    if (password) updates.password = password;
    if (level !== account.accountLevel) updates.accountLevel = level;
    if (active !== account.active) updates.active = active;

    if (Object.keys(updates).length === 0) { onOpenChange(false); return; }

    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Account updated" });
      onRefresh(); onOpenChange(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account — @{account.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Display Name</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">New Password <span className="text-muted-foreground font-normal">(leave blank to keep)</span></Label>
            <PasswordInput placeholder="Leave blank to keep" value={password} onChange={setPassword} />
          </div>
          {!isSelf && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Access Level</Label>
                {isStaffAccount ? (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    This is a staff account linked to a team member. Manage it from the <strong>Team page</strong>.
                  </p>
                ) : (
                  <>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="superadmin">Super Admin — full access</SelectItem>
                        <SelectItem value="admin">Admin — manage boxes, team, roles</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={active ? "true" : "false"} onValueChange={v => setActive(v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {isSelf && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              You cannot change your own access level or suspend your own account.
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAccountsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: accounts, isLoading } = useAccounts();

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
  }

  async function handleDelete(id: number) {
    try {
      const r = await fetch(`${BASE}/api/admin-accounts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Account deleted" });
      refresh();
      setDeleteId(null);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Account Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage admin and superadmin login accounts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          Create Account
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> Staff accounts are managed from the <a href={`${import.meta.env.BASE_URL}team`} className="underline font-medium">Team page</a> using "Grant Login Access". This page manages admin-level accounts only.
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader className="[&_tr]:border-slate-200 dark:[&_tr]:border-slate-700">
            <TableRow className="bg-muted/30">
              <TableHead>Display Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Access Level</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-slate-100 dark:[&_tr]:border-slate-800">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {[1,2,3,4,5,6,7].map(j => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>)}
                </TableRow>
              ))
            ) : !accounts || accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No accounts found</TableCell>
              </TableRow>
            ) : (
              accounts.map(account => {
                const meta = LEVEL_META[account.accountLevel] ?? LEVEL_META.user;
                const isSelf = account.id === user?.id;
                return (
                  <TableRow key={account.id} className={isSelf ? "bg-muted/20" : ""}>
                    <TableCell className="font-semibold">
                      {account.displayName}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">@{account.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs flex w-fit items-center gap-1 ${meta.badge}`}>
                        {meta.icon}
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {account.userId != null ? "Staff login" : "Standalone"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={account.active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"}>
                        {account.active ? "Active" : "Suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setEditAccount(account)} title="Edit">
                          <Pencil size={14} />
                        </Button>
                        {!isSelf && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(account.id)} title="Delete">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} onRefresh={refresh} />

      {editAccount && (
        <EditAccountDialog
          account={editAccount}
          open={!!editAccount}
          onOpenChange={v => !v && setEditAccount(null)}
          onRefresh={refresh}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the login account. Any team member profile linked to it will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && handleDelete(deleteId)}>
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
