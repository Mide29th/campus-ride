import { createBrowserRouter } from 'react-router';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PreSignupRolePage from './pages/PreSignupRolePage';
import UniversitySelectionPage from './pages/UniversitySelectionPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import RiderDashboard from './pages/RiderDashboard';
import DriverDashboard from './pages/DriverDashboard';
import BookRidePage from './pages/BookRidePage';
import ActiveRidePage from './pages/ActiveRidePage';
import DriverActiveRidePage from './pages/DriverActiveRidePage';
import AdminDashboard from './pages/AdminDashboard';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: LoginPage,
  },
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/signup',
    Component: SignupPage,
  },
  {
    path: '/choose-role',
    Component: PreSignupRolePage,
  },
  {
    path: '/university-selection',
    Component: UniversitySelectionPage,
  },
  {
    path: '/role-selection',
    Component: RoleSelectionPage,
  },
  {
    path: '/rider',
    Component: RiderDashboard,
  },
  {
    path: '/rider/book',
    Component: BookRidePage,
  },
  {
    path: '/ride/active',
    Component: ActiveRidePage,
  },
  {
    path: '/driver',
    Component: DriverDashboard,
  },
  {
    path: '/driver/active-ride',
    Component: DriverActiveRidePage,
  },
  {
    path: '/admin',
    Component: AdminDashboard,
  },
]);