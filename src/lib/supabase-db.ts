import { supabase } from '@/integrations/supabase/client';

// Types
export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit_price: number;
  cost_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
  unit: string | null;
  tax_rate: number | null;
  is_active: boolean | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled' | 'delivered';
export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  status: DocumentStatus;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  discount: number | null;
  total: number;
  created_at: string;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  status: DocumentStatus;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: QuotationItem[];
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  discount: number | null;
  total: number;
  created_at: string;
}

export interface DeliveryNote {
  id: string;
  delivery_number: string;
  invoice_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_address: string | null;
  status: DocumentStatus;
  delivery_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  created_at: string;
}

export interface POSSale {
  id: string;
  sale_number: string;
  customer_id: string | null;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  amount_paid: number;
  change_amount: number;
  payment_method: PaymentMethod;
  status: DocumentStatus;
  created_by: string | null;
  created_at: string;
  items?: POSSaleItem[];
}

export interface POSSaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  discount: number | null;
  total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string | null;
  pos_sale_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// Categories
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function addCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Products
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function addProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function updateStock(productId: string, quantity: number, movementType: 'in' | 'out' | 'adjustment', referenceType?: string, referenceId?: string): Promise<void> {
  // Get current stock
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const newQuantity = movementType === 'in' 
    ? (product?.stock_quantity || 0) + quantity
    : movementType === 'out'
    ? (product?.stock_quantity || 0) - quantity
    : quantity;
  
  // Update product stock
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newQuantity })
    .eq('id', productId);
  
  if (updateError) throw updateError;
  
  // Record movement
  const { error: movementError } = await supabase
    .from('stock_movements')
    .insert({
      product_id: productId,
      quantity: movementType === 'out' ? -quantity : quantity,
      movement_type: movementType,
      reference_type: referenceType,
      reference_id: referenceId,
    });
  
  if (movementError) throw movementError;
}

// Customers
export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function addCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(customer)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

// Invoices
export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].invoice_number.split('-')[2], 10);
    return `INV-${year}-${String(lastNumber + 1).padStart(5, '0')}`;
  }
  return `INV-${year}-00001`;
}

export async function addInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>, items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[]): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoice)
    .select()
    .single();
  
  if (error) throw error;
  
  if (items.length > 0) {
    const itemsWithInvoiceId = items.map(item => ({
      ...item,
      invoice_id: data.id,
    }));
    
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsWithInvoiceId);
    
    if (itemsError) throw itemsError;
  }
  
  return data;
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>, items?: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[]): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update(invoice)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  if (items) {
    // Delete existing items
    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    
    // Insert new items
    if (items.length > 0) {
      const itemsWithInvoiceId = items.map(item => ({
        ...item,
        invoice_id: id,
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsWithInvoiceId);
      
      if (itemsError) throw itemsError;
    }
  }
  
  return data;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

// Quotations
export async function getQuotations(): Promise<Quotation[]> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*, items:quotation_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getNextQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('quotations')
    .select('quotation_number')
    .like('quotation_number', `QT-${year}-%`)
    .order('quotation_number', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].quotation_number.split('-')[2], 10);
    return `QT-${year}-${String(lastNumber + 1).padStart(5, '0')}`;
  }
  return `QT-${year}-00001`;
}

export async function addQuotation(quotation: Omit<Quotation, 'id' | 'created_at' | 'updated_at'>, items: Omit<QuotationItem, 'id' | 'quotation_id' | 'created_at'>[]): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    .insert(quotation)
    .select()
    .single();
  
  if (error) throw error;
  
  if (items.length > 0) {
    const itemsWithQuotationId = items.map(item => ({
      ...item,
      quotation_id: data.id,
    }));
    
    const { error: itemsError } = await supabase
      .from('quotation_items')
      .insert(itemsWithQuotationId);
    
    if (itemsError) throw itemsError;
  }
  
  return data;
}

