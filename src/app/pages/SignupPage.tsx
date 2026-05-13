import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Car, User } from 'lucide-react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '../services/api';
import { BackButton } from '../components/BackButton';

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (location.state as { role?: 'rider' | 'driver' })?.role;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If no role was passed, send them back to choose one
  useEffect(() => {
    if (!role) {
      navigate('/choose-role', { replace: true });
    }
  }, [role, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!name || !phoneNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (emailDomain !== 'gmail.com' && emailDomain !== 'yahoo.com') {
      toast.error('Only Gmail and Yahoo email addresses are allowed');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.signup({
        email,
        password,
        name,
        role: role!, // Role chosen before signup
        phoneNumber,
        studentId,
        universityId: '', // Will be set after university selection
      });

      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!role) return null; // redirecting

  const isDriver = role === 'driver';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-4">
      <BackButton />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 ${isDriver ? 'bg-blue-600' : 'bg-emerald-600'} rounded-full mb-4`}>
            {isDriver ? <Car className="w-8 h-8 text-white" /> : <User className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CampusRide</h1>

          {/* Role badge */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium mt-1 ${
            isDriver ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isDriver ? <Car className="w-4 h-4" /> : <User className="w-4 h-4" />}
            Signing up as a {isDriver ? 'Driver' : 'Rider'}
          </div>

          <button
            onClick={() => navigate('/choose-role')}
            className="block text-xs text-gray-400 hover:text-gray-600 underline mt-1 mx-auto"
          >
            Change role
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Join CampusRide with your email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

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
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentId">
                  {isDriver ? "Driver's License Number" : 'Student ID (Optional)'}
                </Label>
                <Input
                  id="studentId"
                  type="text"
                  placeholder={isDriver ? 'e.g. ABC12345678' : 'STU12345'}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required={isDriver}
                />
              </div>

              <Button
                type="submit"
                className={`w-full ${isDriver ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Account...
                  </span>
                ) : `Sign Up as ${isDriver ? 'Driver' : 'Rider'}`}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-emerald-600 hover:underline"
              >
                Already have an account? Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}