import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  AcademicCapIcon,
  ClockIcon,
  TrophyIcon,
  ChartBarIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

const Progress = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

            return {
              id: enrollDoc.id,
              courseId: enrollDoc.data().courseId,
              progress: enrollDoc.data().progress || {},
              lastAccessed: enrollDoc.data().lastAccessed?.toDate() || new Date(),
              course: { id: courseSnap.id, ...courseSnap.data() },
            };
          })
        );

        // Filter out any null values from courses that weren't found
        const validEnrollments = enrollmentData.filter(Boolean);
        setEnrollments(validEnrollments);
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

  const calculateProgress = (enrollment) => {
    const completedLessons = Object.values(enrollment.progress).filter(Boolean).length;
    const totalLessons = enrollment.course.lessons?.length || 0;
    return {
      percentage: Math.round((completedLessons / totalLessons) * 100) || 0,
      completed: completedLessons,
      total: totalLessons,
    };
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Overall Progress */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Learning Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Overall Progress</p>
                  <p className="mt-1 text-3xl font-bold text-blue-700">{overallPercentage}%</p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Completed Lessons</p>
                  <p className="mt-1 text-3xl font-bold text-green-700">
                    {overallProgress.completedLessons}
                  </p>
                </div>
                <AcademicCapIcon className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Enrolled Courses</p>
                  <p className="mt-1 text-3xl font-bold text-purple-700">{enrollments.length}</p>
                </div>
                <TrophyIcon className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Course Progress List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
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
                  <div key={enrollment.id} className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        to={`/courses/${enrollment.courseId}`}
                        className="text-lg font-medium text-gray-900 hover:text-blue-600"
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
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      <span className="absolute right-0 top-4 text-sm font-medium text-gray-600">
                        {progress.percentage}%
                      </span>
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
        </div>
      </div>
    </div>
  );
};

export default Progress; 