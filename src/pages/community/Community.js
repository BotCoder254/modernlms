import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  ChatBubbleLeftRightIcon,
  FireIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const SORT_OPTIONS = {
  recent: { label: 'Most Recent', icon: ClockIcon },
  popular: { label: 'Most Popular', icon: FireIcon },
  unanswered: { label: 'Unanswered', icon: QuestionMarkCircleIcon },
};

const Community = () => {
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [discussions, setDiscussions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const discussionsPerPage = 5;

  // Fetch courses for the filter
  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const coursesRef = collection(db, 'courses');
      const snapshot = await getDocs(coursesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
  });

  // Use a real-time subscription for discussions
  useEffect(() => {
    setIsLoading(true);
    
      const discussionsRef = collection(db, 'discussions');
      let q = query(discussionsRef);

      // Apply filters
      if (selectedCourse !== 'all') {
        q = query(q, where('courseId', '==', selectedCourse));
      }

    // Apply sorting with proper error handling
    try {
      switch (sortBy) {
        case 'popular':
          q = query(q, orderBy('likes', 'desc'));
          break;
        case 'unanswered':
          q = query(q, where('responseCount', '==', 0));
          break;
        default:
          // For 'recent', fetch without orderBy to avoid index issues
          q = query(q, limit(50));
          break;
      }
    } catch (error) {
      console.error("Error creating query:", error);
      // Fallback to simple query with just a limit
      q = query(discussionsRef, limit(50));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          // Use a Map to ensure we don't have duplicate IDs
          const discussionsMap = new Map();
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            // Create a truly unique key by combining id with timestamp
            const uniqueId = `${doc.id}-${data.createdAt ? data.createdAt.seconds : Date.now()}`;
            discussionsMap.set(uniqueId, { 
              id: doc.id, 
              uniqueId,
              ...data,
              // Ensure createdAt is properly formatted
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : new Timestamp(0, 0)
            });
          });
          
          // Convert Map back to array and sort if needed
          let discussionsList = Array.from(discussionsMap.values());
          
          // Sort client-side for 'recent' to avoid Firebase index issues
          if (sortBy === 'recent') {
            discussionsList = discussionsList.sort((a, b) => 
              b.createdAt?.seconds - a.createdAt?.seconds || 0
            );
          }
          
          setDiscussions(discussionsList);
          setIsLoading(false);
          // Reset to first page when filters change
          setCurrentPage(1);
        } catch (error) {
          console.error("Error processing discussions:", error);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Discussions subscription error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sortBy, selectedCourse]);

  // Pagination function
  const paginateDiscussions = (items, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return items.slice(startIndex, endIndex);
  };

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-center mt-6">
        <nav className="flex items-center space-x-1" aria-label="Pagination">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`px-2 py-1 rounded-md ${
              currentPage === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          {[...Array(totalPages)].map((_, index) => {
            const pageNumber = index + 1;
            // Show first page, last page, and pages around current page
            if (
              pageNumber === 1 ||
              pageNumber === totalPages ||
              (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
            ) {
              return (
                <button
                  key={`page-${pageNumber}`}
                  onClick={() => onPageChange(pageNumber)}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === pageNumber
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            } 
            // Show ellipsis for skipped pages
            else if (
              (pageNumber === 2 && currentPage > 3) ||
              (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
            ) {
              return <span key={`ellipsis-${pageNumber}`}>...</span>;
            }
            return null;
          })}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={`px-2 py-1 rounded-md ${
              currentPage === totalPages
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </nav>
      </div>
    );
  };

  // Get paginated discussions
  const paginatedDiscussions = paginateDiscussions(discussions, currentPage, discussionsPerPage);
  const totalPages = Math.ceil(discussions.length / discussionsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Community</h1>
          <p className="mt-2 text-gray-600">
            Join discussions, ask questions, and learn from others
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          {/* Course Filter */}
          <div className="flex-1 max-w-xs">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Courses</option>
              {courses?.map((course) => (
                <option key={`course-${course.id}`} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex space-x-2">
            {Object.entries(SORT_OPTIONS).map(([key, { label, icon: Icon }]) => (
              <button
                key={`sort-${key}`}
                onClick={() => setSortBy(key)}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                  sortBy === key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Discussions List */}
        <div className="space-y-4">
          {isLoading ? (
            // Loading state
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={`loading-${i}`} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : discussions?.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No discussions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Be the first to start a discussion!
              </p>
            </div>
          ) : (
            // Discussions with pagination
            <>
            <motion.div layout className="space-y-4">
                {paginatedDiscussions.map((discussion, index) => (
                <motion.div
                    key={`discussion-${discussion.uniqueId}-${index}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <Link
                    to={`/community/discussion/${discussion.courseId}/${discussion.id}`}
                    className="block p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {discussion.message}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Started by {discussion.userName || (discussion.userId ? discussion.userId.slice(0, 5) + '...' : 'Student')} •{' '}
                          {discussion.createdAt?.seconds
                            ? new Date(discussion.createdAt.seconds * 1000).toLocaleString()
                            : 'Just now'}
                        </p>
                      </div>
                      <div className="ml-4 flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <ChatBubbleLeftRightIcon className="h-5 w-5 mr-1" />
                          {discussion.responseCount || 0}
                        </span>
                        <span className="flex items-center">
                          <FireIcon className="h-5 w-5 mr-1" />
                          {discussion.likes || 0}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
              
              {/* Pagination */}
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Community; 