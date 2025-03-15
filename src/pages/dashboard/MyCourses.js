import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  AcademicCapIcon,
  ClockIcon,
  PlayIcon,
  BookOpenIcon,
  UserGroupIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

const MyCourses = () => {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [createdCourses, setCreatedCourses] = useState([]);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(true);
  const [isLoadingCreated, setIsLoadingCreated] = useState(true);

  // Real-time subscription for enrolled courses
  useEffect(() => {
    if (!user?.uid) return;

    setIsLoadingEnrolled(true);
    const enrollmentsRef = collection(db, 'enrollments');
    const q = query(enrollmentsRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const courses = await Promise.all(
          snapshot.docs.map(async (enrollDoc) => {
            const courseDocRef = doc(db, 'courses', enrollDoc.data().courseId);
            const courseSnap = await getDoc(courseDocRef);
            
            if (!courseSnap.exists()) {
              console.error('Course not found:', enrollDoc.data().courseId);
              return null;
            }

            return {
              id: courseSnap.id,
              ...courseSnap.data(),
              progress: enrollDoc.data().progress || {},
              lastAccessed: enrollDoc.data().lastAccessed?.toDate() || new Date(),
            };
          })
        );

        // Filter out any null values from courses that weren't found
        const validCourses = courses.filter(Boolean);
        setEnrolledCourses(validCourses);
        setIsLoadingEnrolled(false);
      } catch (error) {
        console.error('Error fetching enrolled courses:', error);
        setIsLoadingEnrolled(false);
      }
    }, (error) => {
      console.error('Enrolled courses subscription error:', error);
      setIsLoadingEnrolled(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Real-time subscription for created courses (instructors)
  useEffect(() => {
    if (!user?.uid || user?.role !== 'instructor') return;

    setIsLoadingCreated(true);
    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, where('instructorId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const courses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastUpdated: doc.data().lastUpdated?.toDate() || new Date(),
        }));
        setCreatedCourses(courses);
        setIsLoadingCreated(false);
      } catch (error) {
        console.error('Error fetching created courses:', error);
        setIsLoadingCreated(false);
      }
    }, (error) => {
      console.error('Created courses subscription error:', error);
      setIsLoadingCreated(false);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  const calculateProgress = (course) => {
    const completedLessons = Object.values(course.progress || {}).filter(Boolean).length;
    const totalLessons = course.lessons?.length || 0;
    return Math.round((completedLessons / totalLessons) * 100) || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Enrolled Courses */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Learning</h2>
          {isLoadingEnrolled ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-lg" />
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : enrolledCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((course) => (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                      <div className="flex items-center">
                        <ClockIcon className="h-5 w-5 mr-1" />
                        {course.lessons.length} lessons
                      </div>
                      <div className="flex items-center">
                        <AcademicCapIcon className="h-5 w-5 mr-1" />
                        {course.level}
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{calculateProgress(course)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateProgress(course)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900">No courses yet</h3>
              <p className="mt-1 text-gray-500">Get started by enrolling in a course</p>
              <div className="mt-6">
                <Link
                  to="/courses"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlayIcon className="h-5 w-5 mr-2" />
                  Browse Courses
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Created Courses (for instructors) */}
        {user?.role === 'instructor' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Created Courses</h2>
              <Link
                to="/courses/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create New Course
              </Link>
            </div>
            {isLoadingCreated ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-t-lg" />
                    <div className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : createdCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {createdCourses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center">
                          <UserGroupIcon className="h-5 w-5 mr-1" />
                          {course.enrollmentCount} students
                        </div>
                        <div className="flex items-center">
                          <StarIcon className="h-5 w-5 mr-1 text-yellow-400" />
                          {(course.rating / course.reviewCount || 0).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No courses created</h3>
                <p className="mt-1 text-gray-500">Start creating your first course</p>
                <div className="mt-6">
                  <Link
                    to="/courses/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create Course
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCourses; 