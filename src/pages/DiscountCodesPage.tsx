 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { format } from "date-fns";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Plus, Search, Tag, Percent, DollarSign, Calendar, Copy, Trash2 } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 import { useAuth } from "@/contexts/AuthContext";
 import { Skeleton } from "@/components/ui/skeleton";
 
 type DiscountCode = {
   id: string;
   code: string;
   name: string;
   description: string | null;
   discount_type: "percentage" | "fixed_amount";
   discount_value: number;
   min_purchase_amount: number;
   max_discount_amount: number | null;
   usage_limit: number | null;
   usage_count: number;
   valid_from: string;
   valid_until: string | null;
   status: "active" | "inactive" | "expired" | "scheduled";
 };
 
 export default function DiscountCodesPage() {
   const [search, setSearch] = useState("");
   const [dialogOpen, setDialogOpen] = useState(false);
   const [formData, setFormData] = useState({
     code: "",
     name: "",
     description: "",
     discount_type: "percentage" as "percentage" | "fixed_amount",
     discount_value: 0,
     min_purchase_amount: 0,
     max_discount_amount: "",
     usage_limit: "",
     valid_until: "",
   });
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const { data: codes, isLoading } = useQuery({
     queryKey: ["discount-codes", search],
     queryFn: async () => {
       let query = supabase
         .from("discount_codes")
         .select("*")
         .order("created_at", { ascending: false });
 
       if (search) {
         query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as DiscountCode[];
     },
   });
 
   const createMutation = useMutation({
     mutationFn: async (data: typeof formData) => {
       const { error } = await supabase.from("discount_codes").insert({
         code: data.code.toUpperCase(),
         name: data.name,
         description: data.description || null,
         discount_type: data.discount_type,
         discount_value: data.discount_value,
         min_purchase_amount: data.min_purchase_amount,
         max_discount_amount: data.max_discount_amount ? parseFloat(data.max_discount_amount) : null,
         usage_limit: data.usage_limit ? parseInt(data.usage_limit) : null,
         valid_until: data.valid_until || null,
         created_by: user?.id,
       });
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
       setDialogOpen(false);
       resetForm();
       toast({ title: "Discount code created successfully" });
     },
     onError: (error: any) => {
       toast({ title: "Error creating discount code", description: error.message, variant: "destructive" });
     },
   });
 
   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from("discount_codes").delete().eq("id", id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
       toast({ title: "Discount code deleted" });
     },
   });
 
   const resetForm = () => {
     setFormData({
       code: "",
       name: "",
       description: "",
       discount_type: "percentage",
       discount_value: 0,
       min_purchase_amount: 0,
       max_discount_amount: "",
       usage_limit: "",
       valid_until: "",
     });
   };
 
   const copyCode = (code: string) => {
     navigator.clipboard.writeText(code);
     toast({ title: "Code copied to clipboard" });
   };
 
   const statusColors: Record<string, string> = {
     active: "bg-green-100 text-green-800",
     inactive: "bg-gray-100 text-gray-800",
     expired: "bg-red-100 text-red-800",
     scheduled: "bg-blue-100 text-blue-800",
   };
 
   return (
     <AppLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-bold">Discount Codes</h1>
             <p className="text-muted-foreground">Manage promotional codes and discounts</p>
           </div>
           <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
             <DialogTrigger asChild>
               <Button>
                 <Plus className="h-4 w-4 mr-2" />
                 Create Code
               </Button>
             </DialogTrigger>
             <DialogContent className="max-w-lg">
               <DialogHeader>
                 <DialogTitle>Create Discount Code</DialogTitle>
               </DialogHeader>
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Code *</Label>
                     <Input
                       placeholder="e.g., SUMMER20"
                       value={formData.code}
                       onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Name *</Label>
                     <Input
                       placeholder="Summer Sale"
                       value={formData.name}
                       onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                     />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Discount Type</Label>
                     <Select
                       value={formData.discount_type}
                       onValueChange={(v: "percentage" | "fixed_amount") => setFormData({ ...formData, discount_type: v })}
                     >
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="percentage">Percentage (%)</SelectItem>
                         <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2">
                     <Label>Discount Value *</Label>
                     <Input
                       type="number"
                       value={formData.discount_value}
                       onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                     />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Min Purchase Amount</Label>
                     <Input
                       type="number"
                       value={formData.min_purchase_amount}
                       onChange={(e) => setFormData({ ...formData, min_purchase_amount: parseFloat(e.target.value) || 0 })}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Usage Limit</Label>
                     <Input
                       type="number"
                       placeholder="Unlimited"
                       value={formData.usage_limit}
                       onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                     />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <Label>Valid Until</Label>
                   <Input
                     type="datetime-local"
                     value={formData.valid_until}
                     onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                   />
                 </div>
                 <Button
                   className="w-full"
                   onClick={() => createMutation.mutate(formData)}
                   disabled={!formData.code || !formData.name || createMutation.isPending}
                 >
                   {createMutation.isPending ? "Creating..." : "Create Discount Code"}
                 </Button>
               </div>
             </DialogContent>
           </Dialog>
         </div>
 
         <Card>
           <CardHeader>
             <div className="flex items-center gap-4">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="Search codes..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="pl-9"
                 />
               </div>
             </div>
           </CardHeader>
           <CardContent className="p-0">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Code</TableHead>
                   <TableHead>Name</TableHead>
                   <TableHead>Discount</TableHead>
                   <TableHead>Usage</TableHead>
                   <TableHead>Valid Until</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {isLoading ? (
                   Array.from({ length: 3 }).map((_, i) => (
                     <TableRow key={i}>
                       <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                       <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                       <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                     </TableRow>
                   ))
                 ) : codes?.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                       No discount codes found. Create your first one!
                     </TableCell>
                   </TableRow>
                 ) : (
                   codes?.map((code) => (
                     <TableRow key={code.id}>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           <Tag className="h-4 w-4 text-primary" />
                           <code className="font-mono font-semibold">{code.code}</code>
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(code.code)}>
                             <Copy className="h-3 w-3" />
                           </Button>
                         </div>
                       </TableCell>
                       <TableCell>{code.name}</TableCell>
                       <TableCell>
                         <div className="flex items-center gap-1">
                           {code.discount_type === "percentage" ? (
                             <Percent className="h-4 w-4" />
                           ) : (
                             <DollarSign className="h-4 w-4" />
                           )}
                           <span>{code.discount_value}{code.discount_type === "percentage" ? "%" : ""}</span>
                         </div>
                       </TableCell>
                       <TableCell>
                         {code.usage_count} / {code.usage_limit || "∞"}
                       </TableCell>
                       <TableCell>
                         {code.valid_until ? (
                           <div className="flex items-center gap-1">
                             <Calendar className="h-4 w-4 text-muted-foreground" />
                             {format(new Date(code.valid_until), "MMM dd, yyyy")}
                           </div>
                         ) : (
                           "No expiry"
                         )}
                       </TableCell>
                       <TableCell>
                         <Badge className={statusColors[code.status]}>{code.status}</Badge>
                       </TableCell>
                       <TableCell className="text-right">
                         <Button
                           variant="ghost"
                           size="icon"
                           className="text-destructive"
                           onClick={() => deleteMutation.mutate(code.id)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 }