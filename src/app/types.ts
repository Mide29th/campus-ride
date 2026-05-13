export type UserRole = 'rider' | 'driver';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletBalance: number;
  phoneNumber: string;
  studentId?: string;
  universityId?: string;
  driverVerified?: boolean;
  vehicleInfo?: {
    model: string;
    plateNumber: string;
    color: string;
  };
}

export interface CampusLocation {
  id: string;
  name: string;
  category: 'hostel' | 'academic' | 'facility' | 'gate' | 'food' | 'sports' | 'religious';
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  pickupLocation: CampusLocation;
  dropoffLocation: CampusLocation;
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  fare: number;
  pin: string;
  universityId?: string;
  createdAt: Date | string;
  acceptedAt?: Date | string;
  completedAt?: Date | string;
  riderName: string;
  driverName?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'topup' | 'ride' | 'refund';
  amount: number;
  description: string;
  createdAt: Date | string;
}