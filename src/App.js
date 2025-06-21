import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/dashboard/Dashboard';
import MyCourses from './pages/dashboard/MyCourses';
import Progress from './pages/dashboard/Progress';
import Analytics from './pages/dashboard/Analytics';
import Students from './pages/dashboard/Students';
import LearningPaths from './pages/dashboard/LearningPaths';
import CourseList from './pages/courses/CourseList';
import CourseDetail from './pages/courses/CourseDetail';
import CreateCourse from './pages/courses/CreateCourse';
import EditCourse from './pages/courses/EditCourse';
import Profile from './pages/Profile';
import Certificates from './pages/achievements/Certificates';
import Community from './pages/community/Community';
import Discussion from './pages/community/Discussion';
import RecycledCourses from './pages/dashboard/RecycledCourses';

// Components
import Navbar from './components/Navigation/Navbar';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const ProtectedRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div>
            <Toaster position="top-right" />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/my-courses"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <MyCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/progress"
                element={
                  <ProtectedRoute roles={['student']}>
                    <Navbar />
                    <Progress />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/learning-paths"
                element={
                  <ProtectedRoute roles={['student']}>
                    <Navbar />
                    <LearningPaths />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute roles={['instructor']}>
                    <Navbar />
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/recycled-courses"
                element={
                  <ProtectedRoute roles={['instructor']}>
                    <Navbar />
                    <RecycledCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/students"
                element={
                  <ProtectedRoute roles={['instructor']}>
                    <Navbar />
                    <Students />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <Profile />
                  </ProtectedRoute>
                }
              />

              {/* Course Routes */}
              <Route
                path="/courses"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <CourseList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:courseId"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <CourseDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/create"
                element={
                  <ProtectedRoute roles={['instructor']}>
                    <Navbar />
                    <CreateCourse />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/edit/:courseId"
                element={
                  <ProtectedRoute roles={['instructor']}>
                    <Navbar />
                    <EditCourse />
                  </ProtectedRoute>
                }
              />

              {/* Achievement Routes */}
              <Route
                path="/achievements/certificates"
                element={
                  <ProtectedRoute roles={['student']}>
                    <Navbar />
                    <Certificates />
                  </ProtectedRoute>
                }
              />

              {/* Community Routes */}
              <Route
                path="/community"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <Community />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/community/discussion/:courseId/:discussionId"
                element={
                  <ProtectedRoute>
                    <Navbar />
                    <Discussion />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
