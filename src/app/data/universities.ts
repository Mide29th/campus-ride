export interface UniversityLocation {
  id: string;
  name: string;
  category: 'hostel' | 'academic' | 'facility' | 'gate' | 'food' | 'sports' | 'religious';
  lat: number;
  lng: number;
  mapPosition: { x: number; y: number }; // kept for legacy compat
}

export interface University {
  id: string;
  name: string;
  shortName: string;
  mapImage: string;
  center: { lat: number; lng: number };
  zoom: number;
  locations: UniversityLocation[];
}

export const universities: University[] = [
  {
    id: 'redeemers',
    name: "Redeemer's University",
    shortName: 'RUN',
    mapImage: '',
    center: { lat: 7.5225, lng: 4.5150 },
    zoom: 16,
    locations: [
      // Academic Buildings
      { id: '1', name: 'Faculty of Basic Medical Science', category: 'academic', lat: 7.5248, lng: 4.5138, mapPosition: { x: 40, y: 15 } },
      { id: '2', name: 'Faculty of Law', category: 'academic', lat: 7.5242, lng: 4.5155, mapPosition: { x: 55, y: 18 } },
      { id: '3', name: 'Faculty of Engineering', category: 'academic', lat: 7.5235, lng: 4.5125, mapPosition: { x: 30, y: 22 } },
      { id: '4', name: 'Lecture Rooms', category: 'academic', lat: 7.5230, lng: 4.5148, mapPosition: { x: 48, y: 25 } },
      { id: '5', name: 'ICT Center', category: 'academic', lat: 7.5226, lng: 4.5160, mapPosition: { x: 60, y: 28 } },

      // Research & Facilities
      { id: '6', name: 'Center for Chemical & Biochemical Research', category: 'facility', lat: 7.5240, lng: 4.5118, mapPosition: { x: 22, y: 20 } },
      { id: '7', name: 'IGH Center', category: 'facility', lat: 7.5238, lng: 4.5170, mapPosition: { x: 68, y: 20 } },
      { id: '8', name: 'Event Center', category: 'facility', lat: 7.5222, lng: 4.5140, mapPosition: { x: 42, y: 32 } },
      { id: '9', name: 'Health Center', category: 'facility', lat: 7.5210, lng: 4.5155, mapPosition: { x: 55, y: 42 } },
      { id: '10', name: 'Peace Park', category: 'facility', lat: 7.5220, lng: 4.5152, mapPosition: { x: 52, y: 34 } },

      // Hostels
      { id: '11', name: 'Engineering Male Hostel', category: 'hostel', lat: 7.5232, lng: 4.5110, mapPosition: { x: 18, y: 24 } },
      { id: '12', name: 'Engineering Female Hostel', category: 'hostel', lat: 7.5228, lng: 4.5112, mapPosition: { x: 20, y: 27 } },
      { id: '13', name: 'Main Hostel', category: 'hostel', lat: 7.5205, lng: 4.5135, mapPosition: { x: 38, y: 48 } },
      { id: '14', name: 'Female Hostel', category: 'hostel', lat: 7.5202, lng: 4.5145, mapPosition: { x: 45, y: 50 } },
      { id: '15', name: 'Extension Hostel', category: 'hostel', lat: 7.5198, lng: 4.5128, mapPosition: { x: 32, y: 55 } },

      // Food & Restaurants
      { id: '16', name: 'New Era Cafeteria', category: 'food', lat: 7.5218, lng: 4.5145, mapPosition: { x: 45, y: 36 } },
      { id: '17', name: 'Double Portion', category: 'food', lat: 7.5208, lng: 4.5150, mapPosition: { x: 50, y: 44 } },
      { id: '18', name: 'Numbers', category: 'food', lat: 7.5206, lng: 4.5158, mapPosition: { x: 58, y: 46 } },
      { id: '19', name: 'Chow Park', category: 'food', lat: 7.5212, lng: 4.5162, mapPosition: { x: 62, y: 40 } },
      { id: '20', name: 'Foodmart', category: 'food', lat: 7.5215, lng: 4.5168, mapPosition: { x: 66, y: 38 } },
      { id: '21', name: 'Manna', category: 'food', lat: 7.5216, lng: 4.5132, mapPosition: { x: 35, y: 37 } },
      { id: '22', name: 'Container', category: 'food', lat: 7.5214, lng: 4.5138, mapPosition: { x: 40, y: 39 } },
      { id: '23', name: 'Sapetro', category: 'food', lat: 7.5200, lng: 4.5165, mapPosition: { x: 64, y: 52 } },

      // Sports
      { id: '24', name: 'RUN Football Field', category: 'sports', lat: 7.5195, lng: 4.5148, mapPosition: { x: 48, y: 58 } },
      { id: '25', name: 'RUN Basketball Court', category: 'sports', lat: 7.5193, lng: 4.5155, mapPosition: { x: 55, y: 60 } },
      { id: '26', name: 'Volleyball Court', category: 'sports', lat: 7.5191, lng: 4.5152, mapPosition: { x: 52, y: 62 } },
    ],
  },
];
