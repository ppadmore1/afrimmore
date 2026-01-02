import { useState, useEffect } from "react";
import { AlertTriangle, X, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProducts, type Product } from "@/lib/supabase-db";

interface LowStockAlertProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export function LowStockAlert({ onDismiss, showDismiss = true }: LowStockAlertProps) {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkStock() {
      try {
        const products = await getProducts();
        const lowStock = products.filter(p => 
          p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 10)
        );
        const outOfStock = products.filter(p => p.stock_quantity === 0);
        
        setLowStockProducts(lowStock);
        setOutOfStockProducts(outOfStock);
      } catch (error) {
        console.error("Error checking stock levels:", error);
      } finally {
        setLoading(false);
      }
    }
    checkStock();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (loading || dismissed) return null;
  
  const hasAlerts = lowStockProducts.length > 0 || outOfStockProducts.length > 0;
  if (!hasAlerts) return null;

  const totalAlerts = lowStockProducts.length + outOfStockProducts.length;

  return (
    <Alert variant={outOfStockProducts.length > 0 ? "destructive" : "default"} className="relative border-warning bg-warning/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Inventory Alert
        <Badge variant="secondary" className="ml-2">
          {totalAlerts} {totalAlerts === 1 ? 'item' : 'items'}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex flex-col gap-2">
          {outOfStockProducts.length > 0 && (
            <div className="flex items-center gap-2 text-destructive">
              <Package className="h-4 w-4" />
              <span className="font-medium">
                {outOfStockProducts.length} product{outOfStockProducts.length !== 1 ? 's' : ''} out of stock
              </span>
              {outOfStockProducts.length <= 3 && (
                <span className="text-sm">
                  ({outOfStockProducts.map(p => p.name).join(', ')})
                </span>
              )}
            </div>
          )}
          {lowStockProducts.length > 0 && (
            <div className="flex items-center gap-2 text-warning-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-medium">
                {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} running low
              </span>
              {lowStockProducts.length <= 3 && (
                <span className="text-sm text-muted-foreground">
                  ({lowStockProducts.map(p => `${p.name}: ${p.stock_quantity} left`).join(', ')})
                </span>
              )}
            </div>
          )}
          <Link to="/inventory" className="inline-flex">
            <Button variant="outline" size="sm" className="mt-2">
              View Inventory
            </Button>
          </Link>
        </div>
      </AlertDescription>
      {showDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Alert>
  );
}

export function useLowStockCheck() {
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [criticalProducts, setCriticalProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function checkStock() {
      try {
        const products = await getProducts();
        const lowStock = products.filter(p => 
          p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 10)
        );
        const outOfStock = products.filter(p => p.stock_quantity === 0);
        
        setLowStockCount(lowStock.length);
        setOutOfStockCount(outOfStock.length);
        setCriticalProducts([...outOfStock.slice(0, 5), ...lowStock.slice(0, 5)].slice(0, 5));
      } catch (error) {
        console.error("Error checking stock:", error);
      }
    }
    checkStock();
  }, []);

  return { lowStockCount, outOfStockCount, criticalProducts, hasAlerts: lowStockCount > 0 || outOfStockCount > 0 };
}
