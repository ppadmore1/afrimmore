import { Link, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  CreditCard,
  BarChart3,
  ShoppingCart,
  FileCheck,
  Truck,
  Menu,
  X,
  LogOut,
  Settings,
  User,
  Bell,
  AlertTriangle,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
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

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: ShoppingCart, label: "POS", path: "/pos" },
  { icon: Tag, label: "Products", path: "/products" },
  { icon: Boxes, label: "Inventory", path: "/inventory" },
  { icon: GitCompare, label: "Stock Comparison", path: "/branch-stock" },
  { icon: PackageSearch, label: "Reorder Suggestions", path: "/reorder" },
  { icon: Truck, label: "Suppliers", path: "/suppliers" },
  { icon: ClipboardList, label: "Purchase Orders", path: "/purchase-orders" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: FileCheck, label: "Quotations", path: "/quotations" },
  { icon: CreditCard, label: "Receipts", path: "/receipts" },
  { icon: Truck, label: "Delivery Notes", path: "/delivery-notes" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: CreditCard, label: "Payments", path: "/payments" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Building2, label: "Branches", path: "/branches", adminOnly: true },
  { icon: BarChart3, label: "Admin Dashboard", path: "/admin", adminOnly: true },
  { icon: Settings, label: "Settings", path: "/settings", adminOnly: true },
  { icon: Users, label: "User Management", path: "/users", adminOnly: true },
 { icon: Clock, label: "Time Tracking", path: "/time-tracking" },
 { icon: Percent, label: "Discount Codes", path: "/discounts", adminOnly: true },
 { icon: History, label: "Activity Logs", path: "/activity-logs", adminOnly: true },
 { icon: FormInput, label: "Custom Fields", path: "/custom-fields", adminOnly: true },
  { icon: FileBarChart, label: "Payroll Reports", path: "/payroll-reports", adminOnly: true },
];

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
  const { lowStockCount, outOfStockCount, criticalProducts, hasAlerts } = useLowStockCheck();

  // Show toast notification for low stock on first load
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
        duration: 8000,
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

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="p-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-sidebar-foreground">POSFlow</h1>
              <p className="text-xs text-sidebar-foreground/60">Business Management</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Offline Status Indicator */}
            <OfflineIndicator />
            
            {/* Notification Bell */}
            {hasAlerts && (
              <Link to="/inventory" className="relative">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                  <Bell className="h-5 w-5" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {totalAlertCount > 9 ? '9+' : totalAlertCount}
                  </Badge>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Branch Selector */}
        <div className="px-4 pb-4">
          <BranchSelector />
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              // Skip admin-only items for non-admins
              if ('adminOnly' in item && item.adminOnly && !isAdmin) return null;
              
              const isActive = location.pathname === item.path || 
                (item.path !== "/" && location.pathname.startsWith(item.path));
              const isInventory = item.path === "/inventory";
              const showAlertBadge = isInventory && hasAlerts;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                      showAlertBadge && !isActive && "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    )}
                  >
                    <div className="relative">
                      <item.icon className="w-5 h-5" />
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
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.user_metadata?.full_name || user?.email}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60">Staff</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
               <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
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
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">POSFlow</span>
          </Link>
          <div className="flex items-center gap-1">
            {/* Offline Status */}
            <OfflineIndicator />
            {/* Mobile Branch Selector */}
            <BranchSelector compact />
            {/* Mobile Notification Bell */}
            {hasAlerts && (
              <Link to="/inventory">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                  >
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg max-h-[70vh] overflow-y-auto"
          >
            <nav className="p-4">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  // Skip admin-only items for non-admins
                  if ('adminOnly' in item && item.adminOnly && !isAdmin) return null;
                  
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
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
