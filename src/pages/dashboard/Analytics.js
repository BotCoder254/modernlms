import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import {
  UsersIcon,
  StarIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PresentationChartLineIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';

const Analytics = () => {
  const { user } = useAuth();

  const { data: courseStats = [], isLoading } = useQuery({
    queryKey: ['courseStats', user?.uid],
    queryFn: async () => {
      const coursesRef = collection(db, 'courses');
      const q = query(coursesRef, where('instructorId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const courseData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate total revenue
      const enrollmentsRef = collection(db, 'enrollments');
      const enrollmentPromises = courseData.map(async (course) => {
        const enrollmentQuery = query(
          enrollmentsRef,
          where('courseId', '==', course.id)
        );
        const enrollmentSnapshot = await getDocs(enrollmentQuery);
        
        // Get monthly enrollment data
        const monthlyData = {};
        let revenueByCategory = {};
        let studentsByLevel = { 'Beginner': 0, 'Intermediate': 0, 'Advanced': 0 };
        
        enrollmentSnapshot.docs.forEach(doc => {
          const enrollmentData = doc.data();
          
          // Process monthly data
          if (enrollmentData.enrolledAt) {
            const date = new Date(enrollmentData.enrolledAt.toDate());
            const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
            
            if (!monthlyData[monthYear]) {
              monthlyData[monthYear] = { month: monthYear, revenue: 0, enrollments: 0 };
            }
            
            monthlyData[monthYear].revenue += course.price || 0;
            monthlyData[monthYear].enrollments += 1;
          }
          
          // Process category data
          const category = course.category || 'Uncategorized';
          if (!revenueByCategory[category]) {
            revenueByCategory[category] = 0;
          }
          revenueByCategory[category] += course.price || 0;
          
          // Process student level data
          if (course.level) {
            studentsByLevel[course.level] = (studentsByLevel[course.level] || 0) + 1;
          }
        });
        
        // Convert to arrays for charts
        const monthlyDataArray = Object.values(monthlyData).sort((a, b) => {
          const [aMonth, aYear] = a.month.split('/').map(Number);
          const [bMonth, bYear] = b.month.split('/').map(Number);
          
          if (aYear !== bYear) return aYear - bYear;
          return aMonth - bMonth;
        });
        
        const categoryDataArray = Object.entries(revenueByCategory).map(([name, value]) => ({
          name,
          value
        }));
        
        const levelDataArray = Object.entries(studentsByLevel).map(([name, value]) => ({
          name,
          value
        }));
        
        return {
          ...course,
          totalRevenue: course.price * enrollmentSnapshot.size,
          actualEnrollments: enrollmentSnapshot.size,
          monthlyData: monthlyDataArray,
          categoryData: categoryDataArray,
          levelData: levelDataArray
        };
      });

      return Promise.all(enrollmentPromises);
    },
    enabled: !!user,
  });

  const totalStats = courseStats.reduce(
    (acc, course) => {
      acc.totalStudents += course.actualEnrollments;
      acc.totalRevenue += course.totalRevenue;
      acc.totalReviews += course.reviewCount || 0;
      acc.averageRating += course.rating || 0;
      return acc;
    },
    { totalStudents: 0, totalRevenue: 0, totalReviews: 0, averageRating: 0 }
  );

  totalStats.averageRating = totalStats.averageRating / (courseStats.length || 1);
  
  // Prepare combined monthly data for chart
  const combinedMonthlyData = {};
  courseStats.forEach(course => {
    (course.monthlyData || []).forEach(item => {
      if (!combinedMonthlyData[item.month]) {
        combinedMonthlyData[item.month] = { 
          name: item.month, 
          revenue: 0, 
          enrollments: 0 
        };
      }
      combinedMonthlyData[item.month].revenue += item.revenue;
      combinedMonthlyData[item.month].enrollments += item.enrollments;
    });
  });
  
  const monthlyChartData = Object.values(combinedMonthlyData).sort((a, b) => {
    const [aMonth, aYear] = a.name.split('/').map(Number);
    const [bMonth, bYear] = b.name.split('/').map(Number);
    
    if (aYear !== bYear) return aYear - bYear;
    return aMonth - bMonth;
  });
  
  // Combine category data
  const combinedCategoryData = {};
  courseStats.forEach(course => {
    (course.categoryData || []).forEach(item => {
      if (!combinedCategoryData[item.name]) {
        combinedCategoryData[item.name] = 0;
      }
      combinedCategoryData[item.name] += item.value;
    });
  });
  
  const categoryChartData = Object.entries(combinedCategoryData)
    .map(([name, value]) => ({ name, value }));
    
  // Combine level data
  const combinedLevelData = {};
  courseStats.forEach(course => {
    (course.levelData || []).forEach(item => {
      if (!combinedLevelData[item.name]) {
        combinedLevelData[item.name] = 0;
      }
      combinedLevelData[item.name] += item.value;
    });
  });
  
  const levelChartData = Object.entries(combinedLevelData)
    .map(([name, value]) => ({ name, value }));
  
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Course Analytics</h2>
          <p className="text-gray-600">Track the performance of your courses and student engagement</p>
        </motion.div>
        
        {/* Overview Stats */}
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
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {totalStats.totalStudents}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <UsersIcon className="h-6 w-6 text-blue-600" />
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
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  ${totalStats.totalRevenue}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
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
                <p className="text-sm font-medium text-gray-500">Average Rating</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {totalStats.averageRating.toFixed(1)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <StarIcon className="h-6 w-6 text-yellow-600" />
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
                <p className="text-sm font-medium text-gray-500">Total Reviews</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {totalStats.totalReviews}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Revenue</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Enrollments</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, 'Enrollments']} />
                  <Line 
                    type="monotone" 
                    dataKey="enrollments" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue by Category</h3>
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
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Students by Level</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {levelChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Students']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Course Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="bg-white rounded-xl shadow-md border border-gray-100"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-900">Course Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reviews
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : (
                  courseStats.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-md object-cover" src={course.thumbnail} alt="" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{course.title}</div>
                            <div className="text-sm text-gray-500">{course.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">{course.actualEnrollments}</div>
                        <div className="text-xs text-gray-500 flex items-center">
                          {course.actualEnrollments > 10 ? (
                            <ArrowUpIcon className="h-3 w-3 text-green-500 mr-1" />
                          ) : (
                            <ArrowDownIcon className="h-3 w-3 text-red-500 mr-1" />
                          )}
                          {course.level}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">${course.totalRevenue}</div>
                        <div className="text-xs text-gray-500">
                          ${course.price} per student
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <StarIcon className="h-5 w-5 text-yellow-400 mr-1" />
                          <span className="text-sm text-gray-900 font-medium">
                            {(course.rating / (course.reviewCount || 1) || 0).toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {course.reviewCount || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;