export async function updateQuotation(id: string, quotation: Partial<Quotation>, items?: Omit<QuotationItem, 'id' | 'quotation_id' | 'created_at'>[]): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    .update(quotation)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  if (items) {
    await supabase.from('quotation_items').delete().eq('quotation_id', id);
    
    if (items.length > 0) {
      const itemsWithQuotationId = items.map(item => ({
        ...item,
        quotation_id: id,
      }));
      
      const { error: itemsError } = await supabase
        .from('quotation_items')
        .insert(itemsWithQuotationId);
      
      if (itemsError) throw itemsError;
    }
  }
  
  return data;
}

export async function deleteQuotation(id: string): Promise<void> {
  const { error } = await supabase.from('quotations').delete().eq('id', id);
  if (error) throw error;
}

export async function convertQuotationToInvoice(quotationId: string): Promise<Invoice> {
  const quotation = await getQuotation(quotationId);
  if (!quotation) throw new Error('Quotation not found');
  
  const invoiceNumber = await getNextInvoiceNumber();
  
  const invoice = await addInvoice({
    invoice_number: invoiceNumber,
    customer_id: quotation.customer_id,
    customer_name: quotation.customer_name,
    customer_email: quotation.customer_email,
    customer_address: quotation.customer_address,
    status: 'pending',
    subtotal: quotation.subtotal,
    tax_total: quotation.tax_total,
    discount_total: quotation.discount_total,
    total: quotation.total,
    amount_paid: 0,
    due_date: null,
    payment_terms: null,
    notes: quotation.notes,
    created_by: quotation.created_by,
  }, quotation.items?.map(item => ({
    product_id: item.product_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate,
    discount: item.discount,
    total: item.total,
  })) || []);
  
  // Update quotation status
  await updateQuotation(quotationId, { status: 'approved' });
  
  return invoice;
}

// Delivery Notes
export async function getDeliveryNotes(): Promise<DeliveryNote[]> {
  const { data, error } = await supabase
    .from('delivery_notes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDeliveryNote(id: string): Promise<DeliveryNote | null> {
  const { data, error } = await supabase
    .from('delivery_notes')
    .select('*, items:delivery_note_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getNextDeliveryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('delivery_notes')
    .select('delivery_number')
    .like('delivery_number', `DN-${year}-%`)
    .order('delivery_number', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].delivery_number.split('-')[2], 10);
    return `DN-${year}-${String(lastNumber + 1).padStart(5, '0')}`;
  }
  return `DN-${year}-00001`;
}

export async function addDeliveryNote(deliveryNote: Omit<DeliveryNote, 'id' | 'created_at' | 'updated_at'>, items: Omit<DeliveryNoteItem, 'id' | 'delivery_note_id' | 'created_at'>[]): Promise<DeliveryNote> {
  const { data, error } = await supabase
    .from('delivery_notes')
    .insert(deliveryNote)
    .select()
    .single();
  
  if (error) throw error;
  
  if (items.length > 0) {
    const itemsWithDeliveryId = items.map(item => ({
      ...item,
      delivery_note_id: data.id,
    }));
    
    const { error: itemsError } = await supabase
      .from('delivery_note_items')
      .insert(itemsWithDeliveryId);
    
    if (itemsError) throw itemsError;
    
    // Update stock for each item
    for (const item of items) {
      if (item.product_id) {
        await updateStock(item.product_id, item.quantity, 'out', 'delivery', data.id);
      }
    }
  }
  
  return data;
}

