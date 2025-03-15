import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  MagnifyingGlassIcon,
  AcademicCapIcon,
  ClockIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const Students = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: studentData = [], isLoading } = useQuery({
    queryKey: ['students', user?.uid],
    queryFn: async () => {
      // First get all courses by the instructor
      const coursesRef = collection(db, 'courses');
      const courseQuery = query(coursesRef, where('instructorId', '==', user.uid));
      const courseSnapshot = await getDocs(courseQuery);
      const courseIds = courseSnapshot.docs.map(doc => doc.id);

      // Then get all enrollments for these courses
      const enrollmentsRef = collection(db, 'enrollments');
      const enrollmentPromises = courseIds.map(async (courseId) => {
        const enrollmentQuery = query(enrollmentsRef, where('courseId', '==', courseId));
        const enrollmentSnapshot = await getDocs(enrollmentQuery);
        
        const enrollmentData = await Promise.all(
          enrollmentSnapshot.docs.map(async (doc) => {
            const userData = await getDoc(doc(db, 'users', doc.data().userId));
            const courseData = await getDoc(doc(db, 'courses', courseId));
            
            return {
              id: doc.id,
              ...doc.data(),
              student: userData.data(),
              course: courseData.data(),
            };
          })
        );
        
        return enrollmentData;
      });

      const allEnrollments = (await Promise.all(enrollmentPromises)).flat();
      
      // Group by student
      const studentMap = allEnrollments.reduce((acc, enrollment) => {
        if (!acc[enrollment.userId]) {
          acc[enrollment.userId] = {
            id: enrollment.userId,
            name: enrollment.student.displayName,
            email: enrollment.student.email,
            enrollments: [],
          };
        }
        acc[enrollment.userId].enrollments.push({
          courseId: enrollment.courseId,
          courseName: enrollment.course.title,
          progress: enrollment.progress || {},
          enrolledAt: enrollment.enrolledAt,
        });
        return acc;
      }, {});

      return Object.values(studentMap);
    },
    enabled: !!user,
  });

  const filteredStudents = searchTerm
    ? studentData.filter(
        student =>
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : studentData;

  const calculateProgress = (enrollment) => {
    const completedLessons = Object.values(enrollment.progress).filter(Boolean).length;
    const totalLessons = enrollment.course?.lessons?.length || 0;
    return Math.round((completedLessons / totalLessons) * 100) || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="mt-2 text-gray-600">Manage and track your students' progress</p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-lg shadow-sm">
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
                <div key={student.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{student.name}</h3>
                      <p className="text-sm text-gray-500">{student.email}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {student.enrollments.length} courses enrolled
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {student.enrollments.map((enrollment) => (
                      <div
                        key={enrollment.courseId}
                        className="bg-gray-50 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            {enrollment.courseName}
                          </h4>
                          <div className="flex items-center text-sm text-gray-500">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            Enrolled: {new Date(enrollment.enrolledAt?.toDate()).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-500">
                            <ChartBarIcon className="h-4 w-4 mr-1" />
                            Progress: {calculateProgress(enrollment)}%
                          </div>
                          <div className="w-48 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${calculateProgress(enrollment)}%` }}
                            />
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
        </div>
      </div>
    </div>
  );
};

export default Students; 