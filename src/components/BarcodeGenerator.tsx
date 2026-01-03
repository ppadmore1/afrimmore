import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Printer, Barcode } from "lucide-react";

interface BarcodeGeneratorProps {
  value: string;
  productName?: string;
  showActions?: boolean;
  width?: number;
  height?: number;
}

export function BarcodeGenerator({ 
  value, 
  productName,
  showActions = true,
  width = 2,
  height = 80 
}: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width,
          height,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
        setError(false);
      } catch (e) {
        console.error("Barcode generation error:", e);
        setError(true);
      }
    }
  }, [value, width, height]);

  const downloadBarcode = () => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `barcode-${value}.png`;
      downloadLink.href = pngUrl;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const printBarcode = () => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const printWindow = window.open("", "_blank");
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Barcode - ${productName || value}</title>
            <style>
              body { 
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center; 
                min-height: 100vh;
                margin: 0;
                font-family: system-ui, sans-serif;
              }
              .product-name {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 10px;
              }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${productName ? `<div class="product-name">${productName}</div>` : ""}
            ${svgData}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (error) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        Invalid barcode value
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-lg">
        <svg ref={svgRef} />
      </div>
      
      {showActions && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadBarcode}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={printBarcode}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      )}
    </div>
  );
}

interface BarcodeDialogProps {
  value: string;
  productName?: string;
  trigger?: React.ReactNode;
}

export function BarcodeDialog({ value, productName, trigger }: BarcodeDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Barcode className="w-4 h-4 mr-2" />
            View Barcode
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{productName || "Product Barcode"}</DialogTitle>
        </DialogHeader>
        <BarcodeGenerator value={value} productName={productName} />
      </DialogContent>
    </Dialog>
  );
}

// Utility to generate a unique barcode value
export function generateBarcodeValue(productId: string): string {
  // Use a prefix + timestamp + random to ensure uniqueness
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const idPart = productId.substring(0, 4).toUpperCase();
  return `PRD${idPart}${timestamp}${random}`.substring(0, 16);
}
