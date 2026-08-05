import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Archive, 
  LayoutDashboard, 
  PackageSearch, 
  Users, 
  Shield, 
  Info,
  LogOut,
  ScanLine,
  ClipboardList,
  UserCog,
  ShoppingCart,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { useGetUrgentAlerts } from "@workspace/api-client-react";

interface LayoutProps {
  children: ReactNode;
}

const LEVEL_LABELS: Record<string, { label: string; className: string }> = {
  superadmin:  { label: "Super Admin",  className: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  admin:       { label: "Admin",        className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  staff_admin: { label: "Staff Admin",  className: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  user:        { label: "Staff",        className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout, isAdmin, isSuperAdmin, isFullAdmin } = useAuth();
  const { data: alertData } = useGetUrgentAlerts();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const alertCount = (alertData?.overdueBoxes.length ?? 0) + (alertData?.itemDiscrepancies.length ?? 0);

  // Close sidebar on route change (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  async function handleLogout() {
    await logout();
    setLocation("/login");
  }

  const allNavItems = [
    { name: "Dashboard",        href: "/dashboard",      icon: LayoutDashboard, minLevel: "user" },
    { name: "Archive Boxes",    href: "/boxes",           icon: PackageSearch,   minLevel: "user" },
    { name: "Team Members",     href: "/team",            icon: Users,           minLevel: "full_admin" },
    { name: "Role Management",  href: "/roles",           icon: Shield,          minLevel: "full_admin" },
    { name: "Collections Cost", href: "/acquisitions",    icon: ShoppingCart,    minLevel: "admin" },
    { name: "Alerts",           href: "/alerts",          icon: Bell,            minLevel: "user" },
    { name: "Activity Log",     href: "/activity-log",   icon: ClipboardList,   minLevel: "user" },
    { name: "Accounts",         href: "/admin-accounts",  icon: UserCog,        minLevel: "superadmin" },
    { name: "About",            href: "/settings",        icon: Info,            minLevel: "user" },
  ];

  const level = user?.accountLevel ?? "user";
  const navItems = allNavItems.filter(item => {
    if (item.minLevel === "superadmin") return isSuperAdmin;
    if (item.minLevel === "full_admin") return isFullAdmin;
    if (item.minLevel === "admin") return isAdmin;
    return true;
  });

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
        <Archive className="w-6 h-6 text-orange-500 mr-3" />
        <span className="text-white font-bold text-lg tracking-tight">Arciflow</span>
        {/* Close button — mobile only */}
        <button
          className="ml-auto md:hidden text-slate-400 hover:text-white transition-colors"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          const isAlerts = item.href === "/alerts";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors group",
                isActive
                  ? "bg-slate-800 text-white"
                  : "hover:bg-slate-800/50 hover:text-slate-100"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 mr-3 flex-shrink-0 transition-colors",
                isActive ? "text-orange-500" : "text-slate-400 group-hover:text-slate-300"
              )} />
              <span className="flex-1">{item.name}</span>
              {isAlerts && alertCount > 0 && (
                <span className="ml-1 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </Link>
          );
        })}

        <div className="mt-8">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
            Tools
          </div>
          <Link
            href="/scanner-simulator"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors group hover:bg-slate-800/50 hover:text-slate-100"
          >
            <ScanLine className="w-5 h-5 mr-3 flex-shrink-0 text-slate-400 group-hover:text-slate-300" />
            Scanner Simulator
          </Link>
        </div>
      </div>

      {/* User / logout */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        {user && (
          <div className="flex items-start mb-3 gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-0.5">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">@{user.username}</p>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 mt-1 border", LEVEL_LABELS[level]?.className ?? "")}>
                {LEVEL_LABELS[level]?.label ?? level}
              </Badge>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300",
          "md:relative md:translate-x-0 md:flex md:flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 shrink-0 justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800">
              {navItems.find(item => location === item.href || (item.href !== "/" && location.startsWith(item.href)))?.name || "Arciflow"}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            {/* Header actions can go here */}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
