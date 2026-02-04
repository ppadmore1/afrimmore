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
  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.product.unit_price * item.quantity;
    const discountAmount = (itemTotal * item.discount) / 100;
    return sum + (itemTotal - discountAmount);
  }, 0);

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

  const total = subtotal + taxTotal;
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
        discountTotal,
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

  return (
    <AppLayout>
      <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4">
        {/* Products Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="space-y-4 mb-4">
            {/* Offline/Online Status Banner */}
            {!online && (
              <div className="flex items-center justify-between gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <WifiOff className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    Offline Mode - Sales will sync when reconnected
                  </span>
                </div>
                {pendingSales.length > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setIsPendingSalesOpen(true)}
                    className="gap-1"
                  >
                    <History className="w-3 h-3" />
                    {pendingSales.length} pending
                  </Button>
                )}
              </div>
            )}

            {/* Pending sales indicator when online */}
            {online && pendingSales.length > 0 && (
              <div className="flex items-center justify-between gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <CloudOff className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {pendingSales.length} offline sale{pendingSales.length > 1 ? 's' : ''} pending sync
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsPendingSalesOpen(true)}
                  >
                    <History className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={syncPendingSales}
                    disabled={syncing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>
              </div>
            )}

            {/* Branch indicator */}
            {currentBranch && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  Showing inventory for: <strong>{currentBranch.name}</strong>
                </span>
              </div>
            )}
            
          <div className="flex flex-col sm:flex-row gap-3">
              {/* Barcode Scanner Input */}
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Scan barcode or SKU..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>
                <Button type="submit" size="icon" variant="secondary">
                  <Search className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setIsScannerOpen(true)}
                  title="Scan with camera"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </form>

              {/* Search Products */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Always Visible Pending Sales Button */}
              <Button
                variant={pendingSales.length > 0 ? "default" : "outline"}
                onClick={() => setIsPendingSalesOpen(true)}
                className="gap-2 whitespace-nowrap"
              >
                <History className="w-4 h-4" />
                Pending Sales
                {pendingSales.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {pendingSales.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Products Grid */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-muted rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Package className="w-12 h-12 mb-4" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => {
                    const stock = getEffectiveStock(product);
                    const threshold = getEffectiveThreshold(product);
                    const isLowStock = stock > 0 && stock <= threshold;
                    const isOutOfStock = stock <= 0;
                    
                    return (
                      <motion.div
                        key={product.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <Card
                          className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                            isOutOfStock ? "opacity-50" : ""
                          }`}
                          onClick={() => addToCart(product)}
                        >
                          <CardContent className="p-4">
                            <div className="aspect-square mb-3 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>
                            <h3 className="font-medium text-sm truncate">{product.name}</h3>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-bold text-primary font-mono">
                                ${product.unit_price.toFixed(2)}
                              </span>
                              <Badge
                                variant={isOutOfStock ? "destructive" : isLowStock ? "secondary" : "outline"}
                                className="text-xs"
                              >
                                {isOutOfStock && <AlertTriangle className="w-3 h-3 mr-1" />}
                                {stock}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Cart Section */}
        <Card className="lg:w-96 flex flex-col min-h-[400px] lg:min-h-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart
                {cart.length > 0 && (
                  <Badge variant="secondary">{cart.length}</Badge>
                )}
              </CardTitle>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              )}
            </div>

            {/* Customer Selection */}
            <Select
              value={selectedCustomer?.id || "walk-in"}
              onValueChange={(value) => {
                if (value === "walk-in") {
                  setSelectedCustomer(null);
                } else {
                  const customer = customers.find((c) => c.id === value);
                  setSelectedCustomer(customer || null);
                }
              }}
            >
              <SelectTrigger className="mt-2">
                <User className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>

          <Separator />

          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <ShoppingCart className="w-8 h-8 mb-2" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      key={item.product.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {item.product.image_url ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ${item.product.unit_price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-bold text-sm font-mono">
                          ${(item.product.unit_price * item.quantity).toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Totals */}
          <div className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">${subtotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Discount</span>
                <span className="font-mono">-${discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono">${taxTotal.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="font-mono text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-4 pt-0">
            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0}
              onClick={() => {
                setAmountReceived(total.toFixed(2));
                setIsPaymentDialogOpen(true);
              }}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Charge ${total.toFixed(2)}
            </Button>
          </div>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Process Payment</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Total */}
              <div className="text-center p-6 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-4xl font-bold font-mono text-primary">
                  ${total.toFixed(2)}
                </p>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map((method) => (
                  <Button
                    key={method.value}
                    variant={selectedPaymentMethod === method.value ? "default" : "outline"}
                    className="h-20 flex-col gap-2"
                    onClick={() => setSelectedPaymentMethod(method.value)}
                  >
                    <method.icon className="w-6 h-6" />
                    {method.label}
                  </Button>
                ))}
              </div>

              {/* Amount Received (for cash) */}
              {selectedPaymentMethod === "cash" && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Amount Received</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    className="text-xl font-mono text-center h-14"
                    placeholder="0.00"
                  />
                  {parseFloat(amountReceived) >= total && (
                    <div className="flex justify-between p-3 rounded-lg bg-success/10 text-success">
                      <span className="font-medium">Change</span>
                      <span className="font-bold font-mono">
                        ${Math.max(0, parseFloat(amountReceived) - total).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {/* Quick amount buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20, Math.ceil(total / 50) * 50]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .slice(0, 4)
                      .map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setAmountReceived(amount.toFixed(2))}
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
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={processPayment}
                  disabled={
                    processingPayment ||
                    (selectedPaymentMethod === "cash" && parseFloat(amountReceived) < total)
                  }
                >
                  {processingPayment ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete Sale
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
