import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  UsersIcon,
  StarIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

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
        return {
          ...course,
          totalRevenue: course.price * enrollmentSnapshot.size,
          actualEnrollments: enrollmentSnapshot.size,
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
      acc.totalReviews += course.reviewCount;
      acc.averageRating += course.rating;
      return acc;
    },
    { totalStudents: 0, totalRevenue: 0, totalReviews: 0, averageRating: 0 }
  );

  totalStats.averageRating = totalStats.averageRating / courseStats.length || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {totalStats.totalStudents}
                  </p>
                </div>
                <UsersIcon className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    ${totalStats.totalRevenue}
                  </p>
                </div>
                <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Rating</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {totalStats.averageRating.toFixed(1)}
                  </p>
                </div>
                <StarIcon className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Reviews</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {totalStats.totalReviews}
                  </p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Course Performance */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
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
                    <tr key={course.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{course.title}</div>
                        <div className="text-sm text-gray-500">{course.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {course.actualEnrollments}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        ${course.totalRevenue}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-gray-500">
                          <StarIcon className="h-5 w-5 text-yellow-400 mr-1" />
                          {(course.rating / course.reviewCount || 0).toFixed(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {course.reviewCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics; 