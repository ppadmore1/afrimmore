import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Plus, Trash2, Search } from "lucide-react";
import { format, addDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  getQuotation, 
  addQuotation, 
  updateQuotation, 
  getNextQuotationNumber,
  getCustomers,
  getProducts,
  Customer,
  Product,
  QuotationItem,
  DocumentStatus,
} from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";

interface LineItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  total: number;
}

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<string | null>(null);

  const [quotationNumber, setQuotationNumber] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("draft");
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), product_id: null, description: "", quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, total: 0 }
  ]);

  useEffect(() => {
    loadInitialData();
  }, [id, isEditing]);

  async function loadInitialData() {
    try {
      const [customersData, productsData] = await Promise.all([
        getCustomers(),
        getProducts()
      ]);
      setCustomers(customersData);
      setProducts(productsData);

      if (isEditing && id) {
        const quotation = await getQuotation(id);
        if (quotation) {
          setQuotationNumber(quotation.quotation_number);
          setCustomerId(quotation.customer_id || "");
          setCustomerName(quotation.customer_name);
          setCustomerEmail(quotation.customer_email || "");
          setCustomerAddress(quotation.customer_address || "");
          setStatus(quotation.status);
          setValidUntil(quotation.valid_until || format(addDays(new Date(), 30), "yyyy-MM-dd"));
          setNotes(quotation.notes || "");
          if (quotation.items && quotation.items.length > 0) {
            setItems(quotation.items.map(item => ({
              id: item.id,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate || 0,
              discount: item.discount || 0,
              total: item.total,
            })));
          }
        }
      } else {
        const nextNumber = await getNextQuotationNumber();
        setQuotationNumber(nextNumber);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function selectCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerEmail(customer.email || "");
    setCustomerAddress([customer.address, customer.city, customer.country].filter(Boolean).join(", "));
    setCustomerOpen(false);
  }

  function selectProduct(lineId: string, product: Product) {
    setItems(items.map(item => {
      if (item.id === lineId) {
        const total = product.unit_price * item.quantity;
        return {
          ...item,
          product_id: product.id,
          description: product.name,
          unit_price: product.unit_price,
          tax_rate: product.tax_rate || 0,
          total,
        };
      }
      return item;
    }));
    setProductOpen(null);
  }

  function updateLineItem(id: string, field: keyof LineItem, value: number | string) {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        const subtotal = updated.quantity * updated.unit_price;
        const discountAmount = subtotal * (updated.discount / 100);
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * (updated.tax_rate / 100);
        updated.total = afterDiscount + taxAmount;
        return updated;
      }
      return item;
    }));
  }

  function addLineItem() {
    setItems([...items, {
      id: crypto.randomUUID(),
      product_id: null,
      description: "",
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
      discount: 0,
      total: 0,
    }]);
  }

  function removeLineItem(id: string) {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  }

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const discountTotal = items.reduce((sum, item) => {
    const lineSubtotal = item.quantity * item.unit_price;
    return sum + (lineSubtotal * (item.discount / 100));
  }, 0);
  const taxTotal = items.reduce((sum, item) => {
    const lineSubtotal = item.quantity * item.unit_price;
    const afterDiscount = lineSubtotal - (lineSubtotal * (item.discount / 100));
    return sum + (afterDiscount * (item.tax_rate / 100));
  }, 0);
  const total = subtotal - discountTotal + taxTotal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerName.trim()) {
      toast({ title: "Please enter a customer name", variant: "destructive" });
      return;
    }

    if (items.length === 0 || items.every(i => !i.description)) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const quotationData = {
        quotation_number: quotationNumber,
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_address: customerAddress.trim() || null,
        status,
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        total,
        valid_until: validUntil || null,
        notes: notes.trim() || null,
        created_by: null,
      };

      const quotationItems: Omit<QuotationItem, "id" | "quotation_id" | "created_at">[] = items
        .filter(item => item.description)
        .map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          discount: item.discount,
          total: item.total,
        }));

      if (isEditing && id) {
        await updateQuotation(id, quotationData, quotationItems);
        toast({ title: "Quotation updated successfully" });
      } else {
        await addQuotation(quotationData, quotationItems);
        toast({ title: "Quotation created successfully" });
      }

      navigate("/quotations");
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast({ title: "Error saving quotation", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditing ? "Edit Quotation" : "New Quotation"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {quotationNumber}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer & Details */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Search className="w-4 h-4 mr-2" />
                        {customerName || "Search customers..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 bg-popover" align="start">
                      <Command>
                        <CommandInput placeholder="Search customers..." />
                        <CommandList>
                          <CommandEmpty>No customers found.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                onSelect={() => selectCustomer(customer)}
                              >
                                <div>
                                  <p className="font-medium">{customer.name}</p>
                                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerAddress">Address</Label>
                  <Textarea
                    id="customerAddress"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Customer address"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as DocumentStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Description</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[120px]">Unit Price</TableHead>
                    <TableHead className="w-[100px]">Tax %</TableHead>
                    <TableHead className="w-[100px]">Disc %</TableHead>
                    <TableHead className="w-[120px] text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Popover open={productOpen === item.id} onOpenChange={(open) => setProductOpen(open ? item.id : null)}>
                          <PopoverTrigger asChild>
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                              placeholder="Search or type description..."
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0 bg-popover" align="start">
                            <Command>
                              <CommandInput placeholder="Search products..." />
                              <CommandList>
                                <CommandEmpty>No products found.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      onSelect={() => selectProduct(item.id, product)}
                                    >
                                      <div className="flex justify-between w-full">
                                        <span>{product.name}</span>
                                        <span className="text-muted-foreground">${product.unit_price.toFixed(2)}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.tax_rate}
                          onChange={(e) => updateLineItem(item.id, "tax_rate", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) => updateLineItem(item.id, "discount", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${item.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-mono text-destructive">-${discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="font-mono">${taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="font-mono">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : isEditing ? "Update Quotation" : "Create Quotation"}
            </Button>
          </div>
        </form>
      </motion.div>
    </AppLayout>
  );
}
