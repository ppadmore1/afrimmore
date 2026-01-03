import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer, addCustomer, updateCustomer } from "@/lib/supabase-db";
import { toast } from "@/hooks/use-toast";

export default function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isEditing && id) {
      loadCustomer(id);
    }
  }, [id, isEditing]);

  async function loadCustomer(customerId: string) {
    try {
      const customer = await getCustomer(customerId);
      if (customer) {
        setName(customer.name);
        setEmail(customer.email || "");
        setPhone(customer.phone || "");
        setAddress(customer.address || "");
        setCity(customer.city || "");
        setCountry(customer.country || "");
        setTaxId(customer.tax_id || "");
        setNotes(customer.notes || "");
      }
    } catch (error) {
      console.error("Error loading customer:", error);
      toast({ title: "Error loading customer", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Please enter a customer name", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const customerData = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        tax_id: taxId.trim() || null,
        notes: notes.trim() || null,
      };

      if (isEditing && id) {
        await updateCustomer(id, customerData);
        toast({ title: "Customer updated successfully" });
      } else {
        await addCustomer(customerData);
        toast({ title: "Customer created successfully" });
      }

      navigate("/customers");
    } catch (error) {
      console.error("Error saving customer:", error);
      toast({ title: "Error saving customer", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditing ? "Edit Customer" : "New Customer"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEditing ? "Update customer information" : "Add a new customer to your database"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer or company name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                <Input
                  id="taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Tax identification number"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this customer"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : isEditing ? "Update Customer" : "Create Customer"}
            </Button>
          </div>
        </form>
      </motion.div>
    </AppLayout>
  );
}
