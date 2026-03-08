import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Search,
  Calendar,
  Users,
  Printer,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface StatementLine {
  date: string;
  type: "invoice" | "payment" | "credit_note";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function CustomerStatementsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("last-30");
  const [statementOpen, setStatementOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase.from("customers").select("id, name, email, phone").order("name");
    setCustomers(data || []);
  }

  function getDateRange(): { from: Date; to: Date } {
    const now = new Date();
    switch (dateRange) {
      case "last-30": return { from: subDays(now, 30), to: now };
      case "last-60": return { from: subDays(now, 60), to: now };
      case "last-90": return { from: subDays(now, 90), to: now };
      case "this-month": return { from: startOfMonth(now), to: endOfMonth(now) };
      case "last-month": {
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      }
      case "all": return { from: new Date("2020-01-01"), to: now };
      default: return { from: subDays(now, 30), to: now };
    }
  }

  async function generateStatement(customerId: string) {
    setLoading(true);
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    setSelectedCustomer(customer);

    const { from, to } = getDateRange();
    const fromStr = format(from, "yyyy-MM-dd");
    const toStr = format(to, "yyyy-MM-dd");

    try {
      // Fetch invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, created_at, total, amount_paid, status")
        .eq("customer_id", customerId)
        .gte("created_at", fromStr)
        .lte("created_at", toStr + "T23:59:59")
        .order("created_at");

      // Fetch payments
      const { data: payments } = await supabase
        .from("payments")
        .select("id, payment_number, created_at, amount, payment_method, invoice_id")
        .not("invoice_id", "is", null)
        .gte("created_at", fromStr)
        .lte("created_at", toStr + "T23:59:59")
        .order("created_at");

      // Filter payments to this customer's invoices
      const customerInvoiceIds = new Set((invoices || []).map((i) => i.id));
      const customerPayments = (payments || []).filter((p) => customerInvoiceIds.has(p.invoice_id));

      // Fetch credit notes
      const { data: creditNotes } = await supabase
        .from("credit_notes")
        .select("id, credit_note_number, created_at, total, status")
        .eq("customer_id", customerId)
        .gte("created_at", fromStr)
        .lte("created_at", toStr + "T23:59:59")
        .order("created_at");

      // Calculate opening balance (invoices before period minus payments before period)
      const { data: priorInvoices } = await supabase
        .from("invoices")
        .select("total")
        .eq("customer_id", customerId)
        .lt("created_at", fromStr)
        .neq("status", "cancelled");

      const { data: allPriorPayments } = await supabase
        .from("payments")
        .select("amount, invoice_id")
        .lt("created_at", fromStr);

      // Get all customer invoice IDs for prior period
      const { data: priorInvoiceIds } = await supabase
        .from("invoices")
        .select("id")
        .eq("customer_id", customerId)
        .lt("created_at", fromStr);

      const priorIdSet = new Set((priorInvoiceIds || []).map((i) => i.id));
      const priorPaymentsTotal = (allPriorPayments || [])
        .filter((p) => priorIdSet.has(p.invoice_id))
        .reduce((sum, p) => sum + p.amount, 0);
      const priorInvoicesTotal = (priorInvoices || []).reduce((sum, i) => sum + i.total, 0);
      const opening = priorInvoicesTotal - priorPaymentsTotal;
      setOpeningBalance(opening);

      // Build statement lines
      const allLines: StatementLine[] = [];

      (invoices || []).forEach((inv) => {
        if (inv.status !== "cancelled") {
          allLines.push({
            date: inv.created_at,
            type: "invoice",
            reference: inv.invoice_number,
            description: `Invoice ${inv.invoice_number}`,
            debit: inv.total,
            credit: 0,
            balance: 0,
          });
        }
      });

      customerPayments.forEach((pay) => {
        allLines.push({
          date: pay.created_at,
          type: "payment",
          reference: pay.payment_number,
          description: `Payment - ${pay.payment_method}`,
          debit: 0,
          credit: pay.amount,
          balance: 0,
        });
      });

      (creditNotes || []).forEach((cn) => {
        if (cn.status !== "cancelled") {
          allLines.push({
            date: cn.created_at,
            type: "credit_note",
            reference: cn.credit_note_number,
            description: `Credit Note ${cn.credit_note_number}`,
            debit: 0,
            credit: cn.total,
            balance: 0,
          });
        }
      });

      // Sort by date
      allLines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      let runningBalance = opening;
      allLines.forEach((line) => {
        runningBalance += line.debit - line.credit;
        line.balance = runningBalance;
      });

      setLines(allLines);
      setStatementOpen(true);
    } catch (error) {
      console.error("Error generating statement:", error);
      toast({ title: "Error generating statement", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const closingBalance = lines.length > 0 ? lines[lines.length - 1].balance : openingBalance;
  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customer Statements</h1>
            <p className="text-muted-foreground mt-1">Generate account statements for your customers</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-30">Last 30 Days</SelectItem>
                  <SelectItem value="last-60">Last 60 Days</SelectItem>
                  <SelectItem value="last-90">Last 90 Days</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Select Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No customers found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.email || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.phone || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => generateStatement(customer.id)}
                          disabled={loading}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Generate Statement
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Statement Dialog */}
        <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Account Statement - {selectedCustomer?.name}</span>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 print:p-4" id="statement-content">
              {/* Statement Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">ACCOUNT STATEMENT</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Period: {format(getDateRange().from, "MMM d, yyyy")} - {format(getDateRange().to, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{selectedCustomer?.name}</p>
                  {selectedCustomer?.email && <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>}
                  {selectedCustomer?.phone && <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="text-lg font-bold">${openingBalance.toFixed(2)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Charges</p>
                  <p className="text-lg font-bold">${totalDebits.toFixed(2)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Payments</p>
                  <p className="text-lg font-bold text-green-600">${totalCredits.toFixed(2)}</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${closingBalance > 0 ? 'bg-orange-50 dark:bg-orange-950' : 'bg-green-50 dark:bg-green-950'}`}>
                  <p className="text-xs text-muted-foreground">Closing Balance</p>
                  <p className={`text-lg font-bold ${closingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${closingBalance.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Statement Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening balance row */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={6} className="font-medium">Opening Balance</TableCell>
                    <TableCell className="text-right font-mono font-bold">${openingBalance.toFixed(2)}</TableCell>
                  </TableRow>

                  {lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{format(new Date(line.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={line.type === "invoice" ? "secondary" : line.type === "payment" ? "default" : "outline"}>
                          {line.type === "invoice" ? "Invoice" : line.type === "payment" ? "Payment" : "Credit Note"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{line.reference}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit > 0 ? `$${line.debit.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {line.credit > 0 ? `$${line.credit.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${line.balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                        ${line.balance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Closing balance row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>Closing Balance</TableCell>
                    <TableCell className="text-right font-mono">${totalDebits.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">${totalCredits.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-mono ${closingBalance > 0 ? "text-orange-600" : "text-green-600"}`}>
                      ${closingBalance.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {lines.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No transactions in this period</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
