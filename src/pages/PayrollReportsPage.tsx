 import { useState, useEffect } from "react";
 import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, eachDayOfInterval } from "date-fns";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { Skeleton } from "@/components/ui/skeleton";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { Download, Clock, DollarSign, Users, Calendar } from "lucide-react";
 
 type DateRange = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";
 
 interface EmployeePayrollData {
   userId: string;
   employeeName: string;
   email: string;
   totalHours: number;
   regularHours: number;
   overtimeHours: number;
   totalBreakMinutes: number;
   daysWorked: number;
   regularPay: number;
   overtimePay: number;
   totalPay: number;
 }
 
 interface TimeEntry {
   id: string;
   user_id: string;
   clock_in: string;
   clock_out: string | null;
   break_minutes: number | null;
   total_hours: number | null;
   status: string;
 }
 
 export default function PayrollReportsPage() {
   const { toast } = useToast();
   const [loading, setLoading] = useState(true);
   const [dateRange, setDateRange] = useState<DateRange>("thisWeek");
   const [customStartDate, setCustomStartDate] = useState("");
   const [customEndDate, setCustomEndDate] = useState("");
   const [hourlyRate, setHourlyRate] = useState(15);
   const [overtimeRate, setOvertimeRate] = useState(1.5);
   const [overtimeThreshold, setOvertimeThreshold] = useState(40);
   const [payrollData, setPayrollData] = useState<EmployeePayrollData[]>([]);
   const [profiles, setProfiles] = useState<Record<string, { full_name: string; email: string }>>({});
 
   useEffect(() => {
     loadPayrollData();
   }, [dateRange, customStartDate, customEndDate]);
 
   const getDateRangeBounds = () => {
     const now = new Date();
     switch (dateRange) {
       case "thisWeek":
         return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
       case "lastWeek":
         const lastWeek = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
         return { start: lastWeek, end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
       case "thisMonth":
         return { start: startOfMonth(now), end: endOfMonth(now) };
       case "lastMonth":
         const lastMonth = subDays(startOfMonth(now), 1);
         return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
       case "custom":
         return {
           start: customStartDate ? new Date(customStartDate) : subDays(now, 7),
           end: customEndDate ? new Date(customEndDate) : now,
         };
       default:
         return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
     }
   };
 
   async function loadPayrollData() {
     try {
       setLoading(true);
       const { start, end } = getDateRangeBounds();
 
       // Fetch time entries within the date range
       const { data: timeEntries, error: timeError } = await supabase
         .from("employee_time_entries")
         .select("*")
         .gte("clock_in", start.toISOString())
         .lte("clock_in", end.toISOString())
         .eq("status", "clocked_out");
 
       if (timeError) throw timeError;
 
       // Fetch profiles for employee names
       const { data: profilesData, error: profilesError } = await supabase
         .from("profiles")
         .select("id, full_name, email");
 
       if (profilesError) throw profilesError;
 
       // Create profiles lookup
       const profilesMap: Record<string, { full_name: string; email: string }> = {};
       profilesData?.forEach((p) => {
         profilesMap[p.id] = { full_name: p.full_name || "Unknown", email: p.email || "" };
       });
       setProfiles(profilesMap);
 
       // Process time entries by employee
       const employeeMap = new Map<string, {
         totalHours: number;
         totalBreakMinutes: number;
         daysWorked: Set<string>;
       }>();
 
       (timeEntries as TimeEntry[] || []).forEach((entry) => {
         const existing = employeeMap.get(entry.user_id) || {
           totalHours: 0,
           totalBreakMinutes: 0,
           daysWorked: new Set<string>(),
         };
 
         existing.totalHours += entry.total_hours || 0;
         existing.totalBreakMinutes += entry.break_minutes || 0;
         existing.daysWorked.add(format(new Date(entry.clock_in), "yyyy-MM-dd"));
 
         employeeMap.set(entry.user_id, existing);
       });
 
       // Calculate payroll for each employee
       const payroll: EmployeePayrollData[] = [];
       employeeMap.forEach((data, userId) => {
         const profile = profilesMap[userId];
         const regularHours = Math.min(data.totalHours, overtimeThreshold);
         const overtimeHours = Math.max(0, data.totalHours - overtimeThreshold);
         const regularPay = regularHours * hourlyRate;
         const overtimePay = overtimeHours * hourlyRate * overtimeRate;
 
         payroll.push({
           userId,
           employeeName: profile?.full_name || "Unknown Employee",
           email: profile?.email || "",
           totalHours: data.totalHours,
           regularHours,
           overtimeHours,
           totalBreakMinutes: data.totalBreakMinutes,
           daysWorked: data.daysWorked.size,
           regularPay,
           overtimePay,
           totalPay: regularPay + overtimePay,
         });
       });
 
       // Sort by total hours descending
       payroll.sort((a, b) => b.totalHours - a.totalHours);
       setPayrollData(payroll);
     } catch (error) {
       console.error("Failed to load payroll data:", error);
       toast({
         title: "Error",
         description: "Failed to load payroll data",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   }
 
   const recalculatePayroll = () => {
     const updatedPayroll = payrollData.map((emp) => {
       const regularHours = Math.min(emp.totalHours, overtimeThreshold);
       const overtimeHours = Math.max(0, emp.totalHours - overtimeThreshold);
       const regularPay = regularHours * hourlyRate;
       const overtimePay = overtimeHours * hourlyRate * overtimeRate;
 
       return {
         ...emp,
         regularHours,
         overtimeHours,
         regularPay,
         overtimePay,
         totalPay: regularPay + overtimePay,
       };
     });
     setPayrollData(updatedPayroll);
   };
 
   const exportToCSV = () => {
     if (payrollData.length === 0) {
       toast({ title: "No data to export", variant: "destructive" });
       return;
     }
 
     const { start, end } = getDateRangeBounds();
     const headers = [
       "Employee Name",
       "Email",
       "Days Worked",
       "Total Hours",
       "Regular Hours",
       "Overtime Hours",
       "Break Minutes",
       "Regular Pay",
       "Overtime Pay",
       "Total Pay",
     ];
 
     const rows = payrollData.map((emp) => [
       emp.employeeName,
       emp.email,
       emp.daysWorked,
       emp.totalHours.toFixed(2),
       emp.regularHours.toFixed(2),
       emp.overtimeHours.toFixed(2),
       emp.totalBreakMinutes,
       emp.regularPay.toFixed(2),
       emp.overtimePay.toFixed(2),
       emp.totalPay.toFixed(2),
     ]);
 
     const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `payroll_report_${format(start, "yyyy-MM-dd")}_to_${format(end, "yyyy-MM-dd")}.csv`;
     link.click();
 
     toast({ title: "Export successful", description: "Payroll report downloaded" });
   };
 
   // Summary calculations
   const totalEmployees = payrollData.length;
   const totalHoursWorked = payrollData.reduce((sum, emp) => sum + emp.totalHours, 0);
   const totalPayroll = payrollData.reduce((sum, emp) => sum + emp.totalPay, 0);
   const totalOvertimeHours = payrollData.reduce((sum, emp) => sum + emp.overtimeHours, 0);
 
   const { start, end } = getDateRangeBounds();
 
   return (
     <AppLayout>
       <div className="space-y-6">
         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
           <div>
             <h1 className="text-3xl font-bold tracking-tight">Payroll Reports</h1>
             <p className="text-muted-foreground">
               Employee time tracking and payroll calculations
             </p>
           </div>
           <Button onClick={exportToCSV} disabled={loading || payrollData.length === 0}>
             <Download className="h-4 w-4 mr-2" />
             Export CSV
           </Button>
         </div>
 
         {/* Filters & Settings */}
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-sm font-medium">Date Range</CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
               <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="thisWeek">This Week</SelectItem>
                   <SelectItem value="lastWeek">Last Week</SelectItem>
                   <SelectItem value="thisMonth">This Month</SelectItem>
                   <SelectItem value="lastMonth">Last Month</SelectItem>
                   <SelectItem value="custom">Custom Range</SelectItem>
                 </SelectContent>
               </Select>
               {dateRange === "custom" && (
                 <div className="space-y-2">
                   <Input
                     type="date"
                     value={customStartDate}
                     onChange={(e) => setCustomStartDate(e.target.value)}
                   />
                   <Input
                     type="date"
                     value={customEndDate}
                     onChange={(e) => setCustomEndDate(e.target.value)}
                   />
                 </div>
               )}
               <p className="text-xs text-muted-foreground">
                 {format(start, "MMM d, yyyy")} - {format(end, "MMM d, yyyy")}
               </p>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-sm font-medium">Hourly Rate</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="flex items-center gap-2">
                 <span className="text-muted-foreground">$</span>
                 <Input
                   type="number"
                   min={0}
                   step={0.5}
                   value={hourlyRate}
                   onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                   className="w-24"
                 />
                 <span className="text-muted-foreground text-sm">/hr</span>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-sm font-medium">Overtime Settings</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
               <div className="flex items-center gap-2">
                 <Label className="text-xs w-16">After</Label>
                 <Input
                   type="number"
                   min={0}
                   value={overtimeThreshold}
                   onChange={(e) => setOvertimeThreshold(parseFloat(e.target.value) || 40)}
                   className="w-16"
                 />
                 <span className="text-xs text-muted-foreground">hrs</span>
               </div>
               <div className="flex items-center gap-2">
                 <Label className="text-xs w-16">Rate</Label>
                 <Input
                   type="number"
                   min={1}
                   step={0.1}
                   value={overtimeRate}
                   onChange={(e) => setOvertimeRate(parseFloat(e.target.value) || 1.5)}
                   className="w-16"
                 />
                 <span className="text-xs text-muted-foreground">x</span>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-sm font-medium">Actions</CardTitle>
             </CardHeader>
             <CardContent>
               <Button onClick={recalculatePayroll} variant="outline" className="w-full">
                 Recalculate
               </Button>
             </CardContent>
           </Card>
         </div>
 
         {/* Summary Cards */}
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
               <Users className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               {loading ? (
                 <Skeleton className="h-8 w-16" />
               ) : (
                 <div className="text-2xl font-bold">{totalEmployees}</div>
               )}
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
               <Clock className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               {loading ? (
                 <Skeleton className="h-8 w-20" />
               ) : (
                 <>
                   <div className="text-2xl font-bold">{totalHoursWorked.toFixed(1)}</div>
                   <p className="text-xs text-muted-foreground">
                     {totalOvertimeHours.toFixed(1)} overtime
                   </p>
                 </>
               )}
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
               <DollarSign className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               {loading ? (
                 <Skeleton className="h-8 w-24" />
               ) : (
                 <div className="text-2xl font-bold">${totalPayroll.toFixed(2)}</div>
               )}
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Avg Per Employee</CardTitle>
               <Calendar className="h-4 w-4 text-muted-foreground" />
             </CardHeader>
             <CardContent>
               {loading ? (
                 <Skeleton className="h-8 w-24" />
               ) : (
                 <div className="text-2xl font-bold">
                   ${totalEmployees > 0 ? (totalPayroll / totalEmployees).toFixed(2) : "0.00"}
                 </div>
               )}
             </CardContent>
           </Card>
         </div>
 
         {/* Payroll Table */}
         <Card>
           <CardHeader>
             <CardTitle>Employee Payroll Details</CardTitle>
             <CardDescription>
               Breakdown of hours worked and calculated pay for each employee
             </CardDescription>
           </CardHeader>
           <CardContent>
             {loading ? (
               <div className="space-y-3">
                 {[...Array(5)].map((_, i) => (
                   <Skeleton key={i} className="h-12 w-full" />
                 ))}
               </div>
             ) : payrollData.length === 0 ? (
               <div className="text-center py-10 text-muted-foreground">
                 No time entries found for the selected period
               </div>
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Employee</TableHead>
                     <TableHead className="text-right">Days</TableHead>
                     <TableHead className="text-right">Total Hours</TableHead>
                     <TableHead className="text-right">Regular</TableHead>
                     <TableHead className="text-right">Overtime</TableHead>
                     <TableHead className="text-right">Regular Pay</TableHead>
                     <TableHead className="text-right">OT Pay</TableHead>
                     <TableHead className="text-right">Total Pay</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {payrollData.map((emp) => (
                     <TableRow key={emp.userId}>
                       <TableCell>
                         <div>
                           <div className="font-medium">{emp.employeeName}</div>
                           <div className="text-xs text-muted-foreground">{emp.email}</div>
                         </div>
                       </TableCell>
                       <TableCell className="text-right">{emp.daysWorked}</TableCell>
                       <TableCell className="text-right font-medium">
                         {emp.totalHours.toFixed(2)}
                       </TableCell>
                       <TableCell className="text-right">{emp.regularHours.toFixed(2)}</TableCell>
                       <TableCell className="text-right">
                         {emp.overtimeHours > 0 ? (
                           <Badge variant="secondary">{emp.overtimeHours.toFixed(2)}</Badge>
                         ) : (
                           "0.00"
                         )}
                       </TableCell>
                       <TableCell className="text-right">${emp.regularPay.toFixed(2)}</TableCell>
                       <TableCell className="text-right">
                         {emp.overtimePay > 0 ? (
                           <span className="text-primary">${emp.overtimePay.toFixed(2)}</span>
                         ) : (
                           "$0.00"
                         )}
                       </TableCell>
                       <TableCell className="text-right font-bold">
                         ${emp.totalPay.toFixed(2)}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 }