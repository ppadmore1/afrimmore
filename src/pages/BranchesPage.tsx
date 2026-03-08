import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Building2, 
  Edit, 
  Trash2,
  Users,
  MapPin,
  Phone,
  Mail,
  MoreHorizontal,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useBranch, Branch } from "@/contexts/BranchContext";
import { toast } from "@/hooks/use-toast";

interface BranchFormData {
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  is_active: boolean;
}

const emptyFormData: BranchFormData = {
  name: "",
  code: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  is_active: true,
};

export default function BranchesPage() {
  const { branches, isAdmin, refreshBranches } = useBranch();
  const [loading, setLoading] = useState(true);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  async function loadBranches() {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setAllBranches(data || []);
    } catch (error) {
      console.error("Error loading branches:", error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingBranch(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(branch: Branch) {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || "",
      city: branch.city || "",
      phone: branch.phone || "",
      email: branch.email || "",
      is_active: branch.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim()) {
      toast({ title: "Name and code are required", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const branchData = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        is_active: formData.is_active,
      };

      if (editingBranch) {
        const { error } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', editingBranch.id);

        if (error) throw error;
        toast({ title: "Branch updated successfully" });
      } else {
        const { error } = await supabase
          .from('branches')
          .insert(branchData);

        if (error) throw error;
        toast({ title: "Branch created successfully" });
      }

      setDialogOpen(false);
      loadBranches();
      refreshBranches();
    } catch (error: any) {
      console.error("Error saving branch:", error);
      toast({ 
        title: "Error saving branch", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(branch: Branch) {
    if (!confirm(`Are you sure you want to delete "${branch.name}"?`)) return;

    try {
      const { error } = await supabase.rpc('safe_delete_branch', { p_branch_id: branch.id });

      if (error) throw error;
      toast({ title: "Branch deleted successfully" });
      loadBranches();
      refreshBranches();
    } catch (error: any) {
      console.error("Error deleting branch:", error);
      toast({ 
        title: "Error deleting branch", 
        description: error.message,
        variant: "destructive" 
      });
    }
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can manage branches.</p>
        </div>
      </AppLayout>
    );
  }

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
            <h1 className="text-3xl font-bold text-foreground">Branches</h1>
            <p className="text-muted-foreground mt-1">Manage your business locations</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={openCreateDialog}>
                <Plus className="w-4 h-4" />
                Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingBranch ? "Edit Branch" : "New Branch"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Branch name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="MAIN"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="branch@example.com"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <Label htmlFor="is_active">Active Branch</Label>
                    <p className="text-sm text-muted-foreground">
                      Inactive branches won't appear in selection
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingBranch ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Branches Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-12 w-12 bg-muted rounded-lg mb-4" />
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allBranches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No branches yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first branch to get started
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Branch
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allBranches.map((branch) => (
              <Card key={branch.id} className="group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{branch.name}</h3>
                        <Badge variant="outline" className="font-mono">
                          {branch.code}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => openEditDialog(branch)} className="cursor-pointer">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(branch)}
                          className="text-destructive cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {branch.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{branch.city}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{branch.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
