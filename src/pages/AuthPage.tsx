import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Store, Mail, Lock, User, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';
import { Separator } from '@/components/ui/separator';

const emailSchema = z.string().email('Invalid email address').max(255, 'Email is too long');
const passwordSchema = z.string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long');

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; confirmPassword?: string }>({});
  
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for password reset token in URL (from email link)
  useEffect(() => {
    const checkForRecoverySession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Check if this is a recovery session (user clicked reset link)
      if (session?.user && window.location.hash.includes('type=recovery')) {
        setIsResetPassword(true);
      }
    };

    // Listen for auth state changes to detect recovery flow
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPassword(true);
      }
    });

    checkForRecoverySession();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !authLoading && !isResetPassword) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate, isResetPassword]);

  const validate = () => {
    const newErrors: typeof errors = {};
    
    if (!isResetPassword && !isForgotPassword) {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
    }

    if (isForgotPassword) {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }
    
    if (!isForgotPassword) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    if (isResetPassword) {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    if (!isLogin && !isResetPassword && !isForgotPassword) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.fullName = nameResult.error.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Check your email',
          description: 'We sent you a password reset link.',
        });
        setIsForgotPassword(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Password updated',
          description: 'Your password has been successfully updated.',
        });
        setIsResetPassword(false);
        navigate('/', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast({
              title: 'Login Failed',
              description: 'Invalid email or password. Please try again.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Login Failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Welcome back!',
            description: 'You have successfully logged in.',
          });
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Sign Up Failed',
              description: 'This email is already registered. Please login instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign Up Failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Account Created!',
            description: 'Welcome to the system. You are now logged in.',
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-primary-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
                <Store className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">POSFlow</h1>
                <p className="text-primary-foreground/70">Business Management</p>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              Manage your business<br />with confidence
            </h2>
            
            <ul className="space-y-4 text-lg text-primary-foreground/90">
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                Point of Sale & Inventory
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                Invoices & Quotations
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                Cloud Sync & Reports
              </li>
            </ul>
          </motion.div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-foreground/10 rounded-full -mr-48 -mb-48" />
        <div className="absolute top-20 right-20 w-32 h-32 bg-primary-foreground/5 rounded-full" />
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">POSFlow</h1>
              <p className="text-sm text-muted-foreground">Business Management</p>
            </div>
          </div>

          <Card className="border-0 shadow-elevated">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">
                {isResetPassword 
                  ? 'Set new password' 
                  : isForgotPassword 
                    ? 'Reset password'
                    : isLogin 
                      ? 'Welcome back' 
                      : 'Create account'}
              </CardTitle>
              <CardDescription>
                {isResetPassword 
                  ? 'Enter your new password below'
                  : isForgotPassword
                    ? 'Enter your email to receive a reset link'
                    : isLogin 
                      ? 'Enter your credentials to access your account' 
                      : 'Fill in your details to get started'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Reset Password Form */}
              {isResetPassword ? (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Min 10 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 gradient-primary text-primary-foreground"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Update Password
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              ) : isForgotPassword ? (
                /* Forgot Password Form */
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 gradient-primary text-primary-foreground"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Send Reset Link
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setErrors({});
                      }}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Back to <span className="text-primary font-medium">Sign in</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Login/Signup Form */
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="fullName"
                            type="text"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        {errors.fullName && (
                          <p className="text-sm text-destructive">{errors.fullName}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password}</p>
                      )}
                      {!isLogin && !errors.password && (
                        <p className="text-xs text-muted-foreground">
                          Min 10 characters with uppercase, lowercase, and number
                        </p>
                      )}
                    </div>

                    {isLogin && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setErrors({});
                          }}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full h-11 gradient-primary text-primary-foreground"
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {isLogin ? 'Sign In' : 'Create Account'}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="relative my-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                      or continue with
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const { error } = await lovable.auth.signInWithOAuth('google', {
                          redirect_uri: window.location.origin,
                        });
                        if (error) {
                          toast({
                            title: 'Google Sign-In Failed',
                            description: error.message,
                            variant: 'destructive',
                          });
                        }
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </Button>
                  
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setErrors({});
                      }}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isLogin ? (
                        <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
                      ) : (
                        <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
                      )}
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
