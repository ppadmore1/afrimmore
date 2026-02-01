import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  getOfflineDB, 
  isOnline, 
  getCachedData, 
  cacheData,
  queueOperation,
  getPendingOperationsCount 
} from '@/lib/offline-sync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface OfflinePOSSale {
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
  payment_method: string;
  status: string;
  created_by: string | null;
  created_at: string;
  branch_id: string | null;
  items: OfflinePOSSaleItem[];
  synced: boolean;
}

export interface OfflinePOSSaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  total: number;
}

export interface OfflineProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: number;
  tax_rate: number | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
  is_active: boolean | null;
  branch_stock?: number;
  branch_threshold?: number;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

// Generate offline sale number
function generateOfflineSaleNumber(): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OFF-${dateStr}-${random}`;
}

export function useOfflinePOS(branchId: string | null) {
  const [offlineProducts, setOfflineProducts] = useState<OfflineProduct[]>([]);
  const [offlineCustomers, setOfflineCustomers] = useState<OfflineCustomer[]>([]);
  const [pendingSales, setPendingSales] = useState<OfflinePOSSale[]>([]);
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);

  // Load cached data on mount
  useEffect(() => {
    loadCachedData();
    
    const handleOnline = () => {
      setOnline(true);
      syncPendingSales();
    };
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [branchId]);

  const loadCachedData = async () => {
    try {
      const products = await getCachedData<OfflineProduct>('products');
      const customers = await getCachedData<OfflineCustomer>('customers');
      
      setOfflineProducts(products);
      setOfflineCustomers(customers);
      
      // Load pending sales
      const db = await getOfflineDB();
      const sales = await db.getAll('pos_sales');
      const unsynced = sales.filter(s => !s.synced).map(s => ({
        ...s.data,
        items: s.items || [],
        synced: s.synced
      }));
      setPendingSales(unsynced);
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  // Cache products and customers for offline use
  const cacheForOffline = useCallback(async (
    products: OfflineProduct[], 
    customers: OfflineCustomer[]
  ) => {
    try {
      await cacheData('products', products.map(p => ({ ...p, id: p.id })));
      await cacheData('customers', customers.map(c => ({ ...c, id: c.id })));
      setOfflineProducts(products);
      setOfflineCustomers(customers);
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }, []);

  // Update local stock after a sale
  const updateLocalStock = useCallback(async (items: OfflinePOSSaleItem[]) => {
    const db = await getOfflineDB();
    const tx = db.transaction('products', 'readwrite');
    
    for (const item of items) {
      const record = await tx.store.get(item.product_id);
      if (record) {
        const product = record.data;
        product.stock_quantity = Math.max(0, product.stock_quantity - item.quantity);
        if (product.branch_stock !== undefined) {
          product.branch_stock = Math.max(0, product.branch_stock - item.quantity);
        }
        await tx.store.put({
          ...record,
          data: product,
          updated_at: new Date().toISOString(),
        });
      }
    }
    
    await tx.done;
    
    // Update local state
    setOfflineProducts(prev => prev.map(p => {
      const soldItem = items.find(i => i.product_id === p.id);
      if (soldItem) {
        return {
          ...p,
          stock_quantity: Math.max(0, p.stock_quantity - soldItem.quantity),
          branch_stock: p.branch_stock !== undefined 
            ? Math.max(0, p.branch_stock - soldItem.quantity) 
            : undefined,
        };
      }
      return p;
    }));
  }, []);

  // Process offline sale
  const processOfflineSale = useCallback(async (
    cart: Array<{ product: OfflineProduct; quantity: number; discount: number }>,
    customerId: string | null,
    customerName: string | null,
    paymentMethod: string,
    amountPaid: number,
    userId: string | null
  ): Promise<OfflinePOSSale | null> => {
    try {
      // Calculate totals
      let subtotal = 0;
      let taxTotal = 0;
      let discountTotal = 0;

      const items: OfflinePOSSaleItem[] = cart.map(item => {
        const itemSubtotal = item.product.unit_price * item.quantity;
        const itemDiscount = (itemSubtotal * item.discount) / 100;
        const itemAfterDiscount = itemSubtotal - itemDiscount;
        const itemTax = (itemAfterDiscount * (item.product.tax_rate || 0)) / 100;
        const itemTotal = itemAfterDiscount + itemTax;

        subtotal += itemAfterDiscount;
        taxTotal += itemTax;
        discountTotal += itemDiscount;

        return {
          id: uuidv4(),
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.unit_price,
          tax_rate: item.product.tax_rate || 0,
          discount: item.discount,
          total: itemTotal,
        };
      });

      const total = subtotal + taxTotal;
      const changeAmount = Math.max(0, amountPaid - total);

      const sale: OfflinePOSSale = {
        id: uuidv4(),
        sale_number: generateOfflineSaleNumber(),
        customer_id: customerId,
        customer_name: customerName,
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        total,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        payment_method: paymentMethod,
        status: 'paid',
        created_by: userId,
        created_at: new Date().toISOString(),
        branch_id: branchId,
        items,
        synced: false,
      };

      // Save to IndexedDB
      const db = await getOfflineDB();
      await db.put('pos_sales', {
        id: sale.id,
        data: sale,
        items: sale.items,
        synced: false,
        updated_at: new Date().toISOString(),
      });

      // Update local stock
      await updateLocalStock(items);

      // Queue for sync
      await queueOperation('pos_sales_rpc', 'insert', {
        saleData: sale,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          discount: i.discount,
        })),
      });

      // Update pending sales state
      setPendingSales(prev => [...prev, sale]);

      toast({
        title: '📴 Offline Sale Saved',
        description: `Sale ${sale.sale_number} saved locally. Will sync when online.`,
      });

      return sale;
    } catch (error) {
      console.error('Error processing offline sale:', error);
      toast({
        title: 'Error',
        description: 'Failed to save offline sale',
        variant: 'destructive',
      });
      return null;
    }
  }, [branchId, updateLocalStock]);

  // Sync pending sales to server
  const syncPendingSales = useCallback(async () => {
    if (!isOnline() || syncing) return;

    setSyncing(true);
    const db = await getOfflineDB();
    const allSales = await db.getAll('pos_sales');
    const unsyncedSales = allSales.filter(s => !s.synced);

    let syncedCount = 0;
    let failedCount = 0;

    for (const saleRecord of unsyncedSales) {
      try {
        const sale = saleRecord.data as OfflinePOSSale;
        const items = saleRecord.items || [];

        // Use the RPC function to properly process the sale
        const { data: result, error } = await supabase.rpc('process_pos_sale', {
          p_customer_id: sale.customer_id || null,
          p_customer_name: sale.customer_name || null,
          p_payment_method: sale.payment_method as any,
          p_amount_paid: sale.amount_paid,
          p_created_by: sale.created_by || null,
          p_items: items.map((i: any) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            discount: i.discount || 0,
          })),
        });

        if (error) {
          // If stock is insufficient, mark as failed but keep for review
          console.error(`Failed to sync sale ${sale.sale_number}:`, error);
          failedCount++;
          continue;
        }

        // Mark as synced
        await db.put('pos_sales', {
          ...saleRecord,
          synced: true,
          data: {
            ...sale,
            sale_number: result[0].sale_number, // Update with server-generated number
            synced: true,
          },
          updated_at: new Date().toISOString(),
        });

        syncedCount++;
      } catch (error) {
        console.error('Sync error:', error);
        failedCount++;
      }
    }

    // Remove synced operations from queue
    const operations = await db.getAll('pending_operations');
    for (const op of operations) {
      if (op.table === 'pos_sales_rpc') {
        const matchingSale = unsyncedSales.find(
          s => (s.data as OfflinePOSSale).id === op.data?.saleData?.id
        );
        if (matchingSale) {
          const updatedSale = await db.get('pos_sales', matchingSale.id);
          if (updatedSale?.synced) {
            await db.delete('pending_operations', op.id);
          }
        }
      }
    }

    // Update state
    const updatedSales = await db.getAll('pos_sales');
    setPendingSales(updatedSales.filter(s => !s.synced).map(s => ({
      ...s.data,
      items: s.items || [],
      synced: s.synced,
    })));

    setSyncing(false);

    if (syncedCount > 0) {
      toast({
        title: '✅ Sales Synced',
        description: `${syncedCount} offline sale${syncedCount > 1 ? 's' : ''} synced to server`,
      });
    }

    if (failedCount > 0) {
      toast({
        title: '⚠️ Some sales failed to sync',
        description: `${failedCount} sale${failedCount > 1 ? 's' : ''} could not be synced. Check stock availability.`,
        variant: 'destructive',
      });
    }

    return { syncedCount, failedCount };
  }, [syncing]);

  // Get pending sales count
  const getPendingSalesCount = useCallback(async (): Promise<number> => {
    const db = await getOfflineDB();
    const sales = await db.getAll('pos_sales');
    return sales.filter(s => !s.synced).length;
  }, []);

  return {
    offlineProducts,
    offlineCustomers,
    pendingSales,
    online,
    syncing,
    cacheForOffline,
    processOfflineSale,
    syncPendingSales,
    getPendingSalesCount,
    loadCachedData,
  };
}
