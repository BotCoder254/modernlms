import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  HomeIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserGroupIcon,
  CogIcon,
  BellIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  PlusCircleIcon,
  ClipboardDocumentListIcon,
  TrophyIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: HomeIcon, roles: ['student', 'instructor'] },
  { name: 'My Courses', path: '/my-courses', icon: BookOpenIcon, roles: ['student', 'instructor'] },
  { name: 'Course List', path: '/courses', icon: AcademicCapIcon, roles: ['student', 'instructor'] },
  { name: 'Progress', path: '/progress', icon: ChartBarIcon, roles: ['student'] },
  { name: 'Analytics', path: '/analytics', icon: ChartBarIcon, roles: ['instructor'] },
  { name: 'Students', path: '/students', icon: UserGroupIcon, roles: ['instructor'] },
  { name: 'Community', path: '/community', icon: ChatBubbleLeftRightIcon, roles: ['student', 'instructor'] },
  { name: 'Certificates', path: '/certificates', icon: DocumentCheckIcon, roles: ['student'] },
  { name: 'Profile', path: '/profile', icon: UserIcon, roles: ['student', 'instructor'] },
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role)
  );

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const mockNotifications = [
    { id: 1, title: 'New course available', message: 'Check out our latest course on React!', time: '2 hours ago' },
    { id: 2, title: 'Assignment due', message: 'Complete your assignment by tomorrow', time: '1 day ago' },
    { id: 3, title: 'Achievement unlocked', message: 'You completed 5 courses!', time: '3 days ago' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-md' : 'bg-white/80 backdrop-blur-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Navigation Links */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  ModernLMS
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:ml-10 sm:space-x-6">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group relative inline-flex items-center px-2 py-1 text-sm font-medium transition-all duration-200 ${
                    isActive(item.path)
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-blue-600'
                  }`}
                >
                  <span className="flex items-center">
                    <item.icon className={`h-5 w-5 mr-1 transition-transform group-hover:scale-110 ${
                      isActive(item.path) ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
                    }`} />
                    <span>{item.name}</span>
                  </span>
                  {isActive(item.path) && (
                    <motion.div
                      className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full"
                      layoutId="activeNavIndicator"
                    />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="group relative p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 focus:outline-none"
                aria-label="Notifications"
              >
                <BellIcon className="h-6 w-6" />
                <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white transform scale-100 transition-transform duration-300" />
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 transform -translate-x-1 group-hover:translate-x-0 transition-all duration-300">
                  Notifications
                </span>
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="origin-top-right absolute right-0 mt-2 w-80 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 overflow-hidden"
                  >
                    <div className="divide-y divide-gray-100">
                      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <h3 className="text-sm font-semibold text-white flex justify-between items-center">
                          Notifications
                          <span className="bg-white/20 text-xs rounded-full px-2 py-0.5">
                            {mockNotifications.length} new
                          </span>
                        </h3>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {mockNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                          >
                            <div className="flex justify-between">
                              <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                              <p className="text-xs text-gray-500">{notification.time}</p>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 bg-gray-50">
                        <Link to="/notifications" className="text-sm font-medium text-blue-600 hover:text-blue-500 flex justify-center">
                          View all notifications
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Menu */}
            <div className="hidden sm:flex items-center border-l border-gray-200 pl-4">
              <div className="flex items-center mr-4">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="ml-2 hidden md:block">
                  <p className="text-sm font-medium text-gray-800">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role || 'Student'}</p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-1" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="sm:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-label="Main menu"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden overflow-hidden"
          >
            <div className="pt-2 pb-3 space-y-1 bg-gray-50 px-2">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors ${
                    isActive(item.path)
                      ? 'text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              ))}
              
              <div className="pt-4 pb-2 border-t border-gray-200">
                <div className="flex items-center px-3 py-2">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-medium text-gray-800">{user?.name || 'User'}</p>
                    <p className="text-sm text-gray-500 capitalize">{user?.role || 'Student'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-2 w-full flex items-center justify-center px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                >
                  <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" />
                  Sign out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;