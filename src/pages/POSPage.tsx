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
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

type Product = Tables<"products">;
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
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [productsRes, customersRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("customers").select("*").order("name"),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;

      setProducts(productsRes.data || []);
      setCustomers(customersRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is out of stock`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty >= product.stock_quantity) {
          toast({
            title: "Insufficient Stock",
            description: `Only ${product.stock_quantity} available`,
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
      if (newQty <= 0) {
        return prev.filter((item) => item.product.id !== productId);
      }
      if (newQty > prev[index].product.stock_quantity) {
        toast({
          title: "Insufficient Stock",
          description: `Only ${prev[index].product.stock_quantity} available`,
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

  // Calculate totals
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

  const generateSaleNumber = async () => {
    const today = new Date();
    const prefix = `POS-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    
    const { data } = await supabase
      .from("pos_sales")
      .select("sale_number")
      .like("sale_number", `${prefix}%`)
      .order("sale_number", { ascending: false })
      .limit(1);

    const lastNumber = data?.[0]?.sale_number;
    const nextNum = lastNumber ? parseInt(lastNumber.split("-").pop() || "0") + 1 : 1;
    return `${prefix}-${String(nextNum).padStart(4, "0")}`;
  };

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
      const saleNumber = await generateSaleNumber();
      const paymentNumber = `PAY-${Date.now()}`;

      // Create POS sale
      const { data: sale, error: saleError } = await supabase
        .from("pos_sales")
        .insert({
          sale_number: saleNumber,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || null,
          subtotal: subtotal,
          tax_total: taxTotal,
          discount_total: discountTotal,
          total: total,
          amount_paid: parseFloat(amountReceived) || total,
          change_amount: Math.max(0, changeAmount),
          payment_method: selectedPaymentMethod,
          status: "paid",
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items and update stock
      for (const item of cart) {
        const itemTotal = item.product.unit_price * item.quantity;
        const discountAmount = (itemTotal * item.discount) / 100;
        const taxAmount = ((itemTotal - discountAmount) * (item.product.tax_rate || 0)) / 100;

        // Insert sale item
        await supabase.from("pos_sale_items").insert({
          sale_id: sale.id,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.unit_price,
          discount: item.discount,
          tax_rate: item.product.tax_rate || 0,
          total: itemTotal - discountAmount + taxAmount,
        });

        // Update stock
        await supabase
          .from("products")
          .update({ stock_quantity: item.product.stock_quantity - item.quantity })
          .eq("id", item.product.id);

        // Record stock movement
        await supabase.from("stock_movements").insert({
          product_id: item.product.id,
          quantity: -item.quantity,
          movement_type: "sale",
          reference_type: "pos_sale",
          reference_id: sale.id,
          created_by: user?.id || null,
          notes: `POS Sale: ${saleNumber}`,
        });
      }

      // Create payment record
      await supabase.from("payments").insert({
        payment_number: paymentNumber,
        pos_sale_id: sale.id,
        amount: total,
        payment_method: selectedPaymentMethod,
        created_by: user?.id || null,
      });

      toast({
        title: "Sale Complete",
        description: `Sale ${saleNumber} processed successfully`,
      });

      // Reset
      setCart([]);
      setSelectedCustomer(null);
      setIsPaymentDialogOpen(false);
      setAmountReceived("");
      setSelectedPaymentMethod("cash");

      // Refresh products to get updated stock
      loadData();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Error",
        description: "Failed to process payment",
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
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                          product.stock_quantity <= 0 ? "opacity-50" : ""
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
                              variant={product.stock_quantity <= (product.low_stock_threshold || 10) ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {product.stock_quantity}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
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
      </div>
    </AppLayout>
  );
}
