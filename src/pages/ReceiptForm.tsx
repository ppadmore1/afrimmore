import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Download, Save, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandHint,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LineItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
  tax_rate: number | null;
}

export default function ReceiptForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const isEditing = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);

  const [receiptNumber, setReceiptNumber] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other'>('cash');
  const [amountReceived, setAmountReceived] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: uuidv4(), product_id: null, description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, total: 0 }
  ]);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, email, address')
        .order('name');
      setCustomers(customersData || []);

      // Load products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, unit_price, tax_rate')
        .eq('is_active', true)
        .order('name');
      setProducts(productsData || []);

      if (isEditing) {
        // Load existing receipt
        const { data: receipt, error } = await supabase
          .from('receipts')
          .select('*, receipt_items(*)')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (receipt) {
          setReceiptNumber(receipt.receipt_number);
          setCustomerId(receipt.customer_id);
          setCustomerName(receipt.customer_name);
          setCustomerEmail(receipt.customer_email || '');
          setCustomerAddress(receipt.customer_address || '');
          setPaymentMethod(receipt.payment_method);
          setAmountReceived(Number(receipt.amount_received));
          setNotes(receipt.notes || '');
          setItems(receipt.receipt_items.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            discount: Number(item.discount || 0),
            tax_rate: Number(item.tax_rate || 0),
            total: Number(item.total),
          })));
        }
      } else {
        // Generate new receipt number
        const today = format(new Date(), 'yyyyMMdd');
        const { count } = await supabase
          .from('receipts')
          .select('*', { count: 'exact', head: true })
          .like('receipt_number', `REC-${today}%`);
        setReceiptNumber(`REC-${today}-${String((count || 0) + 1).padStart(4, '0')}`);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerEmail(customer.email || '');
    setCustomerAddress(customer.address || '');
    setCustomerOpen(false);
  };

  const selectProduct = (lineId: string, product: Product) => {
    setItems(prev => prev.map(item => {
      if (item.id === lineId) {
        const taxRate = product.tax_rate || 0;
        const subtotal = product.unit_price * item.quantity;
        const discountAmount = subtotal * (item.discount / 100);
        const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
        return {
          ...item,
          product_id: product.id,
          description: product.name,
          unit_price: product.unit_price,
          tax_rate: taxRate,
          total: subtotal - discountAmount + taxAmount,
        };
      }
      return item;
    }));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: number | string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        const subtotal = updated.unit_price * updated.quantity;
        const discountAmount = subtotal * (updated.discount / 100);
        const taxAmount = (subtotal - discountAmount) * (updated.tax_rate / 100);
        updated.total = subtotal - discountAmount + taxAmount;
        return updated;
      }
      return item;
    }));
  };

  const addLineItem = () => {
    setItems(prev => [...prev, {
      id: uuidv4(),
      product_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax_rate: 0,
      total: 0,
    }]);
  };

  const removeLineItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const discountTotal = items.reduce((sum, item) => {
    const itemSubtotal = item.unit_price * item.quantity;
    return sum + (itemSubtotal * (item.discount / 100));
  }, 0);
  const taxTotal = items.reduce((sum, item) => {
    const itemSubtotal = item.unit_price * item.quantity;
    const discountAmount = itemSubtotal * (item.discount / 100);
    return sum + ((itemSubtotal - discountAmount) * (item.tax_rate / 100));
  }, 0);
  const total = subtotal - discountTotal + taxTotal;
  const changeAmount = Math.max(0, amountReceived - total);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (items.every(item => !item.description.trim())) {
      toast.error('At least one item is required');
      return;
    }

    setSaving(true);
    try {
      const receiptData = {
        receipt_number: receiptNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_address: customerAddress || null,
        payment_method: paymentMethod,
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        total,
        amount_received: amountReceived,
        change_amount: changeAmount,
        notes: notes || null,
        created_by: user?.id,
        branch_id: currentBranch?.id || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('receipts')
          .update(receiptData)
          .eq('id', id);
        if (error) throw error;

        // Delete old items and insert new
        await supabase.from('receipt_items').delete().eq('receipt_id', id);
        const { error: itemsError } = await supabase.from('receipt_items').insert(
          items.filter(item => item.description.trim()).map(item => ({
            receipt_id: id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            tax_rate: item.tax_rate,
            total: item.total,
          }))
        );
        if (itemsError) throw itemsError;
        toast.success('Receipt updated');
      } else {
        const { data: newReceipt, error } = await supabase
          .from('receipts')
          .insert(receiptData)
          .select()
          .single();
        if (error) throw error;

        const { error: itemsError } = await supabase.from('receipt_items').insert(
          items.filter(item => item.description.trim()).map(item => ({
            receipt_id: newReceipt.id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            tax_rate: item.tax_rate,
            total: item.total,
          }))
        );
        if (itemsError) throw itemsError;
        toast.success('Receipt created');
      }

      navigate('/receipts');
    } catch (error) {
      console.error('Error saving receipt:', error);
      toast.error('Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('RECEIPT', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Receipt #: ${receiptNumber}`, 14, 35);
    doc.text(`Date: ${format(new Date(), 'MMM d, yyyy')}`, 14, 42);
    doc.text(`Customer: ${customerName}`, 14, 49);
    doc.text(`Payment: ${paymentMethod.replace('_', ' ').toUpperCase()}`, 14, 56);

    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Qty', 'Price', 'Total']],
      body: items.filter(i => i.description).map(item => [
        item.description,
        item.quantity.toString(),
        `$${item.unit_price.toFixed(2)}`,
        `$${item.total.toFixed(2)}`,
      ]),
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 140, finalY);
    doc.text(`Tax: $${taxTotal.toFixed(2)}`, 140, finalY + 7);
    doc.setFontSize(14);
    doc.text(`Total: $${total.toFixed(2)}`, 140, finalY + 17);
    doc.setFontSize(12);
    doc.text(`Amount Received: $${amountReceived.toFixed(2)}`, 140, finalY + 27);
    doc.text(`Change: $${changeAmount.toFixed(2)}`, 140, finalY + 34);

    doc.save(`${receiptNumber}.pdf`);
    toast.success('PDF downloaded');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/receipts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? 'Edit Receipt' : 'New Receipt'}</h1>
            <p className="text-muted-foreground">{receiptNumber}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Receipt Number</Label>
                  <Input 
                    value={receiptNumber} 
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="font-mono" 
                    placeholder="Auto-generated or enter custom number"
                  />
                  <p className="text-xs text-muted-foreground">Auto-generated. Edit to use a custom number.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <Search className="w-4 h-4 mr-2" />
                          {customerName || 'Select customer...'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0">
                        <Command>
                          <CommandInput placeholder="Search customers..." />
                          <CommandList>
                            <CommandEmpty>No customers found</CommandEmpty>
                            <CommandGroup>
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  onSelect={() => selectCustomer(customer)}
                                >
                                  {customer.name}
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
                    <Label>Customer Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in Customer"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount Received</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Discount %</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              placeholder="Search or enter description..."
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0">
                            <Command>
                              <CommandInput placeholder="Search products..." />
                              <CommandList>
                                <CommandEmpty>No products found</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      onSelect={() => selectProduct(item.id, product)}
                                    >
                                      <div className="flex justify-between w-full">
                                        <span>{product.name}</span>
                                        <span className="text-muted-foreground">
                                          ${product.unit_price.toFixed(2)}
                                        </span>
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
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) => updateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={item.tax_rate}
                          onChange={(e) => updateLineItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
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
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end mt-6">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount:</span>
                    <span>-${discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax:</span>
                    <span>${taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Change:</span>
                    <span>${changeAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/receipts')}>
              Cancel
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" onClick={downloadPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Receipt'}
            </Button>
          </div>
        </form>
      </motion.div>
    </AppLayout>
  );
}
