import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Plus, Edit2, Trash2, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Account {
  id: string; account_code: string; account_name: string;
  account_type: string; account_subtype: string | null;
  parent_account_id: string | null; description: string | null;
  is_active: boolean; is_system: boolean; opening_balance: number;
  current_balance: number; normal_balance: string;
}

const ACCOUNT_TYPES = [
  { value: "asset", label: "Asset", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "liability", label: "Liability", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "equity", label: "Equity", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "revenue", label: "Revenue", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { value: "expense", label: "Expense", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
  asset: [
    { value: "current_asset", label: "Current Asset" },
    { value: "fixed_asset", label: "Fixed Asset" },
    { value: "other_asset", label: "Other Asset" },
  ],
  liability: [
    { value: "current_liability", label: "Current Liability" },
    { value: "long_term_liability", label: "Long-term Liability" },
  ],
  equity: [
    { value: "owner_equity", label: "Owner's Equity" },
    { value: "retained_earnings", label: "Retained Earnings" },
  ],
  revenue: [
    { value: "operating_revenue", label: "Operating Revenue" },
    { value: "other_revenue", label: "Other Revenue" },
  ],
  expense: [
    { value: "cost_of_goods_sold", label: "Cost of Goods Sold" },
    { value: "operating_expense", label: "Operating Expense" },
    { value: "other_expense", label: "Other Expense" },
  ],
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [activeTab, setActiveTab] = useState("asset");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("asset");
  const [subtype, setSubtype] = useState("");
  const [parentId, setParentId] = useState("none");
  const [description, setDescription] = useState("");
  const [normalBalance, setNormalBalance] = useState("debit");
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoading(true);
    const { data } = await supabase.from("chart_of_accounts").select("*").order("account_code");
    setAccounts((data as Account[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setCode(""); setName(""); setType("asset");
    setSubtype(""); setParentId("none"); setDescription("");
    setNormalBalance("debit"); setOpeningBalance(0);
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc); setCode(acc.account_code); setName(acc.account_name);
    setType(acc.account_type); setSubtype(acc.account_subtype || "");
    setParentId(acc.parent_account_id || "none"); setDescription(acc.description || "");
    setNormalBalance(acc.normal_balance); setOpeningBalance(acc.opening_balance);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!code || !name || !type) { toast.error("Code, name, and type are required"); return; }
    setSaving(true);
    try {
      const data: any = {
        account_code: code, account_name: name, account_type: type,
        account_subtype: subtype || null,
        parent_account_id: parentId !== "none" ? parentId : null,
        description: description || null, normal_balance: normalBalance,
        opening_balance: openingBalance, current_balance: openingBalance,
      };
      if (editing) {
        const { error } = await supabase.from("chart_of_accounts").update(data).eq("id", editing.id);
        if (error) throw error;
        toast.success("Account updated");
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(data);
        if (error) throw error;
        toast.success("Account created");
      }
      setDialogOpen(false);
      loadAccounts();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function handleDelete(acc: Account) {
    if (acc.is_system) { toast.error("Cannot delete system accounts"); return; }
    if (!confirm(`Delete account "${acc.account_code} - ${acc.account_name}"?`)) return;
    const { error } = await supabase.from("chart_of_accounts").delete().eq("id", acc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Account deleted");
    loadAccounts();
  }

  const getTypeInfo = (t: string) => ACCOUNT_TYPES.find(at => at.value === t);

  const filteredAccounts = accounts.filter(a => {
    const matchesTab = a.account_type === activeTab;
    const matchesSearch = !search || a.account_code.toLowerCase().includes(search.toLowerCase()) || a.account_name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Summary totals
  const typeTotals = ACCOUNT_TYPES.map(t => ({
    ...t,
    total: accounts.filter(a => a.account_type === t.value).reduce((s, a) => s + a.current_balance, 0),
    count: accounts.filter(a => a.account_type === t.value).length,
  }));

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-8 h-8" /> Chart of Accounts
            </h1>
            <p className="text-muted-foreground mt-1">IFRS-aligned general ledger account structure</p>
          </div>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> New Account</Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {typeTotals.map(t => (
            <Card key={t.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab(t.value)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Badge className={t.color}>{t.label}</Badge>
                  <span className="text-xs text-muted-foreground">{t.count} accts</span>
                </div>
                <p className="text-xl font-bold mt-2 font-mono">${Math.abs(t.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Input placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {ACCOUNT_TYPES.map(t => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {ACCOUNT_TYPES.map(t => (
            <TabsContent key={t.value} value={t.value}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Subtype</TableHead>
                        <TableHead>Normal</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                      ) : filteredAccounts.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No accounts found</TableCell></TableRow>
                      ) : filteredAccounts.map(acc => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-mono font-medium">{acc.account_code}</TableCell>
                          <TableCell>
                            <div>
                              {acc.account_name}
                              {acc.is_system && <Badge variant="outline" className="ml-2 text-xs">System</Badge>}
                            </div>
                            {acc.description && <p className="text-xs text-muted-foreground">{acc.description}</p>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {acc.account_subtype?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{acc.normal_balance}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${acc.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {acc.is_active
                              ? <Badge className="bg-emerald-600 text-white">Active</Badge>
                              : <Badge variant="secondary">Inactive</Badge>}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(acc)}><Edit2 className="w-4 h-4" /></Button>
                            {!acc.is_system && (
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(acc)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Code *</Label>
                  <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g., 1100" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Account Type *</Label>
                  <Select value={type} onValueChange={v => { setType(v); setSubtype(""); setNormalBalance(["asset", "expense"].includes(v) ? "debit" : "credit"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Accounts Receivable" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subtype</Label>
                  <Select value={subtype} onValueChange={setSubtype}>
                    <SelectTrigger><SelectValue placeholder="Select subtype" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {(SUBTYPES[type] || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Normal Balance</Label>
                  <Select value={normalBalance} onValueChange={setNormalBalance}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parent Account</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">None (Top Level)</SelectItem>
                      {accounts.filter(a => a.account_type === type && a.id !== editing?.id).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.account_code} - {a.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Opening Balance</Label>
                  <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Account description..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
