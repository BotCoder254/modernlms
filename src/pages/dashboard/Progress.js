import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  ClockIcon,
  TrophyIcon,
  ChartBarIcon,
  BookOpenIcon,
  StarIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, Legend 
} from 'recharts';

// Helper functions
const calculateProgress = (enrollment) => {
  if (!enrollment || !enrollment.progress) return { percentage: 0, completed: 0, total: 0 };
  
  const completedLessons = Object.values(enrollment.progress).filter(Boolean).length;
  const totalLessons = enrollment.course?.lessons?.length || 0;
  return {
    percentage: Math.round((completedLessons / totalLessons) * 100) || 0,
    completed: completedLessons,
    total: totalLessons,
  };
};

const Progress = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [courseReviews, setCourseReviews] = useState({});
  const [progressData, setProgressData] = useState([]);
  const [activityData, setActivityData] = useState([]);

  // Real-time subscription for enrollments and progress
  useEffect(() => {
    if (!user?.uid) return;

    setIsLoading(true);
    const enrollmentsRef = collection(db, 'enrollments');
    const q = query(enrollmentsRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const enrollmentData = await Promise.all(
          snapshot.docs.map(async (enrollDoc) => {
            const courseDocRef = doc(db, 'courses', enrollDoc.data().courseId);
            const courseSnap = await getDoc(courseDocRef);
            
            if (!courseSnap.exists()) {
              console.error('Course not found:', enrollDoc.data().courseId);
              return null;
            }

            // Fetch reviews for this course - modified to avoid index error
            const reviewsRef = collection(db, 'reviews');
            const reviewsQuery = query(
              reviewsRef,
              where('courseId', '==', enrollDoc.data().courseId),
              limit(10) // Limit to the most recent 10 reviews
            );
            const reviewsSnap = await getDocs(reviewsQuery);
            const reviews = reviewsSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() || new Date()
            })).sort((a, b) => b.createdAt - a.createdAt); // Sort client-side instead of using orderBy

            // Update reviews in state
            setCourseReviews(prev => ({
              ...prev,
              [enrollDoc.data().courseId]: reviews
            }));

            return {
              id: enrollDoc.id,
              courseId: enrollDoc.data().courseId,
              progress: enrollDoc.data().progress || {},
              lastAccessed: enrollDoc.data().lastAccessed?.toDate() || new Date(),
              enrolledAt: enrollDoc.data().enrolledAt?.toDate() || new Date(),
              course: { 
                id: courseSnap.id, 
                ...courseSnap.data(),
                reviews: reviews 
              },
            };
          })
        );

        // Filter out any null values from courses that weren't found
        const validEnrollments = enrollmentData.filter(Boolean);
        setEnrollments(validEnrollments);
        
        // Generate activity data for chart
        const now = new Date();
        const last30Days = [...Array(30)].map((_, i) => {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          return date.toISOString().split('T')[0];
        }).reverse();
        
        // Generate progress data
        const progressByDay = {};
        validEnrollments.forEach(enrollment => {
          const enrolledDate = enrollment.enrolledAt;
          if (!enrolledDate) return;
          
          // Create progress by date
          const totalLessons = enrollment.course.lessons?.length || 0;
          if (totalLessons === 0) return;
          
          const completedLessons = Object.values(enrollment.progress || {}).filter(Boolean).length;
          const completionPercentage = Math.round((completedLessons / totalLessons) * 100) || 0;
          
          const dateStr = enrolledDate.toISOString().split('T')[0];
          if (!progressByDay[dateStr]) {
            progressByDay[dateStr] = {
              completedLessons: 0,
              totalLessons: 0
            };
          }
          
          progressByDay[dateStr].completedLessons += completedLessons;
          progressByDay[dateStr].totalLessons += totalLessons;
        });
        
        // Format for chart
        const chartData = last30Days.map(date => {
          const dayData = progressByDay[date] || { completedLessons: 0, totalLessons: 0 };
          const percentComplete = dayData.totalLessons > 0 
            ? Math.round((dayData.completedLessons / dayData.totalLessons) * 100) 
            : 0;
            
          return {
            date,
            progress: percentComplete
          };
        });
        
        setProgressData(chartData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching enrollments:', error);
        setIsLoading(false);
      }
    }, (error) => {
      console.error('Enrollments subscription error:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Calculate completion for categories
  const coursesByCategory = enrollments.reduce((acc, enrollment) => {
    const category = enrollment.course.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { 
        completed: 0, 
        total: 0, 
        totalLessons: 0, 
        completedLessons: 0 
      };
    }
    
    const progress = calculateProgress(enrollment);
    acc[category].total += 1;
    acc[category].totalLessons += progress.total;
    acc[category].completedLessons += progress.completed;
    
    if (progress.percentage === 100) {
      acc[category].completed += 1;
    }
    
    return acc;
  }, {});
  
  // Format category data for charts
  const categoryData = Object.entries(coursesByCategory).map(([name, data]) => {
    const percentage = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    const lessonsPercentage = data.totalLessons > 0 
      ? Math.round((data.completedLessons / data.totalLessons) * 100)
      : 0;
      
    return {
      name,
      courses: data.total,
      completed: data.completed,
      percentage,
      lessonsPercentage
    };
  });
  
  const getAverageRating = (courseId) => {
    const reviews = courseReviews[courseId] || [];
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return (totalRating / reviews.length).toFixed(1);
  };

  const overallProgress = enrollments.reduce(
    (acc, enrollment) => {
      const progress = calculateProgress(enrollment);
      acc.completedLessons += progress.completed;
      acc.totalLessons += progress.total;
      return acc;
    },
    { completedLessons: 0, totalLessons: 0 }
  );

  const overallPercentage =
    Math.round((overallProgress.completedLessons / overallProgress.totalLessons) * 100) || 0;

  // Custom formatter for chart dates
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Overall Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Learning Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100">Overall Progress</p>
                  <p className="mt-1 text-3xl font-bold">{overallPercentage}%</p>
                </div>
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                  <ChartBarIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-4 bg-white/20 rounded-full h-2.5">
                <div 
                  className="bg-white h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-100">Completed Lessons</p>
                  <p className="mt-1 text-3xl font-bold">
                    {overallProgress.completedLessons} <span className="text-lg font-medium">/ {overallProgress.totalLessons}</span>
                  </p>
                </div>
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-green-100">
                <AcademicCapIcon className="h-4 w-4 mr-1" />
                <span className="text-sm">Keep learning to improve your skills</span>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-100">Enrolled Courses</p>
                  <p className="mt-1 text-3xl font-bold">{enrollments.length}</p>
                </div>
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                  <BookOpenIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-4">
                <Link to="/courses" className="text-sm text-purple-100 hover:text-white flex items-center">
                  Browse more courses
                  <ArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Progress Over Time Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Progress Over Time</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={progressData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value) => [`${value}%`, 'Progress']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="progress" 
                    stroke="#3B82F6" 
                    fillOpacity={1} 
                    fill="url(#colorProgress)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          {/* Progress By Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Progress By Category</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'lessonsPercentage') return [`${value}%`, 'Completion'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="lessonsPercentage" name="Completion" fill="#8884d8">
                    {
                      categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Course Progress List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-white rounded-xl shadow-md border border-gray-100"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-900">Course Progress</h3>
          </div>
          <div className="divide-y">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-6 animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-1/3 h-4 bg-gray-200 rounded" />
                    <div className="w-1/4 h-4 bg-gray-200 rounded" />
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded" />
                </div>
              ))
            ) : enrollments.length > 0 ? (
              enrollments.map((enrollment) => {
                const progress = calculateProgress(enrollment);
                return (
                  <div key={enrollment.id} className="p-6 transition-colors hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        to={`/courses/${enrollment.courseId}`}
                        className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {enrollment.course.title}
                      </Link>
                      <div className="flex items-center text-sm text-gray-600">
                        <ClockIcon className="h-5 w-5 mr-1" />
                        Last accessed: {new Date(enrollment.lastAccessed).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-4">
                      <AcademicCapIcon className="h-5 w-5 mr-1" />
                      {enrollment.course.level}
                      <span className="mx-2">•</span>
                      {progress.completed} of {progress.total} lessons completed
                    </div>
                    <div className="relative mb-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            progress.percentage < 30 
                              ? 'bg-red-500' 
                              : progress.percentage < 70 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      <span className="absolute right-0 top-4 text-sm font-medium text-gray-600">
                        {progress.percentage}%
                      </span>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-gray-600">
                      <StarIcon className="h-4 w-4 text-yellow-400 mr-1" />
                      {getAverageRating(enrollment.courseId)} ({enrollment.course.reviews?.length || 0} reviews)
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No courses enrolled</h3>
                <p className="mt-1 text-gray-500">Start learning by enrolling in a course</p>
                <div className="mt-6">
                  <Link
                    to="/courses"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Browse Courses
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Progress;