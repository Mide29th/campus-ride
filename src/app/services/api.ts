import { projectId, publicAnonKey } from '/utils/supabase/info';
import { User, Ride, Transaction } from '../types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-0be7dc4c`;

// Store access token in memory
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('campusride_token', token);
  } else {
    localStorage.removeItem('campusride_token');
  }
};

export const getAccessToken = (): string | null => {
  if (!accessToken) {
    accessToken = localStorage.getItem('campusride_token');
  }
  return accessToken;
};

const getHeaders = (useAuth = false) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };
  
  if (useAuth) {
    const token = getAccessToken();
    if (token) {
      headers['X-Session-Token'] = token;
    }
  }
  
  return headers;
};

// Auth API
export const authAPI = {
  signup: async (data: {
    email: string;
    password: string;
    name: string;
    role: 'rider' | 'driver';
    phoneNumber: string;
    studentId?: string;
    universityId: string;
    vehicleInfo?: {
      model: string;
      plateNumber: string;
      color: string;
    };
  }) => {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Signup failed');
    }
    
    return result;
  },

  login: async (email: string, password: string): Promise<{ user: User; accessToken: string }> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Login failed');
    }
    
    setAccessToken(result.accessToken);
    return result;
  },

  getSession: async (): Promise<{ user: User; accessToken: string }> => {
    const response = await fetch(`${API_BASE}/auth/session`, {
      method: 'GET',
      headers: getHeaders(true),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Session error');
    }
    
    return result;
  },

  logout: async () => {
    try {
      // Clear session from server KV store
      const token = getAccessToken();
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: getHeaders(true),
        });
      }
    } catch (error) {
      console.log('Error during server logout:', error);
    } finally {
      setAccessToken(null);
    }
  },
};

// User API
export const userAPI = {
  getUser: async (userId: string): Promise<User> => {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch user');
    }
    
    return result.user;
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
    const token = getAccessToken();
    console.log('UpdateUser API call:', { 
      userId, 
      updates, 
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
    });
    
    if (!token) {
      console.error('No access token available');
      throw new Error('No authentication token found. Please login again.');
    }
    
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(updates),
    });
    
    console.log('UpdateUser API response status:', response.status);
    
    // Get the response text first
    const responseText = await response.text();
    console.log('UpdateUser API response text:', responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      throw new Error(`Server error: ${responseText.substring(0, 100)}`);
    }
    
    console.log('UpdateUser API response parsed:', { 
      ok: response.ok, 
      status: response.status,
      result 
    });
    
    if (!response.ok) {
      const errorMessage = result.error || `Failed to update user (Status: ${response.status})`;
      console.error('UpdateUser API error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    if (!result.user) {
      console.error('No user object in response:', result);
      throw new Error('Invalid response from server');
    }
    
    return result.user;
  },
};

// Ride API
export const rideAPI = {
  createRide: async (data: {
    pickupLocation: any;
    dropoffLocation: any;
    fare: number;
    universityId: string;
  }): Promise<Ride> => {
    const response = await fetch(`${API_BASE}/rides`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create ride');
    }
    
    return result.ride;
  },

  getPendingRides: async (universityId: string): Promise<Ride[]> => {
    const response = await fetch(`${API_BASE}/rides/pending/${universityId}`, {
      method: 'GET',
      headers: getHeaders(true),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch pending rides');
    }
    
    return result.rides;
  },

  acceptRide: async (rideId: string): Promise<Ride> => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/accept`, {
      method: 'POST',
      headers: getHeaders(true),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to accept ride');
    }
    
    return result.ride;
  },

  updateRideStatus: async (rideId: string, status: string): Promise<Ride> => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/status`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify({ status }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update ride status');
    }
    
    return result.ride;
  },

  verifyPin: async (rideId: string, pin: string): Promise<{ ride: Ride; message: string }> => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/verify-pin`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ pin }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to verify PIN');
    }
    
    return result;
  },

  getUserRides: async (userId: string): Promise<Ride[]> => {
    const response = await fetch(`${API_BASE}/rides/user/${userId}`, {
      method: 'GET',
      headers: getHeaders(true),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch rides');
    }
    
    return result.rides;
  },

  cancelRide: async (rideId: string): Promise<Ride> => {
    const response = await fetch(`${API_BASE}/rides/${rideId}/cancel`, {
      method: 'POST',
      headers: getHeaders(true),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to cancel ride');
    }
    
    return result.ride;
  },
};

// Wallet API
export const walletAPI = {
  topup: async (amount: number): Promise<{ user: User; transaction: Transaction }> => {
    const response = await fetch(`${API_BASE}/wallet/topup`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ amount }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to top up wallet');
    }
    
    return result;
  },

  getPaystackConfig: async (): Promise<{ publicKey: string }> => {
    const response = await fetch(`${API_BASE}/wallet/paystack/config`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to get payment config');
    return result;
  },

  initializePaystack: async (amount: number): Promise<{ authorization_url: string; access_code: string; reference: string }> => {
    const response = await fetch(`${API_BASE}/wallet/paystack/initialize`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ amount }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to initialize payment');
    return result;
  },

  verifyPaystack: async (reference: string): Promise<{ user: User; transaction?: Transaction; message: string }> => {
    const response = await fetch(`${API_BASE}/wallet/paystack/verify`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ reference }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Payment verification failed');
    return result;
  },

  getBanks: async (): Promise<{ banks: Array<{ name: string; code: string; id: number }> }> => {
    const response = await fetch(`${API_BASE}/wallet/banks`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to fetch banks');
    return result;
  },

  resolveAccount: async (account_number: string, bank_code: string): Promise<{ account_name: string; account_number: string }> => {
    const response = await fetch(`${API_BASE}/wallet/resolve-account`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ account_number, bank_code }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not resolve account');
    return result;
  },

  withdraw: async (data: { amount: number; bank_code: string; account_number: string; account_name: string }): Promise<{ user: User; transaction: Transaction; message: string }> => {
    const response = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Withdrawal failed');
    return result;
  },
};

// Transaction API
export const transactionAPI = {
  getUserTransactions: async (userId: string): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE}/transactions/${userId}`, {
      method: 'GET',
      headers: getHeaders(true),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch transactions');
    }
    
    return result.transactions;
  },
};

