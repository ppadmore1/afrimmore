import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Edit2, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Branch { id: string; name: string; }
interface Location {
  id: string; branch_id: string; name: string; code: string;
  zone: string | null; aisle: string | null; shelf: string | null;
  bin: string | null; description: string | null; is_active: boolean;
}

export default function WarehouseLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [filterBranch, setFilterBranch] = useState("all");
  const [saving, setSaving] = useState(false);

  // Form
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [zone, setZone] = useState("");
  const [aisle, setAisle] = useState("");
  const [shelf, setShelf] = useState("");
  const [bin, setBin] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: l }, { data: b }] = await Promise.all([
      supabase.from("warehouse_locations").select("*").order("branch_id, zone, aisle, shelf, bin"),
      supabase.from("branches").select("id, name").eq("is_active", true),
    ]);
    setLocations((l as Location[]) || []);
    setBranches((b as Branch[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setBranchId(""); setName(""); setCode(""); setZone(""); setAisle(""); setShelf(""); setBin(""); setDescription("");
    setDialogOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc); setBranchId(loc.branch_id); setName(loc.name); setCode(loc.code);
    setZone(loc.zone || ""); setAisle(loc.aisle || ""); setShelf(loc.shelf || ""); setBin(loc.bin || ""); setDescription(loc.description || "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!branchId || !name || !code) { toast.error("Branch, name, and code are required"); return; }
    setSaving(true);
    try {
      const data = {
        branch_id: branchId, name, code, zone: zone || null, aisle: aisle || null,
        shelf: shelf || null, bin: bin || null, description: description || null, is_active: true,
      };
      if (editing) {
        const { error } = await supabase.from("warehouse_locations").update(data).eq("id", editing.id);
        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase.from("warehouse_locations").insert(data);
        if (error) throw error;
        toast.success("Location created");
      }
      setDialogOpen(false);
      loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function handleDelete(loc: Location) {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    const { error } = await supabase.from("warehouse_locations").delete().eq("id", loc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Location deleted");
    loadData();
  }

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || "Unknown";
  const filtered = filterBranch === "all" ? locations : locations.filter(l => l.branch_id === filterBranch);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="w-8 h-8" /> Warehouse Locations
            </h1>
            <p className="text-muted-foreground mt-1">Manage shelf, bin, and zone locations per branch</p>
          </div>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> New Location</Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {branches.map(b => {
            const count = locations.filter(l => l.branch_id === b.id).length;
            return (
              <Card key={b.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterBranch(b.id)}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">{b.name}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Aisle</TableHead>
                  <TableHead>Shelf</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No locations found</TableCell></TableRow>
                ) : filtered.map(loc => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-mono font-medium">{loc.code}</TableCell>
                    <TableCell>{loc.name}</TableCell>
                    <TableCell>{getBranchName(loc.branch_id)}</TableCell>
                    <TableCell>{loc.zone || "-"}</TableCell>
                    <TableCell>{loc.aisle || "-"}</TableCell>
                    <TableCell>{loc.shelf || "-"}</TableCell>
                    <TableCell>{loc.bin || "-"}</TableCell>
                    <TableCell>{loc.is_active ? <Badge className="bg-emerald-600 text-white">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(loc)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Location" : "New Location"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch *</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent className="bg-popover">{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g., A-01-03" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Main Aisle Shelf 3" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>Zone</Label><Input value={zone} onChange={e => setZone(e.target.value)} placeholder="A" /></div>
                <div className="space-y-2"><Label>Aisle</Label><Input value={aisle} onChange={e => setAisle(e.target.value)} placeholder="01" /></div>
                <div className="space-y-2"><Label>Shelf</Label><Input value={shelf} onChange={e => setShelf(e.target.value)} placeholder="03" /></div>
                <div className="space-y-2"><Label>Bin</Label><Input value={bin} onChange={e => setBin(e.target.value)} placeholder="B" /></div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
}
