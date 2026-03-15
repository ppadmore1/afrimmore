import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Crown, ArrowRight, Users, Building2, Package, Calendar, AlertTriangle } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_branches: number;
  max_products: number | null;
  features: string[];
}

interface Usage {
  users: number;
  branches: number;
  products: number;
}

export default function SubscriptionPage() {
  const { tenant, subscription, isTrialExpired } = useTenant();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Usage>({ users: 0, branches: 0, products: 0 });
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadData();
  }, [tenant]);

  const loadData = async () => {
    if (!tenant) return;
    try {
      const [plansRes, usersRes, branchesRes, productsRes, subPlanRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('tenant_users').select('id').eq('tenant_id', tenant.id),
        supabase.from('branches').select('id').eq('tenant_id', tenant.id),
        supabase.from('products').select('id').eq('tenant_id', tenant.id).eq('is_active', true),
        subscription?.plan_id
          ? supabase.from('subscription_plans').select('*').eq('id', subscription.plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (plansRes.data) setPlans(plansRes.data.map(p => ({ ...p, features: (p.features as any) || [] })) as Plan[]);
      setUsage({
        users: usersRes.data?.length || 0,
        branches: branchesRes.data?.length || 0,
        products: productsRes.data?.length || 0,
      });
      if (subPlanRes.data) setCurrentPlan({ ...subPlanRes.data, features: (subPlanRes.data.features as any) || [] } as Plan);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeRequest = (plan: Plan) => {
    toast({
      title: 'Upgrade Requested',
      description: `Your request to upgrade to ${plan.name} has been submitted. Our team will contact you shortly to activate your plan.`,
    });
  };

  const usageBar = (label: string, icon: React.ReactNode, current: number, max: number | null) => {
    const pct = max ? Math.min((current / max) * 100, 100) : 10;
    const isNearLimit = max ? current >= max * 0.8 : false;
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-foreground font-medium">
            {icon}
            {label}
          </div>
          <span className={isNearLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            {current} / {max && max < 999 ? max : '∞'}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
    );
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Subscription & Billing</h1>
          <p className="text-muted-foreground">Manage your plan and usage</p>
        </div>

        {isTrialExpired && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Your trial has expired</p>
                <p className="text-sm text-muted-foreground">Please upgrade to continue using all features.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-warning" />
                  Current Plan: {currentPlan?.name || tenant?.plan || 'Starter'}
                </CardTitle>
                <CardDescription>
                  {subscription?.status === 'trial' && subscription?.trial_ends_at
                    ? `Trial ends ${format(new Date(subscription.trial_ends_at), 'MMM d, yyyy')}`
                    : subscription?.status === 'active'
                    ? 'Active subscription'
                    : 'Free plan'}
                </CardDescription>
              </div>
              <Badge variant={subscription?.status === 'active' ? 'default' : subscription?.status === 'trial' ? 'secondary' : 'outline'}>
                {subscription?.status || 'free'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageBar('Users', <Users className="w-4 h-4" />, usage.users, tenant?.max_users || 2)}
            {usageBar('Branches', <Building2 className="w-4 h-4" />, usage.branches, tenant?.max_branches || 1)}
            {usageBar('Products', <Package className="w-4 h-4" />, usage.products, currentPlan?.max_products || 100)}
          </CardContent>
        </Card>

        {/* Available Plans */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentPlan?.slug === plan.slug || (!currentPlan && plan.slug === 'starter');
              const isUpgrade = plan.price_monthly > (currentPlan?.price_monthly || 0);
              const isDowngrade = plan.price_monthly < (currentPlan?.price_monthly || 0);
              return (
                <Card key={plan.slug} className={`flex flex-col ${isCurrent ? 'border-primary ring-1 ring-primary/20' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {isCurrent && <Badge>Current</Badge>}
                    </div>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">${plan.price_monthly}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="text-sm text-muted-foreground mb-3 space-y-0.5">
                      <p>{plan.max_users >= 999 ? 'Unlimited' : plan.max_users} users</p>
                      <p>{plan.max_branches >= 999 ? 'Unlimited' : plan.max_branches} branches</p>
                      <p>{plan.max_products ? `${plan.max_products.toLocaleString()} products` : 'Unlimited products'}</p>
                    </div>
                    <ul className="space-y-1.5 mb-4 flex-1 text-sm">
                      {plan.features.slice(0, 6).map(f => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && (
                      <Button
                        variant={isUpgrade ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => handleUpgradeRequest(plan)}
                      >
                        {isUpgrade ? 'Request Upgrade' : 'Request Downgrade'}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Plan changes are processed manually. Our team will contact you to confirm and activate your new plan.
          </p>
        </div>
      </motion.div>
    </AppLayout>
  );
}
