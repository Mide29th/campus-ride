import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppProvider } from './context/AppContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  useEffect(() => {
    document.title = 'CampusRide.ng';
  }, []);

  return (
    <AppProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AppProvider>
  );
}