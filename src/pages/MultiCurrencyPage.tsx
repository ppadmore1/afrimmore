import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2, Globe, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

interface Currency { id: string; code: string; name: string; symbol: string; is_base: boolean; is_active: boolean; }
interface ExchangeRate { id: string; from_currency: string; to_currency: string; rate: number; effective_date: string; }

export default function MultiCurrencyPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [currForm, setCurrForm] = useState({ code: "", name: "", symbol: "" });
  const [rateForm, setRateForm] = useState({ from_currency: "", to_currency: "", rate: 1 });
  const [convertAmount, setConvertAmount] = useState(100);
  const [convertFrom, setConvertFrom] = useState("");
  const [convertTo, setConvertTo] = useState("");
  const [convertResult, setConvertResult] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [cRes, rRes] = await Promise.all([
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
      supabase.from("exchange_rates").select("*").order("effective_date", { ascending: false }),
    ]);
    setCurrencies((cRes.data || []) as Currency[]);
    setRates((rRes.data || []) as ExchangeRate[]);
    setLoading(false);
  }

  async function handleAddCurrency() {
    if (!currForm.code || !currForm.name) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    const { error } = await supabase.from("currencies").insert({ code: currForm.code.toUpperCase(), name: currForm.name, symbol: currForm.symbol || "$" });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Currency added" });
    setShowAddCurrency(false);
    setCurrForm({ code: "", name: "", symbol: "" });
    loadData();
  }

  async function handleAddRate() {
    if (!rateForm.from_currency || !rateForm.to_currency || rateForm.rate <= 0) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    const { error } = await supabase.from("exchange_rates").insert({
      from_currency: rateForm.from_currency, to_currency: rateForm.to_currency, rate: rateForm.rate,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Exchange rate added" });
    setShowAddRate(false);
    setRateForm({ from_currency: "", to_currency: "", rate: 1 });
    loadData();
  }

  async function handleDeleteCurrency(id: string, isBase: boolean) {
    if (isBase) { toast({ title: "Cannot delete base currency", variant: "destructive" }); return; }
    await supabase.from("currencies").delete().eq("id", id);
    toast({ title: "Currency deleted" });
    loadData();
  }

  function handleConvert() {
    const rate = rates.find(r => r.from_currency === convertFrom && r.to_currency === convertTo);
    if (rate) { setConvertResult(convertAmount * rate.rate); }
    else {
      const reverse = rates.find(r => r.from_currency === convertTo && r.to_currency === convertFrom);
      if (reverse) { setConvertResult(convertAmount / reverse.rate); }
      else { toast({ title: "No exchange rate found", variant: "destructive" }); setConvertResult(null); }
    }
  }

  const baseCurrency = currencies.find(c => c.is_base);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Multi-Currency</h1>
            <p className="text-muted-foreground">Manage currencies and exchange rates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddRate(true)}><ArrowRightLeft className="h-4 w-4 mr-2" />Add Rate</Button>
            <Button onClick={() => setShowAddCurrency(true)}><Plus className="h-4 w-4 mr-2" />Add Currency</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Base Currency</p>
            <p className="text-2xl font-bold">{baseCurrency ? `${baseCurrency.code} (${baseCurrency.symbol})` : "Not set"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active Currencies</p>
            <p className="text-2xl font-bold">{currencies.filter(c => c.is_active).length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Exchange Rates</p>
            <p className="text-2xl font-bold">{rates.length}</p>
          </CardContent></Card>
        </div>

        {/* Currency Converter */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />Quick Convert</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end flex-wrap">
              <div><Label>Amount</Label><Input type="number" value={convertAmount} onChange={e => setConvertAmount(parseFloat(e.target.value) || 0)} className="w-32" /></div>
              <div><Label>From</Label><Input value={convertFrom} onChange={e => setConvertFrom(e.target.value.toUpperCase())} placeholder="USD" className="w-24" /></div>
              <div><Label>To</Label><Input value={convertTo} onChange={e => setConvertTo(e.target.value.toUpperCase())} placeholder="EUR" className="w-24" /></div>
              <Button onClick={handleConvert}>Convert</Button>
              {convertResult !== null && <p className="text-lg font-bold text-primary">= {convertResult.toFixed(2)} {convertTo}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Currencies Table */}
        <Card>
          <CardHeader><CardTitle>Currencies</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Symbol</TableHead><TableHead>Type</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {currencies.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.symbol}</TableCell>
                    <TableCell>{c.is_base ? <Badge>Base</Badge> : <Badge variant="secondary">Foreign</Badge>}</TableCell>
                    <TableCell>
                      {!c.is_base && <Button size="sm" variant="ghost" onClick={() => handleDeleteCurrency(c.id, c.is_base)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Exchange Rates Table */}
        <Card>
          <CardHeader><CardTitle>Exchange Rates</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Rate</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rates.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No exchange rates configured</TableCell></TableRow>
                ) : rates.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.from_currency}</TableCell>
                    <TableCell>{r.to_currency}</TableCell>
                    <TableCell className="text-right font-semibold">{r.rate.toFixed(4)}</TableCell>
                    <TableCell>{format(new Date(r.effective_date), "MMM dd, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddCurrency} onOpenChange={setShowAddCurrency}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Currency</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Code (e.g. EUR)</Label><Input value={currForm.code} onChange={e => setCurrForm({ ...currForm, code: e.target.value })} maxLength={3} /></div>
            <div><Label>Name</Label><Input value={currForm.name} onChange={e => setCurrForm({ ...currForm, name: e.target.value })} /></div>
            <div><Label>Symbol</Label><Input value={currForm.symbol} onChange={e => setCurrForm({ ...currForm, symbol: e.target.value })} maxLength={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCurrency(false)}>Cancel</Button>
            <Button onClick={handleAddCurrency}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddRate} onOpenChange={setShowAddRate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Exchange Rate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>From Currency Code</Label><Input value={rateForm.from_currency} onChange={e => setRateForm({ ...rateForm, from_currency: e.target.value.toUpperCase() })} /></div>
            <div><Label>To Currency Code</Label><Input value={rateForm.to_currency} onChange={e => setRateForm({ ...rateForm, to_currency: e.target.value.toUpperCase() })} /></div>
            <div><Label>Rate</Label><Input type="number" step="0.0001" value={rateForm.rate} onChange={e => setRateForm({ ...rateForm, rate: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRate(false)}>Cancel</Button>
            <Button onClick={handleAddRate}>Add Rate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
