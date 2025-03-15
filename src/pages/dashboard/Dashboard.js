import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  ClockIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  FireIcon,
  StarIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    coursesEnrolled: 0,
    coursesCompleted: 0,
    totalHoursLearned: 0,
    learningStreak: 0,
    totalRevenue: 0,
    totalStudents: 0,
    averageRating: 0,
    totalCourses: 0,
  });
  const [progressData, setProgressData] = useState([]);

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', user?.uid, user?.role],
    queryFn: async () => {
      if (!user?.uid || !user?.role) return null;

      if (user.role === 'student') {
        // Fetch student analytics
        const enrollmentsRef = collection(db, 'enrollments');
        const enrollmentQuery = query(
          enrollmentsRef,
          where('userId', '==', user.uid)
        );
        const enrollmentSnapshot = await getDocs(enrollmentQuery);
        
        let totalHours = 0;
        let completed = 0;
        let progressByWeek = {};
        
        await Promise.all(enrollmentSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          if (!data.courseId) return; // Skip if courseId is undefined
          
          const courseDoc = await getDoc(doc(db, 'courses', data.courseId));
          if (!courseDoc.exists()) return; // Skip if course doesn't exist
          
          const courseData = courseDoc.data();
          
          // Calculate completion
          const completedLessons = Object.values(data.progress || {}).filter(Boolean).length;
          const totalLessons = (courseData.lessons || []).length;
          const completionPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
          
          if (completionPercentage === 100) completed++;
          
          // Calculate hours from lessons
          if (courseData.lessons) {
            totalHours += courseData.lessons.reduce((acc, lesson) => {
              const duration = parseInt(lesson.duration) || 0;
              return acc + duration;
            }, 0) / 60;
          }
          
          // Track weekly progress
          if (data.enrolledAt) {
            const week = new Date(data.enrolledAt.toDate()).toISOString().slice(0, 10);
            progressByWeek[week] = (progressByWeek[week] || 0) + completionPercentage;
          }
        }));
        
        // Format progress data for chart
        const chartData = Object.entries(progressByWeek)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, progress]) => ({
            name: date,
            progress: Math.round(progress),
          }));
        
        return {
          type: 'student',
          stats: {
            coursesEnrolled: enrollmentSnapshot.size,
            coursesCompleted: completed,
            totalHoursLearned: Math.round(totalHours),
            learningStreak: await calculateLearningStreak(user.uid),
          },
          chartData,
        };
      } else {
        // Fetch instructor analytics
        const coursesRef = collection(db, 'courses');
        const courseQuery = query(
          coursesRef,
          where('instructorId', '==', user.uid)
        );
        const courseSnapshot = await getDocs(courseQuery);
        
        let totalRevenue = 0;
        let totalStudents = 0;
        let totalRating = 0;
        let revenueByWeek = {};
        
        await Promise.all(courseSnapshot.docs.map(async (doc) => {
          const courseData = doc.data();
          
          // Get enrollments for this course
          const enrollmentsRef = collection(db, 'enrollments');
          const enrollmentQuery = query(
            enrollmentsRef,
            where('courseId', '==', doc.id)
          );
          const enrollmentSnapshot = await getDocs(enrollmentQuery);
          
          totalStudents += enrollmentSnapshot.size;
          totalRating += courseData.rating || 0;
          
          // Calculate revenue
          enrollmentSnapshot.docs.forEach(enrollment => {
            const data = enrollment.data();
            if (!data.enrolledAt) return; // Skip if no enrollment date
            
            const revenue = data.paidAmount || courseData.price || 0;
            totalRevenue += revenue;
            
            // Track weekly revenue
            const week = new Date(data.enrolledAt.toDate()).toISOString().slice(0, 10);
            revenueByWeek[week] = (revenueByWeek[week] || 0) + revenue;
          });
        }));
        
        // Format revenue data for chart
        const chartData = Object.entries(revenueByWeek)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, revenue]) => ({
            name: date,
            revenue: Math.round(revenue),
          }));
        
        return {
          type: 'instructor',
          stats: {
            totalRevenue: Math.round(totalRevenue),
            totalStudents,
            averageRating: courseSnapshot.size > 0 ? totalRating / courseSnapshot.size : 0,
            totalCourses: courseSnapshot.size,
          },
          chartData,
        };
      }
    },
    enabled: !!user?.uid && !!user?.role,
  });

  // Calculate learning streak
  const calculateLearningStreak = async (userId) => {
    const progressRef = collection(db, 'progress');
    const today = new Date();
    let streak = 0;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const progressQuery = query(
        progressRef,
        where('userId', '==', userId),
        where('lastUpdated', '>=', startOfDay),
        where('lastUpdated', '<=', endOfDay)
      );
      
      const snapshot = await getDocs(progressQuery);
      
      if (snapshot.empty) {
        if (i === 0) continue; // Don't break streak for today
        break;
      }
      
      streak++;
    }
    
    return streak;
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    if (analyticsData) {
      setStats(analyticsData.stats);
      setProgressData(analyticsData.chartData);
    }
  }, [analyticsData]);

  // Update the real-time subscriptions
  useEffect(() => {
    if (!user?.uid || !user?.role) return;

    const unsubscribeProgress = onSnapshot(
      query(collection(db, 'progress'), where('userId', '==', user.uid)),
      (snapshot) => {
        const progressData = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          progressData[data.lessonId] = data.completed;
        });
        setProgressData(progressData);
      },
      (error) => console.error('Progress subscription error:', error)
    );

    // Separate subscriptions for different data types
    const unsubscribeEngagement = onSnapshot(
      collection(db, 'user_engagement'),
      (snapshot) => {
        const engagementData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(data => data.userId === user.uid)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100);

        // Process engagement data for charts
        const activityByDate = {};
        engagementData.forEach(activity => {
          if (activity.timestamp) {
            const date = new Date(activity.timestamp.toDate()).toISOString().split('T')[0];
            activityByDate[date] = (activityByDate[date] || 0) + 1;
          }
        });

        const chartData = Object.entries(activityByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({
            name: date,
            activity: count
          }));

        setProgressData(chartData);
      },
      (error) => console.error('Engagement subscription error:', error)
    );

    // For instructors, optimize course engagement tracking
    if (user.role === 'instructor') {
      const unsubscribeCourseEngagement = onSnapshot(
        collection(db, 'course_engagement'),
        (snapshot) => {
          const engagementData = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter(data => data.instructorId === user.uid);

          // Calculate instructor stats without requiring index
          const stats = {
            totalViews: 0,
            totalRevenue: 0,
            totalStudents: new Set(),
            averageRating: 0,
            totalCourses: 0
          };

          engagementData.forEach(data => {
            if (data.action === 'view') stats.totalViews++;
            if (data.action === 'enroll' && data.data) {
              stats.totalRevenue += data.data.amount || 0;
              if (data.data.userId) stats.totalStudents.add(data.data.userId);
            }
          });

          setStats(prev => ({
            ...prev,
            totalViews: stats.totalViews,
            totalRevenue: stats.totalRevenue,
            totalStudents: stats.totalStudents.size
          }));
        },
        (error) => console.error('Course engagement subscription error:', error)
      );

      return () => {
        unsubscribeProgress();
        unsubscribeEngagement();
        unsubscribeCourseEngagement();
      };
    }

    return () => {
      unsubscribeProgress();
      unsubscribeEngagement();
    };
  }, [user?.uid, user?.role]);

  // Optimize course completion tracking
  useEffect(() => {
    if (!user?.uid || user?.role !== 'student') return;

    const unsubscribe = onSnapshot(
      collection(db, 'enrollments'),
      (snapshot) => {
        const userEnrollments = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(data => data.userId === user.uid);

        let completed = 0;
        let totalHours = 0;

        // Process enrollments without requiring additional queries
        userEnrollments.forEach(enrollment => {
          if (enrollment.progress && enrollment.courseData) {
            const completedLessons = Object.values(enrollment.progress).filter(Boolean).length;
            const totalLessons = enrollment.courseData.lessons?.length || 0;

            if (completedLessons === totalLessons && totalLessons > 0) {
              completed++;
            }

            totalHours += enrollment.courseData.lessons?.reduce((acc, lesson) => {
              return acc + (parseInt(lesson.duration) || 0);
            }, 0) || 0;
          }
        });

        setStats(prev => ({
          ...prev,
          coursesCompleted: completed,
          totalHoursLearned: Math.round(totalHours / 60)
        }));
      },
      (error) => console.error('Enrollment subscription error:', error)
    );

    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  // Add real-time course tracking for instructors
  useEffect(() => {
    if (!user?.uid || user?.role !== 'instructor') return;

    const unsubscribeCourses = onSnapshot(
      query(collection(db, 'courses'), where('instructorId', '==', user.uid)),
      async (snapshot) => {
        try {
          const courseData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          let totalRevenue = 0;
          let totalStudents = new Set();
          let totalRating = 0;
          let revenueByWeek = {};

          // Get all enrollments for instructor's courses
          const enrollmentPromises = courseData.map(async course => {
            const enrollmentSnapshot = await getDocs(
              query(collection(db, 'enrollments'), where('courseId', '==', course.id))
            );

            enrollmentSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.userId) totalStudents.add(data.userId);
              if (data.paidAmount) totalRevenue += data.paidAmount;
              
              if (data.enrolledAt) {
                const week = new Date(data.enrolledAt.toDate()).toISOString().slice(0, 10);
                revenueByWeek[week] = (revenueByWeek[week] || 0) + (data.paidAmount || 0);
              }
            });

            return enrollmentSnapshot.size;
          });

          await Promise.all(enrollmentPromises);

          // Calculate average rating
          courseData.forEach(course => {
            totalRating += course.rating || 0;
          });

          const chartData = Object.entries(revenueByWeek)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, revenue]) => ({
              name: date,
              revenue: Math.round(revenue)
            }));

          setStats(prev => ({
            ...prev,
            totalRevenue: Math.round(totalRevenue),
            totalStudents: totalStudents.size,
            averageRating: courseData.length > 0 ? totalRating / courseData.length : 0,
            totalCourses: courseData.length
          }));

          setProgressData(chartData);
        } catch (error) {
          console.error('Error processing instructor data:', error);
        }
      },
      error => console.error('Courses subscription error:', error)
    );

    return () => unsubscribeCourses();
  }, [user?.uid, user?.role]);

  // Add real-time student progress tracking
  useEffect(() => {
    if (!user?.uid || user?.role !== 'student') return;

    const unsubscribeEnrollments = onSnapshot(
      query(collection(db, 'enrollments'), where('userId', '==', user.uid)),
      async (snapshot) => {
        try {
          const enrollmentData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          let completed = 0;
          let totalHours = 0;
          let progressByWeek = {};

          // Process each enrollment
          enrollmentData.forEach(enrollment => {
            if (enrollment.courseData?.lessons) {
              const completedLessons = Object.values(enrollment.progress || {}).filter(Boolean).length;
              const totalLessons = enrollment.courseData.lessons.length;

              if (completedLessons === totalLessons && totalLessons > 0) {
                completed++;
              }

              totalHours += enrollment.courseData.lessons.reduce((acc, lesson) => {
                return acc + (parseInt(lesson.duration) || 0);
              }, 0);

              if (enrollment.lastUpdated) {
                const week = new Date(enrollment.lastUpdated.toDate()).toISOString().slice(0, 10);
                const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
                progressByWeek[week] = (progressByWeek[week] || 0) + progress;
              }
            }
          });

          const chartData = Object.entries(progressByWeek)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, progress]) => ({
              name: date,
              progress: Math.round(progress / enrollmentData.length)
            }));

          setStats(prev => ({
            ...prev,
            coursesEnrolled: enrollmentData.length,
            coursesCompleted: completed,
            totalHoursLearned: Math.round(totalHours / 60)
          }));

          setProgressData(chartData);
        } catch (error) {
          console.error('Error processing student data:', error);
        }
      },
      error => console.error('Enrollments subscription error:', error)
    );

    return () => unsubscribeEnrollments();
  }, [user?.uid, user?.role]);

  // Add real-time learning streak tracking
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeProgress = onSnapshot(
      query(collection(db, 'progress'), where('userId', '==', user.uid)),
      (snapshot) => {
        try {
          const today = new Date();
          const progressByDay = new Map();

          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.lastUpdated) {
              const date = data.lastUpdated.toDate().toISOString().split('T')[0];
              progressByDay.set(date, true);
            }
          });

          let streak = 0;
          for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            if (!progressByDay.has(dateStr)) {
              if (i === 0) continue; // Don't break streak for today
              break;
            }
            streak++;
          }

          setStats(prev => ({
            ...prev,
            learningStreak: streak
          }));
        } catch (error) {
          console.error('Error processing streak data:', error);
        }
      },
      error => console.error('Progress subscription error:', error)
    );

    return () => unsubscribeProgress();
  }, [user?.uid]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Welcome back, {user?.name || 'User'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
            Logout
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {user?.role === 'student' ? (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <AcademicCapIcon className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Courses Enrolled</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.coursesEnrolled}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <ChartBarIcon className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Courses Completed</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.coursesCompleted}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Hours Learned</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalHoursLearned}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <FireIcon className="h-8 w-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Learning Streak</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.learningStreak} days</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900">${stats.totalRevenue}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <UserGroupIcon className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Students</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <StarIcon className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Average Rating</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {stats.averageRating.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <AcademicCapIcon className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Courses</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalCourses}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {user?.role === 'student' ? 'Learning Progress' : 'Revenue Trend'}
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={user?.role === 'student' ? 'progress' : 'revenue'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 