export async function updateDeliveryNote(id: string, deliveryNote: Partial<DeliveryNote>): Promise<DeliveryNote> {
  const { data, error } = await supabase
    .from('delivery_notes')
    .update(deliveryNote)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// POS Sales
export async function getPOSSales(): Promise<POSSale[]> {
  const { data, error } = await supabase
    .from('pos_sales')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPOSSale(id: string): Promise<POSSale | null> {
  const { data, error } = await supabase
    .from('pos_sales')
    .select('*, items:pos_sale_items(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getNextSaleNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  
  const { data } = await supabase
    .from('pos_sales')
    .select('sale_number')
    .like('sale_number', `POS-${year}${month}${day}-%`)
    .order('sale_number', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].sale_number.split('-')[2], 10);
    return `POS-${year}${month}${day}-${String(lastNumber + 1).padStart(4, '0')}`;
  }
  return `POS-${year}${month}${day}-0001`;
}

export async function addPOSSale(sale: Omit<POSSale, 'id' | 'created_at'>, items: Omit<POSSaleItem, 'id' | 'sale_id' | 'created_at'>[]): Promise<POSSale> {
  const { data, error } = await supabase
    .from('pos_sales')
    .insert(sale)
    .select()
    .single();
  
  if (error) throw error;
  
  if (items.length > 0) {
    const itemsWithSaleId = items.map(item => ({
      ...item,
      sale_id: data.id,
    }));
    
    const { error: itemsError } = await supabase
      .from('pos_sale_items')
      .insert(itemsWithSaleId);
    
    if (itemsError) throw itemsError;
    
    // Update stock for each item
    for (const item of items) {
      if (item.product_id) {
        await updateStock(item.product_id, item.quantity, 'out', 'sale', data.id);
      }
    }
    
    // Create payment record
    const paymentNumber = `PAY-${data.sale_number.replace('POS-', '')}`;
    await supabase.from('payments').insert({
      payment_number: paymentNumber,
      pos_sale_id: data.id,
      amount: sale.amount_paid,
      payment_method: sale.payment_method,
    });
  }
  
  return data;
}

// Payments
export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getNextPaymentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('payments')
    .select('payment_number')
    .like('payment_number', `PAY-${year}-%`)
    .order('payment_number', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].payment_number.split('-')[2], 10);
    return `PAY-${year}-${String(lastNumber + 1).padStart(5, '0')}`;
  }
  return `PAY-${year}-00001`;
}

export async function addPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single();
  
  if (error) throw error;
  
  // Update invoice amount_paid and status if linked to invoice
  if (payment.invoice_id) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('amount_paid, total')
      .eq('id', payment.invoice_id)
      .single();
    
    if (invoice) {
      const newAmountPaid = (invoice.amount_paid || 0) + payment.amount;
      const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'pending';
      
      await supabase
        .from('invoices')
        .update({ amount_paid: newAmountPaid, status: newStatus })
        .eq('id', payment.invoice_id);
    }
  }
  
  return data;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) throw error;
}

// Dashboard stats
export async function getDashboardStats(): Promise<{
  totalRevenue: number;
  outstandingAmount: number;
  todaySales: number;
  lowStockProducts: number;
  recentInvoices: Invoice[];
  topProducts: { name: string; quantity: number }[];
}> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get all data in parallel
  const [
    { data: payments },
    { data: invoices },
    { data: posSales },
    { data: products },
  ] = await Promise.all([
    supabase.from('payments').select('amount'),
    supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('pos_sales').select('total, created_at'),
    supabase.from('products').select('name, stock_quantity, low_stock_threshold'),
  ]);
  
  const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  
  const outstandingAmount = invoices?.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((sum, i) => sum + (i.total - i.amount_paid), 0) || 0;
  
  const todaySales = posSales?.filter(s => s.created_at.startsWith(today))
    .reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  
  const lowStockProducts = products?.filter(p => 
    (p.stock_quantity || 0) <= (p.low_stock_threshold || 10)
  ).length || 0;
  
  return {
    totalRevenue,
    outstandingAmount,
    todaySales,
    lowStockProducts,
    recentInvoices: invoices || [],
    topProducts: [],
  };
}

export async function getLowStockProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .lt('stock_quantity', supabase.rpc ? 10 : 10) // Fallback comparison
    .order('stock_quantity');
  
  if (error) throw error;
  
  // Filter in JS since we can't compare columns directly
  return (data || []).filter(p => (p.stock_quantity || 0) <= (p.low_stock_threshold || 10));
}
