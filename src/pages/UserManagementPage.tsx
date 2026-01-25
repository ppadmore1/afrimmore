import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Shield, 
  Building2,
  MoreHorizontal,
  UserCog,
  Loader2,
  Mail,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useBranch, Branch } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'staff' | 'cashier';
}

interface UserBranch {
  user_id: string;
  branch_id: string;
  is_default: boolean;
}

interface UserWithDetails extends UserProfile {
  role?: 'admin' | 'staff' | 'cashier';
  branches: string[];
  defaultBranchId?: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  staff: { label: "Staff", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  cashier: { label: "Cashier", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

export default function UserManagementPage() {
  const { branches, isAdmin } = useBranch();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState<string>("");
  const [saving, setSaving] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  async function loadUsers() {
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get all user branches
      const { data: userBranches, error: branchesError } = await supabase
        .from('user_branches')
        .select('user_id, branch_id, is_default');

      if (branchesError) throw branchesError;

      // Combine data
      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const userBranchAssignments = userBranches?.filter(ub => ub.user_id === profile.id) || [];
        const defaultBranchAssignment = userBranchAssignments.find(ub => ub.is_default);

        return {
          ...profile,
          role: userRole?.role as 'admin' | 'staff' | 'cashier' | undefined,
          branches: userBranchAssignments.map(ub => ub.branch_id),
          defaultBranchId: defaultBranchAssignment?.branch_id,
        };
      });

      setUsers(usersWithDetails);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({ title: "Error loading users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openEditDialog(user: UserWithDetails) {
    setEditingUser(user);
    setSelectedRole(user.role || "staff");
    setSelectedBranches(user.branches);
    setDefaultBranch(user.defaultBranchId || "");
    setEditDialogOpen(true);
  }

  function toggleBranch(branchId: string) {
    setSelectedBranches(prev => {
      if (prev.includes(branchId)) {
        // Remove branch
        const newBranches = prev.filter(id => id !== branchId);
        // If removing default branch, clear default
        if (defaultBranch === branchId) {
          setDefaultBranch(newBranches[0] || "");
        }
        return newBranches;
      } else {
        // Add branch
        const newBranches = [...prev, branchId];
        // If first branch, set as default
        if (newBranches.length === 1) {
          setDefaultBranch(branchId);
        }
        return newBranches;
      }
    });
  }

  async function handleSave() {
    if (!editingUser) return;

    setSaving(true);

    try {
      // Update user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: editingUser.id,
          role: selectedRole as 'admin' | 'staff' | 'cashier',
        }, {
          onConflict: 'user_id',
        });

      if (roleError) throw roleError;

      // Delete existing branch assignments
      const { error: deleteError } = await supabase
        .from('user_branches')
        .delete()
        .eq('user_id', editingUser.id);

      if (deleteError) throw deleteError;

      // Insert new branch assignments
      if (selectedBranches.length > 0) {
        const branchAssignments = selectedBranches.map(branchId => ({
          user_id: editingUser.id,
          branch_id: branchId,
          is_default: branchId === defaultBranch,
        }));

        const { error: insertError } = await supabase
          .from('user_branches')
          .insert(branchAssignments);

        if (insertError) throw insertError;
      }

      toast({ title: "User updated successfully" });
      setEditDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({ 
        title: "Error updating user", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(user: UserWithDetails) {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!userToDelete) return;

    // Prevent self-deletion
    if (userToDelete.id === currentUser?.id) {
      toast({ 
        title: "Cannot delete yourself", 
        description: "You cannot remove your own account.",
        variant: "destructive" 
      });
      setDeleteDialogOpen(false);
      return;
    }

    setDeleting(true);

    try {
      // Delete user branches
      const { error: branchesError } = await supabase
        .from('user_branches')
        .delete()
        .eq('user_id', userToDelete.id);

      if (branchesError) throw branchesError;

      // Delete user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToDelete.id);

      if (roleError) throw roleError;

      toast({ title: "User access removed successfully" });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast({ 
        title: "Error removing user", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setDeleting(false);
    }
  }

  const filteredUsers = users.filter(user =>
    (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Shield className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only administrators can manage users.</p>
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
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage user roles and branch assignments</p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff</p>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'staff').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
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
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {users.length === 0 ? "No users found" : "No matching users"}
              </h3>
              <p className="text-muted-foreground">
                {users.length === 0 
                  ? "Users will appear here when they sign up" 
                  : "Try adjusting your search"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {user.full_name || "Unnamed User"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => openEditDialog(user)} className="cursor-pointer">
                          <UserCog className="w-4 h-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(user)} 
                          className="cursor-pointer text-destructive focus:text-destructive"
                          disabled={user.id === currentUser?.id}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove Access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 space-y-3">
                    {/* Role */}
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      {user.role ? (
                        <Badge className={roleLabels[user.role]?.color}>
                          {roleLabels[user.role]?.label}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No role assigned</span>
                      )}
                    </div>

                    {/* Branches */}
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                      {user.branches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.branches.map(branchId => {
                            const branch = branches.find(b => b.id === branchId);
                            const isDefault = branchId === user.defaultBranchId;
                            return branch ? (
                              <Badge 
                                key={branchId} 
                                variant={isDefault ? "default" : "outline"}
                                className="text-xs"
                              >
                                {branch.code}
                                {isDefault && " ★"}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No branches assigned</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            
            {editingUser && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {editingUser.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium">{editingUser.full_name || "Unnamed User"}</p>
                    <p className="text-sm text-muted-foreground">{editingUser.email}</p>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="admin">Admin - Full access to all features</SelectItem>
                      <SelectItem value="staff">Staff - Access to assigned branches</SelectItem>
                      <SelectItem value="cashier">Cashier - POS access only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Branch Assignments */}
                {selectedRole !== 'admin' && (
                  <div className="space-y-3">
                    <Label>Branch Access</Label>
                    <div className="border rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto">
                      {branches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No branches available</p>
                      ) : (
                        branches.map(branch => (
                          <div key={branch.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`branch-${branch.id}`}
                                checked={selectedBranches.includes(branch.id)}
                                onCheckedChange={() => toggleBranch(branch.id)}
                              />
                              <label 
                                htmlFor={`branch-${branch.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {branch.name}
                                <span className="text-muted-foreground ml-2">({branch.code})</span>
                              </label>
                            </div>
                            {selectedBranches.includes(branch.id) && (
                              <Button
                                variant={defaultBranch === branch.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDefaultBranch(branch.id)}
                              >
                                {defaultBranch === branch.id ? "Default" : "Set Default"}
                              </Button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {selectedRole !== 'admin' && selectedBranches.length === 0 && (
                      <p className="text-sm text-orange-600">
                        ⚠️ User won't have access to any branch data
                      </p>
                    )}
                  </div>
                )}

                {selectedRole === 'admin' && (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    ℹ️ Admins automatically have access to all branches
                  </p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User Access</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove access for{" "}
                <span className="font-semibold">{userToDelete?.full_name || userToDelete?.email}</span>?
                <br /><br />
                This will remove their role and all branch assignments. They will no longer be able to access the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove Access"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AppLayout>
  );
}
