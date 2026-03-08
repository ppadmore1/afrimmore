import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Upload, CheckCircle, XCircle, Link2, Landmark, Search } from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  currency_code: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: string;
  reference: string | null;
  matched_entity_type: string | null;
  matched_entity_id: string | null;
  status: string;
}

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountForm, setAccountForm] = useState({ name: "", account_number: "", bank_name: "", opening_balance: 0 });
  const [csvText, setCsvText] = useState("");

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { if (selectedAccount) loadTransactions(); }, [selectedAccount]);

  async function loadAccounts() {
    const { data } = await supabase.from("bank_accounts").select("*").order("name");
    const accts = (data || []) as BankAccount[];
    setAccounts(accts);
    if (accts.length > 0 && !selectedAccount) setSelectedAccount(accts[0].id);
    setLoading(false);
  }

  async function loadTransactions() {
    const { data } = await supabase.from("bank_transactions").select("*")
      .eq("bank_account_id", selectedAccount).order("transaction_date", { ascending: false });
    setTransactions((data || []) as BankTransaction[]);
  }

  async function handleAddAccount() {
    if (!accountForm.name) { toast({ title: "Enter account name", variant: "destructive" }); return; }
    const { error } = await supabase.from("bank_accounts").insert({
      name: accountForm.name, account_number: accountForm.account_number,
      bank_name: accountForm.bank_name, opening_balance: accountForm.opening_balance,
      current_balance: accountForm.opening_balance,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Bank account added" });
    setShowAddAccount(false);
    setAccountForm({ name: "", account_number: "", bank_name: "", opening_balance: 0 });
    loadAccounts();
  }

  async function handleImportCSV() {
    if (!csvText.trim() || !selectedAccount) return;
    const lines = csvText.trim().split("\n").slice(1); // skip header
    const rows = lines.map(line => {
      const [date, desc, amount, type] = line.split(",").map(s => s.trim());
      return {
        bank_account_id: selectedAccount,
        transaction_date: date,
        description: desc,
        amount: Math.abs(parseFloat(amount) || 0),
        type: type?.toLowerCase() === "credit" ? "credit" : "debit",
        imported_at: new Date().toISOString(),
      };
    }).filter(r => r.description && r.amount > 0);

    if (rows.length === 0) { toast({ title: "No valid rows found", variant: "destructive" }); return; }
    const { error } = await supabase.from("bank_transactions").insert(rows);
    if (error) { toast({ title: "Import error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Imported ${rows.length} transactions` });
    setShowImport(false);
    setCsvText("");
    loadTransactions();
  }

  async function handleMatch(txn: BankTransaction) {
    // Auto-match: find payment with similar amount
    const { data: payments } = await supabase.from("payments").select("id, amount, payment_number")
      .gte("amount", txn.amount - 0.01).lte("amount", txn.amount + 0.01).limit(1);
    if (payments && payments.length > 0) {
      await supabase.from("bank_transactions").update({
        status: "matched", matched_entity_type: "payment", matched_entity_id: payments[0].id
      }).eq("id", txn.id);
      toast({ title: `Matched to ${payments[0].payment_number}` });
      loadTransactions();
    } else {
      toast({ title: "No matching payment found", variant: "destructive" });
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const currentAcct = accounts.find(a => a.id === selectedAccount);
  const matched = transactions.filter(t => t.status === "matched").length;
  const unmatched = transactions.filter(t => t.status === "unmatched").length;
  const filtered = transactions.filter(t =>
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.reference || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
            <p className="text-muted-foreground">Import and match bank transactions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddAccount(true)}><Plus className="h-4 w-4 mr-2" />Add Account</Button>
            <Button onClick={() => setShowImport(true)} disabled={!selectedAccount}><Upload className="h-4 w-4 mr-2" />Import CSV</Button>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="flex gap-4 items-end">
            <div className="w-64">
              <Label>Bank Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.bank_name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {currentAcct && (
              <div className="flex gap-4">
                <Card><CardContent className="pt-3 pb-2 px-4">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-lg font-bold">{fmt(currentAcct.current_balance)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-3 pb-2 px-4">
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="text-lg font-bold text-green-600">{matched}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-3 pb-2 px-4">
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                  <p className="text-lg font-bold text-orange-600">{unmatched}</p>
                </CardContent></Card>
              </div>
            )}
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {accounts.length === 0 ? "Add a bank account to get started" : "No transactions. Import a CSV to begin reconciliation."}
              </TableCell></TableRow>
            ) : filtered.map(txn => (
              <TableRow key={txn.id}>
                <TableCell>{format(new Date(txn.transaction_date), "MMM dd, yyyy")}</TableCell>
                <TableCell>{txn.description}</TableCell>
                <TableCell>{txn.reference || "—"}</TableCell>
                <TableCell><Badge variant={txn.type === "credit" ? "default" : "secondary"}>{txn.type}</Badge></TableCell>
                <TableCell className={`text-right font-semibold ${txn.type === "credit" ? "text-green-600" : "text-destructive"}`}>
                  {txn.type === "credit" ? "+" : "-"}{fmt(txn.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant={txn.status === "matched" ? "default" : "outline"}>
                    {txn.status === "matched" ? <><CheckCircle className="h-3 w-3 mr-1" />Matched</> : "Unmatched"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {txn.status === "unmatched" && (
                    <Button size="sm" variant="outline" onClick={() => handleMatch(txn)}>
                      <Link2 className="h-3 w-3 mr-1" />Match
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Account Name</Label><Input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} /></div>
            <div><Label>Bank Name</Label><Input value={accountForm.bank_name} onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })} /></div>
            <div><Label>Account Number</Label><Input value={accountForm.account_number} onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })} /></div>
            <div><Label>Opening Balance</Label><Input type="number" value={accountForm.opening_balance} onChange={e => setAccountForm({ ...accountForm, opening_balance: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccount(false)}>Cancel</Button>
            <Button onClick={handleAddAccount}>Add Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Bank Statement (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Format: <code>date, description, amount, type</code> (header row required)</p>
            <Textarea rows={8} placeholder={"date,description,amount,type\n2026-03-01,Payment from Client,1500.00,credit\n2026-03-02,Office Supplies,-250.00,debit"} value={csvText} onChange={e => setCsvText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button onClick={handleImportCSV}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
