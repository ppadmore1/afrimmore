import { useRef } from "react";
import { format } from "date-fns";
import { Printer, X, Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

interface ReceiptData {
  saleNumber: string;
  date: Date;
  customerName: string | null;
  items: ReceiptItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  isOffline?: boolean;
}

interface ReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
};

export function ReceiptDialog({ isOpen, onClose, receipt }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receipt.saleNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              width: 80mm;
              padding: 10px;
              background: white;
              color: black;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .header h1 {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .header p {
              font-size: 10px;
              color: #666;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
              font-size: 11px;
            }
            .items-header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 5px;
            }
            .item {
              margin-bottom: 8px;
            }
            .item-name {
              font-weight: bold;
            }
            .item-details {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              padding-left: 10px;
            }
            .totals {
              margin-top: 10px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .total-row.grand {
              font-weight: bold;
              font-size: 14px;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 10px;
            }
            @media print {
              body {
                width: 80mm;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Receipt
            {receipt.isOffline && (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="w-3 h-3" />
                Offline Sale
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="bg-muted/30 rounded-lg p-4 max-h-[60vh] overflow-auto">
          <div ref={receiptRef} className="bg-background p-4 rounded font-mono text-sm">
            {/* Header */}
            <div className="header text-center mb-4">
              <h1 className="text-lg font-bold">AFRIMMORE</h1>
              <p className="text-xs text-muted-foreground">Thank you for your purchase!</p>
            </div>

            <Separator className="my-3" />

            {/* Sale Info */}
            <div className="space-y-1 text-xs">
              <div className="info-row flex justify-between">
                <span>Receipt #:</span>
                <span className="font-medium">{receipt.saleNumber}</span>
              </div>
              <div className="info-row flex justify-between">
                <span>Date:</span>
                <span>{format(receipt.date, "MMM dd, yyyy HH:mm")}</span>
              </div>
              {receipt.customerName && (
                <div className="info-row flex justify-between">
                  <span>Customer:</span>
                  <span>{receipt.customerName}</span>
                </div>
              )}
            </div>

            <Separator className="my-3" />

            {/* Items */}
            <div className="space-y-2">
              <div className="items-header flex justify-between text-xs font-semibold">
                <span>Item</span>
                <span>Amount</span>
              </div>
              {receipt.items.map((item, index) => (
                <div key={index} className="item">
                  <div className="item-name text-xs font-medium">{item.name}</div>
                  <div className="item-details flex justify-between text-xs text-muted-foreground pl-2">
                    <span>
                      {item.quantity} x ${item.unitPrice.toFixed(2)}
                      {item.discount > 0 && ` (-${item.discount}%)`}
                    </span>
                    <span>${item.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            {/* Totals */}
            <div className="totals space-y-1 text-xs">
              <div className="total-row flex justify-between">
                <span>Subtotal:</span>
                <span>${receipt.subtotal.toFixed(2)}</span>
              </div>
              {receipt.discountTotal > 0 && (
                <div className="total-row flex justify-between text-destructive">
                  <span>Discount:</span>
                  <span>-${receipt.discountTotal.toFixed(2)}</span>
                </div>
              )}
              {receipt.taxTotal > 0 && (
                <div className="total-row flex justify-between">
                  <span>Tax:</span>
                  <span>${receipt.taxTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="total-row grand flex justify-between font-bold text-base pt-2 border-t">
                <span>TOTAL:</span>
                <span>${receipt.total.toFixed(2)}</span>
              </div>
            </div>

            <Separator className="my-3" />

            {/* Payment Info */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span>{paymentMethodLabels[receipt.paymentMethod] || receipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span>${receipt.amountPaid.toFixed(2)}</span>
              </div>
              {receipt.changeAmount > 0 && (
                <div className="flex justify-between font-medium">
                  <span>Change:</span>
                  <span>${receipt.changeAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <Separator className="my-3" />

            {/* Footer */}
            <div className="footer text-center text-xs text-muted-foreground">
              {receipt.isOffline && (
                <p className="text-destructive font-medium mb-1">
                  ⚡ Offline Sale - Will sync when online
                </p>
              )}
              <p>Thank you for shopping with us!</p>
              <p className="mt-1">Please keep this receipt for your records.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
