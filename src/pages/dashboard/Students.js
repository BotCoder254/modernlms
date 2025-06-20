import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  AcademicCapIcon,
  ClockIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  BookOpenIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';

const Students = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: studentData = [], isLoading } = useQuery({
    queryKey: ['students', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      // First get all courses by the instructor
      const coursesRef = collection(db, 'courses');
      const courseQuery = query(coursesRef, where('instructorId', '==', user.uid));
      const courseSnapshot = await getDocs(courseQuery);
      const courseIds = courseSnapshot.docs.map(doc => doc.id);
      const courseData = courseSnapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {});

      if (courseIds.length === 0) return [];

      // Then get all enrollments for these courses using Promise.all for parallel requests
      const enrollmentsRef = collection(db, 'enrollments');
      const enrollmentPromises = courseIds.map(async (courseId) => {
        const enrollmentQuery = query(enrollmentsRef, where('courseId', '==', courseId));
        const enrollmentSnapshot = await getDocs(enrollmentQuery);
        
        // Process enrollments in parallel for better performance
        return Promise.all(enrollmentSnapshot.docs.map(async (doc) => {
          const enrollmentData = doc.data();
          const userId = enrollmentData.userId;
          
          try {
            const userData = await getDoc(doc(db, 'users', userId));
            
            // Also fetch the latest progress data
            const progressQuery = query(
              collection(db, 'progress'),
              where('userId', '==', userId),
              where('courseId', '==', courseId)
            );
            const progressSnapshot = await getDocs(progressQuery);
            
            // Get latest progress entry
            let latestProgress = null;
            let latestTimestamp = 0;
            
            progressSnapshot.forEach(progressDoc => {
              const progressData = progressDoc.data();
              if (progressData.lastUpdated && progressData.lastUpdated.seconds > latestTimestamp) {
                latestTimestamp = progressData.lastUpdated.seconds;
                latestProgress = progressData;
              }
            });
            
            return {
              id: doc.id,
              ...enrollmentData,
              student: userData.exists() ? userData.data() : null,
              course: courseData[courseId],
              latestActivity: latestProgress?.lastUpdated || enrollmentData.enrolledAt || null
            };
          } catch (error) {
            console.error(`Error fetching data for user ${userId}:`, error);
            return {
              id: doc.id,
              ...enrollmentData,
              student: null,
              course: courseData[courseId],
              error: true
            };
          }
        }));
      });

      // Wait for all enrollment data
      const allEnrollments = (await Promise.all(enrollmentPromises)).flat();
      
      // Group by student
      const studentMap = allEnrollments.reduce((acc, enrollment) => {
        if (!acc[enrollment.userId]) {
          // Fix the Anonymous User and No email provided issues
          const student = enrollment.student || {};
          const displayName = student.displayName || user?.displayName || (student.email ? student.email.split('@')[0] : 'Student');
          const email = student.email || user?.email || `user-${enrollment.userId.slice(0, 5)}@example.com`;
          
          acc[enrollment.userId] = {
            id: enrollment.userId,
            name: displayName,
            email: email,
            profileImage: student.photoURL || '',
            enrollments: [],
            enrollmentDates: [],
            progressByCategory: {},
            completedCourses: 0,
            lastActive: null
          };
        }
        
        // Add enrollment
        const courseCategory = enrollment.course?.category || 'Uncategorized';
        const totalLessons = enrollment.course?.lessons?.length || 0;
        const completedLessons = Object.values(enrollment.progress || {}).filter(Boolean).length;
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        
        // Update category progress
        if (!acc[enrollment.userId].progressByCategory[courseCategory]) {
          acc[enrollment.userId].progressByCategory[courseCategory] = {
            totalCourses: 0,
            totalProgress: 0
          };
        }
        acc[enrollment.userId].progressByCategory[courseCategory].totalCourses += 1;
        acc[enrollment.userId].progressByCategory[courseCategory].totalProgress += progress;
        
        // Track completion
        if (progress === 100) {
          acc[enrollment.userId].completedCourses += 1;
        }
        
        // Track last activity
        if (enrollment.latestActivity && (!acc[enrollment.userId].lastActive || 
            enrollment.latestActivity.seconds > acc[enrollment.userId].lastActive.seconds)) {
          acc[enrollment.userId].lastActive = enrollment.latestActivity;
        }
        
        // Save enrollment data
        acc[enrollment.userId].enrollments.push({
          courseId: enrollment.courseId,
          courseName: enrollment.course?.title || 'Unknown Course',
          courseCategory,
          progress: enrollment.progress || {},
          progressPercentage: progress,
          enrolledAt: enrollment.enrolledAt,
          totalLessons,
          completedLessons,
          lastActivity: enrollment.latestActivity
        });
        
        // Save enrollment date for chart
        if (enrollment.enrolledAt) {
          acc[enrollment.userId].enrollmentDates.push(enrollment.enrolledAt.toDate());
        }
        
        return acc;
      }, {});

      // Process data for charts
      const result = Object.values(studentMap).map(student => {
        // Calculate average progress per category
        const categoryProgress = Object.entries(student.progressByCategory).map(([category, data]) => {
          return {
            name: category,
            value: Math.round(data.totalProgress / data.totalCourses) || 0
          };
        });
        
        // Sort enrollment dates
        const sortedDates = student.enrollmentDates.sort((a, b) => a - b);
        
        return {
          ...student,
          categoryProgress,
          firstEnrollment: sortedDates[0] || new Date(),
          latestEnrollment: sortedDates[sortedDates.length - 1] || new Date()
        };
      });

      return result;
    },
    enabled: !!user?.uid && user?.role === 'instructor',
    staleTime: 30000, // 30 seconds - balance between fresh data and performance
    refetchInterval: 60000 // Refresh every minute even if not invalidated
  });

  // Set up real-time student data subscription
  useEffect(() => {
    if (!user?.uid || user?.role !== 'instructor') return;
    
    // First get all courses by the instructor
    const getCoursesAndSetupListeners = async () => {
      const coursesRef = collection(db, 'courses');
      const courseQuery = query(coursesRef, where('instructorId', '==', user.uid));
      const courseSnapshot = await getDocs(courseQuery);
      const courseIds = courseSnapshot.docs.map(doc => doc.id);
      
      // Set up listeners for enrollments on each course
      const unsubscribers = [];
      
      // Course listener (for new courses)
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'courses'), where('instructorId', '==', user.uid)),
          () => {
            queryClient.invalidateQueries(['students', user?.uid]);
          },
          (error) => console.error('Courses subscription error:', error)
        )
      );
      
      // Enrollment listeners (for each course)
      courseIds.forEach(courseId => {
        unsubscribers.push(
          onSnapshot(
            query(collection(db, 'enrollments'), where('courseId', '==', courseId)),
            (snapshot) => {
              // When enrollments change, invalidate the query to update data
              queryClient.invalidateQueries(['students', user?.uid]);
            },
            (error) => console.error('Enrollment subscription error:', error)
          )
        );
        
        // Progress listeners
        unsubscribers.push(
          onSnapshot(
            query(collection(db, 'progress'), where('courseId', '==', courseId)),
            () => {
              queryClient.invalidateQueries(['students', user?.uid]);
            },
            (error) => console.error('Progress subscription error:', error)
          )
        );
      });
      
      // Return cleanup function
      return () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
      };
    };
    
    const unsubscribePromise = getCoursesAndSetupListeners();
    return () => {
      if (unsubscribePromise instanceof Promise) {
        unsubscribePromise.then(cleanup => {
          if (cleanup) cleanup();
        }).catch(err => console.error("Error cleaning up subscriptions:", err));
      }
    };
  }, [user?.uid, user?.role, queryClient]);

  const filteredStudents = searchTerm
    ? studentData.filter(
        student =>
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : studentData;

  // Prepare chart data
  const enrollmentsByCategory = {};
  studentData.forEach(student => {
    student.enrollments.forEach(enrollment => {
      if (!enrollmentsByCategory[enrollment.courseCategory]) {
        enrollmentsByCategory[enrollment.courseCategory] = 0;
      }
      enrollmentsByCategory[enrollment.courseCategory]++;
    });
  });
  
  const categoryChartData = Object.entries(enrollmentsByCategory).map(([name, value]) => ({
    name,
    value
  }));
  
  // Progress distribution data
  const progressGroups = {
    '0-25': 0,
    '26-50': 0,
    '51-75': 0,
    '76-100': 0
  };
  
  studentData.forEach(student => {
    student.enrollments.forEach(enrollment => {
      if (enrollment.progressPercentage <= 25) {
        progressGroups['0-25']++;
      } else if (enrollment.progressPercentage <= 50) {
        progressGroups['26-50']++;
      } else if (enrollment.progressPercentage <= 75) {
        progressGroups['51-75']++;
      } else {
        progressGroups['76-100']++;
      }
    });
  });
  
  const progressChartData = Object.entries(progressGroups).map(([name, value]) => ({
    name,
    value
  }));
  
  // Calculate totals
  const totalStudents = studentData.length;
  const totalEnrollments = studentData.reduce((total, student) => total + student.enrollments.length, 0);
  const completedCourses = studentData.reduce((total, student) => total + student.completedCourses, 0);
  const averageCoursesPerStudent = totalStudents > 0 ? (totalEnrollments / totalStudents).toFixed(1) : 0;
  
  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Students</h2>
          <p className="text-gray-600">Manage and track your students' progress</p>
        </motion.div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <UserGroupIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Enrollments</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{totalEnrollments}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <BookOpenIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed Courses</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{completedCourses}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg. Courses Per Student</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{averageCoursesPerStudent}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <ChartBarIcon className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Enrollments by Category</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Enrollments']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Progress Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={progressChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, 'Enrollments']} />
                  <Bar dataKey="value" name="Enrollments">
                    {progressChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          index === 0 ? '#EF4444' : 
                          index === 1 ? '#F59E0B' : 
                          index === 2 ? '#3B82F6' : 
                          '#10B981'
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mb-6"
        >
          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </motion.div>

        {/* Student List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-white rounded-xl shadow-md border border-gray-100"
        >
          {isLoading ? (
            <div className="p-6 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="divide-y">
              {filteredStudents.map((student) => (
                <div key={student.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                        {student.profileImage ? (
                          <img src={student.profileImage} alt={student.name} className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-6 w-6 text-gray-500" />
                        )}
                      </div>
                      <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{student.name}</h3>
                      <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm text-gray-500 mb-1">
                      {student.enrollments.length} courses enrolled
                      </div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        First enrolled: {new Date(student.firstEnrollment).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {student.enrollments.map((enrollment) => (
                      <div
                        key={enrollment.courseId}
                        className="bg-gray-50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            {enrollment.courseName}
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                              {enrollment.courseCategory}
                            </span>
                          </h4>
                          <div className="flex items-center text-sm text-gray-500">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            {enrollment.enrolledAt ? 
                              new Date(enrollment.enrolledAt.toDate()).toLocaleDateString() : 
                              'Unknown date'}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-500">
                            <ChartBarIcon className="h-4 w-4 mr-1" />
                            {enrollment.completedLessons} of {enrollment.totalLessons} lessons completed
                          </div>
                          <div className="flex items-center">
                            <div className="w-48 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  enrollment.progressPercentage < 30 ? 'bg-red-500' : 
                                  enrollment.progressPercentage < 70 ? 'bg-yellow-500' : 
                                  'bg-green-500'
                                }`}
                                style={{ width: `${enrollment.progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {enrollment.progressPercentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">No students found</h3>
              <p className="mt-1 text-gray-500">
                {searchTerm ? 'Try adjusting your search' : 'Start creating courses to get students'}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Students; 