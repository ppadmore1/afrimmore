 import { useState, useRef } from "react";
 import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Badge } from "@/components/ui/badge";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 
 interface ImportDialogProps<T> {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   title: string;
   description: string;
   templateColumns: string[];
   parseData: (csvText: string) => { data: Partial<T>[]; errors: string[] };
   onImport: (data: Partial<T>[]) => Promise<{ success: number; failed: number }>;
   onComplete: () => void;
 }
 
 export function ImportDialog<T>({
   open,
   onOpenChange,
   title,
   description,
   templateColumns,
   parseData,
   onImport,
   onComplete,
 }: ImportDialogProps<T>) {
   const [file, setFile] = useState<File | null>(null);
   const [parsedData, setParsedData] = useState<Partial<T>[]>([]);
   const [parseErrors, setParseErrors] = useState<string[]>([]);
   const [importing, setImporting] = useState(false);
   const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
 
   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const selectedFile = e.target.files?.[0];
     if (!selectedFile) return;
 
     setFile(selectedFile);
     setResult(null);
 
     const text = await selectedFile.text();
     const { data, errors } = parseData(text);
     setParsedData(data);
     setParseErrors(errors);
   };
 
   const handleImport = async () => {
     if (parsedData.length === 0) return;
 
     setImporting(true);
     try {
       const result = await onImport(parsedData);
       setResult(result);
       if (result.success > 0) {
         onComplete();
       }
     } finally {
       setImporting(false);
     }
   };
 
   const handleClose = () => {
     setFile(null);
     setParsedData([]);
     setParseErrors([]);
     setResult(null);
     onOpenChange(false);
   };
 
   const downloadTemplate = () => {
     const content = templateColumns.join(",") + "\n";
     const blob = new Blob([content], { type: "text/csv" });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `${title.toLowerCase().replace(/\s+/g, "_")}_template.csv`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
   };
 
   return (
     <Dialog open={open} onOpenChange={handleClose}>
       <DialogContent className="max-w-lg">
         <DialogHeader>
           <DialogTitle>{title}</DialogTitle>
           <DialogDescription>{description}</DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4">
           {/* Template Download */}
           <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
             <div className="flex items-center gap-2">
               <FileText className="w-4 h-4 text-muted-foreground" />
               <span className="text-sm">Need a template?</span>
             </div>
             <Button variant="outline" size="sm" onClick={downloadTemplate}>
               Download Template
             </Button>
           </div>
 
           {/* File Upload */}
           <div
             className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
             onClick={() => fileInputRef.current?.click()}
           >
             <input
               ref={fileInputRef}
               type="file"
               accept=".csv"
               onChange={handleFileChange}
               className="hidden"
             />
             <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
             {file ? (
               <p className="text-sm font-medium">{file.name}</p>
             ) : (
               <p className="text-sm text-muted-foreground">
                 Click to upload or drag and drop a CSV file
               </p>
             )}
           </div>
 
           {/* Parse Results */}
           {file && (
             <div className="space-y-2">
               <div className="flex items-center gap-2">
                 <Badge variant={parsedData.length > 0 ? "default" : "secondary"}>
                   {parsedData.length} rows ready
                 </Badge>
                 {parseErrors.length > 0 && (
                   <Badge variant="destructive">{parseErrors.length} errors</Badge>
                 )}
               </div>
 
               {parseErrors.length > 0 && (
                 <ScrollArea className="h-24 border rounded-md p-2">
                   {parseErrors.map((error, i) => (
                     <p key={i} className="text-xs text-destructive">
                       {error}
                     </p>
                   ))}
                 </ScrollArea>
               )}
             </div>
           )}
 
           {/* Result */}
           {result && (
             <Alert variant={result.failed > 0 ? "destructive" : "default"}>
               {result.failed > 0 ? (
                 <AlertCircle className="h-4 w-4" />
               ) : (
                 <CheckCircle2 className="h-4 w-4" />
               )}
               <AlertDescription>
                 Imported {result.success} rows successfully
                 {result.failed > 0 && `, ${result.failed} failed`}
               </AlertDescription>
             </Alert>
           )}
 
           {/* Actions */}
           <div className="flex justify-end gap-2">
             <Button variant="outline" onClick={handleClose}>
               {result ? "Close" : "Cancel"}
             </Button>
             {!result && (
               <Button
                 onClick={handleImport}
                 disabled={parsedData.length === 0 || importing}
               >
                 {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                 Import {parsedData.length} Rows
               </Button>
             )}
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 }