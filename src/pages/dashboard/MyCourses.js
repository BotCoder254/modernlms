import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  AcademicCapIcon,
  ClockIcon,
  PlayIcon,
  BookOpenIcon,
  UserGroupIcon,
  StarIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const MyCourses = () => {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [createdCourses, setCreatedCourses] = useState([]);
  const [isLoadingEnrolled, setIsLoadingEnrolled] = useState(true);
  const [isLoadingCreated, setIsLoadingCreated] = useState(true);
  const [courseReviews, setCourseReviews] = useState({});

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
            
            // Skip deleted courses
            const courseData = courseSnap.data();
            if (courseData.isDeleted === true) {
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
              id: courseSnap.id,
              ...courseData,
              progress: enrollDoc.data().progress || {},
              lastAccessed: enrollDoc.data().lastAccessed?.toDate() || new Date(),
              reviews: reviews
            };
          })
        );

        // Filter out any null values from courses that weren't found or are deleted
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
    const q = query(
      coursesRef, 
      where('instructorId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const courses = await Promise.all(snapshot.docs.map(async (courseDoc) => {
          // Skip deleted courses
          const courseData = courseDoc.data();
          if (courseData.isDeleted === true) {
            return null;
          }
          
          // Fetch reviews for this course - modified to avoid index error
          const reviewsRef = collection(db, 'reviews');
          const reviewsQuery = query(
            reviewsRef,
            where('courseId', '==', courseDoc.id),
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
            [courseDoc.id]: reviews
          }));

          return {
            id: courseDoc.id,
            ...courseData,
            lastUpdated: courseData.lastUpdated?.toDate() || new Date(),
            reviews: reviews
          };
        }));

        // Filter out null values (deleted courses)
        const activeCourses = courses.filter(course => course !== null);
        setCreatedCourses(activeCourses);
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

  const getAverageRating = (courseId) => {
    const reviews = courseReviews[courseId] || [];
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return (totalRating / reviews.length).toFixed(1);
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
              <div className="flex items-center space-x-3">
                <Link
                  to="/dashboard/recycled-courses"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Recycled Courses
                </Link>
                <Link
                  to="/courses/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create New Course
                </Link>
              </div>
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
                  <div
                    key={course.id}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Link
                      to={`/courses/${course.id}`}
                    >
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-48 object-cover rounded-t-lg"
                      />
                    </Link>
                    <div className="p-4">
                      <Link to={`/courses/${course.id}`}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                      </Link>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                        <div className="flex items-center">
                          <UserGroupIcon className="h-5 w-5 mr-1" />
                          {course.enrollmentCount} students
                        </div>
                        <div className="flex items-center">
                          <StarIcon className="h-5 w-5 mr-1 text-yellow-400" />
                          {getAverageRating(course.id)}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Last updated: {new Date(course.updatedAt?.seconds * 1000).toLocaleDateString()}
                        </span>
                        <Link
                          to={`/courses/edit/${course.id}`}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <PencilIcon className="h-4 w-4 mr-1" />
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
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