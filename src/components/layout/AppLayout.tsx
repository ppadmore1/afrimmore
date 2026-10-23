import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Mail,
  FileText,
  Users,
  Package,
  CreditCard,
  BarChart3,
  ShoppingCart,
  Lightbulb,
  FileCheck,
  Truck,
  Menu,
  X,
  LogOut,
  Settings,
  User,
  Bell,
  Building2,
  GitCompare,
  PackageSearch,
  ClipboardList,
  Boxes,
  Tag,
  Clock,
  History,
  Percent,
  FormInput,
  FileBarChart,
  FileBarChart2,
  LayoutTemplate,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Star,
  ChevronDown,
  RefreshCw,
  Landmark,
  Globe,
  Calculator,
  Layers,
  Receipt,
  ScrollText,
  Wallet,
  ArrowLeftRight,
  MapPin,
  PackageCheck,
  ClipboardCheck,
  BookOpen,
  FileSpreadsheet,
  ScaleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useUserRole, primaryRoleLabel } from "@/hooks/useUserRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLowStockCheck } from "@/components/LowStockAlert";
import { BranchSelector } from "@/components/BranchSelector";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { toast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type RoleAccess = 'all' | 'admin' | 'staff' | 'cashier';

interface NavItem {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
  /** Minimum role required: 'cashier' < 'staff' < 'admin'. Defaults to 'staff'. */
  minRole?: RoleAccess;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/", minRole: "cashier" },
      { icon: ShoppingCart, label: "POS", path: "/pos", minRole: "cashier" },
      { icon: Receipt, label: "Daily Cash-Up", path: "/daily-cash-up", minRole: "cashier" },
      { icon: Receipt, label: "My Branch", path: "/my-branch", minRole: "staff" },
      { icon: Receipt, label: "Branch Cash-Up Dashboard", path: "/cash-up-dashboard", minRole: "admin" },
      { icon: ShoppingCart, label: "Online Orders", path: "/online-orders", minRole: "staff" },
      { icon: Lightbulb, label: "Ask AI (Branch Insights)", path: "/branch-insights", minRole: "staff" },
    ],
  },
  {
    label: "Products & Inventory",
    items: [
      { icon: Tag, label: "Products", path: "/products", minRole: "cashier" },
      { icon: Tag, label: "Barcode Labels", path: "/barcode-labels", minRole: "staff" },
      { icon: Boxes, label: "Inventory", path: "/inventory", minRole: "staff" },
      { icon: ArrowLeftRight, label: "Stock Transfers", path: "/stock-transfers", minRole: "staff" },
      { icon: ClipboardCheck, label: "Adjustments", path: "/inventory-adjustments", minRole: "staff" },
      { icon: GitCompare, label: "Stock Comparison", path: "/branch-stock", minRole: "staff" },
      { icon: PackageSearch, label: "Reorder Suggestions", path: "/reorder", minRole: "staff" },
      { icon: Calculator, label: "Inventory Valuation", path: "/inventory-valuation", minRole: "admin" },
      { icon: Layers, label: "Batch Tracking", path: "/batch-tracking", minRole: "staff" },
      { icon: Tag, label: "Serial Numbers", path: "/serial-numbers", minRole: "staff" },
      { icon: PackageCheck, label: "Bundle Items", path: "/bundle-items", minRole: "staff" },
      { icon: MapPin, label: "Warehouse Locations", path: "/warehouse-locations", minRole: "staff" },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { icon: Truck, label: "Suppliers", path: "/suppliers", minRole: "staff" },
      { icon: ClipboardList, label: "Purchase Orders", path: "/purchase-orders", minRole: "staff" },
      { icon: Wallet, label: "Vendor Bills", path: "/vendor-bills", minRole: "staff" },
    ],
  },
  {
    label: "Sales & Documents",
    items: [
      { icon: FileText, label: "Invoices", path: "/invoices", minRole: "staff" },
      { icon: FileCheck, label: "Quotations", path: "/quotations", minRole: "staff" },
      { icon: CreditCard, label: "Receipts", path: "/receipts", minRole: "staff" },
      { icon: Truck, label: "Delivery Notes", path: "/delivery-notes", minRole: "staff" },
      { icon: Users, label: "Customers", path: "/customers", minRole: "staff" },
      { icon: FileText, label: "Credit Notes", path: "/credit-notes", minRole: "staff" },
      { icon: RefreshCw, label: "Recurring Invoices", path: "/recurring-invoices", minRole: "admin" },
      { icon: ScrollText, label: "Customer Statements", path: "/customer-statements", minRole: "staff" },
    ],
  },
  {
    label: "Finance",
    items: [
      { icon: BookOpen, label: "Chart of Accounts", path: "/chart-of-accounts", minRole: "admin" },
      { icon: FileSpreadsheet, label: "Journal Entries", path: "/journal-entries", minRole: "staff" },
      { icon: ScaleIcon, label: "Trial Balance", path: "/trial-balance", minRole: "admin" },
      { icon: CreditCard, label: "Payments", path: "/payments", minRole: "staff" },
      { icon: TrendingDown, label: "Expenses", path: "/expenses", minRole: "staff" },
      { icon: FileBarChart, label: "Financial Statements", path: "/financial-statements", minRole: "admin" },
      { icon: Clock, label: "Aging Reports", path: "/aging-reports", minRole: "admin" },
      { icon: Landmark, label: "Bank Reconciliation", path: "/bank-reconciliation", minRole: "admin" },
      { icon: Globe, label: "Multi-Currency", path: "/multi-currency", minRole: "admin" },
      { icon: Calculator, label: "Tax Management", path: "/tax-management", minRole: "admin" },
    ],
  },
  {
    label: "Reports",
    items: [
      { icon: BarChart3, label: "Reports", path: "/reports", minRole: "staff" },
      { icon: FileBarChart2, label: "Branch Reports", path: "/branch-reports", minRole: "staff" },
      { icon: FileBarChart, label: "Payroll Reports", path: "/payroll-reports", minRole: "admin" },
    ],
  },
  {
    label: "HR & Time",
    items: [
      { icon: Clock, label: "Time Tracking", path: "/time-tracking", minRole: "cashier" },
    ],
  },
  {
    label: "Administration",
    items: [
      { icon: Building2, label: "Branches", path: "/branches", minRole: "admin" },
      { icon: BarChart3, label: "Admin Dashboard", path: "/admin", minRole: "admin" },
      { icon: Settings, label: "Settings", path: "/settings", minRole: "admin" },
      { icon: Mail, label: "Daily Email Reports", path: "/email-reports", minRole: "admin" },
      { icon: Users, label: "User Management", path: "/users", minRole: "admin" },
      { icon: Percent, label: "Discount Codes", path: "/discounts", minRole: "admin" },
      { icon: History, label: "Activity Logs", path: "/activity-logs", minRole: "admin" },
      { icon: FormInput, label: "Custom Fields", path: "/custom-fields", minRole: "admin" },
      { icon: LayoutTemplate, label: "Document Templates", path: "/document-templates", minRole: "admin" },
      { icon: ShieldCheck, label: "Approval Thresholds", path: "/approval-thresholds", minRole: "admin" },
      { icon: Star, label: "Branch Grades", path: "/branch-grades", minRole: "admin" },
      { icon: ShieldAlert, label: "Audit Visits", path: "/audit-visits", minRole: "admin" },
      { icon: CreditCard, label: "Subscription", path: "/subscription", minRole: "admin" },
      { icon: ShieldCheck, label: "Super Admin", path: "/super-admin", minRole: "admin" },
    ],
  },
];

