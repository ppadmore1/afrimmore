 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Switch } from "@/components/ui/switch";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Plus, Settings, Trash2, Package, Users, FileText, Type, Hash, Calendar, ToggleLeft, List } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 import { Skeleton } from "@/components/ui/skeleton";
 
 type FieldDefinition = {
   id: string;
   entity_type: string;
   field_name: string;
   field_label: string;
   field_type: "text" | "number" | "date" | "boolean" | "select" | "multiselect" | "textarea";
   options: string[];
   is_required: boolean;
   default_value: string | null;
   sort_order: number;
   is_active: boolean;
 };
 
 const entityTypes = [
   { value: "product", label: "Products", icon: Package },
   { value: "customer", label: "Customers", icon: Users },
   { value: "invoice", label: "Invoices", icon: FileText },
   { value: "quotation", label: "Quotations", icon: FileText },
   { value: "supplier", label: "Suppliers", icon: Users },
 ];
 
 const fieldTypes = [
   { value: "text", label: "Text", icon: Type },
   { value: "number", label: "Number", icon: Hash },
   { value: "date", label: "Date", icon: Calendar },
   { value: "boolean", label: "Yes/No", icon: ToggleLeft },
   { value: "select", label: "Dropdown", icon: List },
   { value: "textarea", label: "Long Text", icon: Type },
 ];
 
 export default function CustomFieldsPage() {
   const [activeTab, setActiveTab] = useState("product");
   const [dialogOpen, setDialogOpen] = useState(false);
   const [formData, setFormData] = useState({
     entity_type: "product",
     field_name: "",
     field_label: "",
     field_type: "text" as FieldDefinition["field_type"],
     options: "",
     is_required: false,
     default_value: "",
   });
   const queryClient = useQueryClient();
 
   const { data: fields, isLoading } = useQuery({
     queryKey: ["custom-fields", activeTab],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("custom_field_definitions")
         .select("*")
         .eq("entity_type", activeTab)
         .order("sort_order", { ascending: true });
 
       if (error) throw error;
       return data as FieldDefinition[];
     },
   });
 
   const createMutation = useMutation({
     mutationFn: async (data: typeof formData) => {
       const fieldName = data.field_label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
       const { error } = await supabase.from("custom_field_definitions").insert({
         entity_type: data.entity_type,
         field_name: fieldName,
         field_label: data.field_label,
         field_type: data.field_type,
         options: data.options ? data.options.split(",").map((o) => o.trim()) : [],
         is_required: data.is_required,
         default_value: data.default_value || null,
       });
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
       setDialogOpen(false);
       resetForm();
       toast({ title: "Custom field created successfully" });
     },
     onError: (error: any) => {
       toast({ title: "Error creating field", description: error.message, variant: "destructive" });
     },
   });
 
   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from("custom_field_definitions").delete().eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
       toast({ title: "Custom field deleted" });
     },
   });
 
   const toggleActiveMutation = useMutation({
     mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
       const { error } = await supabase
         .from("custom_field_definitions")
         .update({ is_active })
         .eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
     },
   });
 
   const resetForm = () => {
     setFormData({
       entity_type: activeTab,
       field_name: "",
       field_label: "",
       field_type: "text",
       options: "",
       is_required: false,
       default_value: "",
     });
   };
 
   const getFieldTypeIcon = (type: string) => {
     const found = fieldTypes.find((f) => f.value === type);
     return found?.icon || Type;
   };
 
   return (
     <AppLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-bold">Custom Fields</h1>
             <p className="text-muted-foreground">Add custom data fields to any entity</p>
           </div>
           <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
             <DialogTrigger asChild>
               <Button onClick={() => setFormData({ ...formData, entity_type: activeTab })}>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Field
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Create Custom Field</DialogTitle>
               </DialogHeader>
               <div className="space-y-4">
                 <div className="space-y-2">
                   <Label>Entity Type</Label>
                   <Select
                     value={formData.entity_type}
                     onValueChange={(v) => setFormData({ ...formData, entity_type: v })}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       {entityTypes.map((type) => (
                         <SelectItem key={type.value} value={type.value}>
                           {type.label}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label>Field Label *</Label>
                   <Input
                     placeholder="e.g., Serial Number"
                     value={formData.field_label}
                     onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Field Type</Label>
                   <Select
                     value={formData.field_type}
                     onValueChange={(v: FieldDefinition["field_type"]) => setFormData({ ...formData, field_type: v })}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       {fieldTypes.map((type) => (
                         <SelectItem key={type.value} value={type.value}>
                           <div className="flex items-center gap-2">
                             <type.icon className="h-4 w-4" />
                             {type.label}
                           </div>
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 {(formData.field_type === "select" || formData.field_type === "multiselect") && (
                   <div className="space-y-2">
                     <Label>Options (comma separated)</Label>
                     <Input
                       placeholder="Option 1, Option 2, Option 3"
                       value={formData.options}
                       onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                     />
                   </div>
                 )}
                 <div className="space-y-2">
                   <Label>Default Value</Label>
                   <Input
                     placeholder="Optional default value"
                     value={formData.default_value}
                     onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <Label>Required Field</Label>
                   <Switch
                     checked={formData.is_required}
                     onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
                   />
                 </div>
                 <Button
                   className="w-full"
                   onClick={() => createMutation.mutate(formData)}
                   disabled={!formData.field_label || createMutation.isPending}
                 >
                   {createMutation.isPending ? "Creating..." : "Create Field"}
                 </Button>
               </div>
             </DialogContent>
           </Dialog>
         </div>
 
         <Tabs value={activeTab} onValueChange={setActiveTab}>
           <TabsList>
             {entityTypes.map((type) => (
               <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-2">
                 <type.icon className="h-4 w-4" />
                 {type.label}
               </TabsTrigger>
             ))}
           </TabsList>
 
           {entityTypes.map((type) => (
             <TabsContent key={type.value} value={type.value}>
               <Card>
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <type.icon className="h-5 w-5" />
                     {type.label} Custom Fields
                   </CardTitle>
                   <CardDescription>
                     Define additional fields for {type.label.toLowerCase()}
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="p-0">
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Field Label</TableHead>
                         <TableHead>Type</TableHead>
                         <TableHead>Required</TableHead>
                         <TableHead>Active</TableHead>
                         <TableHead className="text-right">Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {isLoading ? (
                         Array.from({ length: 2 }).map((_, i) => (
                           <TableRow key={i}>
                             <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                             <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                             <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                             <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                             <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                           </TableRow>
                         ))
                       ) : fields?.length === 0 ? (
                         <TableRow>
                           <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                             No custom fields defined for {type.label.toLowerCase()}
                           </TableCell>
                         </TableRow>
                       ) : (
                         fields?.map((field) => {
                           const TypeIcon = getFieldTypeIcon(field.field_type);
                           return (
                             <TableRow key={field.id}>
                               <TableCell className="font-medium">{field.field_label}</TableCell>
                               <TableCell>
                                 <div className="flex items-center gap-2">
                                   <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                   {field.field_type}
                                 </div>
                               </TableCell>
                               <TableCell>
                                 {field.is_required ? (
                                   <Badge variant="secondary">Required</Badge>
                                 ) : (
                                   <span className="text-muted-foreground">Optional</span>
                                 )}
                               </TableCell>
                               <TableCell>
                                 <Switch
                                   checked={field.is_active}
                                   onCheckedChange={(checked) =>
                                     toggleActiveMutation.mutate({ id: field.id, is_active: checked })
                                   }
                                 />
                               </TableCell>
                               <TableCell className="text-right">
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="text-destructive"
                                   onClick={() => deleteMutation.mutate(field.id)}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </TableCell>
                             </TableRow>
                           );
                         })
                       )}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
             </TabsContent>
           ))}
         </Tabs>
       </div>
     </AppLayout>
   );
 }