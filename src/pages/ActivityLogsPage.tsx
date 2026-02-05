 import { useState } from "react";
 import { useQuery } from "@tanstack/react-query";
 import { format } from "date-fns";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Search, Filter, Clock, User, FileText, Package, Users, CreditCard, ShoppingCart } from "lucide-react";
 import { Skeleton } from "@/components/ui/skeleton";
 
 const entityIcons: Record<string, React.ElementType> = {
   product: Package,
   customer: Users,
   invoice: FileText,
   pos_sale: ShoppingCart,
   payment: CreditCard,
   default: FileText,
 };
 
 const actionColors: Record<string, string> = {
   create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
   update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
   delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
   login: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
   logout: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
 };
 
 export default function ActivityLogsPage() {
   const [search, setSearch] = useState("");
   const [entityFilter, setEntityFilter] = useState<string>("all");
   const [actionFilter, setActionFilter] = useState<string>("all");
 
   const { data: logs, isLoading } = useQuery({
     queryKey: ["activity-logs", search, entityFilter, actionFilter],
     queryFn: async () => {
       let query = supabase
         .from("activity_logs")
         .select(`
           *,
           profiles:user_id (full_name, email)
         `)
         .order("created_at", { ascending: false })
         .limit(100);
 
       if (entityFilter !== "all") {
         query = query.eq("entity_type", entityFilter);
       }
       if (actionFilter !== "all") {
         query = query.eq("action", actionFilter);
       }
       if (search) {
         query = query.or(`entity_name.ilike.%${search}%,action.ilike.%${search}%`);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data;
     },
   });
 
   const entityTypes = ["product", "customer", "invoice", "quotation", "pos_sale", "payment", "receipt", "delivery_note"];
   const actionTypes = ["create", "update", "delete", "login", "logout", "view"];
 
   return (
     <AppLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-bold">Activity Logs</h1>
             <p className="text-muted-foreground">Track all user actions and system events</p>
           </div>
           <Clock className="h-8 w-8 text-muted-foreground" />
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Filter className="h-5 w-5" />
               Filters
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex flex-wrap gap-4">
               <div className="flex-1 min-w-[200px]">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input
                     placeholder="Search by entity name..."
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     className="pl-9"
                   />
                 </div>
               </div>
               <Select value={entityFilter} onValueChange={setEntityFilter}>
                 <SelectTrigger className="w-[180px]">
                   <SelectValue placeholder="Entity Type" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Entities</SelectItem>
                   {entityTypes.map((type) => (
                     <SelectItem key={type} value={type}>
                       {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <Select value={actionFilter} onValueChange={setActionFilter}>
                 <SelectTrigger className="w-[180px]">
                   <SelectValue placeholder="Action Type" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Actions</SelectItem>
                   {actionTypes.map((type) => (
                     <SelectItem key={type} value={type}>
                       {type.charAt(0).toUpperCase() + type.slice(1)}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardContent className="p-0">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Timestamp</TableHead>
                   <TableHead>User</TableHead>
                   <TableHead>Action</TableHead>
                   <TableHead>Entity</TableHead>
                   <TableHead>Details</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {isLoading ? (
                   Array.from({ length: 5 }).map((_, i) => (
                     <TableRow key={i}>
                       <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                       <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                     </TableRow>
                   ))
                 ) : logs?.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                       No activity logs found
                     </TableCell>
                   </TableRow>
                 ) : (
                   logs?.map((log: any) => {
                     const IconComponent = entityIcons[log.entity_type] || entityIcons.default;
                     return (
                       <TableRow key={log.id}>
                         <TableCell className="whitespace-nowrap">
                           <div className="flex items-center gap-2">
                             <Clock className="h-4 w-4 text-muted-foreground" />
                             <span className="text-sm">
                               {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                             </span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <User className="h-4 w-4 text-muted-foreground" />
                             <span className="text-sm">
                               {log.profiles?.full_name || log.profiles?.email || "System"}
                             </span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <Badge className={actionColors[log.action] || "bg-gray-100"}>
                             {log.action}
                           </Badge>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <IconComponent className="h-4 w-4 text-muted-foreground" />
                             <span className="capitalize">
                               {log.entity_type?.replace("_", " ")}
                             </span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <span className="text-sm text-muted-foreground">
                             {log.entity_name || "-"}
                           </span>
                         </TableCell>
                       </TableRow>
                     );
                   })
                 )}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 }