// Admin API
export const adminAPI = {
  getStats: async () => {
    const response = await fetch(`${API_BASE}/cr-admin/stats`, {
      method: 'GET',
      headers: getHeaders(true),
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse admin stats response:', responseText);
      throw new Error('Invalid response from server. Please ensure you are logged in as admin.');
    }

    if (!response.ok) throw new Error(result.error || 'Failed to load stats');
    return result as {
      totals: {
        users: number; riders: number; drivers: number; verifiedDrivers: number;
        rides: number; activeRides: number; completedRides: number; cancelledRides: number;
        transactions: number; totalRevenue: number; totalWalletBalance: number;
        topupVolume: number; withdrawalVolume: number;
      };
      signupsByDay: Record<string, number>;
    };
  },
  getUsers: async (): Promise<{ users: User[] }> => {
    const response = await fetch(`${API_BASE}/cr-admin/users`, { method: 'GET', headers: getHeaders(true) });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse admin users response:', responseText);
      throw new Error('Invalid response from server. Please ensure you are logged in as admin.');
    }

    if (!response.ok) throw new Error(result.error || 'Failed to load users');
    return result;
  },
  getRides: async (): Promise<{ rides: Ride[] }> => {
    const response = await fetch(`${API_BASE}/cr-admin/rides`, { method: 'GET', headers: getHeaders(true) });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse admin rides response:', responseText);
      throw new Error('Invalid response from server. Please ensure you are logged in as admin.');
    }

    if (!response.ok) throw new Error(result.error || 'Failed to load rides');
    return result;
  },
  getTransactions: async (): Promise<{ transactions: Transaction[] }> => {
    const response = await fetch(`${API_BASE}/cr-admin/transactions`, { method: 'GET', headers: getHeaders(true) });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse admin transactions response:', responseText);
      throw new Error('Invalid response from server. Please ensure you are logged in as admin.');
    }

    if (!response.ok) throw new Error(result.error || 'Failed to load transactions');
    return result;
  },
  getWebhookConfig: async (): Promise<{ webhookUrl: string }> => {
    const response = await fetch(`${API_BASE}/cr-admin/webhook-config`, { method: 'GET', headers: getHeaders(true) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to get webhook config');
    return result;
  },
  setWebhookConfig: async (webhookUrl: string): Promise<{ success: boolean; webhookUrl: string }> => {
    const response = await fetch(`${API_BASE}/cr-admin/webhook-config`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ webhookUrl }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to set webhook config');
    return result;
  },
};

// Notification API (for drivers)
export const notificationAPI = {
  getNotifications: async (userId: string): Promise<{ notifications: any[]; unreadCount: number }> => {
    const response = await fetch(`${API_BASE}/notifications/${userId}`, { method: 'GET', headers: getHeaders(true) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to fetch notifications');
    return result;
  },
  markAllRead: async (userId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/notifications/${userId}/read-all`, { method: 'POST', headers: getHeaders(true) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to mark notifications as read');
  },
};

// Driver API
export const driverAPI = {
  updateAvailability: async (userId: string, available: boolean, universityId: string) => {
    const response = await fetch(`${API_BASE}/drivers/${userId}/availability`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify({ available, universityId }),
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update availability');
    }
    
    return result;
  },
};

// Maps API
export const mapsAPI = {
  getConfig: async (): Promise<{ apiKey: string }> => {
    const response = await fetch(`${API_BASE}/maps/config`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to get maps config');
    return result;
  },
};