import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, Plus, Eye, Check, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface Account { id: string; account_code: string; account_name: string; account_type: string; }
interface JournalEntry {
  id: string; entry_number: string; entry_date: string; description: string;
  reference_type: string | null; status: string; is_auto_generated: boolean;
  notes: string | null; created_at: string;
}
interface JournalLine {
  id: string; journal_entry_id: string; account_id: string;
  description: string | null; debit: number; credit: number;
}
interface NewLine { account_id: string; description: string; debit: number; credit: number; }

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [detailLines, setDetailLines] = useState<JournalLine[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  // Form
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<NewLine[]>([
    { account_id: "", description: "", debit: 0, credit: 0 },
    { account_id: "", description: "", debit: 0, credit: 0 },
  ]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: e }, { data: a }] = await Promise.all([
      supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("chart_of_accounts").select("id, account_code, account_name, account_type").eq("is_active", true).order("account_code"),
    ]);
    setEntries((e as JournalEntry[]) || []);
    setAccounts((a as Account[]) || []);
    setLoading(false);
  }

  const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredits = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  async function handleCreate() {
    if (!description) { toast.error("Description is required"); return; }
    const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) { toast.error("At least 2 lines required"); return; }
    if (!isBalanced) { toast.error("Debits must equal credits"); return; }

    setSaving(true);
    try {
      const today = format(new Date(), "yyyyMMdd");
      const { count } = await supabase.from("journal_entries").select("*", { count: "exact", head: true }).like("entry_number", `JE-${today}%`);
      const num = `JE-${today}-${String((count || 0) + 1).padStart(4, "0")}`;

      const { data: entry, error } = await supabase.from("journal_entries").insert({
        entry_number: num, entry_date: entryDate, description,
        status: "draft", created_by: user?.id, notes: notes || null,
      }).select().single();
      if (error) throw error;

      const lineData = validLines.map(l => ({
        journal_entry_id: entry.id, account_id: l.account_id,
        description: l.description || null, debit: l.debit, credit: l.credit,
      }));
      const { error: lErr } = await supabase.from("journal_entry_lines").insert(lineData);
      if (lErr) throw lErr;

      toast.success(`Journal entry ${num} created`);
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function resetForm() {
    setEntryDate(format(new Date(), "yyyy-MM-dd")); setDescription(""); setNotes("");
    setLines([{ account_id: "", description: "", debit: 0, credit: 0 }, { account_id: "", description: "", debit: 0, credit: 0 }]);
  }

  async function viewDetail(je: JournalEntry) {
    setSelected(je);
    const { data } = await supabase.from("journal_entry_lines").select("*").eq("journal_entry_id", je.id);
    setDetailLines((data as JournalLine[]) || []);
    setDetailOpen(true);
  }

  async function postEntry(je: JournalEntry) {
    // Update account balances
    const { data: entryLines } = await supabase.from("journal_entry_lines").select("*").eq("journal_entry_id", je.id);
    if (entryLines) {
      for (const line of entryLines as JournalLine[]) {
        const acc = accounts.find(a => a.id === line.account_id);
        if (!acc) continue;
        // For debit-normal accounts: balance increases with debits
        // For credit-normal accounts: balance increases with credits
        const { data: currentAcc } = await supabase.from("chart_of_accounts").select("current_balance, normal_balance").eq("id", line.account_id).single();
        if (currentAcc) {
          const change = currentAcc.normal_balance === "debit"
            ? line.debit - line.credit
            : line.credit - line.debit;
          await supabase.from("chart_of_accounts").update({
            current_balance: currentAcc.current_balance + change,
          }).eq("id", line.account_id);
        }
      }
    }
    await supabase.from("journal_entries").update({ status: "posted", posted_by: user?.id, posted_at: new Date().toISOString() }).eq("id", je.id);
    toast.success("Journal entry posted and balances updated");
    setDetailOpen(false);
    loadData();
  }

  async function deleteEntry(je: JournalEntry) {
    if (je.status === "posted") { toast.error("Cannot delete posted entries"); return; }
    if (!confirm("Delete this draft journal entry?")) return;
    await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", je.id);
    await supabase.from("journal_entries").delete().eq("id", je.id);
    toast.success("Entry deleted");
    loadData();
  }

  const getAccountLabel = (id: string) => {
    const a = accounts.find(a => a.id === id);
    return a ? `${a.account_code} - ${a.account_name}` : "Unknown";
  };

  const filtered = statusFilter === "all" ? entries : entries.filter(e => e.status === statusFilter);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-8 h-8" /> Journal Entries
            </h1>
            <p className="text-muted-foreground mt-1">Double-entry bookkeeping transactions</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> New Entry</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Journal Entry</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Monthly rent payment" />
                  </div>
                </div>

                {/* Lines */}
                <div>
                  <Label>Entry Lines</Label>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                      <div className="col-span-5">Account</div>
                      <div className="col-span-3">Description</div>
                      <div className="col-span-2">Debit</div>
                      <div className="col-span-2">Credit</div>
                    </div>
                    {lines.map((line, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <Select value={line.account_id} onValueChange={v => { const n = [...lines]; n[i].account_id = v; setLines(n); }}>
                            <SelectTrigger className="text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent className="bg-popover max-h-60">
                              {accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.account_code} - {a.account_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input value={line.description} onChange={e => { const n = [...lines]; n[i].description = e.target.value; setLines(n); }} placeholder="Memo" className="text-xs" />
                        </div>
                        <div className="col-span-2">
                          <Input type="number" step="0.01" min={0} value={line.debit || ""} onChange={e => {
                            const n = [...lines]; n[i].debit = parseFloat(e.target.value) || 0;
                            if (n[i].debit > 0) n[i].credit = 0; setLines(n);
                          }} placeholder="0.00" className="text-xs font-mono" />
                        </div>
                        <div className="col-span-2 flex gap-1">
                          <Input type="number" step="0.01" min={0} value={line.credit || ""} onChange={e => {
                            const n = [...lines]; n[i].credit = parseFloat(e.target.value) || 0;
                            if (n[i].credit > 0) n[i].debit = 0; setLines(n);
                          }} placeholder="0.00" className="text-xs font-mono flex-1" />
                          {lines.length > 2 && <Button variant="ghost" size="icon" className="h-10 w-8" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setLines([...lines, { account_id: "", description: "", debit: 0, credit: 0 }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Line
                  </Button>

                  {/* Totals */}
                  <div className="mt-3 grid grid-cols-12 gap-2 border-t pt-2">
                    <div className="col-span-8 text-right font-medium text-sm">Totals:</div>
                    <div className="col-span-2 font-mono font-medium text-sm">${totalDebits.toFixed(2)}</div>
                    <div className="col-span-2 font-mono font-medium text-sm">${totalCredits.toFixed(2)}</div>
                  </div>
                  {totalDebits > 0 && (
                    <div className={`text-sm mt-1 ${isBalanced ? "text-emerald-600" : "text-destructive"}`}>
                      {isBalanced ? "✓ Entry is balanced" : `✗ Difference: $${Math.abs(totalDebits - totalCredits).toFixed(2)}`}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving || !isBalanced}>{saving ? "Creating..." : "Create Entry"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No journal entries found</TableCell></TableRow>
                ) : filtered.map(je => (
                  <TableRow key={je.id}>
                    <TableCell className="font-mono font-medium">{je.entry_number}</TableCell>
                    <TableCell>{format(new Date(je.entry_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{je.description}</TableCell>
                    <TableCell>
                      <Badge variant={je.status === "posted" ? "default" : "secondary"} className={je.status === "posted" ? "bg-emerald-600 text-white" : ""}>
                        {je.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{je.is_auto_generated ? <Badge variant="outline">Auto</Badge> : <Badge variant="outline">Manual</Badge>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => viewDetail(je)}><Eye className="w-4 h-4" /></Button>
                      {je.status === "draft" && <Button variant="ghost" size="sm" onClick={() => deleteEntry(je)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Journal Entry {selected?.entry_number}</DialogTitle></DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Date:</span> {format(new Date(selected.entry_date), "MMM d, yyyy")}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={selected.status === "posted" ? "default" : "secondary"} className={selected.status === "posted" ? "bg-emerald-600 text-white" : ""}>{selected.status}</Badge></div>
                </div>
                <p className="text-sm"><span className="text-muted-foreground">Description:</span> {selected.description}</p>
                {selected.notes && <p className="text-sm text-muted-foreground">{selected.notes}</p>}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailLines.map(line => (
                      <TableRow key={line.id}>
                        <TableCell className="text-sm">{getAccountLabel(line.account_id)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{line.description || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{line.debit > 0 ? `$${line.debit.toFixed(2)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono">{line.credit > 0 ? `$${line.credit.toFixed(2)}` : "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2} className="text-right">Totals</TableCell>
                      <TableCell className="text-right font-mono">${detailLines.reduce((s, l) => s + l.debit, 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${detailLines.reduce((s, l) => s + l.credit, 0).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {selected.status === "draft" && (
                  <DialogFooter>
                    <Button onClick={() => postEntry(selected)}><Check className="w-4 h-4 mr-1" /> Post Entry</Button>
                  </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
