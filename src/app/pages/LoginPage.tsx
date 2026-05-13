import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Car } from 'lucide-react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setCurrentUser, setSelectedUniversity } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (emailDomain !== 'gmail.com' && emailDomain !== 'yahoo.com') {
      toast.error('Only Gmail and Yahoo email addresses are allowed');
      return;
    }

    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting login...');
      const { user, accessToken } = await authAPI.login(email, password);
      console.log('Login successful, setting user and token:', { userId: user.id, hasToken: !!accessToken });
      
      setCurrentUser(user);
      
      // Small delay to ensure token is persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      toast.success('Login successful!');
      
      // Admin override
      const ADMIN_EMAILS = ['yinkaibrahim68@gmail.com'];
      if (ADMIN_EMAILS.includes(user.email)) {
        console.log('Admin login detected, navigating to admin dashboard');
        navigate('/admin');
        return;
      }

      // Navigate based on user state
      if (!user.universityId) {
        console.log('Navigating to university selection');
        navigate('/university-selection');
      } else if (!user.role) {
        console.log('Navigating to role selection');
        navigate('/choose-role');
      } else if (user.role === 'rider') {
        console.log('Navigating to rider dashboard');
        navigate('/rider');
      } else {
        console.log('Navigating to driver dashboard');
        navigate('/driver');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-full mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CampusRide</h1>
          <p className="text-gray-600">Get around campus quickly and safely</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in with your email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">Only gmail.com and yahoo.com emails accepted</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing In...
                  </span>
                ) : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/choose-role')}
                className="text-sm text-emerald-600 hover:underline"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-gray-500 mt-6">
          This is a demo app. In production, use your actual university credentials.
        </p>
      </div>
    </div>
  );
}