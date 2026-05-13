import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { MapPin, User, Phone, MessageSquare, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { CampusMap } from '../components/CampusMap';
import { rideAPI, userAPI } from '../services/api';
import { BackButton } from '../components/BackButton';

export default function DriverActiveRidePage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, rides, setRides, selectedUniversity } = useApp();
  const [pinInput, setPinInput] = useState('');
  const [rideStarted, setRideStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeRide = rides.find(
    (r) => r.driverId === currentUser?.id && (r.status === 'accepted' || r.status === 'in-progress')
  );

  if (!activeRide) {
    navigate('/driver');
    return null;
  }

  const handleStartRide = async () => {
    setIsLoading(true);
    try {
      await rideAPI.verifyPin(activeRide.id, pinInput);
      
      // Update local state
      const updatedRide = { ...activeRide, status: 'in-progress' as const };
      setRides((prev) => prev.map((r) => (r.id === activeRide.id ? updatedRide : r)));
      setRideStarted(true);
      
      toast.success('PIN verified! Ride started.');
    } catch (error: any) {
      console.error('Error verifying PIN:', error);
      toast.error(error.message || 'Incorrect PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    setIsLoading(true);
    try {
      const { ride: completedRide } = await rideAPI.verifyPin(activeRide.id, activeRide.pin);
      
      // Update rides
      setRides((prev) => prev.map((r) => (r.id === activeRide.id ? completedRide : r)));

      // Refresh user data to get updated wallet balance
      if (currentUser) {
        const updatedUser = await userAPI.getUser(currentUser.id);
        setCurrentUser(updatedUser);
      }

      toast.success(`Ride completed! ₦${activeRide.fare} added to your wallet.`);
      navigate('/driver');
    } catch (error: any) {
      console.error('Error completing ride:', error);
      toast.error(error.message || 'Failed to complete ride');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-6">
        <h1 className="text-2xl font-bold">Active Ride</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Campus Map */}
        <CampusMap
          university={selectedUniversity}
          pickupLocationId={activeRide.pickupLocation.id}
          dropoffLocationId={activeRide.dropoffLocation.id}
        />

        {/* Status */}
        <Card className={`${activeRide.status === 'in-progress' ? 'bg-emerald-500' : 'bg-blue-500'} text-white border-none`}>
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold">
              {activeRide.status === 'accepted' ? 'Heading to Pickup' : 'In Progress'}
            </h2>
            <p className="text-sm opacity-90">
              {activeRide.status === 'accepted'
                ? 'Navigate to the pickup location'
                : 'Taking rider to destination'}
            </p>
          </CardContent>
        </Card>

        {/* Rider Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rider Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{activeRide.riderName}</p>
                <p className="text-sm text-gray-600">Student</p>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" className="flex-1" size="sm">
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
              <Button variant="outline" className="flex-1" size="sm">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Route */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 bg-emerald-600 rounded-full mt-1.5"></div>
              <div className="flex-1">
                <p className="font-medium">{activeRide.pickupLocation.name}</p>
                <p className="text-sm text-gray-600">Pickup</p>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-gray-300 ml-1.5 h-8"></div>
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 bg-blue-600 rounded-full mt-1.5"></div>
              <div className="flex-1">
                <p className="font-medium">{activeRide.dropoffLocation.name}</p>
                <p className="text-sm text-gray-600">Dropoff</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PIN Verification */}
        {activeRide.status === 'accepted' && !rideStarted && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <span>Verify Ride PIN</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                Ask the rider for their 4-digit PIN to start the ride:
              </p>
              <Input
                type="text"
                placeholder="Enter 4-digit PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className="text-center text-2xl tracking-widest"
              />
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleStartRide}
                disabled={pinInput.length !== 4 || isLoading}
              >
                {isLoading ? 'Verifying...' : 'Start Ride'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Fare */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Fare</span>
              <span className="text-2xl font-bold text-emerald-600">₦{activeRide.fare}</span>
            </div>
          </CardContent>
        </Card>

        {/* Complete Ride Button */}
        {activeRide.status === 'in-progress' && (
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="lg"
            onClick={handleCompleteRide}
            disabled={isLoading}
          >
            {isLoading ? 'Completing...' : 'Complete Ride'}
          </Button>
        )}
      </div>
    </div>
  );
}