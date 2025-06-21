import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  TrashIcon,
  ArrowPathIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const RecycledCourses = () => {
  const { user } = useAuth();
  const [recycledCourses, setRecycledCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || user?.role !== 'instructor') return;

    const fetchRecycledCourses = async () => {
      try {
        setIsLoading(true);
        // Query courses marked as deleted within the last 7 days
        const coursesRef = collection(db, 'courses');
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        
        // First, query for deleted courses by this instructor
        const q = query(
          coursesRef, 
          where('instructorId', '==', user.uid),
          where('isDeleted', '==', true)
        );
        
        const snapshot = await getDocs(q);
        
        // Then filter the results in JavaScript to avoid needing a composite index
        const courses = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(course => course.deletedAt && course.deletedAt.toDate() >= sevenDaysAgo)
          .map(course => ({
            ...course,
            daysRemaining: calculateDaysRemaining(course.deletedAt?.toDate())
          }));
        
        setRecycledCourses(courses);
      } catch (error) {
        console.error('Error fetching recycled courses:', error);
        toast.error('Failed to load recycled courses.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecycledCourses();
  }, [user?.uid, user?.role]);

  const calculateDaysRemaining = (deletedDate) => {
    if (!deletedDate) return 0;
    
    const now = new Date();
    const expiryDate = new Date(deletedDate);
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from deletion
    
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleRestore = async (courseId) => {
    try {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        isDeleted: false,
        deletedAt: null,
        restoredAt: new Date(),
      });
      
      toast.success('Course restored successfully!');
      // Update UI
      setRecycledCourses(recycledCourses.filter(course => course.id !== courseId));
    } catch (error) {
      console.error('Error restoring course:', error);
      toast.error('Failed to restore course.');
    }
  };

  const handlePermanentDelete = async (courseId) => {
    if (!window.confirm('This will permanently delete the course and cannot be undone. Continue?')) {
      return;
    }
    
    try {
      // Check for enrolled students before permanent deletion
      const enrollmentsRef = collection(db, 'enrollments');
      const q = query(enrollmentsRef, where('courseId', '==', courseId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        toast.error('Cannot permanently delete a course with enrolled students.');
        return;
      }
      
      // Delete course versions first
      const versionsRef = collection(db, 'courseVersions');
      const versionsQuery = query(versionsRef, where('courseId', '==', courseId));
      const versionSnapshot = await getDocs(versionsQuery);
      
      const deletePromises = versionSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Then delete the main course document
      await deleteDoc(doc(db, 'courses', courseId));
      
      toast.success('Course permanently deleted.');
      setRecycledCourses(recycledCourses.filter(course => course.id !== courseId));
    } catch (error) {
      console.error('Error permanently deleting course:', error);
      toast.error('Failed to delete course permanently.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center mb-6">
          <Link to="/dashboard/my-courses" className="mr-4">
            <ArrowLeftIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Recycled Courses</h2>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900">About Recycled Courses</h3>
              <p className="mt-1 text-sm text-gray-600">
                Courses remain in the recycle bin for 7 days before being permanently deleted.
                During this period, you can restore them or delete them permanently.
                Courses with enrolled students cannot be permanently deleted.
              </p>
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <ArrowPathIcon className="animate-spin h-8 w-8 text-blue-600" />
          </div>
        ) : recycledCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recycledCourses.map((course) => (
              <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="relative">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-48 object-cover opacity-50"
                  />
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                    <div className="bg-white bg-opacity-75 px-4 py-2 rounded-lg">
                      <p className="text-red-600 font-medium flex items-center">
                        <TrashIcon className="h-5 w-5 mr-1" />
                        Deleted
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 mr-1" />
                      <span className="text-red-600">
                        {course.daysRemaining} {course.daysRemaining === 1 ? 'day' : 'days'} remaining
                      </span>
                    </div>
                    <div className="flex items-center">
                      Deleted on {course.deletedAt?.toDate().toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex justify-between space-x-2 mt-4">
                    <button
                      onClick={() => handleRestore(course.id)}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(course.id)}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-gray-50"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Delete Permanently
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <TrashIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No recycled courses</h3>
            <p className="mt-1 text-gray-500">
              Deleted courses will appear here for 7 days before being permanently removed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecycledCourses; 