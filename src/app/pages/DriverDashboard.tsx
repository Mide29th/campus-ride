import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Home, History, Wallet, User, MapPin, ArrowRight, Phone, Shield, Loader2, Banknote, CheckCircle, Search, Bell, BellRing, X, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { rideAPI, driverAPI, authAPI, userAPI, walletAPI, notificationAPI } from '../services/api';
import { BackButton } from '../components/BackButton';
import { Input } from '../components/ui/input';

// ── Audio alert using Web Audio API (no external files needed) ────────────────
const playRideAlert = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const times = [0, 0.18, 0.36];
    times.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + t + 0.14);
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.16);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.18);
    });
  } catch (e) {
    // Audio not available in this environment
  }
};
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, rides, setRides, driverAvailable, setDriverAvailable, selectedUniversity } = useApp();
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'earnings' | 'profile'>('home');
  const [rideRequests, setRideRequests] = useState<typeof rides>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editVehicleModel, setEditVehicleModel] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editVehicleColor, setEditVehicleColor] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // ── Change Role state ────────────────────────────────────────────────────
  const [showChangeRoleConfirm, setShowChangeRoleConfirm] = useState(false);
  const [isResettingRole, setIsResettingRole] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Notification state ───────────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newRideFlash, setNewRideFlash] = useState(false);
  const prevRideCountRef = useRef<number>(-1);
  const hasInteractedRef = useRef(false);
  // ────────────────────────────────────────────────────────────────────────

  // Mark audio allowed after first user interaction
  useEffect(() => {
    const allow = () => { hasInteractedRef.current = true; };
    window.addEventListener('click', allow, { once: true });
    window.addEventListener('touchstart', allow, { once: true });
    return () => {
      window.removeEventListener('click', allow);
      window.removeEventListener('touchstart', allow);
    };
  }, []);

  // Load banks on mount
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const { banks: bankList } = await walletAPI.getBanks();
        setBanks(bankList);
      } catch (error) {
        console.error('Error loading banks:', error);
      }
    };
    loadBanks();
  }, []);

  // Auto-resolve account when account number is 10 digits and bank is selected
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      const resolveAccount = async () => {
        setIsResolvingAccount(true);
        setAccountName('');
        try {
          const result = await walletAPI.resolveAccount(accountNumber, selectedBank.code);
          setAccountName(result.account_name);
        } catch (error: any) {
          console.error('Error resolving account:', error);
          toast.error(error.message || 'Could not verify account');
          setAccountName('');
        } finally {
          setIsResolvingAccount(false);
        }
      };
      resolveAccount();
    } else {
      setAccountName('');
    }
  }, [accountNumber, selectedBank]);

  // ── Poll for pending rides + notifications when driver is available ────────
  const pollRidesAndNotifs = useCallback(async () => {
    if (!driverAvailable || !selectedUniversity || !currentUser) return;
    try {
      const [pendingRides, notifData] = await Promise.all([
        rideAPI.getPendingRides(selectedUniversity.id),
        notificationAPI.getNotifications(currentUser.id),
      ]);

      // Detect genuinely new rides (more than before)
      const isFirst = prevRideCountRef.current === -1;
      const hasNewRides = !isFirst && pendingRides.length > prevRideCountRef.current;

      if (hasNewRides) {
        if (hasInteractedRef.current) playRideAlert();
        setNewRideFlash(true);
        setTimeout(() => setNewRideFlash(false), 4000);
        toast.success(`🚗 New ride request! ${pendingRides[0]?.riderName || ''} needs a ride`, {
          duration: 6000,
          position: 'top-center',
        });
      }

      prevRideCountRef.current = pendingRides.length;
      setRideRequests(pendingRides);
      setNotifications(notifData.notifications);
      setUnreadCount(notifData.unreadCount);
    } catch (error) {
      console.error('Error polling rides/notifications:', error);
    }
  }, [driverAvailable, selectedUniversity, currentUser]);

  useEffect(() => {
    if (!driverAvailable || !selectedUniversity) {
      prevRideCountRef.current = -1;
      setRideRequests([]);
      return;
    }
    pollRidesAndNotifs();
    const interval = setInterval(pollRidesAndNotifs, 5000);
    return () => clearInterval(interval);
  }, [driverAvailable, selectedUniversity, pollRidesAndNotifs]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleOpenNotifPanel = async () => {
    setShowNotifPanel(true);
    if (unreadCount > 0 && currentUser) {
      try {
        await notificationAPI.markAllRead(currentUser.id);
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch (e) {
        console.error('Error marking notifications read:', e);
      }
    }
  };

  const handleWithdraw = async () => {
    if (!currentUser || !selectedBank || !accountName) return;
    const amount = parseInt(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > (currentUser.walletBalance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    setIsWithdrawing(true);
    try {
      const result = await walletAPI.withdraw({
        amount,
        bank_code: selectedBank.code,
        account_number: accountNumber,
        account_name: accountName,
      });
      setCurrentUser(result.user);
      toast.success(result.message);
      setShowWithdrawForm(false);
      setWithdrawAmount('');
      setAccountNumber('');
      setAccountName('');
      setSelectedBank(null);
      setBankSearch('');
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.message || 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const startEditProfile = () => {
    setEditName(currentUser?.name || '');
    setEditPhone(currentUser?.phoneNumber || '');
    setEditStudentId(currentUser?.studentId || '');
    setEditVehicleModel(currentUser?.vehicleInfo?.model || '');
    setEditVehiclePlate(currentUser?.vehicleInfo?.plateNumber || '');
    setEditVehicleColor(currentUser?.vehicleInfo?.color || '');
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
        vehicleInfo: {
          model: editVehicleModel.trim(),
          plateNumber: editVehiclePlate.trim(),
          color: editVehicleColor.trim(),
        },
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

  const activeRide = rides.find(
    (r) => r.driverId === currentUser?.id && (r.status === 'accepted' || r.status === 'in-progress')
  );

  const completedRides = rides.filter(
    (r) => r.driverId === currentUser?.id && r.status === 'completed'
  );

  const totalEarnings = completedRides.reduce((sum, ride) => sum + ride.fare, 0);
  const todayEarnings = completedRides
    .filter((r) => {
      const today = new Date().toDateString();
      return new Date(r.completedAt!).toDateString() === today;
    })
    .reduce((sum, ride) => sum + ride.fare, 0);

  const handleAvailabilityToggle = async (checked: boolean) => {
    if (!currentUser || !selectedUniversity) return;

    setIsLoading(true);
    try {
      await driverAPI.updateAvailability(currentUser.id, checked, selectedUniversity.id);
      setDriverAvailable(checked);
      toast.success(checked ? 'You are now online' : 'You are now offline');
    } catch (error: any) {
      console.error('Error updating availability:', error);
      toast.error(error.message || 'Failed to update availability');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    setIsLoading(true);
    try {
      const acceptedRide = await rideAPI.acceptRide(rideId);
      
      // Update local state
      const updatedRides = [...rides, acceptedRide];
      setRides(updatedRides);
      setRideRequests((prev) => prev.filter((r) => r.id !== rideId));
      
      toast.success('Ride accepted!');
      navigate('/driver/active-ride');
    } catch (error: any) {
      console.error('Error accepting ride:', error);
      toast.error(error.message || 'Failed to accept ride');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectRide = (rideId: string) => {
    setRideRequests((prev) => prev.filter((r) => r.id !== rideId));
    toast.info('Ride request declined');
  };

  const handleSignOut = async () => {
    await authAPI.logout();
    setCurrentUser(null);
    setRides([]);
    navigate('/login');
    toast.success('Signed out successfully');
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
  
  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-4">
            {/* New ride flash banner */}
            {newRideFlash && (
              <div className="bg-emerald-500 text-white rounded-xl p-4 flex items-center gap-3 animate-pulse shadow-lg">
                <BellRing className="w-6 h-6 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-sm">New ride request!</p>
                  <p className="text-xs text-emerald-100">A student needs a ride — check below</p>
                </div>
              </div>
            )}

            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-blue-100 text-sm">Availability Status</p>
                    <p className="text-2xl font-bold">
                      {driverAvailable ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <Switch
                    checked={driverAvailable}
                    onCheckedChange={handleAvailabilityToggle}
                    className="data-[state=checked]:bg-white"
                  />
                </div>
                <div className="pt-4 border-t border-blue-500">
                  <p className="text-blue-100 text-sm">Today's Earnings</p>
                  <p className="text-3xl font-bold">₦{todayEarnings.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {!driverAvailable && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  You're currently offline. Turn on availability to receive ride requests.
                </p>
              </div>
            )}

            {activeRide && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Active Ride</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Rider</p>
                      <p className="font-medium">{activeRide.riderName}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="font-medium">{activeRide.pickupLocation.name}</p>
                        <p className="text-sm text-gray-600">Pickup</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 mx-auto" />
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium">{activeRide.dropoffLocation.name}</p>
                        <p className="text-sm text-gray-600">Dropoff</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Fare</span>
                        <span className="text-xl font-bold text-emerald-600">₦{activeRide.fare}</span>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => navigate('/driver/active-ride')}
                    >
                      View Ride Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {driverAvailable && !activeRide && rideRequests.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                  <MapPin className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Waiting for Requests</h3>
                <p className="text-gray-600">You'll be notified when a rider needs a ride</p>
                <p className="text-xs text-gray-400 mt-2">Checking every 5 seconds...</p>
              </div>
            )}

            {driverAvailable && !activeRide && rideRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Ride Requests</h3>
                {rideRequests.map((ride) => (
                  <Card key={ride.id} className="border-emerald-200">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Rider</p>
                          <p className="font-medium">{ride.riderName}</p>
                        </div>
                        <div className="flex items-start space-x-3">
                          <MapPin className="w-5 h-5 text-emerald-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">{ride.pickupLocation.name}</p>
                            <ArrowRight className="w-4 h-4 text-gray-400 my-1" />
                            <p className="font-medium">{ride.dropoffLocation.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-emerald-600">₦{ride.fare}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleAcceptRide(ride.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleRejectRide(ride.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                        <p className="font-medium text-sm text-gray-600">Rider: {ride.riderName}</p>
                        <p className="font-medium mt-2">{ride.pickupLocation.name}</p>
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
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case 'earnings':
        const filteredBanks = banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
        return (
          <div className="space-y-4">
            <Card className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              <CardContent className="pt-6">
                <p className="text-emerald-100 text-sm mb-1">Total Earnings</p>
                <p className="text-4xl font-bold mb-6">₦{totalEarnings.toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-500">
                  <div>
                    <p className="text-emerald-100 text-sm">Today</p>
                    <p className="text-xl font-bold">₦{todayEarnings.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm">Total Rides</p>
                    <p className="text-xl font-bold">{completedRides.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5" /> Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600 mb-4">
                  ₦{currentUser?.walletBalance.toLocaleString()}
                </p>
                {!showWithdrawForm ? (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowWithdrawForm(true)}
                    disabled={(currentUser?.walletBalance || 0) <= 0}
                  >
                    Withdraw to Bank
                  </Button>
                ) : (
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="font-medium text-sm">Withdrawal Details</h4>

                    {/* Bank Selection */}
                    <div className="relative">
                      <label className="text-xs text-gray-500 mb-1 block">Select Bank</label>
                      <div className="relative">
                        <Input
                          placeholder="Search bank..."
                          value={selectedBank ? selectedBank.name : bankSearch}
                          onChange={(e) => {
                            setBankSearch(e.target.value);
                            setSelectedBank(null);
                            setShowBankDropdown(true);
                          }}
                          onFocus={() => setShowBankDropdown(true)}
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                      {showBankDropdown && !selectedBank && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredBanks.slice(0, 20).map((bank) => (
                            <button
                              key={bank.code}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50"
                              onClick={() => {
                                setSelectedBank(bank);
                                setBankSearch(bank.name);
                                setShowBankDropdown(false);
                              }}
                            >
                              {bank.name}
                            </button>
                          ))}
                          {filteredBanks.length === 0 && (
                            <p className="px-3 py-2 text-sm text-gray-500">No banks found</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Account Number */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Account Number</label>
                      <Input
                        placeholder="Enter 10-digit account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        maxLength={10}
                      />
                    </div>

                    {/* Account Name */}
                    {isResolvingAccount && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying account...
                      </div>
                    )}
                    {accountName && (
                      <div className="flex items-center gap-2 bg-emerald-50 p-2 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">{accountName}</span>
                      </div>
                    )}

                    {/* Amount */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Amount (₦)</label>
                      <Input
                        type="number"
                        placeholder={`Max: ₦${currentUser?.walletBalance.toLocaleString()}`}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowWithdrawForm(false);
                          setAccountNumber('');
                          setAccountName('');
                          setSelectedBank(null);
                          setBankSearch('');
                          setWithdrawAmount('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleWithdraw}
                        disabled={isWithdrawing || !accountName || !selectedBank || !withdrawAmount}
                      >
                        {isWithdrawing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</> : 'Withdraw'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <CheckCircle className="w-3 h-3" />
              <span>Withdrawals via Paystack - All Nigerian banks supported</span>
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
                <div className="pt-3 border-t">
                  <div className="flex items-center space-x-2 text-emerald-600">
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Verified Driver</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vehicle Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditingProfile ? (
                  <>
                    <div>
                      <label className="text-sm text-gray-600">Model</label>
                      <Input value={editVehicleModel} onChange={(e) => setEditVehicleModel(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Plate Number</label>
                      <Input value={editVehiclePlate} onChange={(e) => setEditVehiclePlate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Color</label>
                      <Input value={editVehicleColor} onChange={(e) => setEditVehicleColor(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Model</p>
                      <p className="font-medium">{currentUser?.vehicleInfo?.model}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Plate Number</p>
                      <p className="font-medium">{currentUser?.vehicleInfo?.plateNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Color</p>
                      <p className="font-medium">{currentUser?.vehicleInfo?.color}</p>
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
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSaveProfile} disabled={isSavingProfile}>
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
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {currentUser?.name?.charAt(0)?.toUpperCase() || 'D'}
              </span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{currentUser?.name}</h1>
              <p className="text-xs text-gray-500">Driver Dashboard</p>
            </div>
          </div>
          {/* Notification bell */}
          <button
            onClick={handleOpenNotifPanel}
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            {unreadCount > 0 ? (
              <BellRing className="w-6 h-6 text-blue-600" />
            ) : (
              <Bell className="w-6 h-6 text-gray-500" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notification panel */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="bg-white w-full max-h-[75vh] rounded-t-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <h2 className="font-bold text-lg">Notifications</h2>
              <button onClick={() => setShowNotifPanel(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif, i) => (
                  <div key={notif.id ?? i} className={`px-4 py-3 border-b flex items-start gap-3 ${notif.read ? 'bg-white' : 'bg-blue-50'}`}>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">New ride from {notif.riderName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {notif.pickupName} → {notif.dropoffName} · ₦{notif.fare}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-4">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-10">
        <div className="max-w-md mx-auto flex">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'history', icon: History, label: 'History' },
            { id: 'earnings', icon: Wallet, label: 'Earnings' },
            { id: 'profile', icon: User, label: 'Profile' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex flex-col items-center py-3 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {id === 'home' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                )}
              </div>
              <span className="text-xs mt-1">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}