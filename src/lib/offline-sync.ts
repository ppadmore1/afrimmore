import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

// Offline sync database schema
interface OfflineSyncDB extends DBSchema {
  products: {
    key: string;
    value: {
      id: string;
      data: any;
      synced: boolean;
      updated_at: string;
    };
    indexes: { 'by-synced': number };
  };
  customers: {
    key: string;
    value: {
      id: string;
      data: any;
      synced: boolean;
      updated_at: string;
    };
    indexes: { 'by-synced': number };
  };
  invoices: {
    key: string;
    value: {
      id: string;
      data: any;
      items: any[];
      synced: boolean;
      updated_at: string;
    };
    indexes: { 'by-synced': number };
  };
  quotations: {
    key: string;
    value: {
      id: string;
      data: any;
      items: any[];
      synced: boolean;
      updated_at: string;
    };
    indexes: { 'by-synced': number };
  };
  receipts: {
    key: string;
    value: {
      id: string;
      data: any;
      items: any[];
      synced: boolean;
      updated_at: string;
    };
    indexes: { 'by-synced': number };
  };
  pos_sales: {
    key: string;
    value: {
      id: string;
      data: any;
      items: any[];
      synced: boolean;
      updated_at: string;
    };
    indexes: { 'by-synced': number };
  };
  pending_operations: {
    key: string;
    value: {
      id: string;
      table: string;
      operation: 'insert' | 'update' | 'delete';
      data: any;
      items?: any[];
      created_at: string;
    };
  };
  sync_meta: {
    key: string;
    value: {
      table: string;
      last_synced: string;
    };
  };
}

let db: IDBPDatabase<OfflineSyncDB> | null = null;

export async function getOfflineDB(): Promise<IDBPDatabase<OfflineSyncDB>> {
  if (db) return db;

  db = await openDB<OfflineSyncDB>('afrimmore-offline', 2, {
    upgrade(database, oldVersion) {
      // Products
      if (!database.objectStoreNames.contains('products')) {
        const productStore = database.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-synced', 'synced');
      }
      // Customers
      if (!database.objectStoreNames.contains('customers')) {
        const customerStore = database.createObjectStore('customers', { keyPath: 'id' });
        customerStore.createIndex('by-synced', 'synced');
      }
      // Invoices
      if (!database.objectStoreNames.contains('invoices')) {
        const invoiceStore = database.createObjectStore('invoices', { keyPath: 'id' });
        invoiceStore.createIndex('by-synced', 'synced');
      }
      // Quotations
      if (!database.objectStoreNames.contains('quotations')) {
        const quotationStore = database.createObjectStore('quotations', { keyPath: 'id' });
        quotationStore.createIndex('by-synced', 'synced');
      }
      // Receipts
      if (!database.objectStoreNames.contains('receipts')) {
        const receiptStore = database.createObjectStore('receipts', { keyPath: 'id' });
        receiptStore.createIndex('by-synced', 'synced');
      }
      // POS Sales
      if (!database.objectStoreNames.contains('pos_sales')) {
        const posStore = database.createObjectStore('pos_sales', { keyPath: 'id' });
        posStore.createIndex('by-synced', 'synced');
      }
      // Pending operations queue
      if (!database.objectStoreNames.contains('pending_operations')) {
        database.createObjectStore('pending_operations', { keyPath: 'id' });
      }
      // Sync metadata
      if (!database.objectStoreNames.contains('sync_meta')) {
        database.createObjectStore('sync_meta', { keyPath: 'table' });
      }
    },
  });

  return db;
}

// Check online status
export function isOnline(): boolean {
  return navigator.onLine;
}

// Cache data locally
export async function cacheData<T extends { id: string }>(
  table: 'products' | 'customers' | 'invoices' | 'quotations' | 'receipts' | 'pos_sales',
  data: T[],
  items?: Record<string, any[]>
): Promise<void> {
  const database = await getOfflineDB();
  const tx = database.transaction(table, 'readwrite');
  
  for (const record of data) {
    await tx.store.put({
      id: record.id,
      data: record,
      items: items?.[record.id] || [],
      synced: true,
      updated_at: new Date().toISOString(),
    } as any);
  }
  
  await tx.done;
  
  // Update sync metadata
  await database.put('sync_meta', {
    table,
    last_synced: new Date().toISOString(),
  });
}

