import { ReactNode } from "react";
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

  const alertCount = (alertData?.overdueBoxes.length ?? 0) + (alertData?.itemDiscrepancies.length ?? 0);

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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <Archive className="w-6 h-6 text-orange-500 mr-3" />
          <span className="text-white font-bold text-lg tracking-tight">Arciflow</span>
        </div>
        
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shrink-0 justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {navItems.find(item => location === item.href || (item.href !== "/" && location.startsWith(item.href)))?.name || "Arciflow"}
          </h2>
          <div className="flex items-center space-x-4">
             {/* Header actions can go here */}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
