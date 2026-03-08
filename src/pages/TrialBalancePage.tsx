import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scale, Download, Calendar } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Account {
  id: string; account_code: string; account_name: string;
  account_type: string; account_subtype: string | null;
  current_balance: number; normal_balance: string; is_active: boolean;
}

interface TrialBalanceRow {
  account_code: string; account_name: string; account_type: string;
  debit: number; credit: number;
}

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];
const TYPE_LABELS: Record<string, string> = {
  asset: "Assets", liability: "Liabilities", equity: "Equity", revenue: "Revenue", expense: "Expenses",
};

export default function TrialBalancePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoading(true);
    const { data } = await supabase.from("chart_of_accounts").select("*").eq("is_active", true).order("account_code");
    setAccounts((data as Account[]) || []);
    setLoading(false);
  }

  // Build trial balance rows
  const trialBalance: TrialBalanceRow[] = accounts
    .filter(a => a.current_balance !== 0)
    .map(a => ({
      account_code: a.account_code,
      account_name: a.account_name,
      account_type: a.account_type,
      debit: a.normal_balance === "debit" ? Math.abs(a.current_balance) : (a.current_balance < 0 ? Math.abs(a.current_balance) : 0),
      credit: a.normal_balance === "credit" ? Math.abs(a.current_balance) : (a.current_balance < 0 ? Math.abs(a.current_balance) : 0),
    }));

  const totalDebits = trialBalance.reduce((s, r) => s + r.debit, 0);
  const totalCredits = trialBalance.reduce((s, r) => s + r.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  // Group by type
  const groupedRows = TYPE_ORDER.map(type => ({
    type,
    label: TYPE_LABELS[type],
    rows: trialBalance.filter(r => r.account_type === type),
    totalDebit: trialBalance.filter(r => r.account_type === type).reduce((s, r) => s + r.debit, 0),
    totalCredit: trialBalance.filter(r => r.account_type === type).reduce((s, r) => s + r.credit, 0),
  })).filter(g => g.rows.length > 0);

  function exportCSV() {
    let csv = "Account Code,Account Name,Type,Debit,Credit\n";
    trialBalance.forEach(r => {
      csv += `"${r.account_code}","${r.account_name}","${r.account_type}",${r.debit.toFixed(2)},${r.credit.toFixed(2)}\n`;
    });
    csv += `,,TOTALS,${totalDebits.toFixed(2)},${totalCredits.toFixed(2)}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trial-balance-${asOfDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Scale className="w-8 h-8" /> Trial Balance
            </h1>
            <p className="text-muted-foreground mt-1">Verify that debits equal credits across all accounts</p>
          </div>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-2xl font-bold font-mono text-foreground">${totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold font-mono text-foreground">${totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Balance Status</p>
              {accounts.length === 0 || (totalDebits === 0 && totalCredits === 0) ? (
                <Badge variant="outline" className="text-lg mt-1">No Entries</Badge>
              ) : isBalanced ? (
                <Badge className="bg-emerald-600 text-white text-lg mt-1">✓ Balanced</Badge>
              ) : (
                <div>
                  <Badge variant="destructive" className="text-lg mt-1">✗ Unbalanced</Badge>
                  <p className="text-sm text-destructive mt-1">Difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Label>As of:</Label>
            <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="w-44" />
          </div>
        </div>

        {/* Trial Balance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              Trial Balance
              <br />
              <span className="text-sm font-normal text-muted-foreground">As of {format(new Date(asOfDate), "MMMM d, yyyy")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right w-36">Debit ($)</TableHead>
                  <TableHead className="text-right w-36">Credit ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : trialBalance.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No account balances yet. Post journal entries to populate the trial balance.
                  </TableCell></TableRow>
                ) : (
                  <>
                    {groupedRows.map(group => (
                      <>
                        <TableRow key={`header-${group.type}`} className="bg-muted/50">
                          <TableCell colSpan={4} className="font-bold text-sm">{group.label}</TableCell>
                        </TableRow>
                        {group.rows.map(row => (
                          <TableRow key={row.account_code}>
                            <TableCell className="font-mono">{row.account_code}</TableCell>
                            <TableCell>{row.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{row.debit > 0 ? row.debit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                            <TableCell className="text-right font-mono">{row.credit > 0 ? row.credit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow key={`subtotal-${group.type}`} className="border-t">
                          <TableCell colSpan={2} className="text-right text-sm font-medium text-muted-foreground">Subtotal {group.label}:</TableCell>
                          <TableCell className="text-right font-mono font-medium">{group.totalDebit > 0 ? group.totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{group.totalCredit > 0 ? group.totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}</TableCell>
                        </TableRow>
                      </>
                    ))}
                    {/* Grand Total */}
                    <TableRow className="border-t-2 border-double bg-muted/30 font-bold">
                      <TableCell colSpan={2} className="text-right text-base">TOTALS</TableCell>
                      <TableCell className="text-right font-mono text-base">${totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono text-base">${totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </AppLayout>
  );
}
