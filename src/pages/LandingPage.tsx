import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Store, ShoppingCart, Package, FileText, BarChart3, Building2, 
  Users, Shield, Check, ArrowRight, Zap, Globe, Clock, Star,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_branches: number;
  max_products: number | null;
  features: string[];
  sort_order: number;
}

const heroFeatures = [
  { icon: ShoppingCart, title: 'Point of Sale', desc: 'Fast, reliable POS with barcode scanning & receipt printing' },
  { icon: Package, title: 'Inventory Management', desc: 'Multi-branch stock tracking, transfers & reorder alerts' },
  { icon: FileText, title: 'Invoicing & Billing', desc: 'Professional invoices, quotations & delivery notes' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Real-time dashboards, financial statements & aging reports' },
  { icon: Building2, title: 'Multi-Branch', desc: 'Manage branches independently with centralized control' },
  { icon: Shield, title: 'Secure & Reliable', desc: 'Role-based access, audit logs & data isolation per tenant' },
];

const testimonials = [
  { name: 'Sarah K.', role: 'Retail Owner', text: 'POSFlow transformed how we manage our 3 stores. Stock transfers are seamless.' },
  { name: 'James M.', role: 'Finance Manager', text: 'The invoicing and financial reporting saves us hours every week.' },
  { name: 'Aisha N.', role: 'Operations Lead', text: 'Finally a system that handles multi-branch inventory properly.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setPlans(data.map(p => ({ ...p, features: (p.features as any) || [] })) as Plan[]);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">POSFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Sign In</Button>
            <Button size="sm" onClick={() => navigate('/auth?mode=signup')}>
              Start Free Trial <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-1">
              <Zap className="w-3 h-3 mr-1" /> 14-day free trial — no credit card required
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              All-in-one business management for{' '}
              <span className="text-primary">growing companies</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              POS, inventory, invoicing, multi-branch management, and financial reporting — 
              everything you need to run your business, in one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base h-12 px-8" onClick={() => navigate('/auth?mode=signup')}>
                Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="text-base h-12 px-8" onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                See Features
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything you need to run your business
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From point of sale to financial statements, POSFlow covers the full spectrum of business operations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {heroFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow border-border/50">
                  <CardContent className="pt-6">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-sm">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Start free, upgrade as you grow. No hidden fees.
            </p>
            <div className="inline-flex items-center gap-2 bg-muted rounded-full p-1">
              <button
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setBilling('monthly')}
              >Monthly</button>
              <button
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billing === 'yearly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setBilling('yearly')}
              >
                Yearly <Badge variant="secondary" className="ml-1 text-xs">Save 20%</Badge>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => {
              const price = billing === 'monthly' ? plan.price_monthly : Math.round(plan.price_yearly / 12);
              const isPopular = plan.slug === 'professional';
              return (
                <motion.div
                  key={plan.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className={`relative h-full flex flex-col ${isPopular ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-border/50'}`}>
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <div className="mt-3">
                        <span className="text-4xl font-bold text-foreground">
                          ${price}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                        {billing === 'yearly' && plan.price_yearly > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Billed ${plan.price_yearly}/year
                          </p>
                        )}
                        {plan.price_monthly === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Free forever</p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="text-sm text-muted-foreground mb-4 space-y-1">
                        <p>{plan.max_users >= 999 ? 'Unlimited' : plan.max_users} users</p>
                        <p>{plan.max_branches >= 999 ? 'Unlimited' : plan.max_branches} {plan.max_branches === 1 ? 'branch' : 'branches'}</p>
                        <p>{plan.max_products ? `${plan.max_products.toLocaleString()} products` : 'Unlimited products'}</p>
                      </div>
                      <ul className="space-y-2.5 mb-6 flex-1">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span className="text-foreground">{feat}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => navigate('/auth?mode=signup')}
                      >
                        {plan.price_monthly === 0 ? 'Get Started' : 'Start Free Trial'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Trusted by businesses everywhere
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-foreground mb-4 text-sm leading-relaxed">"{t.text}"</p>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to streamline your business?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join hundreds of businesses using POSFlow. Start your 14-day free trial today.
          </p>
          <Button size="lg" className="text-base h-12 px-10" onClick={() => navigate('/auth?mode=signup')}>
            Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">POSFlow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} POSFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
