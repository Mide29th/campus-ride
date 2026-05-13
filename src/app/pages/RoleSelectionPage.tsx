import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { User, Car } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { userAPI } from '../services/api';
import { toast } from 'sonner';
import { BackButton } from '../components/BackButton';

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();
  const [isLoading, setIsLoading] = useState(false);

  const selectRole = async (role: 'rider' | 'driver') => {
    if (!currentUser) {
      toast.error('Please log in first');
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      // Update user's role in backend
      const updatedUser = await userAPI.updateUser(currentUser.id, { role });
      setCurrentUser(updatedUser);
      
      toast.success(`You're now a ${role}!`);
      navigate(role === 'rider' ? '/rider' : '/driver');
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-4">
      <BackButton />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Role</h1>
          <p className="text-gray-600">How would you like to use CampusRide?</p>
        </div>

        <div className="space-y-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-emerald-500"
            onClick={() => selectRole('rider')}
          >
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full">
                  <User className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>I'm a Rider</CardTitle>
                  <CardDescription>Request rides around campus</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Book rides to any campus location</li>
                <li>• Track your ride in real-time</li>
                <li>• Secure payment with wallet</li>
              </ul>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-emerald-500"
            onClick={() => selectRole('driver')}
          >
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>I'm a Driver</CardTitle>
                  <CardDescription>Earn by giving rides</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Accept ride requests nearby</li>
                <li>• Set your availability status</li>
                <li>• Earn money from completed trips</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
          Note: Drivers must be verified by campus security before accepting rides.
        </p>
      </div>
    </div>
  );
}