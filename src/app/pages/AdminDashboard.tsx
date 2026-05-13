import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Users, Car, Wallet, TrendingUp, Activity, LogOut, RefreshCw,
  ShieldCheck, ArrowDownCircle, ArrowUpCircle, Loader2, Webhook, CheckCircle2, ExternalLink
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { useApp } from '../context/AppContext';
import { adminAPI, authAPI } from '../services/api';
import { User, Ride, Transaction } from '../types';
import { Input } from '../components/ui/input';

const naira = (n: number) =>
  `₦${(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminAPI.getStats>> | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Webhook config state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSaved, setWebhookSaved] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);

  const loadAll = async () => {
    try {
      setRefreshing(true);
      const [s, u, r, t] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers(),
        adminAPI.getRides(),
        adminAPI.getTransactions(),
      ]);
      setStats(s);
      setUsers(u.users);
      setRides(r.rides);
      setTransactions(t.transactions);
    } catch (err: any) {
      console.error('Admin load error:', err);
      toast.error(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadWebhookConfig = async () => {
    setIsLoadingWebhook(true);
    try {
      const { webhookUrl: url } = await adminAPI.getWebhookConfig();
      setWebhookSaved(url);
      setWebhookUrl(url);
    } catch (e: any) {
      console.error('Failed to load webhook config:', e);
    } finally {
      setIsLoadingWebhook(false);
    }
  };

  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      await adminAPI.setWebhookConfig(webhookUrl.trim());
      setWebhookSaved(webhookUrl.trim());
      toast.success(webhookUrl.trim() ? 'Webhook URL saved! Drivers will now be notified via Make.com.' : 'Webhook URL cleared.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save webhook URL');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    const ADMIN_EMAILS = ['yinkaibrahim68@gmail.com'];
    if (!ADMIN_EMAILS.includes(currentUser.email)) {
      toast.error('Access denied: admin only');
      navigate('/');
      return;
    }
    loadAll();
    loadWebhookConfig();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleLogout = async () => {
    await authAPI.logout();
    setCurrentUser(null);
    navigate('/login');
  };

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const t = stats.totals;
  const signupsData = Object.entries(stats.signupsByDay).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  const activeRides = rides.filter(r =>
    r.status === 'pending' || r.status === 'accepted' || r.status === 'in-progress'
  );

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">CampusRide · {currentUser?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} label="Total Users" value={t.users}
            sub={`${t.riders} riders · ${t.drivers} drivers`} color="bg-emerald-100 text-emerald-700" />
          <StatCard icon={<Activity className="w-5 h-5" />} label="Active Rides" value={t.activeRides}
            sub={`${t.completedRides} completed · ${t.cancelledRides} cancelled`} color="bg-blue-100 text-blue-700" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Revenue" value={naira(t.totalRevenue)}
            sub={`${t.completedRides} completed rides`} color="bg-purple-100 text-purple-700" />
          <StatCard icon={<Wallet className="w-5 h-5" />} label="Wallet Float" value={naira(t.totalWalletBalance)}
            sub={`${t.transactions} transactions`} color="bg-amber-100 text-amber-700" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={<ArrowDownCircle className="w-5 h-5" />} label="Top-ups" value={naira(t.topupVolume)}
            color="bg-emerald-100 text-emerald-700" />
          <StatCard icon={<ArrowUpCircle className="w-5 h-5" />} label="Withdrawals" value={naira(t.withdrawalVolume)}
            color="bg-rose-100 text-rose-700" />
          <StatCard icon={<Car className="w-5 h-5" />} label="Verified Drivers"
            value={`${t.verifiedDrivers}/${t.drivers}`} color="bg-indigo-100 text-indigo-700" />
        </div>

        {/* Signups chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Signups (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signupsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="active">Active ({activeRides.length})</TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="rides">Rides ({rides.length})</TabsTrigger>
            <TabsTrigger value="tx">Transactions</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardContent className="p-0">
                {activeRides.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No active rides right now</div>
                ) : (
                  <div className="divide-y">
                    {activeRides.map(r => (
                      <div key={r.id} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.riderName} → {r.driverName || 'Unassigned'}</div>
                          <div className="text-sm text-gray-500">
                            {r.pickupLocation?.name} → {r.dropoffLocation?.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(r.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={statusColor(r.status)}>{r.status}</Badge>
                          <div className="text-sm font-medium mt-1">{naira(r.fare)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y max-h-[600px] overflow-auto">
                  {users.map(u => (
                    <div key={u.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {u.name}
                          {u.role && <Badge variant="outline" className="text-xs">{u.role}</Badge>}
                          {u.driverVerified && <Badge className="bg-emerald-100 text-emerald-800 text-xs">verified</Badge>}
                        </div>
                        <div className="text-sm text-gray-500">{u.email} · {u.phoneNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{naira(u.walletBalance)}</div>
                        <div className="text-xs text-gray-400">
                          {(u as any).createdAt ? new Date((u as any).createdAt).toLocaleDateString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rides">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y max-h-[600px] overflow-auto">
                  {rides.map(r => (
                    <div key={r.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.riderName} → {r.driverName || '—'}</div>
                        <div className="text-sm text-gray-500">
                          {r.pickupLocation?.name} → {r.dropoffLocation?.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={statusColor(r.status)}>{r.status}</Badge>
                        <div className="text-sm font-medium mt-1">{naira(r.fare)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tx">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y max-h-[600px] overflow-auto">
                  {transactions.map(tx => (
                    <div key={tx.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{tx.type}</Badge>
                          <span className="text-sm">{tx.description}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(tx.createdAt).toLocaleString()} · {tx.userId.slice(0, 8)}
                        </div>
                      </div>
                      <div className={`font-medium ${tx.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {tx.amount < 0 ? '-' : '+'}{naira(Math.abs(tx.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-purple-600" />
                    Make.com Webhook — Driver Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    When a student books a ride, CampusRide will send the ride details to your Make.com webhook.
                    Make.com can then automatically send a <strong>WhatsApp message</strong> or <strong>SMS</strong> to all online drivers.
                  </p>

                  {/* Status badge */}
                  {webhookSaved ? (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs text-emerald-700 font-medium">Active — webhook is configured</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-amber-700">⚠️ No webhook configured — drivers only get in-app alerts</span>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Make.com Webhook URL</label>
                    <Input
                      placeholder="https://hook.eu1.make.com/xxxxxxxxxxxxx"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      disabled={isLoadingWebhook}
                    />
                    <p className="text-xs text-gray-400 mt-1">Leave empty to disable Make.com notifications</p>
                  </div>

                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook || isLoadingWebhook}
                  >
                    {isSavingWebhook ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Webhook URL'}
                  </Button>

                  {/* Setup guide */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 border">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">How to set up Make.com → WhatsApp</p>
                    <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                      <li>Go to <strong>make.com</strong> and create a new scenario</li>
                      <li>Add a <strong>Webhooks → Custom webhook</strong> trigger</li>
                      <li>Copy the generated URL and paste it above</li>
                      <li>Add a <strong>WhatsApp Business</strong> or <strong>Twilio SMS</strong> action</li>
                      <li>Map the fields: <code className="bg-white px-1 rounded">ride.pickupName</code>, <code className="bg-white px-1 rounded">ride.dropoffName</code>, <code className="bg-white px-1 rounded">ride.fare</code>, <code className="bg-white px-1 rounded">drivers[].phone</code></li>
                      <li>Activate the scenario — done! ✅</li>
                    </ol>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs font-medium text-blue-800 mb-1">📦 Payload sent to Make.com on each new ride:</p>
                    <pre className="text-xs text-blue-700 overflow-x-auto">{JSON.stringify({
                      event: "new_ride_request",
                      ride: { pickupName: "Gate A", dropoffName: "Library", fare: 300, riderName: "John" },
                      drivers: [{ name: "Driver Name", phone: "0801234567" }],
                      driversCount: 1
                    }, null, 2)}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, color,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}