// Get cached data
export async function getCachedData<T>(
  table: 'products' | 'customers' | 'invoices' | 'quotations' | 'receipts' | 'pos_sales'
): Promise<T[]> {
  const database = await getOfflineDB();
  const records = await database.getAll(table);
  return records.map(r => r.data as T);
}

// Get single cached record
export async function getCachedRecord<T>(
  table: 'products' | 'customers' | 'invoices' | 'quotations' | 'receipts' | 'pos_sales',
  id: string
): Promise<{ data: T; items?: any[] } | null> {
  const database = await getOfflineDB();
  const record = await database.get(table, id);
  if (!record) return null;
  return { data: record.data as T, items: (record as any).items };
}

// Queue operation for later sync
export async function queueOperation(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: any,
  items?: any[]
): Promise<string> {
  const database = await getOfflineDB();
  const id = `${table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await database.put('pending_operations', {
    id,
    table,
    operation,
    data,
    items,
    created_at: new Date().toISOString(),
  });
  
  return id;
}

// Get pending operations count
export async function getPendingOperationsCount(): Promise<number> {
  const database = await getOfflineDB();
  return (await database.getAll('pending_operations')).length;
}

// Sync pending operations when online
export async function syncPendingOperations(): Promise<{ success: number; failed: number }> {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  const database = await getOfflineDB();
  const operations = await database.getAll('pending_operations');
  
  let success = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      switch (op.table) {
        case 'invoices':
          await syncInvoiceOperation(op);
          break;
        case 'quotations':
          await syncQuotationOperation(op);
          break;
        case 'receipts':
          await syncReceiptOperation(op);
          break;
        case 'pos_sales':
          await syncPOSSaleOperation(op);
          break;
        case 'customers':
          await syncCustomerOperation(op);
          break;
        case 'products':
          await syncProductOperation(op);
          break;
      }
      
      // Remove from queue on success
      await database.delete('pending_operations', op.id);
      success++;
    } catch (error) {
      console.error(`Failed to sync operation ${op.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

// Sync specific table operations
async function syncInvoiceOperation(op: any): Promise<void> {
  if (op.operation === 'insert') {
    const { data, items } = op;
    const { error } = await supabase.from('invoices').insert(data);
    if (error) throw error;
    
    if (items?.length) {
      const itemsWithId = items.map((item: any) => ({ ...item, invoice_id: data.id }));
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithId);
      if (itemsError) throw itemsError;
    }
  } else if (op.operation === 'update') {
    const { data, items } = op;
    const { error } = await supabase.from('invoices').update(data).eq('id', data.id);
    if (error) throw error;
    
    if (items) {
      await supabase.from('invoice_items').delete().eq('invoice_id', data.id);
      if (items.length) {
        const itemsWithId = items.map((item: any) => ({ ...item, invoice_id: data.id }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithId);
        if (itemsError) throw itemsError;
      }
    }
  } else if (op.operation === 'delete') {
    const { error } = await supabase.from('invoices').delete().eq('id', op.data.id);
    if (error) throw error;
  }
}

async function syncQuotationOperation(op: any): Promise<void> {
  if (op.operation === 'insert') {
    const { data, items } = op;
    const { error } = await supabase.from('quotations').insert(data);
    if (error) throw error;
    
    if (items?.length) {
      const itemsWithId = items.map((item: any) => ({ ...item, quotation_id: data.id }));
      const { error: itemsError } = await supabase.from('quotation_items').insert(itemsWithId);
      if (itemsError) throw itemsError;
    }
  } else if (op.operation === 'update') {
    const { data, items } = op;
    const { error } = await supabase.from('quotations').update(data).eq('id', data.id);
    if (error) throw error;
    
    if (items) {
      await supabase.from('quotation_items').delete().eq('quotation_id', data.id);
      if (items.length) {
        const itemsWithId = items.map((item: any) => ({ ...item, quotation_id: data.id }));
        const { error: itemsError } = await supabase.from('quotation_items').insert(itemsWithId);
        if (itemsError) throw itemsError;
      }
    }
  } else if (op.operation === 'delete') {
    const { error } = await supabase.from('quotations').delete().eq('id', op.data.id);
    if (error) throw error;
  }
}

async function syncReceiptOperation(op: any): Promise<void> {
  if (op.operation === 'insert') {
    const { data, items } = op;
    const { error } = await supabase.from('receipts').insert(data);
    if (error) throw error;
    
    if (items?.length) {
      const itemsWithId = items.map((item: any) => ({ ...item, receipt_id: data.id }));
      const { error: itemsError } = await supabase.from('receipt_items').insert(itemsWithId);
      if (itemsError) throw itemsError;
    }
  } else if (op.operation === 'update') {
    const { data, items } = op;
    const { error } = await supabase.from('receipts').update(data).eq('id', data.id);
    if (error) throw error;
  } else if (op.operation === 'delete') {
    const { error } = await supabase.from('receipts').delete().eq('id', op.data.id);
    if (error) throw error;
  }
}

async function syncPOSSaleOperation(op: any): Promise<void> {
  if (op.operation === 'insert') {
    const { data, items } = op;
    const { error } = await supabase.from('pos_sales').insert(data);
    if (error) throw error;
    
    if (items?.length) {
      const itemsWithId = items.map((item: any) => ({ ...item, sale_id: data.id }));
      const { error: itemsError } = await supabase.from('pos_sale_items').insert(itemsWithId);
      if (itemsError) throw itemsError;
    }
  }
}

async function syncCustomerOperation(op: any): Promise<void> {
  if (op.operation === 'insert') {
    const { error } = await supabase.from('customers').insert(op.data);
    if (error) throw error;
  } else if (op.operation === 'update') {
    const { error } = await supabase.from('customers').update(op.data).eq('id', op.data.id);
    if (error) throw error;
  } else if (op.operation === 'delete') {
    const { error } = await supabase.from('customers').delete().eq('id', op.data.id);
    if (error) throw error;
  }
}

async function syncProductOperation(op: any): Promise<void> {
  if (op.operation === 'insert') {
    const { error } = await supabase.from('products').insert(op.data);
    if (error) throw error;
  } else if (op.operation === 'update') {
    const { error } = await supabase.from('products').update(op.data).eq('id', op.data.id);
    if (error) throw error;
  } else if (op.operation === 'delete') {
    const { error } = await supabase.from('products').delete().eq('id', op.data.id);
    if (error) throw error;
  }
}

// Full sync from server to local
export async function syncFromServer(): Promise<void> {
  if (!isOnline()) return;

  try {
    // Sync products
    const { data: products } = await supabase.from('products').select('*');
    if (products) await cacheData('products', products);

    // Sync customers
    const { data: customers } = await supabase.from('customers').select('*');
    if (customers) await cacheData('customers', customers);

    // Sync invoices with items
    const { data: invoices } = await supabase.from('invoices').select('*, items:invoice_items(*)');
    if (invoices) {
      const items: Record<string, any[]> = {};
      invoices.forEach(inv => {
        items[inv.id] = inv.items || [];
      });
      await cacheData('invoices', invoices.map(({ items, ...rest }) => rest), items);
    }

    // Sync quotations
    const { data: quotations } = await supabase.from('quotations').select('*, items:quotation_items(*)');
    if (quotations) {
      const items: Record<string, any[]> = {};
      quotations.forEach(q => {
        items[q.id] = q.items || [];
      });
      await cacheData('quotations', quotations.map(({ items, ...rest }) => rest), items);
    }

    // Sync receipts
    const { data: receipts } = await supabase.from('receipts').select('*, items:receipt_items(*)');
    if (receipts) {
      const items: Record<string, any[]> = {};
      receipts.forEach(r => {
        items[r.id] = r.items || [];
      });
      await cacheData('receipts', receipts.map(({ items, ...rest }) => rest), items);
    }

    console.log('Offline sync completed');
  } catch (error) {
    console.error('Sync from server failed:', error);
  }
}

// Clear all cached data
export async function clearOfflineData(): Promise<void> {
  const database = await getOfflineDB();
  const stores: Array<'products' | 'customers' | 'invoices' | 'quotations' | 'receipts' | 'pos_sales'> = 
    ['products', 'customers', 'invoices', 'quotations', 'receipts', 'pos_sales'];
  
  for (const store of stores) {
    await database.clear(store);
  }
  await database.clear('sync_meta');
}
