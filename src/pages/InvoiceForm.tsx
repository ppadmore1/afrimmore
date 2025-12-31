import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save,
  Calculator,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
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
  getAllCustomers, 
  getAllProducts, 
  getInvoice,
  addInvoice, 
  updateInvoice,
  getNextInvoiceNumber,
  Customer, 
  Product,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
} from "@/lib/db";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");

  useEffect(() => {
    async function loadData() {
      try {
        const [customersData, productsData] = await Promise.all([
          getAllCustomers(),
          getAllProducts(),
        ]);
        setCustomers(customersData);
        setProducts(productsData);

        if (isEditing && id) {
          const invoice = await getInvoice(id);
          if (invoice) {
            setInvoiceNumber(invoice.invoiceNumber);
            setSelectedCustomerId(invoice.customerId);
            setItems(invoice.items);
            setStatus(invoice.status);
            setDueDate(format(new Date(invoice.dueDate), "yyyy-MM-dd"));
            setNotes(invoice.notes);
            setPaymentTerms(invoice.paymentTerms);
          }
        } else {
          const nextNumber = await getNextInvoiceNumber();
          setInvoiceNumber(nextNumber);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isEditing]);

  function addItem() {
    setItems([
      ...items,
      {
        productId: "",
        productName: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        tax: 0,
        discount: 0,
        total: 0,
      },
    ]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total
    const item = newItems[index];
    const subtotal = item.quantity * item.unitPrice;
    const taxAmount = subtotal * (item.tax / 100);
    const discountAmount = subtotal * (item.discount / 100);
    item.total = subtotal + taxAmount - discountAmount;
    
    setItems(newItems);
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        description: product.description,
        unitPrice: product.price,
        total: product.price * newItems[index].quantity,
      };
      setItems(newItems);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.tax / 100), 0);
  const discountTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.discount / 100), 0);
  const total = subtotal + taxTotal - discountTotal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedCustomerId) {
      toast({ title: "Please select a customer", variant: "destructive" });
      return;
    }

    if (items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      const invoice: Invoice = {
        id: isEditing && id ? id : uuidv4(),
        invoiceNumber,
        customerId: selectedCustomerId,
        customerName: customer?.name || "",
        items,
        subtotal,
        taxTotal,
        discountTotal,
        total,
        status,
        dueDate: new Date(dueDate),
        notes,
        paymentTerms,
        createdAt: isEditing ? new Date() : new Date(),
        updatedAt: new Date(),
      };

      if (isEditing) {
        await updateInvoice(invoice);
        toast({ title: "Invoice updated successfully" });
      } else {
        await addInvoice(invoice);
        toast({ title: "Invoice created successfully" });
      }

      navigate("/invoices");
    } catch (error) {
      toast({ title: "Error saving invoice", variant: "destructive" });
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
              {isEditing ? "Edit Invoice" : "New Invoice"}
            </h1>
            <p className="text-muted-foreground mt-1">{invoiceNumber}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input value={invoiceNumber} disabled className="font-mono" />
              </div>

              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No items added yet. Click "Add Item" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="hidden lg:grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <div className="col-span-3">Product/Service</div>
                    <div className="col-span-2">Description</div>
                    <div className="col-span-1">Qty</div>
                    <div className="col-span-2">Unit Price</div>
                    <div className="col-span-1">Tax %</div>
                    <div className="col-span-1">Disc %</div>
                    <div className="col-span-1">Total</div>
                    <div className="col-span-1"></div>
                  </div>

                  {/* Items */}
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-0 bg-muted/50 lg:bg-transparent rounded-lg">
                      <div className="lg:col-span-3">
                        <Label className="lg:hidden mb-2 block">Product</Label>
                        <Select 
                          value={item.productId} 
                          onValueChange={(v) => selectProduct(index, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - ${product.price}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="lg:col-span-2">
                        <Label className="lg:hidden mb-2 block">Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          placeholder="Description"
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <Label className="lg:hidden mb-2 block">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <Label className="lg:hidden mb-2 block">Unit Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <Label className="lg:hidden mb-2 block">Tax %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={item.tax}
                          onChange={(e) => updateItem(index, "tax", parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <Label className="lg:hidden mb-2 block">Discount %</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) => updateItem(index, "discount", parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="lg:col-span-1 flex items-center">
                        <span className="font-mono font-medium">
                          ${item.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="lg:col-span-1 flex items-center justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-end gap-8">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono w-24 text-right">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-8">
                      <span className="text-muted-foreground">Tax:</span>
                      <span className="font-mono w-24 text-right">${taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-8">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-mono w-24 text-right">-${discountTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-end gap-8 text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span className="font-mono w-24 text-right">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g., Net 30"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the invoice..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : isEditing ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </motion.div>
    </AppLayout>
  );
}
