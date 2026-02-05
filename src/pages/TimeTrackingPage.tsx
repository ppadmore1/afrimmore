 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { format, differenceInMinutes, startOfWeek, endOfWeek } from "date-fns";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Clock, Play, Pause, Square, Coffee, Calendar, Timer } from "lucide-react";
 import { toast } from "@/hooks/use-toast";
 import { useAuth } from "@/contexts/AuthContext";
 import { useBranch } from "@/contexts/BranchContext";
 import { Skeleton } from "@/components/ui/skeleton";
 
 type TimeEntry = {
   id: string;
   user_id: string;
   branch_id: string | null;
   clock_in: string;
   clock_out: string | null;
   break_minutes: number;
   total_hours: number | null;
   status: "clocked_in" | "clocked_out" | "on_break";
   notes: string | null;
   created_at: string;
 };
 
 export default function TimeTrackingPage() {
   const { user } = useAuth();
   const { currentBranch } = useBranch();
   const queryClient = useQueryClient();
 
   const { data: activeEntry } = useQuery({
     queryKey: ["active-time-entry", user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("employee_time_entries")
         .select("*")
         .eq("user_id", user?.id)
         .is("clock_out", null)
         .order("clock_in", { ascending: false })
         .limit(1)
         .single();
       
       if (error && error.code !== "PGRST116") throw error;
       return data as TimeEntry | null;
     },
     enabled: !!user?.id,
   });
 
   const { data: entries, isLoading } = useQuery({
     queryKey: ["time-entries", user?.id],
     queryFn: async () => {
       const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
       const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
 
       const { data, error } = await supabase
         .from("employee_time_entries")
         .select("*")
         .eq("user_id", user?.id)
         .gte("clock_in", weekStart.toISOString())
         .lte("clock_in", weekEnd.toISOString())
         .order("clock_in", { ascending: false });
 
       if (error) throw error;
       return data as TimeEntry[];
     },
     enabled: !!user?.id,
   });
 
   const clockInMutation = useMutation({
     mutationFn: async () => {
       const { error } = await supabase.from("employee_time_entries").insert({
         user_id: user?.id,
         branch_id: currentBranch?.id,
         clock_in: new Date().toISOString(),
         status: "clocked_in",
       });
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["time-entries"] });
       queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
       toast({ title: "Clocked in successfully!" });
     },
     onError: (error: any) => {
       toast({ title: "Error clocking in", description: error.message, variant: "destructive" });
     },
   });
 
   const clockOutMutation = useMutation({
     mutationFn: async () => {
       if (!activeEntry) return;
       const { error } = await supabase
         .from("employee_time_entries")
         .update({
           clock_out: new Date().toISOString(),
           status: "clocked_out",
         })
         .eq("id", activeEntry.id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["time-entries"] });
       queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
       toast({ title: "Clocked out successfully!" });
     },
   });
 
   const startBreakMutation = useMutation({
     mutationFn: async () => {
       if (!activeEntry) return;
       const { error } = await supabase
         .from("employee_time_entries")
         .update({ status: "on_break" })
         .eq("id", activeEntry.id);
       if (error) throw error;
       
       await supabase.from("employee_breaks").insert({
         time_entry_id: activeEntry.id,
         break_start: new Date().toISOString(),
       });
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
       toast({ title: "Break started" });
     },
   });
 
   const endBreakMutation = useMutation({
     mutationFn: async () => {
       if (!activeEntry) return;
       
       const { data: breakData } = await supabase
         .from("employee_breaks")
         .select("*")
         .eq("time_entry_id", activeEntry.id)
         .is("break_end", null)
         .single();
 
       if (breakData) {
         const breakMinutes = differenceInMinutes(new Date(), new Date(breakData.break_start));
         
         await supabase
           .from("employee_breaks")
           .update({ break_end: new Date().toISOString() })
           .eq("id", breakData.id);
 
         await supabase
           .from("employee_time_entries")
           .update({
             status: "clocked_in",
             break_minutes: (activeEntry.break_minutes || 0) + breakMinutes,
           })
           .eq("id", activeEntry.id);
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
       toast({ title: "Break ended" });
     },
   });
 
   const totalHoursThisWeek = entries?.reduce((acc, entry) => acc + (entry.total_hours || 0), 0) || 0;
 
   const getCurrentDuration = () => {
     if (!activeEntry) return "00:00:00";
     const start = new Date(activeEntry.clock_in);
     const now = new Date();
     const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
     const hours = Math.floor(diff / 3600);
     const minutes = Math.floor((diff % 3600) / 60);
     const seconds = diff % 60;
     return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
   };
 
   const statusColors = {
     clocked_in: "bg-green-100 text-green-800",
     clocked_out: "bg-gray-100 text-gray-800",
     on_break: "bg-yellow-100 text-yellow-800",
   };
 
   return (
     <AppLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-bold">Time Tracking</h1>
             <p className="text-muted-foreground">Track your work hours and breaks</p>
           </div>
           <Clock className="h-8 w-8 text-muted-foreground" />
         </div>
 
         <div className="grid md:grid-cols-3 gap-6">
           <Card className="md:col-span-2">
             <CardHeader>
               <CardTitle>Clock In / Out</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="flex flex-col items-center space-y-6">
                 <div className="text-6xl font-mono font-bold text-primary">
                   {activeEntry ? getCurrentDuration() : "00:00:00"}
                 </div>
                 
                 {activeEntry && (
                   <Badge className={statusColors[activeEntry.status]}>
                     {activeEntry.status === "clocked_in" ? "Working" : 
                      activeEntry.status === "on_break" ? "On Break" : "Clocked Out"}
                   </Badge>
                 )}
 
                 <div className="flex gap-4">
                   {!activeEntry ? (
                     <Button size="lg" onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
                       <Play className="h-5 w-5 mr-2" />
                       Clock In
                     </Button>
                   ) : (
                     <>
                       {activeEntry.status === "clocked_in" && (
                         <Button variant="outline" size="lg" onClick={() => startBreakMutation.mutate()}>
                           <Coffee className="h-5 w-5 mr-2" />
                           Start Break
                         </Button>
                       )}
                       {activeEntry.status === "on_break" && (
                         <Button variant="outline" size="lg" onClick={() => endBreakMutation.mutate()}>
                           <Play className="h-5 w-5 mr-2" />
                           End Break
                         </Button>
                       )}
                       <Button variant="destructive" size="lg" onClick={() => clockOutMutation.mutate()}>
                         <Square className="h-5 w-5 mr-2" />
                         Clock Out
                       </Button>
                     </>
                   )}
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Timer className="h-5 w-5" />
                 This Week
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-4xl font-bold text-primary">
                 {totalHoursThisWeek.toFixed(1)}h
               </div>
               <p className="text-muted-foreground">Total hours worked</p>
               <div className="mt-4 text-sm text-muted-foreground">
                 <Calendar className="h-4 w-4 inline mr-1" />
                 {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "MMM dd")} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), "MMM dd")}
               </div>
             </CardContent>
           </Card>
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle>Recent Time Entries</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Date</TableHead>
                   <TableHead>Clock In</TableHead>
                   <TableHead>Clock Out</TableHead>
                   <TableHead>Break</TableHead>
                   <TableHead>Total Hours</TableHead>
                   <TableHead>Status</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {isLoading ? (
                   Array.from({ length: 3 }).map((_, i) => (
                     <TableRow key={i}>
                       <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                       <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                       <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                     </TableRow>
                   ))
                 ) : entries?.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                       No time entries this week
                     </TableCell>
                   </TableRow>
                 ) : (
                   entries?.map((entry) => (
                     <TableRow key={entry.id}>
                       <TableCell>{format(new Date(entry.clock_in), "EEE, MMM dd")}</TableCell>
                       <TableCell>{format(new Date(entry.clock_in), "HH:mm")}</TableCell>
                       <TableCell>
                         {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : "-"}
                       </TableCell>
                       <TableCell>{entry.break_minutes}m</TableCell>
                       <TableCell className="font-semibold">
                         {entry.total_hours ? `${entry.total_hours}h` : "-"}
                       </TableCell>
                       <TableCell>
                         <Badge className={statusColors[entry.status]}>{entry.status.replace("_", " ")}</Badge>
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