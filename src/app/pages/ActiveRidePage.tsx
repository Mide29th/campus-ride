import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { MapPin, User, Car, Phone, MessageSquare, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { CampusMap } from '../components/CampusMap';
import { BackButton } from '../components/BackButton';

export default function ActiveRidePage() {
  const navigate = useNavigate();
  const { currentUser, rides, setRides, selectedUniversity } = useApp();
  const [showPin, setShowPin] = useState(false);

  const activeRide = rides.find(
    (r) => r.riderId === currentUser?.id && (r.status === 'pending' || r.status === 'accepted' || r.status === 'in-progress')
  );

  useEffect(() => {
    if (!activeRide) {
      navigate('/rider');
      return;
    }

    // Simulate ride starting after showing PIN
    if (activeRide.status === 'accepted' && showPin) {
      setTimeout(() => {
        const updatedRide = { ...activeRide, status: 'in-progress' as const };
        setRides((prev) => prev.map((r) => (r.id === activeRide.id ? updatedRide : r)));
        toast.success('Ride started!');
      }, 5000);
    }
  }, [activeRide, showPin]);

  if (!activeRide) return null;

  const handleCompleteRide = () => {
    const updatedRide = {
      ...activeRide,
      status: 'completed' as const,
      completedAt: new Date(),
    };
    setRides((prev) => prev.map((r) => (r.id === activeRide.id ? updatedRide : r)));
    
    // Update wallet balance
    toast.success('Ride completed! Thank you for using CampusRide.');
    navigate('/rider');
  };

  const getStatusInfo = () => {
    switch (activeRide.status) {
      case 'pending':
        return {
          title: 'Finding a Driver...',
          description: 'Please wait while we match you with a nearby driver',
          color: 'bg-amber-500',
        };
      case 'accepted':
        return {
          title: 'Driver Accepted!',
          description: 'Your driver is on the way to pick you up',
          color: 'bg-blue-500',
        };
      case 'in-progress':
        return {
          title: 'In Progress',
          description: 'Enjoy your ride!',
          color: 'bg-emerald-500',
        };
      default:
        return {
          title: 'Processing...',
          description: '',
          color: 'bg-gray-500',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-gray-50">
      <BackButton />
      <div className="bg-emerald-600 text-white p-6">
        <h1 className="text-2xl font-bold">Your Ride</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Campus Map */}
        <CampusMap
          university={selectedUniversity}
          pickupLocationId={activeRide.pickupLocation.id}
          dropoffLocationId={activeRide.dropoffLocation.id}
        />

        {/* Status Banner */}
        <Card className={`${statusInfo.color} text-white border-none`}>
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold mb-1">{statusInfo.title}</h2>
            <p className="text-sm opacity-90">{statusInfo.description}</p>
          </CardContent>
        </Card>

        {/* Route Information */}
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

        {/* Driver Information */}
        {activeRide.status !== 'pending' && activeRide.driverName && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Driver Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{activeRide.driverName}</p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Car className="w-4 h-4" />
                    <span>Toyota Corolla • LAG-123-AB</span>
                  </div>
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
        )}

        {/* Ride PIN */}
        {activeRide.status === 'accepted' && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <span>Ride PIN</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showPin ? (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowPin(true)}
                >
                  Show PIN
                </Button>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-700 mb-2">Share this PIN with your driver:</p>
                  <div className="text-5xl font-bold text-emerald-600 tracking-widest mb-3">
                    {activeRide.pin}
                  </div>
                  <p className="text-xs text-gray-600">
                    The driver will enter this PIN to start the trip
                  </p>
                </div>
              )}
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

        {/* Actions */}
        {activeRide.status === 'in-progress' && (
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="lg"
            onClick={handleCompleteRide}
          >
            Complete Ride
          </Button>
        )}

        {activeRide.status === 'pending' && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              setRides((prev) => prev.filter((r) => r.id !== activeRide.id));
              navigate('/rider');
              toast.info('Ride cancelled');
            }}
          >
            Cancel Request
          </Button>
        )}
      </div>
    </div>
  );
}