import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Users, 
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Phone,
  Eye,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  getAllCustomerBalances, 
  deleteCustomer, 
  type CustomerBalance 
} from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";

export default function CustomersPage() {
  const [customerBalances, setCustomerBalances] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await getAllCustomerBalances();
      setCustomerBalances(data.sort((a, b) => a.customer.name.localeCompare(b.customer.name)));
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this customer?")) {
      try {
        await deleteCustomer(id);
        setCustomerBalances(customerBalances.filter(c => c.customer.id !== id));
        toast({ title: "Customer deleted successfully" });
      } catch (error) {
        toast({ title: "Error deleting customer", variant: "destructive" });
      }
    }
  }

  const filteredCustomers = customerBalances.filter(cb =>
    cb.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cb.customer.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const customersWithBalance = filteredCustomers.filter(cb => cb.outstandingBalance > 0);
  const totalOutstanding = filteredCustomers.reduce((sum, cb) => sum + cb.outstandingBalance, 0);

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground mt-1">Manage your customer database</p>
          </div>
          <Link to="/customers/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </Link>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{customerBalances.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className={customersWithBalance.length > 0 ? "border-orange-500/50" : ""}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">With Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">{customersWithBalance.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-12 w-12 bg-muted rounded-full mb-4" />
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {customerBalances.length === 0 ? "No customers yet" : "No matching customers"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {customerBalances.length === 0 
                  ? "Add your first customer to get started" 
                  : "Try adjusting your search"}
              </p>
              {customerBalances.length === 0 && (
                <Link to="/customers/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Customer
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((cb) => (
              <Link key={cb.customer.id} to={`/customers/${cb.customer.id}`}>
                <Card className="group hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {cb.customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{cb.customer.name}</h3>
                          {cb.customer.email && (
                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {cb.customer.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem asChild>
                            <Link to={`/customers/${cb.customer.id}`} className="cursor-pointer">
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/customers/${cb.customer.id}/edit`} className="cursor-pointer">
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => handleDelete(cb.customer.id, e as unknown as React.MouseEvent)}
                            className="text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {cb.customer.phone && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {cb.customer.phone}
                      </div>
                    )}

                    {/* Balance Info */}
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{cb.invoiceCount} invoices</span>
                      </div>
                      {cb.outstandingBalance > 0 ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {cb.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} due
                        </Badge>
                      ) : cb.totalPaid > 0 ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          All paid
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
