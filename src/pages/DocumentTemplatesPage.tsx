import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Upload,
  FileImage,
  Trash2,
  CheckCircle,
  Eye,
  Plus,
  FileText,
  FileCheck,
  Truck,
  Receipt,
} from "lucide-react";

type DocumentType = "invoice" | "quotation" | "delivery_note" | "receipt";

interface DocumentTemplate {
  id: string;
  name: string;
  document_type: DocumentType;
  template_url: string;
  is_active: boolean;
  field_positions: Record<string, unknown>;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  delivery_note: "Delivery Note",
  receipt: "Receipt",
};

const DOC_TYPE_ICONS: Record<DocumentType, React.ElementType> = {
  invoice: FileText,
  quotation: FileCheck,
  delivery_note: Truck,
  receipt: Receipt,
};

export default function DocumentTemplatesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<DocumentType | "all">("all");

  const [form, setForm] = useState({
    name: "",
    document_type: "invoice" as DocumentType,
    file: null as File | null,
    preview: null as string | null,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentTemplate[];
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, docType }: { id: string; docType: DocumentType }) => {
      // Deactivate all templates of this type first
      await supabase
        .from("document_templates")
        .update({ is_active: false })
        .eq("document_type", docType);
      // Activate selected
      const { error } = await supabase
        .from("document_templates")
        .update({ is_active: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast({ title: "Template activated", description: "This template will now be used for PDF generation." });
    },
    onError: () => toast({ title: "Error", description: "Failed to activate template.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (template) {
        // Extract path from URL
        const url = new URL(template.template_url);
        const pathParts = url.pathname.split("/document-templates/");
        if (pathParts[1]) {
          await supabase.storage.from("document-templates").remove([pathParts[1]]);
        }
      }
      const { error } = await supabase.from("document_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast({ title: "Template deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PNG, JPG, or WEBP image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 10MB.", variant: "destructive" });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, file, preview: objectUrl }));
  };

  const handleUpload = async () => {
    if (!form.file || !form.name.trim()) {
      toast({ title: "Missing fields", description: "Please provide a name and select a template image.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = form.file.name.split(".").pop();
      const fileName = `${form.document_type}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("document-templates")
        .upload(fileName, form.file, { upsert: false });
      if (storageError) throw storageError;

      const { data: publicData } = supabase.storage.from("document-templates").getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("document_templates").insert({
        name: form.name.trim(),
        document_type: form.document_type,
        template_url: publicData.publicUrl,
        is_active: false,
        field_positions: {},
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast({ title: "Template uploaded!", description: "Activate it to use it for PDF generation." });
      setUploadDialogOpen(false);
      setForm({ name: "", document_type: "invoice", file: null, preview: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const filtered = filterType === "all" ? templates : templates.filter((t) => t.document_type === filterType);

  const groupedByType = (["invoice", "quotation", "delivery_note", "receipt"] as DocumentType[]).reduce(
    (acc, type) => {
      acc[type] = templates.filter((t) => t.document_type === type);
      return acc;
    },
    {} as Record<DocumentType, DocumentTemplate[]>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Document Templates</h1>
            <p className="text-muted-foreground mt-1">
              Upload custom templates for invoices, quotations, delivery notes, and receipts. Activate a template to use it for PDF generation.
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Upload Template
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["invoice", "quotation", "delivery_note", "receipt"] as DocumentType[]).map((type) => {
            const Icon = DOC_TYPE_ICONS[type];
            const count = groupedByType[type].length;
            const active = groupedByType[type].find((t) => t.is_active);
            return (
                <Card
                key={type}
                className={`cursor-pointer transition-all border-2 ${filterType === type ? "border-primary" : "border-border/0"}`}
                onClick={() => setFilterType(filterType === type ? "all" : type)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{DOC_TYPE_LABELS[type]}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">
                    {active ? <span className="text-emerald-600 font-medium">✓ Active template set</span> : "No active template"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How it works */}
        <Card className="bg-muted/40 border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <FileImage className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">How custom templates work</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload a PNG/JPG image of your template design (scan or screenshot of your branded template). When you activate it, the system uses it as the background when generating PDFs — your document data (customer info, items, totals) is automatically printed on top of your design.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading templates...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileImage className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-1">No templates yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Upload your first document template to customize PDF output.</p>
              <Button onClick={() => setUploadDialogOpen(true)} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Upload Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => {
              const Icon = DOC_TYPE_ICONS[template.document_type];
              return (
                <Card key={template.id} className={`overflow-hidden transition-all ${template.is_active ? "ring-2 ring-emerald-500" : ""}`}>
                  {/* Template preview */}
                  <div
                    className="h-40 bg-muted relative overflow-hidden cursor-pointer group"
                    onClick={() => setPreviewUrl(template.template_url)}
                  >
                    <img
                      src={template.template_url}
                      alt={template.name}
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {template.is_active && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-emerald-500 text-white gap-1 text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[template.document_type]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!template.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs gap-1"
                          onClick={() => activateMutation.mutate({ id: template.id, docType: template.document_type })}
                          disabled={activateMutation.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Set Active
                        </Button>
                      )}
                      {template.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs gap-1 text-emerald-600 border-emerald-500"
                          onClick={() => activateMutation.mutate({ id: template.id, docType: template.document_type })}
                          disabled
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Active
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(template.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) setForm({ name: "", document_type: "invoice", file: null, preview: null }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tpl-name">Template Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Acme Corp Invoice Template"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Document Type</Label>
              <Select
                value={form.document_type}
                onValueChange={(v) => setForm((p) => ({ ...p, document_type: v as DocumentType }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                  <SelectItem value="delivery_note">Delivery Note</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template Image (PNG, JPG, WEBP)</Label>
              <div
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {form.preview ? (
                  <img src={form.preview} alt="Preview" className="max-h-48 mx-auto rounded object-contain" />
                ) : (
                  <div className="py-4">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to browse or drag & drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP — max 10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              {form.file && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{form.file.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading} className="gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Template preview" className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template image and its configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
