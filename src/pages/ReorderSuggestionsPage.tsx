import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Package, 
  TrendingUp, 
  AlertTriangle,
  ShoppingCart,
  Calendar,
  ArrowRight,
  RefreshCw,
  Download,
  FileText,
  Mail,
  Send,
  Settings,
  Save,
  Clock,
  ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { toast } from "@/hooks/use-toast";
import { subDays, format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ReorderSuggestion {
  product_id: string;
  product_name: string;
  sku: string | null;
  current_stock: number;
  low_stock_threshold: number;
  avg_daily_sales: number;
  days_of_stock: number;
  suggested_order_qty: number;
  urgency: "critical" | "high" | "medium" | "low";
  total_sold_period: number;
}

export default function ReorderSuggestionsPage() {
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [analysisPeriod, setAnalysisPeriod] = useState<"7" | "14" | "30">("30");
  const [targetDays, setTargetDays] = useState<"14" | "30" | "60">("30");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purchasingEmail, setPurchasingEmail] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadPurchasingEmail();
  }, []);

  async function loadPurchasingEmail() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'purchasing_team_email')
        .single();
      
      if (!error && data?.value) {
        setPurchasingEmail(data.value);
      }
    } catch (err) {
      console.error("Error loading purchasing email:", err);
    }
  }

  async function savePurchasingEmail() {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: purchasingEmail })
        .eq('key', 'purchasing_team_email');

      if (error) throw error;
      
      toast({ title: "Settings saved", description: "Daily alerts will be sent to this email at 8 AM UTC" });
    } catch (err: any) {
      console.error("Error saving settings:", err);
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  }

  useEffect(() => {
    if (currentBranch) {
      loadReorderSuggestions();
    }
  }, [currentBranch, analysisPeriod, targetDays]);

  async function loadReorderSuggestions() {
    if (!currentBranch) return;
    
    setLoading(true);
    try {
      const periodDays = parseInt(analysisPeriod);
      const targetStockDays = parseInt(targetDays);
      const startDate = subDays(new Date(), periodDays).toISOString();

      // Get branch inventory
      const { data: branchInventory, error: invError } = await supabase
        .from('product_branches')
        .select(`
          product_id,
          stock_quantity,
          low_stock_threshold,
          products (id, name, sku)
        `)
        .eq('branch_id', currentBranch.id);

      if (invError) throw invError;

      // Get all products (including those not in branch inventory)
      const { data: allProducts, error: prodError } = await supabase
        .from('products')
        .select('id, name, sku, low_stock_threshold')
        .eq('is_active', true);

      if (prodError) throw prodError;

      // Get sales data for the period
      const { data: salesData, error: salesError } = await supabase
        .from('pos_sale_items')
        .select(`
          product_id,
          quantity,
          pos_sales!inner (
            branch_id,
            created_at,
            status
          )
        `)
        .eq('pos_sales.branch_id', currentBranch.id)
        .eq('pos_sales.status', 'paid')
        .gte('pos_sales.created_at', startDate);

      if (salesError) throw salesError;

      // Calculate sales per product
      const salesByProduct: Record<string, number> = {};
      salesData?.forEach(item => {
        if (item.product_id) {
          salesByProduct[item.product_id] = (salesByProduct[item.product_id] || 0) + Number(item.quantity);
        }
      });

      // Build inventory map
      const inventoryMap: Record<string, { stock: number; threshold: number }> = {};
      branchInventory?.forEach(inv => {
        inventoryMap[inv.product_id] = {
          stock: inv.stock_quantity,
          threshold: inv.low_stock_threshold || 10,
        };
      });

      // Calculate suggestions
      const reorderSuggestions: ReorderSuggestion[] = [];

      allProducts?.forEach(product => {
        const totalSold = salesByProduct[product.id] || 0;
        const avgDailySales = totalSold / periodDays;
        const currentStock = inventoryMap[product.id]?.stock || 0;
        const threshold = inventoryMap[product.id]?.threshold || product.low_stock_threshold || 10;
        
        // Calculate days of stock remaining
        const daysOfStock = avgDailySales > 0 ? currentStock / avgDailySales : currentStock > 0 ? 999 : 0;
        
        // Calculate suggested order quantity (to reach target days of stock)
        const targetStock = avgDailySales * targetStockDays;
        const suggestedOrderQty = Math.max(0, Math.ceil(targetStock - currentStock));
        
        // Determine urgency
        let urgency: "critical" | "high" | "medium" | "low" = "low";
        if (currentStock === 0 && avgDailySales > 0) {
          urgency = "critical";
        } else if (daysOfStock <= 7 && avgDailySales > 0) {
          urgency = "critical";
        } else if (daysOfStock <= 14 && avgDailySales > 0) {
          urgency = "high";
        } else if (currentStock <= threshold) {
          urgency = "medium";
        }

        // Only include products that need attention
        if (suggestedOrderQty > 0 || currentStock <= threshold || urgency !== "low") {
          reorderSuggestions.push({
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            current_stock: currentStock,
            low_stock_threshold: threshold,
            avg_daily_sales: avgDailySales,
            days_of_stock: daysOfStock,
            suggested_order_qty: suggestedOrderQty,
            urgency,
            total_sold_period: totalSold,
          });
        }
      });

      // Sort by urgency then by days of stock
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      reorderSuggestions.sort((a, b) => {
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        }
        return a.days_of_stock - b.days_of_stock;
      });

      setSuggestions(reorderSuggestions);
    } catch (error) {
      console.error("Error loading reorder suggestions:", error);
      toast({ title: "Error loading suggestions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function getUrgencyBadge(urgency: string) {
    switch (urgency) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500 text-white hover:bg-orange-600">High</Badge>;
      case "medium":
        return <Badge variant="warning" className="bg-warning text-warning-foreground">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  }

  function getStockProgress(current: number, threshold: number) {
    const percentage = threshold > 0 ? Math.min(100, (current / threshold) * 100) : 100;
    let colorClass = "bg-success";
    if (percentage <= 25) colorClass = "bg-destructive";
    else if (percentage <= 50) colorClass = "bg-orange-500";
    else if (percentage <= 75) colorClass = "bg-warning";
    
    return (
      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }

  function exportToCSV() {
    if (suggestions.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const headers = [
      "Product Name",
      "SKU",
      "Urgency",
      "Current Stock",
      "Low Stock Threshold",
      "Avg Daily Sales",
      "Days of Stock Left",
      `Sold (${analysisPeriod} days)`,
      "Suggested Order Qty",
    ];

    const rows = suggestions.map((s) => [
      s.product_name,
      s.sku || "",
      s.urgency.toUpperCase(),
      s.current_stock,
      s.low_stock_threshold,
      s.avg_daily_sales.toFixed(2),
      s.days_of_stock === 999 ? "N/A" : s.days_of_stock.toFixed(0),
      s.total_sold_period,
      s.suggested_order_qty,
    ]);

    const csvContent = [
      `Reorder Suggestions - ${currentBranch?.name} - ${format(new Date(), "yyyy-MM-dd")}`,
      `Analysis Period: Last ${analysisPeriod} days | Target Coverage: ${targetDays} days`,
      "",
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reorder-suggestions-${currentBranch?.code || "all"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "CSV exported successfully" });
  }

  function exportToPDF() {
    if (suggestions.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Reorder Suggestions", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Branch: ${currentBranch?.name}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy")}`, 14, 37);
    doc.text(`Analysis: Last ${analysisPeriod} days | Target: ${targetDays} days coverage`, 14, 44);

    // Summary
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Critical: ${criticalCount} | High: ${highCount} | Total Items: ${suggestions.length} | Total Units: ${totalSuggestedUnits}`, 14, 54);

    // Table
    autoTable(doc, {
      startY: 60,
      head: [[
        "Product",
        "SKU",
        "Urgency",
        "Stock",
        "Avg/Day",
        "Days Left",
        "Order Qty",
      ]],
      body: suggestions.map((s) => [
        s.product_name.length > 25 ? s.product_name.substring(0, 25) + "..." : s.product_name,
        s.sku || "-",
        s.urgency.toUpperCase(),
        s.current_stock.toString(),
        s.avg_daily_sales.toFixed(1),
        s.days_of_stock === 999 ? "∞" : s.days_of_stock.toFixed(0),
        `+${s.suggested_order_qty}`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const urgency = data.cell.raw?.toString().toLowerCase();
          if (urgency === "critical") {
            data.cell.styles.textColor = [220, 53, 69];
            data.cell.styles.fontStyle = "bold";
          } else if (urgency === "high") {
            data.cell.styles.textColor = [255, 152, 0];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    doc.save(`reorder-suggestions-${currentBranch?.code || "all"}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF exported successfully" });
  }

  async function sendEmailAlert() {
    if (!recipientEmail || !currentBranch) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setSendingEmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast({ title: "Please log in to send alerts", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke('send-stock-alert', {
        body: {
          recipientEmail,
          branchName: currentBranch.name,
          items: suggestions.map(s => ({
            product_name: s.product_name,
            sku: s.sku,
            current_stock: s.current_stock,
            low_stock_threshold: s.low_stock_threshold,
            avg_daily_sales: s.avg_daily_sales,
            days_of_stock: s.days_of_stock,
            suggested_order_qty: s.suggested_order_qty,
            urgency: s.urgency,
          })),
          analysisPeriod,
          targetDays,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send alert');
      }

      toast({ title: "Stock alert sent successfully", description: `Email sent to ${recipientEmail}` });
      setEmailDialogOpen(false);
      setRecipientEmail("");
    } catch (error: any) {
      console.error("Error sending stock alert:", error);
      toast({ title: "Failed to send alert", description: error.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  }

  const criticalCount = suggestions.filter(s => s.urgency === "critical").length;
  const highCount = suggestions.filter(s => s.urgency === "high").length;
  const totalSuggestedUnits = suggestions.reduce((sum, s) => sum + s.suggested_order_qty, 0);

  function toggleSelectAll() {
    if (selectedItems.size === suggestions.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(suggestions.map(s => s.product_id)));
    }
  }

  function toggleSelectItem(productId: string) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedItems(newSelected);
  }

  function createPurchaseOrder() {
    const selectedSuggestions = suggestions.filter(s => selectedItems.has(s.product_id));
    if (selectedSuggestions.length === 0) {
      toast({ title: "Please select items to order", variant: "destructive" });
      return;
    }

    const items = selectedSuggestions.map(s => ({
      product_id: s.product_id,
      product_name: s.product_name,
      sku: s.sku,
      quantity: s.suggested_order_qty,
      unit_cost: 0,
    }));

    const itemsParam = encodeURIComponent(JSON.stringify(items));
    navigate(`/purchase-orders/new?items=${itemsParam}`);
  }

  if (!currentBranch) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select a branch to view reorder suggestions</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reorder Suggestions</h1>
            <p className="text-muted-foreground mt-1">
              Smart recommendations based on sales velocity at {currentBranch.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={createPurchaseOrder}
              disabled={loading || selectedItems.size === 0}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Create PO ({selectedItems.size})
            </Button>
            <Button 
              onClick={() => setEmailDialogOpen(true)} 
              variant="outline" 
              disabled={loading || suggestions.length === 0}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Alert
            </Button>
            <Button onClick={exportToCSV} variant="outline" disabled={loading || suggestions.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button onClick={exportToPDF} variant="outline" disabled={loading || suggestions.length === 0}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button onClick={loadReorderSuggestions} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Email Alert Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Send Stock Alert
              </DialogTitle>
              <DialogDescription>
                Send an email alert to the purchasing team with {suggestions.length} items that need reordering.
                {criticalCount > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    ⚠️ {criticalCount} critical items require immediate attention!
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Recipient Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="purchasing@company.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>The email will include:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>{criticalCount} critical items</li>
                  <li>{highCount} high priority items</li>
                  <li>{totalSuggestedUnits.toLocaleString()} total units suggested</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendEmailAlert} disabled={sendingEmail || !recipientEmail}>
                {sendingEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Alert
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Automated Alert Settings */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Automated Daily Alerts</CardTitle>
                    <CardDescription className="text-sm">
                      {purchasingEmail 
                        ? `Sending to ${purchasingEmail} daily at 8 AM UTC`
                        : "Configure email for automatic daily stock alerts"
                      }
                    </CardDescription>
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    {settingsOpen ? "Hide" : "Configure"}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 border-t">
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasing-email">Purchasing Team Email</Label>
                    <div className="flex gap-2">
                      <Input
                        id="purchasing-email"
                        type="email"
                        placeholder="purchasing@company.com"
                        value={purchasingEmail}
                        onChange={(e) => setPurchasingEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={savePurchasingEmail} disabled={savingSettings}>
                        {savingSettings ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Critical and high-priority items will be emailed automatically every day at 8 AM UTC.
                      Leave empty to disable automated alerts.
                    </p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className={criticalCount > 0 ? "border-destructive" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Critical Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
              <p className="text-xs text-muted-foreground">Need immediate attention</p>
            </CardContent>
          </Card>
          
          <Card className={highCount > 0 ? "border-orange-500" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{highCount}</div>
              <p className="text-xs text-muted-foreground">Reorder soon</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suggestions.length}</div>
              <p className="text-xs text-muted-foreground">Need restocking</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suggested Units</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalSuggestedUnits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total to order</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Analysis Period
                </label>
                <Select value={analysisPeriod} onValueChange={(v) => setAnalysisPeriod(v as "7" | "14" | "30")}>
                  <SelectTrigger>
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Target Stock Coverage
                </label>
                <Select value={targetDays} onValueChange={(v) => setTargetDays(v as "14" | "30" | "60")}>
                  <SelectTrigger>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="14">14 days of stock</SelectItem>
                    <SelectItem value="30">30 days of stock</SelectItem>
                    <SelectItem value="60">60 days of stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggestions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reorder Recommendations</CardTitle>
            <CardDescription>
              Based on {analysisPeriod}-day sales velocity, targeting {targetDays} days of stock coverage
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Analyzing sales data...</div>
            ) : suggestions.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-success mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Stock levels are healthy!</h3>
                <p className="text-muted-foreground">No reorder suggestions at this time</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedItems.size === suggestions.length && suggestions.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Urgency</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-center">Stock Level</TableHead>
                    <TableHead className="text-right">Avg Daily Sales</TableHead>
                    <TableHead className="text-right">Days Left</TableHead>
                    <TableHead className="text-right">Sold ({analysisPeriod}d)</TableHead>
                    <TableHead className="text-right font-bold">Suggested Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((item) => (
                    <TableRow 
                      key={item.product_id} 
                      className={cn(
                        item.urgency === "critical" ? "bg-destructive/5" : "",
                        selectedItems.has(item.product_id) ? "bg-primary/5" : ""
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.product_id)}
                          onCheckedChange={() => toggleSelectItem(item.product_id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {item.urgency === "critical" && (
                            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">{item.product_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {item.sku || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {getUrgencyBadge(item.urgency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.current_stock}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStockProgress(item.current_stock, item.low_stock_threshold)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.avg_daily_sales.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.days_of_stock === 999 ? "∞" : item.days_of_stock.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.total_sold_period}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary font-mono">
                        +{item.suggested_order_qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
