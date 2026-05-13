import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Home, History, Wallet, User, MapPin, ArrowRight, Loader2, CreditCard, CheckCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { rideAPI, walletAPI, authAPI, userAPI } from '../services/api';
import { toast } from 'sonner';
import { BackButton } from '../components/BackButton';

export default function RiderDashboard() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, rides, setRides } = useApp();
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'wallet' | 'profile'>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [paystackPublicKey, setPaystackPublicKey] = useState<string | null>(null);
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showChangeRoleConfirm, setShowChangeRoleConfirm] = useState(false);
  const [isResettingRole, setIsResettingRole] = useState(false);

  const startEditProfile = () => {
    setEditName(currentUser?.name || '');
    setEditPhone(currentUser?.phoneNumber || '');
    setEditStudentId(currentUser?.studentId || '');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    if (!editName.trim() || !editPhone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await userAPI.updateUser(currentUser.id, {
        name: editName.trim(),
        phoneNumber: editPhone.trim(),
        studentId: editStudentId.trim(),
      });
      setCurrentUser(updated);
      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetRole = async () => {
    if (!currentUser) return;
    setIsResettingRole(true);
    try {
      const updated = await userAPI.updateUser(currentUser.id, { role: '' });
      setCurrentUser(updated);
      toast.success('Role cleared. Please choose a new role.');
      navigate('/choose-role');
    } catch (error) {
      console.error('Error resetting role:', error);
      toast.error('Failed to reset role');
    } finally {
      setIsResettingRole(false);
      setShowChangeRoleConfirm(false);
    }
  };

  // Load Paystack public key and script on mount
  useEffect(() => {
    const loadPaystack = async () => {
      try {
        const { publicKey } = await walletAPI.getPaystackConfig();
        setPaystackPublicKey(publicKey);
        // Load Paystack inline JS
        if (!document.getElementById('paystack-script')) {
          const script = document.createElement('script');
          script.id = 'paystack-script';
          script.src = 'https://js.paystack.co/v1/inline.js';
          document.head.appendChild(script);
        }
      } catch (error) {
        console.error('Error loading Paystack config:', error);
      }
    };
    loadPaystack();
  }, []);

  // Fetch user rides on mount
  useEffect(() => {
    const fetchRides = async () => {
      if (currentUser) {
        try {
          const userRides = await rideAPI.getUserRides(currentUser.id);
          setRides(userRides);
        } catch (error) {
          console.error('Error fetching rides:', error);
        }
      }
    };

    fetchRides();
  }, [currentUser]);

  // Refresh user data when tab changes to wallet
  useEffect(() => {
    const refreshUser = async () => {
      if (activeTab === 'wallet' && currentUser) {
        try {
          const updatedUser = await userAPI.getUser(currentUser.id);
          setCurrentUser(updatedUser);
        } catch (error) {
          console.error('Error refreshing user:', error);
        }
      }
    };

    refreshUser();
  }, [activeTab]);

  const activeRide = rides.find(
    (r) => r.riderId === currentUser?.id && (r.status === 'pending' || r.status === 'accepted' || r.status === 'in-progress')
  );

  const completedRides = rides.filter(
    (r) => r.riderId === currentUser?.id && r.status === 'completed'
  );

  const handlePaystackTopUp = async (amount: number) => {
    if (!currentUser || !paystackPublicKey) {
      toast.error('Payment service not ready. Please try again.');
      return;
    }
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      // Initialize transaction on backend
      const { access_code, reference } = await walletAPI.initializePaystack(amount);
      setPendingReference(reference);

      // Open Paystack popup
      const handler = (window as any).PaystackPop.setup({
        key: paystackPublicKey,
        email: currentUser.email,
        amount: amount * 100,
        ref: reference,
        currency: 'NGN',
        onClose: () => {
          setIsLoading(false);
          toast.info('Payment window closed');
        },
        callback: (response: any) => {
          // Payment successful, verify on backend
          setIsVerifying(true);
          walletAPI.verifyPaystack(response.reference)
            .then((result) => {
              setCurrentUser(result.user);
              toast.success(`Successfully added ₦${amount.toLocaleString()} to your wallet!`);
              setTopUpAmount('');
            })
            .catch((err: any) => {
              console.error('Verification error:', err);
              toast.error(err.message || 'Payment verification failed');
            })
            .finally(() => {
              setIsVerifying(false);
              setIsLoading(false);
            });
        },
      });
      handler.openIframe();
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      toast.error(error.message || 'Failed to initiate payment');
      setIsLoading(false);
    }
  };

  const handleCustomTopUp = () => {
    const amount = parseInt(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    handlePaystackTopUp(amount);
  };

  const handleSignOut = async () => {
    await authAPI.logout();
    setCurrentUser(null);
    setRides([]);
    navigate('/login');
    toast.success('Signed out successfully');
  };

  const handleCancelRide = async () => {
    if (!activeRide || !currentUser) return;
    
    setIsCancelling(true);
    try {
      const result = await rideAPI.cancelRide(activeRide.id);
      
      // Optimistically update local state immediately so the UI reflects the cancellation
      setRides((prev) =>
        prev.map((r) =>
          r.id === activeRide.id ? { ...r, status: 'cancelled', cancelledAt: new Date().toISOString() } : r
        )
      );
      
      // Update wallet balance from the refund
      if (activeRide.fare) {
        setCurrentUser((prev: any) =>
          prev ? { ...prev, walletBalance: (prev.walletBalance || 0) + activeRide.fare } : prev
        );
      }
      
      toast.success('Ride cancelled. Fare has been refunded to your wallet.');
      
      // Background refresh for consistency (don't block the UI)
      Promise.all([
        rideAPI.getUserRides(currentUser.id),
        userAPI.getUser(currentUser.id),
      ]).then(([userRides, updatedUser]) => {
        setRides(userRides);
        setCurrentUser(updatedUser);
      }).catch((err) => {
        console.error('Background refresh after cancel failed:', err);
      });
    } catch (error: any) {
      console.error('Error cancelling ride:', error);
      toast.error(error.message || 'Failed to cancel ride');
    } finally {
      setIsCancelling(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-4">
            <Card className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-emerald-100 text-sm">Wallet Balance</p>
                    <p className="text-3xl font-bold">₦{currentUser?.walletBalance.toLocaleString()}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('wallet')}
                  >
                    Top Up
                  </Button>
                </div>
              </CardContent>
            </Card>

            {activeRide && (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardHeader>
                  <CardTitle className="text-lg">Active Ride</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="font-medium">{activeRide.pickupLocation.name}</p>
                        <p className="text-sm text-gray-600">Pickup Location</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium">{activeRide.dropoffLocation.name}</p>
                        <p className="text-sm text-gray-600">Dropoff Location</p>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => navigate('/ride/active')}
                    >
                      View Ride Details
                    </Button>
                    <Button
                      className="w-full bg-red-600 hover:bg-red-700"
                      onClick={handleCancelRide}
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel Ride'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!activeRide && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-4">
                  <MapPin className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ready to go?</h3>
                <p className="text-gray-600 mb-6">Book a ride to your destination</p>
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate('/rider/book')}
                >
                  Book a Ride
                </Button>
              </div>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Ride History</h2>
            {completedRides.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No completed rides yet</p>
              </div>
            ) : (
              completedRides.map((ride) => (
                <Card key={ride.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="font-medium">{ride.pickupLocation.name}</p>
                        <ArrowRight className="w-4 h-4 text-gray-400 my-1" />
                        <p className="font-medium">{ride.dropoffLocation.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">₦{ride.fare}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(ride.completedAt!).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {ride.driverName && (
                      <p className="text-sm text-gray-600">Driver: {ride.driverName}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case 'wallet':
        return (
          <div className="space-y-4">
            <Card className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              <CardContent className="pt-6">
                <p className="text-emerald-100 text-sm mb-1">Total Balance</p>
                <p className="text-4xl font-bold mb-6">₦{currentUser?.walletBalance.toLocaleString()}</p>
              </CardContent>
            </Card>

            {isVerifying && (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center space-x-3">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    <p className="text-emerald-700 font-medium">Verifying payment...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Fund Wallet via Paystack
              </h3>
              <p className="text-xs text-gray-500">Pay with any Nigerian bank card, bank transfer, or USSD</p>
              <div className="grid grid-cols-3 gap-3">
                {[500, 1000, 2000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    className="h-20"
                    onClick={() => handlePaystackTopUp(amount)}
                    disabled={isLoading || !paystackPublicKey}
                  >
                    <div className="text-center">
                      <p className="text-lg font-bold">₦{amount}</p>
                    </div>
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Enter custom amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="flex-1"
                />
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleCustomTopUp}
                  disabled={isLoading || !paystackPublicKey}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pay'}
                </Button>
              </div>
            </div>

            {!paystackPublicKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">Payment service is loading. Please wait...</p>
              </div>
            )}

            <div className="pt-4">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3" />
                <span>Secured by Paystack - All Nigerian banks supported</span>
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditingProfile ? (
                  <>
                    <div>
                      <label className="text-sm text-gray-600">Name</label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Email</label>
                      <p className="font-medium text-gray-400">{currentUser?.email}</p>
                      <p className="text-xs text-gray-400">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Student ID</label>
                      <Input value={editStudentId} onChange={(e) => setEditStudentId(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Phone Number</label>
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{currentUser?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{currentUser?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Student ID</p>
                      <p className="font-medium">{currentUser?.studentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone Number</p>
                      <p className="font-medium">{currentUser?.phoneNumber}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {isEditingProfile ? (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveProfile} disabled={isSavingProfile}>
                  {isSavingProfile ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Changes'}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={startEditProfile}>
                Edit Profile
              </Button>
            )}

            {/* Change Role */}
            {!isEditingProfile && (
              !showChangeRoleConfirm ? (
                <Button
                  variant="outline"
                  className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
                  onClick={() => setShowChangeRoleConfirm(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Change Role
                </Button>
              ) : (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-orange-800 font-medium mb-1">Change your role?</p>
                    <p className="text-xs text-orange-600 mb-3">
                      You'll be redirected to choose between Rider and Driver. Your account data will be kept.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setShowChangeRoleConfirm(false)}
                        disabled={isResettingRole}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={handleResetRole}
                        disabled={isResettingRole}
                      >
                        {isResettingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Change Role'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <BackButton />
      <div className="bg-emerald-600 text-white p-6 pb-8">
        <h1 className="text-2xl font-bold">Welcome, {currentUser?.name?.split(' ')[0]}!</h1>
        <p className="text-emerald-100 text-sm">{currentUser?.email}</p>
      </div>

      <div className="p-4 -mt-4">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center space-y-1 ${
              activeTab === 'home' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center space-y-1 ${
              activeTab === 'history' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <History className="w-6 h-6" />
            <span className="text-xs">History</span>
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center space-y-1 ${
              activeTab === 'wallet' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <Wallet className="w-6 h-6" />
            <span className="text-xs">Wallet</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center space-y-1 ${
              activeTab === 'profile' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}