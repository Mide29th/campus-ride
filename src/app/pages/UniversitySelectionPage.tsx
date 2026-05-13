import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { School } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { universities } from '../data/universities';
import { userAPI, getAccessToken } from '../services/api';
import { toast } from 'sonner';
import { BackButton } from '../components/BackButton';

export default function UniversitySelectionPage() {
  const navigate = useNavigate();
  const { setSelectedUniversity, currentUser, setCurrentUser } = useApp();
  const [isLoading, setIsLoading] = useState(false);

  const selectUniversity = async (universityId: string) => {
    const university = universities.find((u) => u.id === universityId);
    
    if (!currentUser) {
      toast.error('Session expired. Please login again.');
      navigate('/login');
      return;
    }
    
    if (!university) {
      toast.error('University not found');
      return;
    }
    
    const token = getAccessToken();
    if (!token) {
      toast.error('Session expired. Please login again.');
      navigate('/login');
      return;
    }
    
    setIsLoading(true);
    try {
      // Update user's university in backend
      const updatedUser = await userAPI.updateUser(currentUser.id, { universityId });
      
      setCurrentUser(updatedUser);
      setSelectedUniversity(university);
      
      toast.success(`Welcome to ${university.shortName}!`);
      
      // Navigate based on role
      if (!updatedUser.role) {
        navigate('/role-selection');
      } else if (updatedUser.role === 'rider') {
        navigate('/rider');
      } else {
        navigate('/driver');
      }
    } catch (error: any) {
      console.error('Error updating university:', error);
      
      if (error.message && (error.message.includes('Unauthorized') || error.message.includes('expired'))) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error(error.message || 'Failed to update university. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-4">
      <BackButton />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-full mb-4">
            <School className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your University</h1>
          <p className="text-gray-600">Choose your campus to get started</p>
        </div>

        <div className="space-y-4">
          {universities.map((university) => (
            <Card
              key={university.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-emerald-500"
              onClick={() => selectUniversity(university.id)}
            >
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={university.mapImage}
                      alt={university.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg mb-1">{university.name}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                        {university.shortName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {university.locations.length} locations
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Tap to continue with {university.shortName}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
          Campus maps help drivers navigate and find you quickly
        </p>
      </div>
    </div>
  );
}