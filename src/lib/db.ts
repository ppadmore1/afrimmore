import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  stock?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  discount: number;
  total: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  status: InvoiceStatus;
  dueDate: Date;
  notes: string;
  paymentTerms: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  reference: string;
  date: Date;
  createdAt: Date;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  reason: string;
  createdAt: Date;
}

interface InvoiceDB extends DBSchema {
  customers: {
    key: string;
    value: Customer;
    indexes: { 'by-name': string; 'by-email': string };
  };
  products: {
    key: string;
    value: Product;
    indexes: { 'by-name': string };
  };
  invoices: {
    key: string;
    value: Invoice;
    indexes: { 'by-customer': string; 'by-status': InvoiceStatus; 'by-date': Date };
  };
  payments: {
    key: string;
    value: Payment;
    indexes: { 'by-invoice': string; 'by-date': Date };
  };
  creditNotes: {
    key: string;
    value: CreditNote;
    indexes: { 'by-invoice': string; 'by-customer': string };
  };
}

let dbInstance: IDBPDatabase<InvoiceDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<InvoiceDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<InvoiceDB>('invoice-system', 1, {
    upgrade(db) {
      // Customers store
      const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
      customerStore.createIndex('by-name', 'name');
      customerStore.createIndex('by-email', 'email');

      // Products store
      const productStore = db.createObjectStore('products', { keyPath: 'id' });
      productStore.createIndex('by-name', 'name');

      // Invoices store
      const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
      invoiceStore.createIndex('by-customer', 'customerId');
      invoiceStore.createIndex('by-status', 'status');
      invoiceStore.createIndex('by-date', 'createdAt');

      // Payments store
      const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
      paymentStore.createIndex('by-invoice', 'invoiceId');
      paymentStore.createIndex('by-date', 'date');

      // Credit Notes store
      const creditNoteStore = db.createObjectStore('creditNotes', { keyPath: 'id' });
      creditNoteStore.createIndex('by-invoice', 'invoiceId');
      creditNoteStore.createIndex('by-customer', 'customerId');
    },
  });

  return dbInstance;
}

// Customer operations
export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDB();
  return db.getAll('customers');
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const db = await getDB();
  return db.get('customers', id);
}

export async function addCustomer(customer: Customer): Promise<string> {
  const db = await getDB();
  await db.put('customers', customer);
  return customer.id;
}

export async function updateCustomer(customer: Customer): Promise<void> {
  const db = await getDB();
  await db.put('customers', { ...customer, updatedAt: new Date() });
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('customers', id);
}

// Product operations
export async function getAllProducts(): Promise<Product[]> {
  const db = await getDB();
  return db.getAll('products');
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.get('products', id);
}

export async function addProduct(product: Product): Promise<string> {
  const db = await getDB();
  await db.put('products', product);
  return product.id;
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await getDB();
  await db.put('products', { ...product, updatedAt: new Date() });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('products', id);
}

// Invoice operations
export async function getAllInvoices(): Promise<Invoice[]> {
  const db = await getDB();
  return db.getAll('invoices');
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const db = await getDB();
  return db.get('invoices', id);
}

export async function addInvoice(invoice: Invoice): Promise<string> {
  const db = await getDB();
  await db.put('invoices', invoice);
  return invoice.id;
}

export async function updateInvoice(invoice: Invoice): Promise<void> {
  const db = await getDB();
  await db.put('invoices', { ...invoice, updatedAt: new Date() });
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('invoices', id);
}

export async function getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
  const db = await getDB();
  return db.getAllFromIndex('invoices', 'by-customer', customerId);
}

// Payment operations
export async function getAllPayments(): Promise<Payment[]> {
  const db = await getDB();
  return db.getAll('payments');
}

export async function addPayment(payment: Payment): Promise<string> {
  const db = await getDB();
  await db.put('payments', payment);
  return payment.id;
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
  const db = await getDB();
  return db.getAllFromIndex('payments', 'by-invoice', invoiceId);
}

export async function deletePayment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('payments', id);
}

// Credit Note operations
export async function getAllCreditNotes(): Promise<CreditNote[]> {
  const db = await getDB();
  return db.getAll('creditNotes');
}

export async function addCreditNote(creditNote: CreditNote): Promise<string> {
  const db = await getDB();
  await db.put('creditNotes', creditNote);
  return creditNote.id;
}

export async function getCreditNotesByInvoice(invoiceId: string): Promise<CreditNote[]> {
  const db = await getDB();
  return db.getAllFromIndex('creditNotes', 'by-invoice', invoiceId);
}

// Generate next invoice number
export async function getNextInvoiceNumber(): Promise<string> {
  const invoices = await getAllInvoices();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  
  const existingNumbers = invoices
    .map(inv => inv.invoiceNumber)
    .filter(num => num.startsWith(prefix))
    .map(num => parseInt(num.replace(prefix, ''), 10))
    .filter(num => !isNaN(num));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// Generate next credit note number
export async function getNextCreditNoteNumber(): Promise<string> {
  const creditNotes = await getAllCreditNotes();
  const year = new Date().getFullYear();
  const prefix = `CN-${year}-`;
  
  const existingNumbers = creditNotes
    .map(cn => cn.creditNoteNumber)
    .filter(num => num.startsWith(prefix))
    .map(num => parseInt(num.replace(prefix, ''), 10))
    .filter(num => !isNaN(num));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}
