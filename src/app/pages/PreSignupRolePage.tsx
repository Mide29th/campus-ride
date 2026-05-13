import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { User, Car, ArrowLeft } from 'lucide-react';

export default function PreSignupRolePage() {
  const navigate = useNavigate();

  const chooseRole = (role: 'rider' | 'driver') => {
    // Pass the chosen role via navigation state to the signup page
    navigate('/signup', { state: { role } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-4">
      {/* Back to login */}
      <button
        onClick={() => navigate('/login')}
        className="absolute top-4 left-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-full mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">How will you use CampusRide?</h1>
          <p className="text-gray-500 text-sm">Choose your role — this will be saved to your account. You can change it later from your profile.</p>
        </div>

        <div className="space-y-4">
          {/* Rider card */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-emerald-500 active:scale-[0.98]"
            onClick={() => chooseRole('rider')}
          >
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full">
                  <User className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>I'm a Rider</CardTitle>
                  <CardDescription>I need rides around campus</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>• Book rides to any campus location</li>
                <li>• Track your ride in real-time</li>
                <li>• Secure payment with your wallet</li>
              </ul>
            </CardContent>
          </Card>

          {/* Driver card */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-500 active:scale-[0.98]"
            onClick={() => chooseRole('driver')}
          >
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>I'm a Driver</CardTitle>
                  <CardDescription>I want to earn by giving rides</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>• Accept ride requests nearby</li>
                <li>• Set your own availability</li>
                <li>• Earn money from completed trips</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-center text-gray-400 mt-6">
          Drivers must be verified by campus security before accepting rides.
        </p>
      </div>
    </div>
  );
}
