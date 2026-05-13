import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { MapPin, Navigation, ArrowDown, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { calculateFare } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { Ride, CampusLocation } from '../types';
import { CampusMap } from '../components/CampusMap';
import { rideAPI, userAPI } from '../services/api';
import { BackButton } from '../components/BackButton';

// Find nearest campus location to given coordinates
function findNearestLocation(
  lat: number,
  lng: number,
  locations: { id: string; name: string; lat: number; lng: number }[]
): { location: typeof locations[0]; distanceMeters: number } | null {
  if (!locations.length) return null;

  let nearest = locations[0];
  let minDist = Infinity;

  for (const loc of locations) {
    const R = 6371000;
    const dLat = ((loc.lat - lat) * Math.PI) / 180;
    const dLng = ((loc.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) * Math.cos((loc.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d < minDist) {
      minDist = d;
      nearest = loc;
    }
  }

  return { location: nearest, distanceMeters: minDist };
}

export default function BookRidePage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, rides, setRides, selectedUniversity } = useApp();

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'success' | 'denied' | 'error'>('loading');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestPickup, setNearestPickup] = useState<{ location: typeof selectedUniversity.locations[0]; distanceMeters: number } | null>(null);

  const [dropoffId, setDropoffId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [showDropoffList, setShowDropoffList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const pickupLocation = nearestPickup?.location ?? null;
  const dropoffLocation = selectedUniversity.locations.find((loc) => loc.id === dropoffId) ?? null;
  const fare = pickupLocation && dropoffLocation ? calculateFare(pickupLocation as CampusLocation, dropoffLocation as CampusLocation) : 0;

  // Request GPS location — use campus center fallback immediately if geolocation is unavailable
  const useFallbackLocation = useCallback(() => {
    const fallbackCoords = { lat: selectedUniversity.center.lat, lng: selectedUniversity.center.lng };
    setUserCoords(fallbackCoords);
    const nearest = findNearestLocation(fallbackCoords.lat, fallbackCoords.lng, selectedUniversity.locations);
    setNearestPickup(nearest);
  }, [selectedUniversity]);

  const requestLocation = useCallback(() => {
    // Check if geolocation is available and not blocked by permissions policy
    if (!navigator.geolocation) {
      setGpsStatus('success');
      useFallbackLocation();
      return;
    }

    setGpsStatus('loading');

    // Use a short timeout — if blocked by policy, error fires instantly
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserCoords(coords);
        const nearest = findNearestLocation(coords.lat, coords.lng, selectedUniversity.locations);
        setNearestPickup(nearest);
        setGpsStatus('success');
      },
      () => {
        // Silently fall back to campus center for any geolocation error
        // (permission denied, policy block, timeout, etc.)
        useFallbackLocation();
        setGpsStatus('success');
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }, [selectedUniversity, useFallbackLocation]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  // Filter locations for dropoff (exclude pickup)
  const filteredLocations = selectedUniversity.locations
    .filter((loc) => loc.id !== pickupLocation?.id)
    .filter((loc) => !searchQuery || loc.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Group filtered locations by category
  const groupedLocations = filteredLocations.reduce((acc, loc) => {
    if (!acc[loc.category]) acc[loc.category] = [];
    acc[loc.category].push(loc);
    return acc;
  }, {} as Record<string, typeof filteredLocations>);

  const categoryLabels: Record<string, string> = {
    academic: '🏫 Academic',
    hostel: '🏠 Hostels',
    facility: '🏢 Facilities',
    food: '🍔 Food & Restaurants',
    sports: '⚽ Sports',
    gate: '🚪 Gates',
    religious: '⛪ Religious',
  };

  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      toast.error('Please select a dropoff location');
      return;
    }

    if (pickupLocation.id === dropoffLocation.id) {
      toast.error('Pickup and dropoff locations cannot be the same');
      return;
    }

    if ((currentUser?.walletBalance || 0) < fare) {
      toast.error('Insufficient wallet balance. Please top up.');
      return;
    }

    if (!currentUser) {
      toast.error('Please log in first');
      navigate('/login');
      return;
    }

    // Show confirmation instead of booking immediately
    setShowConfirmation(true);
  };

  const handleConfirmBooking = async () => {
    if (!pickupLocation || !dropoffLocation || !currentUser) return;

    setShowConfirmation(false);
    setIsCreating(true);
    try {
      const newRide = await rideAPI.createRide({
        pickupLocation,
        dropoffLocation,
        fare,
        universityId: selectedUniversity.id,
      });

      setRides([...rides, newRide]);
      toast.success('Ride requested! Finding a driver...');

      const interval = setInterval(async () => {
        try {
          const userRides = await rideAPI.getUserRides(currentUser.id);
          const updatedRide = userRides.find((r: Ride) => r.id === newRide.id);

          if (updatedRide && updatedRide.status === 'accepted') {
            clearInterval(interval);
            setRides(userRides);
            const updatedUser = await userAPI.getUser(currentUser.id);
            setCurrentUser(updatedUser);
            toast.success('Driver found!');
            navigate('/ride/active');
          }
        } catch (error) {
          console.error('Error polling for ride updates:', error);
        }
      }, 3000);

      setPollInterval(interval);
      setTimeout(() => clearInterval(interval), 30000);
    } catch (error: any) {
      console.error('Error creating ride:', error);
      toast.error(error.message || 'Failed to create ride');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <BackButton />
      <div className="bg-emerald-600 text-white p-6">
        <h1 className="text-2xl font-bold">Book a Ride</h1>
        <p className="text-emerald-100 text-sm mt-1">We'll pick you up from where you are</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Campus Map */}
        <CampusMap
          university={selectedUniversity}
          pickupLocationId={pickupLocation?.id}
          dropoffLocationId={dropoffId}
          userCoords={userCoords ?? undefined}
        />

        {/* Pickup — auto-detected */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Navigation className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-700 font-medium">YOUR PICKUP</p>
                {gpsStatus === 'loading' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                    <span className="text-sm text-gray-500">Detecting your location...</span>
                  </div>
                ) : pickupLocation ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{pickupLocation.name}</p>
                    {nearestPickup && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {nearestPickup.distanceMeters < 100
                          ? 'You are here'
                          : `~${Math.round(nearestPickup.distanceMeters)}m from you`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Could not detect location</p>
                )}
              </div>
              {gpsStatus !== 'loading' && (
                <button
                  onClick={requestLocation}
                  className="p-1.5 rounded-full hover:bg-emerald-100 transition"
                  title="Refresh location"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                </button>
              )}
            </div>
            {gpsStatus === 'denied' && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                📍 Location access denied. Using campus center as fallback. Enable location in your browser settings for accuracy.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <ArrowDown className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Dropoff — manual pick */}
        <Card className={`border-blue-200 ${dropoffLocation ? 'bg-blue-50/50' : ''}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-700 font-medium">YOUR DROPOFF</p>
                {dropoffLocation ? (
                  <p className="text-sm font-semibold text-gray-900 truncate">{dropoffLocation.name}</p>
                ) : (
                  <p className="text-sm text-gray-400">Tap below to choose where you're going</p>
                )}
              </div>
              {dropoffLocation && (
                <button
                  onClick={() => { setDropoffId(''); setShowDropoffList(true); }}
                  className="text-xs text-blue-600 font-medium px-2 py-1 rounded hover:bg-blue-100 transition"
                >
                  Change
                </button>
              )}
            </div>

            {/* Location search and list */}
            {!dropoffLocation || showDropoffList ? (
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search locations..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                />
                <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 bg-white">
                  {Object.entries(groupedLocations).map(([category, locs]) => (
                    <div key={category}>
                      <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 sticky top-0">
                        {categoryLabels[category] || category}
                      </div>
                      {locs.map((loc) => (
                        <button
                          key={loc.id}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 active:bg-blue-100 transition flex items-center gap-2 border-b border-gray-50 ${
                            dropoffId === loc.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                          onClick={() => {
                            setDropoffId(loc.id);
                            setShowDropoffList(false);
                            setSearchQuery('');
                          }}
                        >
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredLocations.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No locations found</p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Fare card */}
        {fare > 0 && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-700 font-medium">Estimated Fare</span>
                <span className="text-2xl font-bold text-emerald-600">₦{fare}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Wallet Balance</span>
                <span className="font-medium text-gray-700">₦{(currentUser?.walletBalance || 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insufficient balance warning */}
        {fare > 0 && (currentUser?.walletBalance || 0) < fare && (
          <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Insufficient Balance</p>
              <p className="text-xs text-amber-700 mt-1">
                You need ₦{fare - (currentUser?.walletBalance || 0)} more to book this ride.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-amber-400 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/rider')}
              >
                Go to Wallet
              </Button>
            </div>
          </div>
        )}

        {/* Book button */}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base"
          onClick={handleBookRide}
          disabled={!pickupLocation || !dropoffId || fare === 0 || isCreating}
        >
          {isCreating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Finding a driver...
            </span>
          ) : fare > 0 ? (
            `Request Ride — ₦${fare}`
          ) : (
            'Select your destination'
          )}
        </Button>

        <p className="text-xs text-center text-gray-500">
          Your ride PIN will be generated once a driver accepts
        </p>

        {/* Confirmation modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="bg-emerald-600 text-white p-5">
                <h2 className="text-lg font-bold">Confirm Your Ride</h2>
                <p className="text-emerald-100 text-sm mt-1">Please review your trip details</p>
              </div>

              <div className="p-5 space-y-4">
                {/* Route summary */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Navigation className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">PICKUP</p>
                      <p className="text-sm font-semibold text-gray-900">{pickupLocation?.name}</p>
                    </div>
                  </div>
                  <div className="ml-3 border-l-2 border-dashed border-gray-200 h-4" />
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-3 h-3 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">DROPOFF</p>
                      <p className="text-sm font-semibold text-gray-900">{dropoffLocation?.name}</p>
                    </div>
                  </div>
                </div>

                {/* Fare & balance */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fare</span>
                    <span className="text-xl font-bold text-emerald-600">₦{fare}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Wallet Balance</span>
                    <span className="font-medium">₦{(currentUser?.walletBalance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-2">
                    <span className="text-gray-500">Balance After Ride</span>
                    <span className="font-medium text-gray-700">₦{((currentUser?.walletBalance || 0) - fare).toLocaleString()}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setShowConfirmation(false)}
                  >
                    Go Back
                  </Button>
                  <Button
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleConfirmBooking}
                  >
                    Confirm Booking
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}