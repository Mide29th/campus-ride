import { CampusLocation, User } from '../types';

export const campusLocations: CampusLocation[] = [
  { id: '1', name: 'Faculty of Basic Medical Science', category: 'academic', lat: 7.5248, lng: 4.5138 },
  { id: '2', name: 'Faculty of Law', category: 'academic', lat: 7.5242, lng: 4.5155 },
  { id: '3', name: 'Faculty of Engineering', category: 'academic', lat: 7.5235, lng: 4.5125 },
  { id: '4', name: 'Lecture Rooms', category: 'academic', lat: 7.5230, lng: 4.5148 },
  { id: '5', name: 'ICT Center', category: 'academic', lat: 7.5226, lng: 4.5160 },
  { id: '6', name: 'Center for Chemical & Biochemical Research', category: 'facility', lat: 7.5240, lng: 4.5118 },
  { id: '7', name: 'IGH Center', category: 'facility', lat: 7.5238, lng: 4.5170 },
  { id: '8', name: 'Event Center', category: 'facility', lat: 7.5222, lng: 4.5140 },
  { id: '9', name: 'Health Center', category: 'facility', lat: 7.5210, lng: 4.5155 },
  { id: '10', name: 'Peace Park', category: 'facility', lat: 7.5220, lng: 4.5152 },
  { id: '11', name: 'Engineering Male Hostel', category: 'hostel', lat: 7.5232, lng: 4.5110 },
  { id: '12', name: 'Engineering Female Hostel', category: 'hostel', lat: 7.5228, lng: 4.5112 },
  { id: '13', name: 'Main Hostel', category: 'hostel', lat: 7.5205, lng: 4.5135 },
  { id: '14', name: 'Female Hostel', category: 'hostel', lat: 7.5202, lng: 4.5145 },
  { id: '15', name: 'Extension Hostel', category: 'hostel', lat: 7.5198, lng: 4.5128 },
  { id: '16', name: 'New Era Cafeteria', category: 'food', lat: 7.5218, lng: 4.5145 },
  { id: '17', name: 'Double Portion', category: 'food', lat: 7.5208, lng: 4.5150 },
  { id: '18', name: 'Numbers', category: 'food', lat: 7.5206, lng: 4.5158 },
  { id: '19', name: 'Chow Park', category: 'food', lat: 7.5212, lng: 4.5162 },
  { id: '20', name: 'Foodmart', category: 'food', lat: 7.5215, lng: 4.5168 },
  { id: '21', name: 'Manna', category: 'food', lat: 7.5216, lng: 4.5132 },
  { id: '22', name: 'Container', category: 'food', lat: 7.5214, lng: 4.5138 },
  { id: '23', name: 'Sapetro', category: 'food', lat: 7.5200, lng: 4.5165 },
  { id: '24', name: 'RUN Football Field', category: 'sports', lat: 7.5195, lng: 4.5148 },
  { id: '25', name: 'RUN Basketball Court', category: 'sports', lat: 7.5193, lng: 4.5155 },
  { id: '26', name: 'Volleyball Court', category: 'sports', lat: 7.5191, lng: 4.5152 },
];

export const mockDrivers: User[] = [
  {
    id: 'driver-1',
    email: 'emeka.okoli@university.edu.ng',
    name: 'Emeka Okoli',
    role: 'driver',
    walletBalance: 15000,
    phoneNumber: '08012345678',
    studentId: 'CS/2021/001',
    driverVerified: true,
    vehicleInfo: {
      model: 'Toyota Corolla',
      plateNumber: 'LAG-123-AB',
      color: 'Silver',
    },
  },
  {
    id: 'driver-2',
    email: 'faith.adeyemi@university.edu.ng',
    name: 'Faith Adeyemi',
    role: 'driver',
    walletBalance: 8500,
    phoneNumber: '08098765432',
    studentId: 'BUS/2020/045',
    driverVerified: true,
    vehicleInfo: {
      model: 'Honda Civic',
      plateNumber: 'ABJ-456-CD',
      color: 'Blue',
    },
  },
];

// Calculate fare based on distance between coordinates
export const calculateFare = (
  pickupLocation: CampusLocation,
  dropoffLocation: CampusLocation
): number => {
  if (pickupLocation.id === dropoffLocation.id) return 0;

  // Calculate actual distance using Haversine formula
  const R = 6371000; // Earth's radius in meters
  const dLat = ((dropoffLocation.lat - pickupLocation.lat) * Math.PI) / 180;
  const dLng = ((dropoffLocation.lng - pickupLocation.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pickupLocation.lat * Math.PI) / 180) *
      Math.cos((dropoffLocation.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = R * c;

  // Base fare ₦100 + ₦50 per 100m
  const fare = 100 + Math.ceil(distanceMeters / 100) * 50;
  return Math.min(fare, 500); // Cap at ₦500 for campus trips
};

export const generateRidePin = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};