// Role hierarchy: admin > staff > cashier
const ROLE_LEVEL: Record<string, number> = { cashier: 1, staff: 2, admin: 3 };

function hasMinRole(userRoles: { isAdmin: boolean; isStaff: boolean; isCashier: boolean }, minRole: RoleAccess): boolean {
  if (minRole === 'all') return true;
  const userLevel = userRoles.isAdmin ? 3 : userRoles.isStaff ? 2 : userRoles.isCashier ? 1 : 0;
  return userLevel >= (ROLE_LEVEL[minRole] || 0);
}
// Pages each specialist role sees. Applies only when the user has no
// admin/owner/staff/branch_manager role (those see everything their level allows).
const COMMON = ["/", "/time-tracking", "/branch-insights"];
const SPECIALIST_PATHS: Record<string, string[]> = {
  inventory_officer: ["/products", "/barcode-labels", "/inventory", "/stock-transfers", "/inventory-adjustments", "/branch-stock", "/reorder", "/batch-tracking", "/serial-numbers", "/bundle-items", "/warehouse-locations", "/suppliers", "/purchase-orders", "/my-branch"],
  accountant: ["/invoices", "/quotations", "/receipts", "/credit-notes", "/recurring-invoices", "/customer-statements", "/customers", "/vendor-bills", "/chart-of-accounts", "/journal-entries", "/trial-balance", "/payments", "/expenses", "/financial-statements", "/aging-reports", "/bank-reconciliation", "/multi-currency", "/tax-management", "/inventory-valuation", "/reports", "/daily-cash-up", "/cash-up-dashboard", "/payroll-reports"],
  executive: ["/cash-up-dashboard", "/daily-cash-up", "/reports", "/branch-reports", "/financial-statements", "/aging-reports", "/inventory-valuation", "/branch-stock", "/admin", "/branch-grades", "/audit-visits", "/payroll-reports"],
};
function specialistPaths(roles: string[]): Set<string> | null {
  if (roles.some((r) => ["admin", "owner", "staff", "branch_manager"].includes(r))) return null;
  const mine = roles.filter((r) => SPECIALIST_PATHS[r]);
  if (mine.length === 0) return null;
  return new Set([...COMMON, ...mine.flatMap((r) => SPECIALIST_PATHS[r])]);
}

