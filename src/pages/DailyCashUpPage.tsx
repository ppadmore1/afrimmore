import { useState, useEffect } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  DollarSign, Users, Clock, TrendingUp, AlertTriangle, Download,
  Banknote, CreditCard, Smartphone, Building2, Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";

interface ShiftSummary {
  id: string;
  user_id: string;
  user_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  total_sales: number;
  total_transactions: number;
  cash_sales: number;
  card_sales: number;
  mobile_money_sales: number;
  bank_transfer_sales: number;
  expected_cash: number;
  actual_cash: number | null;
  cash_difference: number | null;
  status: string;
}

interface SaleDetail {
  id: string;
  sale_number: string;
  customer_name: string | null;
  total: number;
  payment_method: string;
  created_at: string;
  created_by_name: string;
  items_count: number;
}

export default function DailyCashUpPage() {
  const { toast } = useToast();
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [sales, setSales] = useState<SaleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<ShiftSummary | null>(null);
  const [shiftSales, setShiftSales] = useState<SaleDetail[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Aggregate stats
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalTransactions = sales.length;
  const cashTotal = sales.filter(s => s.payment_method === "cash").reduce((s, sale) => s + sale.total, 0);
  const cardTotal = sales.filter(s => s.payment_method === "card").reduce((s, sale) => s + sale.total, 0);
  const mobileTotal = sales.filter(s => s.payment_method === "mobile_money").reduce((s, sale) => s + sale.total, 0);
  const bankTotal = sales.filter(s => s.payment_method === "bank_transfer").reduce((s, sale) => s + sale.total, 0);

  // Group sales by salesperson
  const salesByPerson = sales.reduce((acc, sale) => {
    const key = sale.created_by_name || "Unknown";
    if (!acc[key]) acc[key] = { sales: [], total: 0, count: 0 };
    acc[key].sales.push(sale);
    acc[key].total += sale.total;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { sales: SaleDetail[]; total: number; count: number }>);

  useEffect(() => {
    loadData();
  }, [selectedDate, currentBranch]);

  async function loadData() {
    setLoading(true);
    try {
      const dayStart = startOfDay(new Date(selectedDate)).toISOString();
      const dayEnd = endOfDay(new Date(selectedDate)).toISOString();

      // Load shifts for the day
      let shiftsQuery = supabase
        .from("pos_shifts")
        .select("*")
        .gte("opened_at", dayStart)
        .lte("opened_at", dayEnd)
        .order("opened_at", { ascending: false });

      if (currentBranch) {
        shiftsQuery = shiftsQuery.eq("branch_id", currentBranch.id);
      }

      const { data: shiftsData } = await shiftsQuery;

      // Get user names for shifts
      const userIds = [...new Set((shiftsData || []).map(s => s.user_id))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || "Unknown";
          return acc;
        }, {} as Record<string, string>);
      }

      setShifts((shiftsData || []).map(s => ({
        ...s,
        user_name: profilesMap[s.user_id] || "Unknown",
      })));

      // Load all sales for the day
      let salesQuery = supabase
        .from("pos_sales")
        .select("id, sale_number, customer_name, total, payment_method, created_at, created_by")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      if (currentBranch) {
        salesQuery = salesQuery.eq("branch_id", currentBranch.id);
      }

      const { data: salesData } = await salesQuery;

      // Get user names for sales
      const saleUserIds = [...new Set((salesData || []).map(s => s.created_by).filter(Boolean))];
      if (saleUserIds.length > 0 && saleUserIds.some(id => !profilesMap[id!])) {
        const { data: moreProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", saleUserIds.filter(id => id && !profilesMap[id]));
        
        (moreProfiles || []).forEach(p => {
          profilesMap[p.id] = p.full_name || "Unknown";
        });
      }

      setSales((salesData || []).map(s => ({
        id: s.id,
        sale_number: s.sale_number,
        customer_name: s.customer_name,
        total: Number(s.total),
        payment_method: s.payment_method,
        created_at: s.created_at,
        created_by_name: s.created_by ? profilesMap[s.created_by] || "Unknown" : "Unknown",
        items_count: 0,
      })));
    } catch (error) {
      console.error("Error loading cash-up data:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const viewShiftDetail = async (shift: ShiftSummary) => {
    setSelectedShift(shift);
    const { data } = await supabase
      .from("pos_sales")
      .select("id, sale_number, customer_name, total, payment_method, created_at, created_by")
      .eq("shift_id", shift.id)
      .order("created_at");
    
    setShiftSales((data || []).map(s => ({
      id: s.id,
      sale_number: s.sale_number,
      customer_name: s.customer_name,
      total: Number(s.total),
      payment_method: s.payment_method,
      created_at: s.created_at,
      created_by_name: shift.user_name,
      items_count: 0,
    })));
  };

  const paymentIcon = (method: string) => {
    switch (method) {
      case "cash": return <Banknote className="w-3.5 h-3.5" />;
      case "card": return <CreditCard className="w-3.5 h-3.5" />;
      case "mobile_money": return <Smartphone className="w-3.5 h-3.5" />;
      case "bank_transfer": return <Building2 className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const exportCSV = () => {
    const headers = "Sale #,Date,Time,Salesperson,Customer,Payment Method,Total\n";
    const rows = sales.map(s => 
      `${s.sale_number},${format(new Date(s.created_at), "yyyy-MM-dd")},${format(new Date(s.created_at), "HH:mm")},${s.created_by_name},${s.customer_name || "Walk-in"},${s.payment_method},${s.total.toFixed(2)}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-cash-up-${selectedDate}.csv`;
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Daily Cash-Up Report</h1>
            <p className="text-muted-foreground text-sm">Sales reconciliation & salesperson performance</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                Total Revenue
              </div>
              <p className="text-2xl font-bold font-mono">${totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Transactions
              </div>
              <p className="text-2xl font-bold font-mono">{totalTransactions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Banknote className="w-3.5 h-3.5" />
                Cash
              </div>
              <p className="text-2xl font-bold font-mono text-[hsl(var(--success))]">${cashTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                Card
              </div>
              <p className="text-2xl font-bold font-mono">${cardTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Smartphone className="w-3.5 h-3.5" />
                Mobile/Bank
              </div>
              <p className="text-2xl font-bold font-mono">${(mobileTotal + bankTotal).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Shifts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" />
                Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No shifts recorded for this day</p>
              ) : (
                <div className="space-y-3">
                  {shifts.map((shift) => (
                    <div key={shift.id} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">{shift.user_name}</span>
                        </div>
                        <Badge variant={shift.status === "open" ? "default" : "secondary"}>
                          {shift.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Start: {format(new Date(shift.opened_at), "HH:mm")}</div>
                        <div>End: {shift.closed_at ? format(new Date(shift.closed_at), "HH:mm") : "—"}</div>
                        <div>Transactions: <span className="font-semibold text-foreground">{shift.total_transactions}</span></div>
                        <div>Total: <span className="font-semibold text-foreground font-mono">${Number(shift.total_sales).toFixed(2)}</span></div>
                      </div>
                      {shift.status === "closed" && shift.actual_cash !== null && (
                        <div className={`mt-2 p-2 rounded text-xs font-medium ${
                          Number(shift.cash_difference) === 0 
                            ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                            : Number(shift.cash_difference)! < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                        }`}>
                          Expected: ${Number(shift.expected_cash).toFixed(2)} | Actual: ${Number(shift.actual_cash).toFixed(2)} | 
                          Diff: ${Number(shift.cash_difference).toFixed(2)}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => viewShiftDetail(shift)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Sales
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales by Salesperson */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Sales by Salesperson
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(salesByPerson).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sales for this day</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(salesByPerson)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([name, data]) => (
                    <div key={name} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedUser(expandedUser === name ? null : name)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{name.charAt(0)}</span>
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-sm">{name}</p>
                            <p className="text-xs text-muted-foreground">{data.count} transactions</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono">${data.total.toFixed(2)}</span>
                          {expandedUser === name ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>
                      {expandedUser === name && (
                        <div className="border-t bg-muted/30 max-h-48 overflow-y-auto">
                          {data.sales.map(sale => (
                            <div key={sale.id} className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-b-0">
                              <div className="flex items-center gap-2">
                                {paymentIcon(sale.payment_method)}
                                <span className="font-mono">{sale.sale_number}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{format(new Date(sale.created_at), "HH:mm")}</span>
                                <span className="font-bold font-mono">${sale.total.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Sales — {format(new Date(selectedDate), "MMM d, yyyy")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale #</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No sales recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs">{sale.sale_number}</TableCell>
                        <TableCell className="text-xs">{format(new Date(sale.created_at), "HH:mm")}</TableCell>
                        <TableCell className="text-sm font-medium">{sale.created_by_name}</TableCell>
                        <TableCell className="text-sm">{sale.customer_name || "Walk-in"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {paymentIcon(sale.payment_method)}
                            <span className="text-xs capitalize">{sale.payment_method.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono">${sale.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Shift Detail Dialog */}
        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Shift Detail — {selectedShift?.user_name}</DialogTitle>
            </DialogHeader>
            {selectedShift && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Start</p>
                    <p className="font-semibold">{format(new Date(selectedShift.opened_at), "HH:mm")}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">End</p>
                    <p className="font-semibold">{selectedShift.closed_at ? format(new Date(selectedShift.closed_at), "HH:mm") : "Open"}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Opening Float</p>
                    <p className="font-semibold font-mono">${Number(selectedShift.opening_float).toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Sales</p>
                    <p className="font-semibold font-mono">${Number(selectedShift.total_sales).toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div className="p-2 bg-muted rounded">
                    <Banknote className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--success))]" />
                    <p className="font-bold font-mono">${Number(selectedShift.cash_sales).toFixed(2)}</p>
                    <p className="text-muted-foreground">Cash</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <CreditCard className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="font-bold font-mono">${Number(selectedShift.card_sales).toFixed(2)}</p>
                    <p className="text-muted-foreground">Card</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <Smartphone className="w-4 h-4 mx-auto mb-1" />
                    <p className="font-bold font-mono">${Number(selectedShift.mobile_money_sales).toFixed(2)}</p>
                    <p className="text-muted-foreground">Mobile</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <Building2 className="w-4 h-4 mx-auto mb-1" />
                    <p className="font-bold font-mono">${Number(selectedShift.bank_transfer_sales).toFixed(2)}</p>
                    <p className="text-muted-foreground">Bank</p>
                  </div>
                </div>
                <Separator />
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Sale #</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shiftSales.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs font-mono">{s.sale_number}</TableCell>
                          <TableCell className="text-xs">{format(new Date(s.created_at), "HH:mm")}</TableCell>
                          <TableCell className="text-xs capitalize">{s.payment_method.replace("_", " ")}</TableCell>
                          <TableCell className="text-xs text-right font-bold font-mono">${s.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
