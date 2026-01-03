import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Upload, Palette, Type, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  header_text: string | null;
  footer_text: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  currency_symbol: string;
  currency_code: string;
  date_format: string;
}

const fontOptions = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times-Roman', label: 'Times New Roman' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Arial', label: 'Arial' },
];

const dateFormatOptions = [
  { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY' },
  { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY' },
  { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD' },
  { value: 'MMMM d, yyyy', label: 'Month D, YYYY' },
];

const currencyOptions = [
  { symbol: '$', code: 'USD', label: 'US Dollar ($)' },
  { symbol: '€', code: 'EUR', label: 'Euro (€)' },
  { symbol: '£', code: 'GBP', label: 'British Pound (£)' },
  { symbol: '₦', code: 'NGN', label: 'Nigerian Naira (₦)' },
  { symbol: '¥', code: 'JPY', label: 'Japanese Yen (¥)' },
  { symbol: '₹', code: 'INR', label: 'Indian Rupee (₹)' },
];

export default function CompanySettingsPage() {
  const { currentBranch, isAdmin } = useBranch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>({
    id: '',
    company_name: '',
    logo_url: null,
    address: null,
    city: null,
    country: null,
    phone: null,
    email: null,
    website: null,
    tax_id: null,
    header_text: null,
    footer_text: null,
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF',
    font_family: 'Helvetica',
    currency_symbol: '$',
    currency_code: 'USD',
    date_format: 'MM/dd/yyyy',
  });

  useEffect(() => {
    loadSettings();
  }, [currentBranch]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('company_settings')
        .select('*');

      if (currentBranch) {
        query = query.eq('branch_id', currentBranch.id);
      } else {
        query = query.is('branch_id', null);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data as CompanySettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Only admins can update settings');
      return;
    }

    setSaving(true);
    try {
      const settingsData = {
        ...settings,
        branch_id: currentBranch?.id || null,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert(settingsData)
          .select()
          .single();
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = (code: string) => {
    const currency = currencyOptions.find(c => c.code === code);
    if (currency) {
      setSettings(prev => ({
        ...prev,
        currency_code: currency.code,
        currency_symbol: currency.symbol,
      }));
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Company Settings</h1>
            <p className="text-muted-foreground">
              Customize your document templates and branding
              {currentBranch && ` for ${currentBranch.name}`}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList>
            <TabsTrigger value="company">
              <Building2 className="w-4 h-4 mr-2" />
              Company Info
            </TabsTrigger>
            <TabsTrigger value="branding">
              <Palette className="w-4 h-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="documents">
              <Type className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Basic information that appears on all documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={settings.company_name}
                      onChange={(e) => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax ID / VAT Number</Label>
                    <Input
                      value={settings.tax_id || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, tax_id: e.target.value }))}
                      placeholder="Tax identification number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={settings.address || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Street address"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={settings.city || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={settings.country || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={settings.phone || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={settings.email || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={settings.website || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="www.company.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
                <CardDescription>
                  Your company logo for documents and branding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="Company logo"
                      className="w-32 h-32 object-contain border rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Logo URL</Label>
                    <Input
                      value={settings.logo_url || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, logo_url: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter a URL to your logo image (PNG, JPG, or SVG recommended)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
                <CardDescription>
                  Brand colors used in document headers and accents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={settings.primary_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={settings.primary_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={settings.secondary_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, secondary_color: e.target.value }))}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={settings.secondary_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, secondary_color: e.target.value }))}
                        placeholder="#1E40AF"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: settings.primary_color }}>
                  <p className="text-white font-medium">Preview Header</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Formatting</CardTitle>
                <CardDescription>
                  Default settings for generated documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select
                      value={settings.font_family}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, font_family: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={settings.currency_code}
                      onValueChange={handleCurrencyChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyOptions.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select
                      value={settings.date_format}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, date_format: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dateFormatOptions.map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            {format.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Text</CardTitle>
                <CardDescription>
                  Text that appears on your documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Header Text</Label>
                  <Textarea
                    value={settings.header_text || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, header_text: e.target.value }))}
                    placeholder="Text that appears at the top of documents (e.g., tagline, registration info)"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Footer Text</Label>
                  <Textarea
                    value={settings.footer_text || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, footer_text: e.target.value }))}
                    placeholder="Text that appears at the bottom of documents (e.g., thank you message, terms)"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
}
