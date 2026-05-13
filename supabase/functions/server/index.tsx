import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// Create Supabase clients
// Service role client for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Anon client for user authentication validation
const supabaseAnon = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// Helper function to get session token from request
const getSessionToken = (c: any): string | null => {
  // Check X-Session-Token header first (new approach)
  const sessionToken = c.req.header('X-Session-Token');
  if (sessionToken) return sessionToken;
  // Fallback: check Authorization header for backward compatibility
  const authHeader = c.req.header('Authorization')?.split(' ')[1];
  // Only use auth header if it looks like a session token (not the anon key)
  if (authHeader && authHeader.startsWith('session_')) return authHeader;
  return null;
};

// Helper function to validate session token
const validateSession = async (token: string | null) => {
  if (!token) {
    return { valid: false, userId: null };
  }

  const session = await kv.get(`session:${token}`);
  if (!session) {
    return { valid: false, userId: null };
  }

  // Check if session is expired
  if (Date.now() > session.expiresAt) {
    await kv.del(`session:${token}`);
    return { valid: false, userId: null };
  }

  return { valid: true, userId: session.userId };
};

// Enable logger
app.use('*', logger(console.log));

// Helper: get Paystack keys (env var first, then KV fallback)
const getPaystackSecretKey = async (): Promise<string | null> => {
  const envKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (envKey && envKey.startsWith('sk_')) return envKey.trim();
  const kvKey = await kv.get('config:paystack_secret_key');
  if (kvKey) return kvKey;
  return null;
};

const getPaystackPublicKey = async (): Promise<string | null> => {
  const envKey = Deno.env.get('PAYSTACK_PUBLIC_KEY');
  if (envKey && envKey.startsWith('pk_')) return envKey.trim();
  const kvKey = await kv.get('config:paystack_public_key');
  if (kvKey) return kvKey;
  return null;
};

// Store Paystack keys in KV on startup as fallback
(async () => {
  try {
    // Always sync env-var keys into KV so stale test keys are overwritten
    const envSecret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
    const envPublic = Deno.env.get('PAYSTACK_PUBLIC_KEY')?.trim();

    if (envSecret && envSecret.startsWith('sk_')) {
      await kv.set('config:paystack_secret_key', envSecret);
      console.log('Paystack secret key synced to KV:', envSecret.substring(0, 12) + '...');
    } else {
      const existing = await kv.get('config:paystack_secret_key');
      if (!existing) {
        console.log('WARNING: PAYSTACK_SECRET_KEY env var not set and no KV fallback exists.');
      }
    }

    if (envPublic && envPublic.startsWith('pk_')) {
      const existingPublic = await kv.get('config:paystack_public_key');
      if (existingPublic && existingPublic !== envPublic) {
        const wasTest = existingPublic.startsWith('pk_test');
        const nowLive = envPublic.startsWith('pk_live');
        console.log(
          `Paystack public key ${wasTest && nowLive ? 'UPGRADED from test → live' : 'updated'}: ${envPublic.substring(0, 12)}...`
        );
      }
      await kv.set('config:paystack_public_key', envPublic);
      console.log('Paystack public key synced to KV:', envPublic.substring(0, 12) + '...');
    } else {
      const existing = await kv.get('config:paystack_public_key');
      if (!existing) {
        console.log('WARNING: PAYSTACK_PUBLIC_KEY env var not set and no KV fallback exists.');
      }
    }
  } catch (e) {
    console.log('Error syncing Paystack keys to KV:', e);
  }
})();

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Session-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-0be7dc4c/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== AUTH ROUTES ====================

