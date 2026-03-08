import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, FileText, Calculator, Download } from "lucide-react";

interface TaxRate { id: string; name: string; rate: number; tax_type: string; description: string | null; is_active: boolean; }
interface TaxReturn {
  id: string; period_start: string; period_end: string; tax_type: string;
  total_output_tax: number; total_input_tax: number; net_tax: number; status: string; filed_at: string | null;
}

export default function TaxManagementPage() {
  const { user } = useAuth();
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRate, setShowAddRate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [rateForm, setRateForm] = useState({ name: "", rate: 0, tax_type: "VAT", description: "" });
  const [genPeriod, setGenPeriod] = useState("last_quarter");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [rRes, tRes] = await Promise.all([
      supabase.from("tax_rates").select("*").order("name"),
      supabase.from("tax_returns").select("*").order("period_end", { ascending: false }),
    ]);
    setTaxRates((rRes.data || []) as TaxRate[]);
    setTaxReturns((tRes.data || []) as TaxReturn[]);
    setLoading(false);
  }

  async function handleAddRate() {
    if (!rateForm.name) { toast({ title: "Enter tax name", variant: "destructive" }); return; }
    const { error } = await supabase.from("tax_rates").insert(rateForm);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tax rate added" });
    setShowAddRate(false);
    setRateForm({ name: "", rate: 0, tax_type: "VAT", description: "" });
    loadData();
  }

  async function handleGenerateReturn() {
    const now = new Date();
    let periodStart: Date, periodEnd: Date;
    if (genPeriod === "last_month") {
      const lastMonth = subMonths(now, 1);
      periodStart = startOfMonth(lastMonth);
      periodEnd = endOfMonth(lastMonth);
    } else {
      const lastQ = subMonths(now, 3);
      periodStart = startOfQuarter(lastQ);
      periodEnd = endOfQuarter(lastQ);
    }

    // Calculate output tax (from sales)
    const { data: invoices } = await supabase.from("invoices").select("tax_total, created_at")
      .gte("created_at", periodStart.toISOString()).lte("created_at", periodEnd.toISOString())
      .in("status", ["paid", "approved"]);
    const { data: posSales } = await supabase.from("pos_sales").select("tax_total, created_at")
      .gte("created_at", periodStart.toISOString()).lte("created_at", periodEnd.toISOString());
    const outputTax = [...(invoices || []), ...(posSales || [])].reduce((s: number, r: any) => s + (r.tax_total || 0), 0);

    // Calculate input tax (from purchases)
    const { data: purchases } = await supabase.from("purchase_orders").select("tax_total, created_at")
      .gte("created_at", periodStart.toISOString()).lte("created_at", periodEnd.toISOString())
      .in("status", ["confirmed", "received"]);
    const inputTax = (purchases || []).reduce((s: number, r: any) => s + (r.tax_total || 0), 0);

    const netTax = outputTax - inputTax;

    const { error } = await supabase.from("tax_returns").insert({
      period_start: format(periodStart, "yyyy-MM-dd"),
      period_end: format(periodEnd, "yyyy-MM-dd"),
      tax_type: "VAT",
      total_output_tax: outputTax,
      total_input_tax: inputTax,
      net_tax: netTax,
      status: "draft",
      created_by: user?.id,
    });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tax return generated" });
    setShowGenerate(false);
    loadData();
  }

  async function handleFileReturn(id: string) {
    await supabase.from("tax_returns").update({ status: "filed", filed_at: new Date().toISOString() }).eq("id", id);
    toast({ title: "Tax return marked as filed" });
    loadData();
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const totalOwed = taxReturns.filter(r => r.status === "draft").reduce((s, r) => s + r.net_tax, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tax Management</h1>
            <p className="text-muted-foreground">Configure tax rates and generate VAT/GST returns</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddRate(true)}><Plus className="h-4 w-4 mr-2" />Add Tax Rate</Button>
            <Button onClick={() => setShowGenerate(true)}><Calculator className="h-4 w-4 mr-2" />Generate Return</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active Tax Rates</p>
            <p className="text-2xl font-bold">{taxRates.filter(t => t.is_active).length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Tax Returns Filed</p>
            <p className="text-2xl font-bold">{taxReturns.filter(t => t.status === "filed").length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Net Tax Owed (Draft)</p>
            <p className={`text-2xl font-bold ${totalOwed > 0 ? "text-destructive" : "text-green-600"}`}>{fmt(totalOwed)}</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="returns">
          <TabsList>
            <TabsTrigger value="returns">Tax Returns</TabsTrigger>
            <TabsTrigger value="rates">Tax Rates</TabsTrigger>
          </TabsList>

          <TabsContent value="returns">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Period</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Output Tax (Sales)</TableHead>
                <TableHead className="text-right">Input Tax (Purchases)</TableHead>
                <TableHead className="text-right">Net Tax</TableHead>
                <TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {taxReturns.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tax returns yet</TableCell></TableRow>
                ) : taxReturns.map(tr => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">{format(new Date(tr.period_start), "MMM dd")} — {format(new Date(tr.period_end), "MMM dd, yyyy")}</TableCell>
                    <TableCell><Badge variant="secondary">{tr.tax_type}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(tr.total_output_tax)}</TableCell>
                    <TableCell className="text-right">{fmt(tr.total_input_tax)}</TableCell>
                    <TableCell className={`text-right font-semibold ${tr.net_tax > 0 ? "text-destructive" : "text-green-600"}`}>{fmt(tr.net_tax)}</TableCell>
                    <TableCell><Badge variant={tr.status === "filed" ? "default" : "outline"}>{tr.status}</Badge></TableCell>
                    <TableCell>
                      {tr.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => handleFileReturn(tr.id)}>
                          <FileText className="h-3 w-3 mr-1" />Mark Filed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="rates">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Rate</TableHead>
                <TableHead>Description</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {taxRates.map(tr => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">{tr.name}</TableCell>
                    <TableCell><Badge variant="secondary">{tr.tax_type}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{tr.rate}%</TableCell>
                    <TableCell>{tr.description || "—"}</TableCell>
                    <TableCell><Badge variant={tr.is_active ? "default" : "outline"}>{tr.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddRate} onOpenChange={setShowAddRate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Tax Rate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={rateForm.name} onChange={e => setRateForm({ ...rateForm, name: e.target.value })} placeholder="e.g. Standard VAT" /></div>
            <div><Label>Rate (%)</Label><Input type="number" value={rateForm.rate} onChange={e => setRateForm({ ...rateForm, rate: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Type</Label>
              <Select value={rateForm.tax_type} onValueChange={v => setRateForm({ ...rateForm, tax_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAT">VAT</SelectItem>
                  <SelectItem value="GST">GST</SelectItem>
                  <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                  <SelectItem value="Withholding">Withholding Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={rateForm.description} onChange={e => setRateForm({ ...rateForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRate(false)}>Cancel</Button>
            <Button onClick={handleAddRate}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Tax Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This will calculate output tax (from sales) and input tax (from purchases) for the selected period.</p>
            <div><Label>Period</Label>
              <Select value={genPeriod} onValueChange={setGenPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_quarter">Last Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button onClick={handleGenerateReturn}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