type RoleState = { isAdmin: boolean; isStaff: boolean; isCashier: boolean; roles: string[] };
function itemVisible(item: NavItem, userRole: RoleState): boolean {
  if (!hasMinRole(userRole, item.minRole || 'staff')) {
    // Specialist roles may also see admin-level pages that belong to their job
    const extra = specialistPaths(userRole.roles);
    return !!extra && extra.has(item.path) && item.minRole === 'admin';
  }
  const allowed = specialistPaths(userRole.roles);
  return !allowed || allowed.has(item.path);
}
const ALL_NAV_ITEMS: NavItem[] = navGroups.flatMap((g) => g.items);
// Page lock: the same rules as the menu, applied to typed-in addresses.
// Sub-pages (e.g. /products/new) follow their parent menu page.
export function canAccessPath(pathname: string, userRole: RoleState): boolean {
  if (pathname === "/") return true;
  const item = ALL_NAV_ITEMS
    .filter((i) => i.path !== "/" && (pathname === i.path || pathname.startsWith(i.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!item) return true;
  return itemVisible(item, userRole);
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertShown, setAlertShown] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin, currentBranch } = useBranch();
  const userRole = useUserRole();
  const { lowStockCount, outOfStockCount, criticalProducts, hasAlerts } = useLowStockCheck();

  const userRoleLabel = primaryRoleLabel(userRole.roles);

  useEffect(() => {
    if (!alertShown && hasAlerts && (lowStockCount > 0 || outOfStockCount > 0)) {
      setAlertShown(true);
      const totalAlerts = lowStockCount + outOfStockCount;
      const description = outOfStockCount > 0
        ? `${outOfStockCount} out of stock, ${lowStockCount} running low`
        : `${lowStockCount} products running low on stock`;
      toast({
        title: `⚠️ Low Stock Alert (${totalAlerts} items)`,
        description,
        variant: "destructive",
        duration: 4000,
      });
    }
  }, [hasAlerts, lowStockCount, outOfStockCount, alertShown]);

  const handleSignOut = async () => {
    await signOut();
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const totalAlertCount = lowStockCount + outOfStockCount;

  const isItemActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isItemActive(item.path));

  const filterItems = (items: NavItem[]) => items.filter((item) => itemVisible(item, userRole));

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-6 pb-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl gradient-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-bold text-lg text-sidebar-foreground leading-tight truncate">AFRIMORE BMS</h1>
          </Link>
          <p className="text-[11px] text-sidebar-foreground/60 mt-1.5 truncate">Business Management System</p>
        </div>
        <div className="px-6 pb-4 flex items-center justify-between gap-2">
          <OfflineIndicator />
          {hasAlerts && (
            <Link to="/inventory" className="relative shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                <Bell className="h-5 w-5" />
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {totalAlertCount > 9 ? '9+' : totalAlertCount}
                </Badge>
              </Button>
            </Link>
          )}
        </div>

        <div className="px-4 pb-4">
          <BranchSelector />
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
          {navGroups.map((group) => {
            const visibleItems = filterItems(group.items);
            if (visibleItems.length === 0) return null;
            const groupActive = isGroupActive(group);

            return (
              <Collapsible
                key={group.label}
                defaultOpen={group.defaultOpen || groupActive}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors rounded-md hover:bg-sidebar-accent/50">
                  <span>{group.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-1 space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = isItemActive(item.path);
                      const isInventory = item.path === "/inventory";
                      const showAlertBadge = isInventory && hasAlerts;

                      return (
                        <li key={item.path}>
                          <Link
                            to={item.path}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                              showAlertBadge && !isActive && "bg-destructive/10 text-destructive hover:bg-destructive/20"
                            )}
                          >
                            <div className="relative">
                              <item.icon className="w-4 h-4" />
                              {showAlertBadge && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                              )}
                            </div>
                            <span className="flex-1">{item.label}</span>
                            {showAlertBadge && (
                              <Badge variant="destructive" className="text-xs h-5 px-1.5">
                                {totalAlertCount}
                              </Badge>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.user_metadata?.full_name || user?.email}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60">{userRoleLabel}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              {userRole.isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2">
          <div className="flex items-center gap-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg gradient-primary flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground hidden min-[380px]:inline truncate">AFRIMORE BMS</span>
            </Link>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <OfflineIndicator />
            <BranchSelector compact />
            {hasAlerts && (
              <Link to="/inventory">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]">
                    {totalAlertCount > 9 ? '9+' : totalAlertCount}
                  </Badge>
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain"
          >
            <nav className="p-4 space-y-2">
              <div className="pb-2 border-b border-border">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</p>
                <BranchSelector />
              </div>
              {navGroups.map((group) => {
                const visibleItems = filterItems(group.items);
                if (visibleItems.length === 0) return null;

                return (
                  <Collapsible key={group.label} defaultOpen={group.defaultOpen || isGroupActive(group)}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                      <span>{group.label}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-1 space-y-0.5">
                        {visibleItems.map((item) => {
                          const isActive = location.pathname === item.path;
                          return (
                            <li key={item.path}>
                              <Link
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                  isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground hover:bg-muted"
                                )}
                              >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </nav>
          </motion.div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 p-4 pt-20 lg:pt-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