// Sign up
app.post("/make-server-0be7dc4c/auth/signup", async (c) => {
  try {
    const { email, password, name, role, phoneNumber, studentId, universityId, vehicleInfo } = await c.req.json();

    // Validate email domain
    const emailDomain = email?.split('@')[1]?.toLowerCase();
    if (emailDomain !== 'gmail.com' && emailDomain !== 'yahoo.com') {
      return c.json({ error: 'Only Gmail and Yahoo email addresses are allowed' }, 400);
    }

    // Check if user already exists
    const existingUserId = await kv.get(`user_email:${email}`);
    if (existingUserId) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }

    // Create auth user with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (authError) {
      console.log('Error creating auth user:', authError);
      return c.json({ error: `Failed to create user: ${authError.message}` }, 400);
    }

    const userId = authData.user.id;

    // Create user object
    const user = {
      id: userId,
      email,
      name,
      role,
      walletBalance: 1000,
      phoneNumber,
      studentId,
      universityId,
      driverVerified: role === 'driver' ? false : undefined,
      vehicleInfo: role === 'driver' ? vehicleInfo : undefined,
      createdAt: new Date().toISOString(),
    };

    // Store in KV
    await kv.set(`user:${userId}`, user);
    await kv.set(`user_email:${email}`, userId);

    return c.json({ message: 'Account created successfully' }, 201);
  } catch (error) {
    console.log('Error in signup:', error);
    return c.json({ error: `Signup failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Login
app.post("/make-server-0be7dc4c/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    console.log('=== LOGIN REQUEST ===');
    console.log('Email:', email);

    // Validate email domain
    const emailDomain = email?.split('@')[1]?.toLowerCase();
    if (emailDomain !== 'gmail.com' && emailDomain !== 'yahoo.com') {
      return c.json({ error: 'Only Gmail and Yahoo email addresses are allowed' }, 400);
    }

    // Authenticate with Supabase using anon client
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Login error from Supabase:', error);
      return c.json({ error: `Login failed: ${error.message}` }, 401);
    }
    
    if (!data.session || !data.user) {
      console.log('No session or user returned from Supabase');
      return c.json({ error: 'Login failed: No session created' }, 401);
    }

    const userId = data.user.id;
    
    // Create a simple session token (UUID-based)
    const sessionToken = `session_${userId}_${crypto.randomUUID()}`;
    const sessionExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    
    console.log('Creating session:', { 
      userId, 
      tokenPreview: sessionToken.substring(0, 30) + '...',
      expiresAt: new Date(sessionExpiry).toISOString()
    });

    // Store session in KV
    await kv.set(`session:${sessionToken}`, {
      userId,
      createdAt: Date.now(),
      expiresAt: sessionExpiry
    });

    // Get user from KV
    const user = await kv.get(`user:${userId}`);
    if (!user) {
      console.log('User not found in KV store after successful auth login:', userId);
      return c.json({ error: 'User not found in database. Please contact support.' }, 404);
    }

    console.log('User found in KV store:', { userId, hasUniversityId: !!user.universityId });
    console.log('=== LOGIN SUCCESS ===');
    return c.json({ user, accessToken: sessionToken });
  } catch (error) {
    console.log('Exception in login:', error);
    return c.json({ error: `Login failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Logout - clear session from KV
app.post("/make-server-0be7dc4c/auth/logout", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    if (accessToken) {
      await kv.del(`session:${accessToken}`);
      console.log('Session cleared for token:', accessToken.substring(0, 30) + '...');
    }
    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.log('Error in logout:', error);
    return c.json({ message: 'Logged out' });
  }
});

// Get session
app.get("/make-server-0be7dc4c/auth/session", async (c) => {
  try {
    console.log('=== GET SESSION REQUEST ===');
    const accessToken = getSessionToken(c);
    console.log('Token present:', !!accessToken);
    console.log('Token preview:', accessToken ? accessToken.substring(0, 30) + '...' : 'none');
    
    if (!accessToken) {
      console.log('❌ No access token provided');
      return c.json({ error: 'No access token provided' }, 401);
    }

    // Validate session using our custom session validation
    const { valid, userId } = await validateSession(accessToken);
    console.log('Session validation result:', { valid, userId });
    
    if (!valid || !userId) {
      console.log('❌ Invalid or expired session');
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    // Get user from KV
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      console.log('❌ User not found:', userId);
      return c.json({ error: 'User not found' }, 404);
    }

    console.log('✅ Session valid for user:', userId);
    console.log('=== GET SESSION SUCCESS ===');
    return c.json({ user, accessToken });
  } catch (error) {
    console.log('❌ Exception in get session:', error);
    return c.json({ error: `Session error: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== USER ROUTES ====================

// Get user profile
app.get("/make-server-0be7dc4c/users/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const user = await kv.get(`user:${userId}`);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.log('Error fetching user:', error);
    return c.json({ error: `Failed to fetch user: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Update user profile
app.put("/make-server-0be7dc4c/users/:userId", async (c) => {
  try {
    console.log('=== UPDATE USER REQUEST START ===');
    const userId = c.req.param('userId');
    console.log('Request userId:', userId);
    
    const accessToken = getSessionToken(c);
    console.log('Session token present:', !!accessToken);
    console.log('Session token preview:', accessToken ? accessToken.substring(0, 30) + '...' : 'none');
    
    if (!accessToken) {
      console.log('❌ Error: No session token provided');
      return c.json({ error: 'Unauthorized: No session token' }, 401);
    }
    
    console.log('Validating session token...');
    const { valid, userId: sessionUserId } = await validateSession(accessToken);
    console.log('Session validation result:', { valid, sessionUserId });
    
    if (!valid || !sessionUserId) {
      console.log('❌ Error: Invalid or expired token');
      return c.json({ error: 'Unauthorized: Invalid or expired session' }, 401);
    }

    if (sessionUserId !== userId) {
      console.log('❌ Error: User ID mismatch', { sessionUserId, requestedUserId: userId });
      return c.json({ error: 'Forbidden: Cannot update another user' }, 403);
    }

    const updates = await c.req.json();
    console.log('Update payload:', updates);
    
    console.log('Fetching current user from KV...');
    const currentUser = await kv.get(`user:${userId}`);
    console.log('Current user found:', !!currentUser);
    
    if (!currentUser) {
      console.log('❌ Error: User not found in KV store', userId);
      return c.json({ error: 'User not found' }, 404);
    }

    console.log('Merging user data...');
    const updatedUser = { ...currentUser, ...updates };
    console.log('Updated user data:', updatedUser);
    
    console.log('Saving to KV store...');
    await kv.set(`user:${userId}`, updatedUser);
    console.log('✅ User updated successfully');
    console.log('=== UPDATE USER REQUEST END ===');

    return c.json({ user: updatedUser });
  } catch (error) {
    console.log('❌ EXCEPTION in update user:', error);
    console.log('Exception stack:', error instanceof Error ? error.stack : 'no stack');
    return c.json({ error: `Failed to update user: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== RIDE ROUTES ====================

// Create a ride
app.post("/make-server-0be7dc4c/rides", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { pickupLocation, dropoffLocation, fare, universityId } = await c.req.json();
    const riderId = authUserId;

    // Get rider info
    const rider = await kv.get(`user:${riderId}`);
    if (!rider) {
      return c.json({ error: 'Rider not found' }, 404);
    }

    // Check wallet balance
    if (rider.walletBalance < fare) {
      return c.json({ error: 'Insufficient wallet balance' }, 400);
    }

    // Generate PIN
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    // Create ride
    const rideId = `ride-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ride = {
      id: rideId,
      riderId,
      riderName: rider.name,
      pickupLocation,
      dropoffLocation,
      status: 'pending',
      fare,
      pin,
      universityId,
      createdAt: new Date().toISOString(),
    };

    // Store ride
    await kv.set(`ride:${rideId}`, ride);

    // Add to pending rides for university
    const pendingRidesKey = `pending_rides:${universityId}`;
    const pendingRides = (await kv.get(pendingRidesKey)) || [];
    pendingRides.push(rideId);
    await kv.set(pendingRidesKey, pendingRides);

    // Add to user's rides
    const userRidesKey = `user_rides:${riderId}`;
    const userRides = (await kv.get(userRidesKey)) || [];
    userRides.push(rideId);
    await kv.set(userRidesKey, userRides);

    // ── Notify available drivers ──────────────────────────────────────────────
    const availDriverIds: string[] = (await kv.get(`driver_availability:${universityId}`)) || [];
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const driverPhones: Array<{ name: string; phone: string }> = [];

    for (const driverId of availDriverIds) {
      // Store in-app notification per driver
      const driverNotifsKey = `driver_notifications:${driverId}`;
      const existing: any[] = (await kv.get(driverNotifsKey)) || [];
      existing.unshift({
        id: notifId,
        type: 'new_ride',
        rideId,
        pickupName: pickupLocation.name,
        dropoffName: dropoffLocation.name,
        fare,
        riderName: rider.name,
        createdAt: new Date().toISOString(),
        read: false,
      });
      // Keep only latest 20 notifications
      await kv.set(driverNotifsKey, existing.slice(0, 20));

      // Collect driver phone for webhook
      const driverUser = await kv.get(`user:${driverId}`);
      if (driverUser?.phoneNumber) {
        driverPhones.push({ name: driverUser.name, phone: driverUser.phoneNumber });
      }
    }

    // Fire Make.com webhook if configured (async, non-blocking)
    const webhookUrl = await kv.get('config:makecom_webhook_url');
    if (webhookUrl && availDriverIds.length > 0) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_ride_request',
          ride: {
            id: rideId,
            pickupName: pickupLocation.name,
            dropoffName: dropoffLocation.name,
            fare,
            riderName: rider.name,
            createdAt: ride.createdAt,
          },
          drivers: driverPhones,
          driversCount: availDriverIds.length,
          timestamp: new Date().toISOString(),
        }),
      }).catch((e) => console.log('Make.com webhook error (non-fatal):', e));
      console.log(`Webhook fired for ${driverPhones.length} drivers`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    return c.json({ ride }, 201);
  } catch (error) {
    console.log('Error creating ride:', error);
    return c.json({ error: `Failed to create ride: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Get pending rides for a university
app.get("/make-server-0be7dc4c/rides/pending/:universityId", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const universityId = c.req.param('universityId');
    const pendingRideIds = (await kv.get(`pending_rides:${universityId}`)) || [];
    
    const rides = [];
    for (const rideId of pendingRideIds) {
      const ride = await kv.get(`ride:${rideId}`);
      if (ride && ride.status === 'pending') {
        rides.push(ride);
      }
    }

    return c.json({ rides });
  } catch (error) {
    console.log('Error fetching pending rides:', error);
    return c.json({ error: `Failed to fetch rides: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Accept a ride (driver)
app.post("/make-server-0be7dc4c/rides/:rideId/accept", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const rideId = c.req.param('rideId');
    const driverId = authUserId;

    // Get driver info
    const driver = await kv.get(`user:${driverId}`);
    if (!driver || driver.role !== 'driver') {
      return c.json({ error: 'Only drivers can accept rides' }, 403);
    }

    // Get ride
    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404);
    }

    if (ride.status !== 'pending') {
      return c.json({ error: 'Ride is no longer available' }, 400);
    }

    // Update ride
    const updatedRide = {
      ...ride,
      driverId,
      driverName: driver.name,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
    };

    await kv.set(`ride:${rideId}`, updatedRide);

    // Remove from pending rides
    const pendingRidesKey = `pending_rides:${ride.universityId}`;
    const pendingRides = (await kv.get(pendingRidesKey)) || [];
    const filteredRides = pendingRides.filter((id: string) => id !== rideId);
    await kv.set(pendingRidesKey, filteredRides);

    // Add to driver's rides
    const driverRidesKey = `user_rides:${driverId}`;
    const driverRides = (await kv.get(driverRidesKey)) || [];
    driverRides.push(rideId);
    await kv.set(driverRidesKey, driverRides);

    return c.json({ ride: updatedRide });
  } catch (error) {
    console.log('Error accepting ride:', error);
    return c.json({ error: `Failed to accept ride: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Update ride status
app.put("/make-server-0be7dc4c/rides/:rideId/status", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const rideId = c.req.param('rideId');
    const { status } = await c.req.json();

    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404);
    }

    // Verify user is part of this ride
    if (ride.riderId !== authUserId && ride.driverId !== authUserId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const updatedRide = { ...ride, status };
    await kv.set(`ride:${rideId}`, updatedRide);

    return c.json({ ride: updatedRide });
  } catch (error) {
    console.log('Error updating ride status:', error);
    return c.json({ error: `Failed to update ride status: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Cancel a ride (rider only, only if pending or accepted)
app.post("/make-server-0be7dc4c/rides/:rideId/cancel", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const rideId = c.req.param('rideId');
    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404);
    }

    // Only the rider can cancel
    if (ride.riderId !== authUserId) {
      return c.json({ error: 'Only the rider can cancel this ride' }, 403);
    }

    // Cannot cancel rides that are already completed or cancelled
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return c.json({ error: `Cannot cancel a ride that is already ${ride.status}` }, 400);
    }

    // Refund fare to rider's wallet for any cancellable ride
    const riderUser = await kv.get(`user:${authUserId}`);
    if (riderUser && ride.fare) {
      const refundedUser = { ...riderUser, walletBalance: (riderUser.walletBalance || 0) + ride.fare };
      await kv.set(`user:${authUserId}`, refundedUser);
      console.log('Refunded fare to rider:', { fare: ride.fare, newBalance: refundedUser.walletBalance });
    }

    const updatedRide = { ...ride, status: 'cancelled', cancelledAt: new Date().toISOString() };
    await kv.set(`ride:${rideId}`, updatedRide);

    return c.json({ ride: updatedRide, message: 'Ride cancelled successfully' });
  } catch (error) {
    console.log('Error cancelling ride:', error);
    return c.json({ error: `Failed to cancel ride: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Verify PIN and complete ride
app.post("/make-server-0be7dc4c/rides/:rideId/verify-pin", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const rideId = c.req.param('rideId');
    const { pin } = await c.req.json();

    const ride = await kv.get(`ride:${rideId}`);
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404);
    }

    // Verify user is the driver
    if (ride.driverId !== authUserId) {
      return c.json({ error: 'Only the driver can verify PIN' }, 403);
    }

    // Verify PIN
    if (ride.pin !== pin) {
      return c.json({ error: 'Invalid PIN' }, 400);
    }

    // Update ride status
    const completedRide = {
      ...ride,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
    await kv.set(`ride:${rideId}`, completedRide);

    // Process payment
    const rider = await kv.get(`user:${ride.riderId}`);
    const driver = await kv.get(`user:${ride.driverId}`);

    if (rider && driver) {
      // Deduct from rider
      rider.walletBalance -= ride.fare;
      await kv.set(`user:${ride.riderId}`, rider);

      // Add to driver
      driver.walletBalance += ride.fare;
      await kv.set(`user:${ride.driverId}`, driver);

      // Create transactions
      const riderTxId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const riderTx = {
        id: riderTxId,
        userId: ride.riderId,
        type: 'ride',
        amount: -ride.fare,
        description: `Ride from ${ride.pickupLocation.name} to ${ride.dropoffLocation.name}`,
        createdAt: new Date().toISOString(),
      };
      await kv.set(`transaction:${riderTxId}`, riderTx);

      const riderTxs = (await kv.get(`user_transactions:${ride.riderId}`)) || [];
      riderTxs.push(riderTxId);
      await kv.set(`user_transactions:${ride.riderId}`, riderTxs);

      const driverTxId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const driverTx = {
        id: driverTxId,
        userId: ride.driverId,
        type: 'ride',
        amount: ride.fare,
        description: `Ride from ${ride.pickupLocation.name} to ${ride.dropoffLocation.name}`,
        createdAt: new Date().toISOString(),
      };
      await kv.set(`transaction:${driverTxId}`, driverTx);

      const driverTxs = (await kv.get(`user_transactions:${ride.driverId}`)) || [];
      driverTxs.push(driverTxId);
      await kv.set(`user_transactions:${ride.driverId}`, driverTxs);
    }

    return c.json({ ride: completedRide, message: 'Ride completed successfully' });
  } catch (error) {
    console.log('Error verifying PIN:', error);
    return c.json({ error: `Failed to verify PIN: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Get user's rides
app.get("/make-server-0be7dc4c/rides/user/:userId", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');
    if (authUserId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const rideIds = (await kv.get(`user_rides:${userId}`)) || [];
    const rides = [];
    
    for (const rideId of rideIds) {
      const ride = await kv.get(`ride:${rideId}`);
      if (ride) {
        rides.push(ride);
      }
    }

    // Sort by date descending
    rides.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ rides });
  } catch (error) {
    console.log('Error fetching user rides:', error);
    return c.json({ error: `Failed to fetch rides: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== WALLET ROUTES ====================

// Initialize Paystack transaction for wallet funding
app.post("/make-server-0be7dc4c/wallet/paystack/initialize", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { amount } = await c.req.json();
    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    const user = await kv.get(`user:${authUserId}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const paystackSecretKey = await getPaystackSecretKey();
    if (!paystackSecretKey) {
      console.log('PAYSTACK_SECRET_KEY is not set. Available env vars:', Object.keys(Deno.env.toObject()).filter(k => k.includes('PAYSTACK') || k.includes('paystack')));
      return c.json({ error: 'Payment service not configured: PAYSTACK_SECRET_KEY missing' }, 500);
    }

    console.log('PAYSTACK_SECRET_KEY present, length:', paystackSecretKey.length, 'starts with:', paystackSecretKey.substring(0, 8));

    // Initialize transaction with Paystack (amount in kobo)
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: amount * 100, // Convert to kobo
        reference: `cr_fund_${authUserId}_${Date.now()}`,
        metadata: {
          userId: authUserId,
          type: 'wallet_funding',
        },
      }),
    });

    const result = await response.json();
    console.log('Paystack initialize response status:', response.status, 'body:', JSON.stringify(result));

    if (!result.status) {
      return c.json({ error: result.message || 'Failed to initialize payment' }, 400);
    }

    return c.json({
      authorization_url: result.data.authorization_url,
      access_code: result.data.access_code,
      reference: result.data.reference,
    });
  } catch (error) {
    console.log('Error initializing Paystack transaction:', error);
    return c.json({ error: `Payment initialization failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Verify Paystack transaction and credit wallet
app.post("/make-server-0be7dc4c/wallet/paystack/verify", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { reference } = await c.req.json();
    if (!reference) {
      return c.json({ error: 'Transaction reference required' }, 400);
    }

    const paystackSecretKey = await getPaystackSecretKey();

    // Verify with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    const result = await response.json();
    console.log('Paystack verify response:', result);

    if (!result.status || result.data.status !== 'success') {
      return c.json({ error: 'Payment verification failed' }, 400);
    }

    // Check if this transaction was already processed
    const existingTx = await kv.get(`paystack_ref:${reference}`);
    if (existingTx) {
      const user = await kv.get(`user:${authUserId}`);
      return c.json({ user, message: 'Transaction already processed' });
    }

    const amountInNaira = result.data.amount / 100;

    // Credit user wallet
    const user = await kv.get(`user:${authUserId}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    user.walletBalance = (user.walletBalance || 0) + amountInNaira;
    await kv.set(`user:${authUserId}`, user);

    // Create transaction record
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction = {
      id: txId,
      userId: authUserId,
      type: 'topup',
      amount: amountInNaira,
      description: `Wallet funding via Paystack`,
      reference,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`transaction:${txId}`, transaction);

    const userTxs = (await kv.get(`user_transactions:${authUserId}`)) || [];
    userTxs.push(txId);
    await kv.set(`user_transactions:${authUserId}`, userTxs);

    // Mark reference as processed
    await kv.set(`paystack_ref:${reference}`, { txId, processedAt: new Date().toISOString() });

    return c.json({ user, transaction, message: 'Wallet funded successfully' });
  } catch (error) {
    console.log('Error verifying Paystack transaction:', error);
    return c.json({ error: `Payment verification failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Get Paystack public key for frontend
app.get("/make-server-0be7dc4c/wallet/paystack/config", async (c) => {
  try {
    const publicKey = await getPaystackPublicKey();
    if (!publicKey) {
      return c.json({ error: 'Payment service not configured' }, 500);
    }
    return c.json({ publicKey });
  } catch (error) {
    return c.json({ error: 'Failed to get payment config' }, 500);
  }
});

// List Nigerian banks from Paystack
app.get("/make-server-0be7dc4c/wallet/banks", async (c) => {
  try {
    const paystackSecretKey = await getPaystackSecretKey();
    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      headers: { 'Authorization': `Bearer ${paystackSecretKey}` },
    });
    const result = await response.json();
    if (!result.status) {
      return c.json({ error: 'Failed to fetch banks' }, 400);
    }
    return c.json({ banks: result.data });
  } catch (error) {
    console.log('Error fetching banks:', error);
    return c.json({ error: `Failed to fetch banks: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Resolve bank account name
app.post("/make-server-0be7dc4c/wallet/resolve-account", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid } = await validateSession(accessToken);
    if (!valid) return c.json({ error: 'Unauthorized' }, 401);

    const { account_number, bank_code } = await c.req.json();
    const paystackSecretKey = await getPaystackSecretKey();

    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { 'Authorization': `Bearer ${paystackSecretKey}` } }
    );
    const result = await response.json();
    console.log('Resolve account response:', result);

    if (!result.status) {
      return c.json({ error: result.message || 'Could not resolve account' }, 400);
    }

    return c.json({ account_name: result.data.account_name, account_number: result.data.account_number });
  } catch (error) {
    console.log('Error resolving account:', error);
    return c.json({ error: `Failed to resolve account: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Driver withdrawal request
app.post("/make-server-0be7dc4c/wallet/withdraw", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    if (!valid || !authUserId) return c.json({ error: 'Unauthorized' }, 401);

    const { amount, bank_code, account_number, account_name } = await c.req.json();

    const user = await kv.get(`user:${authUserId}`);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (user.role !== 'driver') return c.json({ error: 'Only drivers can withdraw' }, 403);
    if (amount <= 0 || amount > user.walletBalance) {
      return c.json({ error: 'Invalid withdrawal amount or insufficient balance' }, 400);
    }

    const paystackSecretKey = await getPaystackSecretKey();

    // Step 1: Create transfer recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: account_name,
        account_number,
        bank_code,
        currency: 'NGN',
      }),
    });
    const recipientResult = await recipientRes.json();
    console.log('Transfer recipient result:', recipientResult);

    if (!recipientResult.status) {
      return c.json({ error: recipientResult.message || 'Failed to create transfer recipient' }, 400);
    }

    const recipientCode = recipientResult.data.recipient_code;

    // Step 2: Initiate transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100, // kobo
        recipient: recipientCode,
        reason: `CampusRide driver withdrawal - ${authUserId}`,
        reference: `cr_withdraw_${authUserId}_${Date.now()}`,
      }),
    });
    const transferResult = await transferRes.json();
    console.log('Transfer result:', transferResult);

    // Note: In test mode, transfers may not actually process but we still deduct
    // In production, you'd use webhooks to confirm before deducting

    // Deduct from wallet
    user.walletBalance = (user.walletBalance || 0) - amount;
    await kv.set(`user:${authUserId}`, user);

    // Create transaction record
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction = {
      id: txId,
      userId: authUserId,
      type: 'withdrawal',
      amount: -amount,
      description: `Withdrawal to ${account_name} (${account_number})`,
      reference: transferResult.data?.reference || `cr_withdraw_${authUserId}_${Date.now()}`,
      status: transferResult.status ? 'processing' : 'failed',
      createdAt: new Date().toISOString(),
    };
    await kv.set(`transaction:${txId}`, transaction);

    const userTxs = (await kv.get(`user_transactions:${authUserId}`)) || [];
    userTxs.push(txId);
    await kv.set(`user_transactions:${authUserId}`, userTxs);

    return c.json({
      user,
      transaction,
      message: transferResult.status
        ? 'Withdrawal initiated successfully. Funds will arrive shortly.'
        : 'Withdrawal request submitted. Note: In test mode, actual transfers may not process.',
    });
  } catch (error) {
    console.log('Error processing withdrawal:', error);
    return c.json({ error: `Withdrawal failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Top up wallet (legacy - keep for backward compatibility)
app.post("/make-server-0be7dc4c/wallet/topup", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { amount } = await c.req.json();
    const userId = authUserId;

    if (amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    // Get user
    const user = await kv.get(`user:${userId}`);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Update wallet balance
    user.walletBalance += amount;
    await kv.set(`user:${userId}`, user);

    // Create transaction
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction = {
      id: txId,
      userId,
      type: 'topup',
      amount,
      description: 'Wallet top-up',
      createdAt: new Date().toISOString(),
    };
    await kv.set(`transaction:${txId}`, transaction);

    const userTxs = (await kv.get(`user_transactions:${userId}`)) || [];
    userTxs.push(txId);
    await kv.set(`user_transactions:${userId}`, userTxs);

    return c.json({ user, transaction });
  } catch (error) {
    console.log('Error topping up wallet:', error);
    return c.json({ error: `Failed to top up wallet: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== TRANSACTION ROUTES ====================

// Get user transactions
app.get("/make-server-0be7dc4c/transactions/:userId", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');
    if (authUserId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const txIds = (await kv.get(`user_transactions:${userId}`)) || [];
    const transactions = [];
    
    for (const txId of txIds) {
      const tx = await kv.get(`transaction:${txId}`);
      if (tx) {
        transactions.push(tx);
      }
    }

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ transactions });
  } catch (error) {
    console.log('Error fetching transactions:', error);
    return c.json({ error: `Failed to fetch transactions: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== DRIVER ROUTES ====================

// Update driver availability
app.put("/make-server-0be7dc4c/drivers/:userId/availability", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    
    if (!valid || !authUserId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');
    if (authUserId !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { available, universityId } = await c.req.json();

    const user = await kv.get(`user:${userId}`);
    if (!user || user.role !== 'driver') {
      return c.json({ error: 'User is not a driver' }, 403);
    }

    const availKey = `driver_availability:${universityId}`;
    const availableDrivers = (await kv.get(availKey)) || [];

    if (available && !availableDrivers.includes(userId)) {
      availableDrivers.push(userId);
      await kv.set(availKey, availableDrivers);
    } else if (!available && availableDrivers.includes(userId)) {
      const filtered = availableDrivers.filter((id: string) => id !== userId);
      await kv.set(availKey, filtered);
    }

    return c.json({ success: true, available });
  } catch (error) {
    console.log('Error updating driver availability:', error);
    return c.json({ error: `Failed to update availability: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== ADMIN ROUTES ====================

const ADMIN_EMAILS = [
  'yinkaibrahim68@gmail.com'
];

const requireAdmin = async (c: any) => {
  const token = getSessionToken(c);
  const { valid, userId } = await validateSession(token);
  if (!valid || !userId) return { ok: false, error: 'Unauthorized', status: 401 };
  const user = await kv.get(`user:${userId}`);
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return { ok: false, error: 'Forbidden: admin only', status: 403 };
  }
  return { ok: true, user };
};

app.get("/make-server-0be7dc4c/cr-admin/stats", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);

    const users = await kv.getByPrefix('user:');
    const rides = await kv.getByPrefix('ride:');
    const transactions = await kv.getByPrefix('transaction:');

    const riders = users.filter((u: any) => u?.role === 'rider');
    const drivers = users.filter((u: any) => u?.role === 'driver');
    const activeRides = rides.filter((r: any) =>
      r && (r.status === 'pending' || r.status === 'accepted' || r.status === 'in-progress')
    );
    const completedRides = rides.filter((r: any) => r?.status === 'completed');

    const totalRevenue = completedRides.reduce((sum: number, r: any) => sum + (r.fare || 0), 0);
    const totalWalletBalance = users.reduce((sum: number, u: any) => sum + (u?.walletBalance || 0), 0);
    const topupVolume = transactions
      .filter((t: any) => t?.type === 'topup')
      .reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const withdrawalVolume = transactions
      .filter((t: any) => t?.type === 'withdrawal')
      .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);

    // Signups over last 14 days
    const signupsByDay: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      signupsByDay[d.toISOString().slice(0, 10)] = 0;
    }
    users.forEach((u: any) => {
      if (!u?.createdAt) return;
      const day = new Date(u.createdAt).toISOString().slice(0, 10);
      if (day in signupsByDay) signupsByDay[day]++;
    });

    return c.json({
      totals: {
        users: users.length,
        riders: riders.length,
        drivers: drivers.length,
        verifiedDrivers: drivers.filter((d: any) => d.driverVerified).length,
        rides: rides.length,
        activeRides: activeRides.length,
        completedRides: completedRides.length,
        cancelledRides: rides.filter((r: any) => r?.status === 'cancelled').length,
        transactions: transactions.length,
        totalRevenue,
        totalWalletBalance,
        topupVolume,
        withdrawalVolume,
      },
      signupsByDay,
    });
  } catch (error) {
    console.log('Admin stats error:', error);
    return c.json({ error: `Failed to load stats: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

app.get("/make-server-0be7dc4c/cr-admin/users", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const users = await kv.getByPrefix('user:');
    users.sort((a: any, b: any) =>
      new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );
    return c.json({ users });
  } catch (error) {
    return c.json({ error: `Failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

app.get("/make-server-0be7dc4c/cr-admin/rides", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const rides = await kv.getByPrefix('ride:');
    rides.sort((a: any, b: any) =>
      new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );
    return c.json({ rides });
  } catch (error) {
    return c.json({ error: `Failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

app.get("/make-server-0be7dc4c/cr-admin/transactions", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const transactions = await kv.getByPrefix('transaction:');
    transactions.sort((a: any, b: any) =>
      new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );
    return c.json({ transactions });
  } catch (error) {
    return c.json({ error: `Failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== NOTIFICATION ROUTES ====================

// Get unread notifications for a driver
app.get("/make-server-0be7dc4c/notifications/:userId", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    if (!valid || !authUserId) return c.json({ error: 'Unauthorized' }, 401);

    const userId = c.req.param('userId');
    if (authUserId !== userId) return c.json({ error: 'Forbidden' }, 403);

    const notifications: any[] = (await kv.get(`driver_notifications:${userId}`)) || [];
    const unread = notifications.filter((n) => !n.read);
    return c.json({ notifications, unreadCount: unread.length });
  } catch (error) {
    console.log('Error fetching notifications:', error);
    return c.json({ error: `Failed to fetch notifications: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Mark all notifications as read
app.post("/make-server-0be7dc4c/notifications/:userId/read-all", async (c) => {
  try {
    const accessToken = getSessionToken(c);
    const { valid, userId: authUserId } = await validateSession(accessToken);
    if (!valid || !authUserId) return c.json({ error: 'Unauthorized' }, 401);

    const userId = c.req.param('userId');
    if (authUserId !== userId) return c.json({ error: 'Forbidden' }, 403);

    const notifications: any[] = (await kv.get(`driver_notifications:${userId}`)) || [];
    const updated = notifications.map((n) => ({ ...n, read: true }));
    await kv.set(`driver_notifications:${userId}`, updated);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: `Failed to mark notifications as read: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== ADMIN WEBHOOK CONFIG ROUTES ====================

// Get Make.com webhook URL
app.get("/make-server-0be7dc4c/cr-admin/webhook-config", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const webhookUrl = await kv.get('config:makecom_webhook_url');
    return c.json({ webhookUrl: webhookUrl || '' });
  } catch (error) {
    return c.json({ error: `Failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Set Make.com webhook URL
app.post("/make-server-0be7dc4c/cr-admin/webhook-config", async (c) => {
  try {
    const auth = await requireAdmin(c);
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const { webhookUrl } = await c.req.json();
    if (webhookUrl) {
      await kv.set('config:makecom_webhook_url', webhookUrl.trim());
      console.log('Make.com webhook URL updated');
    } else {
      await kv.del('config:makecom_webhook_url');
      console.log('Make.com webhook URL cleared');
    }
    return c.json({ success: true, webhookUrl: webhookUrl || '' });
  } catch (error) {
    return c.json({ error: `Failed: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ==================== MAPS CONFIG ROUTE ====================

// Get Google Maps API key for the frontend
app.get("/make-server-0be7dc4c/maps/config", async (c) => {
  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.log('WARNING: GOOGLE_MAPS_API_KEY env var not set');
      return c.json({ error: 'Google Maps API key not configured' }, 500);
    }
    console.log('Google Maps config served, key starts with:', apiKey.substring(0, 8) + '...');
    return c.json({ apiKey });
  } catch (error) {
    console.log('Error serving maps config:', error);
    return c.json({ error: `Failed to get maps config: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

Deno.serve(app.fetch);