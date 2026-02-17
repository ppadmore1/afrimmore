import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Plus, Trash2, Search, Package, Download } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandHint,
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
  getDeliveryNote, 
  addDeliveryNote, 
  updateDeliveryNote, 
  getNextDeliveryNumber,
  getCustomers,
  getProducts,
  Customer,
  Product,
  DeliveryNoteItem,
  DocumentStatus,
} from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";
import { downloadDeliveryNotePDF } from "@/lib/pdf";

interface LineItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  stock_available?: number;
}

export default function DeliveryNoteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<string | null>(null);

  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("pending");
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), product_id: null, description: "", quantity: 1 }
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
        const deliveryNote = await getDeliveryNote(id);
        if (deliveryNote) {
          setDeliveryNumber(deliveryNote.delivery_number);
          setCustomerId(deliveryNote.customer_id || "");
          setCustomerName(deliveryNote.customer_name);
          setCustomerAddress(deliveryNote.customer_address || "");
          setStatus(deliveryNote.status);
          setDeliveryDate(deliveryNote.delivery_date || format(new Date(), "yyyy-MM-dd"));
          setNotes(deliveryNote.notes || "");
          if (deliveryNote.items && deliveryNote.items.length > 0) {
            setItems(deliveryNote.items.map(item => ({
              id: item.id,
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              stock_available: productsData.find(p => p.id === item.product_id)?.stock_quantity,
            })));
          }
        }
      } else {
        const nextNumber = await getNextDeliveryNumber();
        setDeliveryNumber(nextNumber);
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
    setCustomerAddress([customer.address, customer.city, customer.country].filter(Boolean).join(", "));
    setCustomerOpen(false);
  }

  function selectProduct(lineId: string, product: Product) {
    setItems(items.map(item => {
      if (item.id === lineId) {
        return {
          ...item,
          product_id: product.id,
          description: product.name,
          stock_available: product.stock_quantity,
        };
      }
      return item;
    }));
    setProductOpen(null);
  }

  function updateLineItem(id: string, field: keyof LineItem, value: number | string) {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
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
    }]);
  }

  function removeLineItem(id: string) {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  }

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

    // Check stock availability for new deliveries
    if (!isEditing) {
      for (const item of items) {
        if (item.product_id && item.stock_available !== undefined) {
          if (item.quantity > item.stock_available) {
            toast({ 
              title: "Insufficient stock", 
              description: `${item.description} only has ${item.stock_available} units available`,
              variant: "destructive" 
            });
            return;
          }
        }
      }
    }

    setSaving(true);

    try {
      const deliveryData = {
        delivery_number: deliveryNumber,
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        customer_address: customerAddress.trim() || null,
        status,
        delivery_date: deliveryDate || null,
        notes: notes.trim() || null,
        invoice_id: null,
        created_by: null,
      };

      const deliveryItems: Omit<DeliveryNoteItem, "id" | "delivery_note_id" | "created_at">[] = items
        .filter(item => item.description)
        .map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
        }));

      if (isEditing && id) {
        await updateDeliveryNote(id, deliveryData);
        toast({ title: "Delivery note updated successfully" });
      } else {
        await addDeliveryNote(deliveryData, deliveryItems);
        toast({ 
          title: "Delivery note created successfully",
          description: "Stock has been automatically updated"
        });
      }

      navigate("/delivery-notes");
    } catch (error) {
      console.error("Error saving delivery note:", error);
      toast({ title: "Error saving delivery note", variant: "destructive" });
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEditing ? "Edit Delivery Note" : "New Delivery Note"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {deliveryNumber}
              </p>
            </div>
          </div>
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const deliveryNote = {
                  id: id!,
                  delivery_number: deliveryNumber,
                  customer_id: customerId || null,
                  customer_name: customerName,
                  customer_address: customerAddress || null,
                  status,
                  delivery_date: deliveryDate || null,
                  notes: notes || null,
                  invoice_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  created_by: null,
                  items: items.map(item => ({
                    id: item.id,
                    delivery_note_id: id!,
                    product_id: item.product_id,
                    description: item.description,
                    quantity: item.quantity,
                    created_at: new Date().toISOString(),
                  })),
                };
                await downloadDeliveryNotePDF(deliveryNote);
                toast({ title: "PDF downloaded" });
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
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
                        <CommandHint />
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
                  <Label htmlFor="customerAddress">Delivery Address</Label>
                  <Textarea
                    id="customerAddress"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Delivery address"
                    rows={3}
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Delivery Date</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
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

                {!isEditing && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Stock will be automatically deducted when the delivery note is created
                    </p>
                  </div>
                )}
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
                    <TableHead className="w-[400px]">Product / Description</TableHead>
                    <TableHead className="w-[120px]">Stock</TableHead>
                    <TableHead className="w-[120px]">Quantity</TableHead>
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
                          <PopoverContent className="w-96 p-0 bg-popover" align="start">
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
                                      <div className="flex justify-between w-full items-center">
                                        <span>{product.name}</span>
                                        <Badge 
                                          variant={product.stock_quantity > 0 ? "secondary" : "destructive"}
                                          className="ml-2"
                                        >
                                          {product.stock_quantity} in stock
                                        </Badge>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                              <CommandHint />
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        {item.stock_available !== undefined ? (
                          <Badge variant={item.stock_available > 0 ? "secondary" : "destructive"}>
                            {item.stock_available}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                          className={item.stock_available !== undefined && item.quantity > item.stock_available ? "border-destructive" : ""}
                        />
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

          {/* Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Total Items</h3>
                  <p className="text-2xl font-bold font-mono">
                    {items.filter(i => i.description).reduce((sum, i) => sum + i.quantity, 0)} units
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {items.filter(i => i.description).length} line items
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
              {saving ? "Saving..." : isEditing ? "Update Delivery Note" : "Create Delivery Note"}
            </Button>
          </div>
        </form>
      </motion.div>
    </AppLayout>
  );
}
