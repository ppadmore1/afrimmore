import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  User,
  X,
  Check,
  Barcode,
  Package,
  Camera,
  AlertTriangle,
  WifiOff,
  CloudOff,
  RefreshCw,
  History,
} from "lucide-react";
 import { Tag, Loader2 } from "lucide-react";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { PendingSalesView } from "@/components/pos/PendingSalesView";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useOfflinePOS } from "@/hooks/useOfflinePOS";
 import { useDiscountCode } from "@/hooks/useDiscountCode";

type Product = Tables<"products"> & {
  branch_stock?: number;
  branch_threshold?: number;
};
type Customer = Tables<"customers">;

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

type PaymentMethod = "cash" | "card" | "mobile_money" | "bank_transfer";

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
];

export default function POSPage() {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Offline POS hook
  const {
    offlineProducts,
    offlineCustomers,
    pendingSales,
    online,
    syncing,
    cacheForOffline,
    processOfflineSale,
    syncPendingSales,
    loadCachedData,
  } = useOfflinePOS(currentBranch?.id || null);

  const [isPendingSalesOpen, setIsPendingSalesOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<{
    saleNumber: string;
    date: Date;
    customerName: string | null;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      taxRate: number;
      total: number;
    }>;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    total: number;
    amountPaid: number;
    changeAmount: number;
    paymentMethod: string;
    isOffline?: boolean;
  } | null>(null);
 
   // Discount code hook - calculated after cart items are defined
   const itemSubtotal = cart.reduce((sum, item) => {
     const itemTotal = item.product.unit_price * item.quantity;
     const discountAmount = (itemTotal * item.discount) / 100;
     return sum + (itemTotal - discountAmount);
   }, 0);
 
   const {
     discountCodeInput,
     setDiscountCodeInput,
     appliedDiscount,
     validating: validatingCode,
     applyCode: applyDiscountCode,
     removeCode: removeDiscountCode,
     reset: resetDiscount,
     recordUsage: recordDiscountUsage,
     couponDiscount,
   } = useDiscountCode(itemSubtotal, selectedCustomer?.id || null);

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Use offline products if we're offline and have cached data
  useEffect(() => {
    if (!online && offlineProducts.length > 0 && loading) {
      setProducts(offlineProducts as Product[]);
      setCustomers(offlineCustomers as Customer[]);
      setLoading(false);
    }
  }, [online, offlineProducts, offlineCustomers, loading]);

  async function loadData() {
    // If offline, use cached data
    if (!navigator.onLine) {
      if (offlineProducts.length > 0) {
        setProducts(offlineProducts as Product[]);
        setCustomers(offlineCustomers as Customer[]);
        setLoading(false);
        return;
      }
    }

    try {
      const [productsRes, customersRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("customers").select("*").order("name"),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;

      let productsWithBranchStock = productsRes.data || [];

      // If a branch is selected, get branch-specific stock
      if (currentBranch) {
        const { data: branchStock, error: branchStockError } = await supabase
          .from("product_branches")
          .select("product_id, stock_quantity, low_stock_threshold")
          .eq("branch_id", currentBranch.id);

        if (!branchStockError && branchStock) {
          const stockMap = new Map(branchStock.map(bs => [bs.product_id, bs]));
          
          productsWithBranchStock = productsRes.data?.map(product => {
            const branchStockInfo = stockMap.get(product.id);
            return {
              ...product,
              branch_stock: branchStockInfo?.stock_quantity ?? 0,
              branch_threshold: branchStockInfo?.low_stock_threshold ?? product.low_stock_threshold ?? 10,
            };
          }) || [];
        }
      }

      setProducts(productsWithBranchStock);
      setCustomers(customersRes.data || []);
      
      // Cache for offline use
      await cacheForOffline(productsWithBranchStock as any, customersRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      
      // Fall back to cached data if available
      if (offlineProducts.length > 0) {
        setProducts(offlineProducts as Product[]);
        setCustomers(offlineCustomers as Customer[]);
        toast({
          title: "Using cached data",
          description: "Showing locally saved products",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load products",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  // Get the effective stock for a product (branch stock if selected, otherwise global)
  const getEffectiveStock = (product: Product) => {
    if (currentBranch && product.branch_stock !== undefined) {
      return product.branch_stock;
    }
    return product.stock_quantity;
  };

  const getEffectiveThreshold = (product: Product) => {
    if (currentBranch && product.branch_threshold !== undefined) {
      return product.branch_threshold;
    }
    return product.low_stock_threshold || 10;
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const stock = getEffectiveStock(product);
    
    if (stock <= 0) {
      toast({
        title: "Out of Stock",
        description: currentBranch 
          ? `${product.name} is out of stock at ${currentBranch.name}`
          : `${product.name} is out of stock`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty >= stock) {
          toast({
            title: "Insufficient Stock",
            description: currentBranch
              ? `Only ${stock} available at ${currentBranch.name}`
              : `Only ${stock} available`,
            variant: "destructive",
          });
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.product.id === productId);
      if (index < 0) return prev;

      const newQty = prev[index].quantity + delta;
      const stock = getEffectiveStock(prev[index].product);
      
      if (newQty <= 0) {
        return prev.filter((item) => item.product.id !== productId);
      }
      if (newQty > stock) {
        toast({
          title: "Insufficient Stock",
          description: currentBranch
            ? `Only ${stock} available at ${currentBranch.name}`
            : `Only ${stock} available`,
          variant: "destructive",
        });
        return prev;
      }

      const updated = [...prev];
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
     resetDiscount();
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.barcode === barcodeInput || p.sku === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput("");
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found with barcode/SKU: ${barcodeInput}`,
        variant: "destructive",
      });
    }
  };

  const handleBarcodeScan = (code: string) => {
    const product = products.find((p) => p.barcode === code || p.sku === code);
    if (product) {
      addToCart(product);
    } else {
      toast({
        title: "Product Not Found",
        description: `No product found with barcode/SKU: ${code}`,
        variant: "destructive",
      });
    }
  };
   const subtotal = itemSubtotal;

  const taxTotal = cart.reduce((sum, item) => {
    const itemTotal = item.product.unit_price * item.quantity;
    const discountAmount = (itemTotal * item.discount) / 100;
    const afterDiscount = itemTotal - discountAmount;
    return sum + (afterDiscount * (item.product.tax_rate || 0)) / 100;
  }, 0);

  const discountTotal = cart.reduce((sum, item) => {
    const itemTotal = item.product.unit_price * item.quantity;
    return sum + (itemTotal * item.discount) / 100;
  }, 0);

   const total = Math.max(0, subtotal + taxTotal - couponDiscount);
  const changeAmount = parseFloat(amountReceived) - total;

  // Sale number is now generated atomically in the database function (or offline)

  const processPayment = async () => {
    if (cart.length === 0) return;
    if (selectedPaymentMethod === "cash" && parseFloat(amountReceived) < total) {
      toast({
        title: "Insufficient Amount",
        description: "Amount received is less than total",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // If offline, process locally
      if (!online) {
        const offlineSale = await processOfflineSale(
          cart.map(item => ({
            product: item.product as any,
            quantity: item.quantity,
            discount: item.discount,
          })),
          selectedCustomer?.id || null,
          selectedCustomer?.name || null,
          selectedPaymentMethod,
          parseFloat(amountReceived) || total,
          user?.id || null
        );

        if (offlineSale) {
          const receiptData = {
            saleNumber: offlineSale.sale_number,
            date: new Date(offlineSale.created_at),
            customerName: offlineSale.customer_name,
            items: offlineSale.items.map(item => ({
              name: item.product_name,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              discount: item.discount,
              taxRate: item.tax_rate,
              total: item.total,
            })),
            subtotal: offlineSale.subtotal,
            taxTotal: offlineSale.tax_total,
            discountTotal: offlineSale.discount_total,
            total: offlineSale.total,
            amountPaid: offlineSale.amount_paid,
            changeAmount: offlineSale.change_amount,
            paymentMethod: offlineSale.payment_method,
            isOffline: true,
          };

          setLastSaleReceipt(receiptData);
          setCart([]);
          setSelectedCustomer(null);
          setIsPaymentDialogOpen(false);
          setAmountReceived("");
          setSelectedPaymentMethod("cash");
          setIsReceiptOpen(true);
        }
        
        setProcessingPayment(false);
        return;
      }

      // Online: use the atomic database function
      const itemsData = cart.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        discount: item.discount
      }));

      const { data: result, error: rpcError } = await supabase.rpc('process_pos_sale', {
        p_customer_id: selectedCustomer?.id || null,
        p_customer_name: selectedCustomer?.name || null,
        p_payment_method: selectedPaymentMethod,
        p_amount_paid: parseFloat(amountReceived) || total,
        p_created_by: user?.id || null,
        p_items: itemsData
      });

      if (rpcError) {
        if (rpcError.message.includes('Insufficient stock')) {
          toast({
            title: "Insufficient Stock",
            description: rpcError.message,
            variant: "destructive",
          });
          return;
        }
        if (rpcError.message.includes('Unauthorized')) {
          toast({
            title: "Unauthorized",
            description: "You must be logged in as staff to process sales",
            variant: "destructive",
          });
          return;
        }
        throw rpcError;
      }

      const saleData = result[0];
      const saleNumber = saleData.sale_number;
      const serverChangeAmount = Number(saleData.change_amount) || 0;
 
       // Record discount code usage if applied
       if (appliedDiscount) {
         await recordDiscountUsage(saleData.sale_id);
       }

      const receiptData = {
        saleNumber,
        date: new Date(),
        customerName: selectedCustomer?.name || null,
        items: cart.map((item) => {
          const itemTotal = item.product.unit_price * item.quantity;
          const discountAmount = (itemTotal * item.discount) / 100;
          const taxAmount = ((itemTotal - discountAmount) * (item.product.tax_rate || 0)) / 100;
          return {
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.unit_price,
            discount: item.discount,
            taxRate: item.product.tax_rate || 0,
            total: itemTotal - discountAmount + taxAmount,
          };
        }),
        subtotal,
        taxTotal,
         discountTotal: discountTotal + couponDiscount,
        total,
        amountPaid: parseFloat(amountReceived) || total,
        changeAmount: serverChangeAmount,
        paymentMethod: selectedPaymentMethod,
      };

      setLastSaleReceipt(receiptData);

      toast({
        title: "Sale Complete",
        description: `Sale ${saleNumber} processed successfully`,
      });

      setCart([]);
      setSelectedCustomer(null);
      setIsPaymentDialogOpen(false);
      setAmountReceived("");
      setSelectedPaymentMethod("cash");
       resetDiscount();
      setIsReceiptOpen(true);
      loadData();
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Numpad handler
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadTarget, setNumpadTarget] = useState<'quantity' | 'amount'>('amount');
  const [numpadValue, setNumpadValue] = useState('');
  const [numpadProductId, setNumpadProductId] = useState<string | null>(null);

  const handleNumpadPress = (key: string) => {
    if (key === 'C') {
      setNumpadValue('');
    } else if (key === '⌫') {
      setNumpadValue(prev => prev.slice(0, -1));
    } else if (key === '.') {
      if (!numpadValue.includes('.')) setNumpadValue(prev => prev + '.');
    } else if (key === 'OK') {
      if (numpadTarget === 'amount') {
        setAmountReceived(numpadValue);
      } else if (numpadTarget === 'quantity' && numpadProductId) {
        const qty = parseInt(numpadValue);
        if (qty > 0) {
          const item = cart.find(i => i.product.id === numpadProductId);
          if (item) {
            const delta = qty - item.quantity;
            updateQuantity(numpadProductId, delta);
          }
        }
      }
      setShowNumpad(false);
      setNumpadValue('');
    } else {
      setNumpadValue(prev => prev + key);
    }
  };

  const openNumpad = (target: 'quantity' | 'amount', productId?: string) => {
    setNumpadTarget(target);
    setNumpadProductId(productId || null);
    setNumpadValue('');
    setShowNumpad(true);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-0 bg-[hsl(222,47%,6%)] -m-4 md:-m-6 p-0 rounded-xl overflow-hidden">
        
        {/* LEFT PANEL — Products */}
        <div className="flex-1 flex flex-col min-h-0 bg-[hsl(222,47%,8%)]">
          {/* Top Bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(222,47%,9%)] border-b border-[hsl(222,47%,15%)]">
            {/* Offline Status */}
            {!online && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full">
                <WifiOff className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive uppercase tracking-wide">Offline</span>
              </div>
            )}
            
            {currentBranch && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 rounded-full">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{currentBranch.name}</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Pending Sales */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPendingSalesOpen(true)}
              className="text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,15%)] gap-1.5"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Pending</span>
              {pendingSales.length > 0 && (
                <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                  {pendingSales.length}
                </span>
              )}
            </Button>

            {online && pendingSales.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={syncPendingSales}
                disabled={syncing}
                className="text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,15%)]"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>

          {/* Search & Barcode */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(222,47%,15%)]">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,16%,47%)]" />
                <Input
                  placeholder="Scan barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="pl-10 w-44 bg-[hsl(222,47%,11%)] border-[hsl(222,47%,18%)] text-white placeholder:text-[hsl(215,16%,40%)] focus:border-primary"
                />
              </div>
              <Button type="submit" size="icon" variant="ghost" className="text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,15%)]">
                <Search className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setIsScannerOpen(true)}
                className="text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,15%)]"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </form>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,16%,47%)]" />
              <Input
                ref={searchInputRef}
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-[hsl(222,47%,11%)] border-[hsl(222,47%,18%)] text-white placeholder:text-[hsl(215,16%,40%)] focus:border-primary"
              />
            </div>
          </div>

          {/* Products Grid */}
          <ScrollArea className="flex-1 p-3">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-[hsl(222,47%,12%)] rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[hsl(215,16%,47%)]">
                <Package className="w-10 h-10 mb-3" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => {
                    const stock = getEffectiveStock(product);
                    const threshold = getEffectiveThreshold(product);
                    const isLowStock = stock > 0 && stock <= threshold;
                    const isOutOfStock = stock <= 0;
                    const inCart = cart.find(i => i.product.id === product.id);
                    
                    return (
                      <motion.button
                        key={product.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => addToCart(product)}
                        className={`relative text-left rounded-xl p-3 transition-all border ${
                          isOutOfStock 
                            ? 'opacity-40 cursor-not-allowed bg-[hsl(222,47%,10%)] border-[hsl(222,47%,15%)]' 
                            : inCart 
                              ? 'bg-primary/15 border-primary/40 ring-1 ring-primary/30' 
                              : 'bg-[hsl(222,47%,11%)] border-[hsl(222,47%,16%)] hover:bg-[hsl(222,47%,14%)] hover:border-[hsl(222,47%,22%)] active:scale-[0.97]'
                        }`}
                      >
                        {inCart && (
                          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-6 h-6 text-[11px] font-bold rounded-full bg-primary text-primary-foreground shadow-lg z-10">
                            {inCart.quantity}
                          </span>
                        )}
                        <div className="flex items-start gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-[hsl(222,47%,15%)] flex items-center justify-center overflow-hidden shrink-0">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-[hsl(215,16%,47%)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate leading-tight">{product.name}</p>
                            <p className="text-lg font-bold text-primary font-mono mt-0.5">${product.unit_price.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {product.sku && (
                            <span className="text-[10px] text-[hsl(215,16%,40%)] font-mono">{product.sku}</span>
                          )}
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ml-auto ${
                            isOutOfStock ? 'text-destructive' : isLowStock ? 'text-[hsl(38,92%,50%)]' : 'text-[hsl(142,76%,42%)]'
                          }`}>
                            {isOutOfStock ? 'OUT' : `${stock} left`}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* RIGHT PANEL — Cart & Checkout */}
        <div className="lg:w-[420px] flex flex-col bg-[hsl(222,47%,9%)] border-l border-[hsl(222,47%,15%)]">
          {/* Customer Selector */}
          <div className="px-4 py-3 border-b border-[hsl(222,47%,15%)]">
            <Select
              value={selectedCustomer?.id || "walk-in"}
              onValueChange={(value) => {
                if (value === "walk-in") setSelectedCustomer(null);
                else setSelectedCustomer(customers.find((c) => c.id === value) || null);
              }}
            >
              <SelectTrigger className="bg-[hsl(222,47%,11%)] border-[hsl(222,47%,18%)] text-white">
                <User className="w-4 h-4 mr-2 text-[hsl(215,16%,47%)]" />
                <SelectValue placeholder="Walk-in Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cart Items */}
          <ScrollArea className="flex-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-[hsl(215,16%,40%)]">
                <ShoppingCart className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No items in cart</p>
                <p className="text-xs mt-1">Tap a product to add</p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(222,47%,14%)]">
                <AnimatePresence mode="popLayout">
                  {cart.map((item, index) => (
                    <motion.div
                      key={item.product.id}
                      layout
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(222,47%,11%)] transition-colors group"
                    >
                      <span className="text-xs text-[hsl(215,16%,40%)] font-mono w-5 text-right">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                        <p className="text-xs text-[hsl(215,16%,47%)] font-mono">
                          ${item.product.unit_price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,18%)]"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <button
                          onClick={() => openNumpad('quantity', item.product.id)}
                          className="w-8 text-center text-sm font-bold text-white hover:text-primary transition-colors"
                        >
                          {item.quantity}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[hsl(210,40%,70%)] hover:text-white hover:bg-[hsl(222,47%,18%)]"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold text-white font-mono w-20 text-right">
                        ${(item.product.unit_price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[hsl(215,16%,40%)] hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>

          {/* Discount Code */}
          <div className="px-4 py-3 border-t border-[hsl(222,47%,15%)]">
            {appliedDiscount ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(142,76%,36%)]/10 border border-[hsl(142,76%,36%)]/30">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[hsl(142,76%,42%)]" />
                  <span className="text-xs font-semibold text-[hsl(142,76%,42%)]">{appliedDiscount.code.code}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(215,16%,47%)] hover:text-destructive" onClick={removeDiscountCode}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(215,16%,40%)]" />
                  <Input
                    placeholder="Promo code"
                    value={discountCodeInput}
                    onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && applyDiscountCode()}
                    className="pl-9 h-9 text-xs bg-[hsl(222,47%,11%)] border-[hsl(222,47%,18%)] text-white placeholder:text-[hsl(215,16%,35%)] uppercase"
                    disabled={cart.length === 0}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={applyDiscountCode}
                  disabled={!discountCodeInput.trim() || validatingCode || cart.length === 0}
                  className="text-primary hover:text-primary hover:bg-primary/10 h-9"
                >
                  {validatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="px-4 py-3 space-y-1.5 border-t border-[hsl(222,47%,15%)] bg-[hsl(222,47%,7%)]">
            <div className="flex justify-between text-sm">
              <span className="text-[hsl(215,16%,50%)]">Subtotal</span>
              <span className="font-mono text-[hsl(210,40%,80%)]">${subtotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(142,76%,42%)]">Discounts</span>
                <span className="font-mono text-[hsl(142,76%,42%)]">-${discountTotal.toFixed(2)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1 text-[hsl(142,76%,42%)]">
                  <Tag className="w-3 h-3" />{appliedDiscount?.code.code}
                </span>
                <span className="font-mono text-[hsl(142,76%,42%)]">-${couponDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[hsl(215,16%,50%)]">Tax</span>
              <span className="font-mono text-[hsl(210,40%,80%)]">${taxTotal.toFixed(2)}</span>
            </div>
            <Separator className="bg-[hsl(222,47%,18%)]" />
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-3xl font-bold font-mono text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="p-4 space-y-2 border-t border-[hsl(222,47%,15%)]">
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="w-full text-[hsl(215,16%,47%)] hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Cart
              </Button>
            )}
            <Button
              className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
              disabled={cart.length === 0}
              onClick={() => {
                setAmountReceived(total.toFixed(2));
                setIsPaymentDialogOpen(true);
              }}
            >
              <CreditCard className="w-5 h-5 mr-3" />
              Charge ${total.toFixed(2)}
            </Button>
          </div>
        </div>

        {/* Numpad Overlay */}
        <Dialog open={showNumpad} onOpenChange={setShowNumpad}>
          <DialogContent className="sm:max-w-xs bg-[hsl(222,47%,9%)] border-[hsl(222,47%,18%)] text-white">
            <DialogHeader>
              <DialogTitle className="text-center text-[hsl(210,40%,80%)]">
                {numpadTarget === 'quantity' ? 'Enter Quantity' : 'Enter Amount'}
              </DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              <span className="text-4xl font-bold font-mono text-primary">
                {numpadTarget === 'amount' && '$'}{numpadValue || '0'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key => (
                <Button
                  key={key}
                  variant="ghost"
                  className="h-14 text-xl font-bold text-white hover:bg-[hsl(222,47%,15%)] bg-[hsl(222,47%,11%)] border border-[hsl(222,47%,18%)]"
                  onClick={() => handleNumpadPress(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                variant="ghost"
                className="h-12 text-[hsl(215,16%,47%)] hover:bg-[hsl(222,47%,15%)] bg-[hsl(222,47%,11%)] border border-[hsl(222,47%,18%)]"
                onClick={() => handleNumpadPress('C')}
              >
                Clear
              </Button>
              <Button
                className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                onClick={() => handleNumpadPress('OK')}
              >
                <Check className="w-5 h-5 mr-2" />
                OK
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md bg-[hsl(222,47%,9%)] border-[hsl(222,47%,18%)] text-white">
            <DialogHeader>
              <DialogTitle className="text-center text-white">Process Payment</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Total Display */}
              <div className="text-center py-6 rounded-xl bg-[hsl(222,47%,7%)] border border-[hsl(222,47%,15%)]">
                <p className="text-xs uppercase tracking-widest text-[hsl(215,16%,47%)] mb-2">Total Due</p>
                <p className="text-5xl font-bold font-mono text-primary">${total.toFixed(2)}</p>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method.value}
                    onClick={() => setSelectedPaymentMethod(method.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedPaymentMethod === method.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-[hsl(222,47%,18%)] bg-[hsl(222,47%,11%)] text-[hsl(210,40%,70%)] hover:border-[hsl(222,47%,25%)]'
                    }`}
                  >
                    <method.icon className="w-6 h-6" />
                    <span className="text-sm font-semibold">{method.label}</span>
                  </button>
                ))}
              </div>

              {/* Cash Amount */}
              {selectedPaymentMethod === "cash" && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(215,16%,47%)]">Amount Received</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    onClick={() => openNumpad('amount')}
                    className="text-2xl font-mono text-center h-16 bg-[hsl(222,47%,11%)] border-[hsl(222,47%,18%)] text-white"
                    placeholder="0.00"
                    readOnly
                  />
                  {parseFloat(amountReceived) >= total && (
                    <div className="flex justify-between p-3 rounded-xl bg-[hsl(142,76%,36%)]/10 border border-[hsl(142,76%,36%)]/30">
                      <span className="font-semibold text-[hsl(142,76%,42%)]">Change</span>
                      <span className="font-bold font-mono text-[hsl(142,76%,42%)]">
                        ${Math.max(0, parseFloat(amountReceived) - total).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20, Math.ceil(total / 50) * 50]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .slice(0, 4)
                      .map((amount) => (
                        <Button
                          key={amount}
                          variant="ghost"
                          size="sm"
                          onClick={() => setAmountReceived(amount.toFixed(2))}
                          className="bg-[hsl(222,47%,11%)] border border-[hsl(222,47%,18%)] text-white hover:bg-[hsl(222,47%,15%)]"
                        >
                          ${amount.toFixed(0)}
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1 h-12 border border-[hsl(222,47%,18%)] text-[hsl(210,40%,70%)] hover:bg-[hsl(222,47%,15%)]"
                  onClick={() => setIsPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25"
                  onClick={processPayment}
                  disabled={processingPayment || (selectedPaymentMethod === "cash" && parseFloat(amountReceived) < total)}
                >
                  {processingPayment ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Pay
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Barcode Scanner */}
        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScan}
        />

        {/* Receipt Dialog */}
        <ReceiptDialog
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          receipt={lastSaleReceipt}
        />

        {/* Pending Sales Sheet */}
        <Sheet open={isPendingSalesOpen} onOpenChange={setIsPendingSalesOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Pending Offline Sales</SheetTitle>
            </SheetHeader>
            <PendingSalesView
              pendingSales={pendingSales}
              online={online}
              syncing={syncing}
              onSync={syncPendingSales}
              onRefresh={loadCachedData}
            />
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
