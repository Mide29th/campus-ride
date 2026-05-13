import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Ride, Transaction } from '../types';
import { University, universities } from '../data/universities';
import { authAPI, getAccessToken } from '../services/api';
import { Car, Loader2 } from 'lucide-react';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  rides: Ride[];
  setRides: (rides: Ride[]) => void;
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  driverAvailable: boolean;
  setDriverAvailable: (available: boolean) => void;
  selectedUniversity: University;
  setSelectedUniversity: (university: University) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [driverAvailable, setDriverAvailable] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState<University>(universities[0]);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = getAccessToken();
        if (token) {
          // Clear old non-session tokens (legacy Supabase JWTs)
          if (!token.startsWith('session_')) {
            console.log('Clearing old non-session token');
            authAPI.logout();
            setIsLoading(false);
            return;
          }
          const { user } = await authAPI.getSession();
          setCurrentUser(user);
          
          // Set university if user has one
          if (user.universityId) {
            const uni = universities.find(u => u.id === user.universityId);
            if (uni) {
              setSelectedUniversity(uni);
            }
          }
        }
      } catch (error) {
        console.log('No active session:', error);
        await authAPI.logout();
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  if (isLoading) {
    return (
      <AppContext.Provider
        value={{
          currentUser,
          setCurrentUser,
          rides,
          setRides,
          transactions,
          setTransactions,
          driverAvailable,
          setDriverAvailable,
          selectedUniversity,
          setSelectedUniversity,
          isLoading,
          setIsLoading,
        }}
      >
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-full mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">CampusRide</h1>
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <p className="text-sm text-gray-500 mt-2">Loading your session...</p>
        </div>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        rides,
        setRides,
        transactions,
        setTransactions,
        driverAvailable,
        setDriverAvailable,
        selectedUniversity,
        setSelectedUniversity,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};