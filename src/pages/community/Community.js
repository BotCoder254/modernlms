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
  Timestamp,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
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
  const { user } = useAuth();
  
  // Migration function to ensure all comments and reviews appear in discussions
  useEffect(() => {
    const migrateCommentsAndReviews = async () => {
      try {
        // Get all comments
        const commentsQuery = query(collection(db, 'comments'));
        const commentsSnapshot = await getDocs(commentsQuery);
        
        // Get all reviews
        const reviewsQuery = query(collection(db, 'reviews'));
        const reviewsSnapshot = await getDocs(reviewsQuery);
        
        // Get existing discussions to avoid duplicates
        const discussionsQuery = query(collection(db, 'discussions'));
        const discussionsSnapshot = await getDocs(discussionsQuery);
        const existingDiscussionIds = new Set();
        
        // Track existing discussions by their source
        discussionsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.sourceId) {
            existingDiscussionIds.add(data.sourceId);
          }
        });
        
        // Migrate comments to discussions
        for (const doc of commentsSnapshot.docs) {
          const comment = doc.data();
          
          // Skip if already migrated or if courseId is missing
          if (existingDiscussionIds.has(doc.id) || !comment.courseId) continue;
          
          await addDoc(collection(db, 'discussions'), {
            userId: comment.userId || 'unknown',
            userName: comment.userName || (comment.userId ? comment.userId.slice(0, 5) + '...' : 'Student'),
            courseId: comment.courseId,
            message: comment.comment || 'No message content',
            createdAt: comment.createdAt || serverTimestamp(),
            userRole: comment.userRole || 'student',
            likes: 0,
            likedBy: [],
            responseCount: 0,
            sourceId: doc.id,
            sourceType: 'comment'
          });
        }
        
        // Migrate reviews to discussions
        for (const doc of reviewsSnapshot.docs) {
          const review = doc.data();
          
          // Skip if already migrated or if courseId is missing
          if (existingDiscussionIds.has(doc.id) || !review.courseId) continue;
          
          await addDoc(collection(db, 'discussions'), {
            userId: review.userId || 'unknown',
            userName: review.userName || (review.userId ? review.userId.slice(0, 5) + '...' : 'Student'),
            courseId: review.courseId,
            message: `Review (${review.rating || 0}/5): ${review.comment || 'No review content'}`,
            createdAt: review.createdAt || serverTimestamp(),
            userRole: review.userRole || 'student',
            likes: 0,
            likedBy: [],
            responseCount: 0,
            sourceId: doc.id,
            sourceType: 'review'
          });
        }
      } catch (error) {
        console.error("Error in migration:", error);
      }
    };
    
    // Only run migration if user is logged in
    if (user) {
      migrateCommentsAndReviews();
    }
  }, [user]);

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
    let q;

    // Simple query without compound index requirements
      if (selectedCourse !== 'all') {
      q = query(discussionsRef, where('courseId', '==', selectedCourse), limit(50));
    } else {
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
          
          // Convert Map back to array and sort client-side to avoid Firestore indexes
          let discussionsList = Array.from(discussionsMap.values());
          
          // Apply client-side sorting based on selected sort option
      switch (sortBy) {
        case 'popular':
              discussionsList = discussionsList.sort((a, b) => (b.likes || 0) - (a.likes || 0));
          break;
        case 'unanswered':
              discussionsList = discussionsList.filter(d => !(d.responseCount && d.responseCount > 0))
                .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds || 0);
              break;
            default: // 'recent'
              discussionsList = discussionsList.sort((a, b) => 
                b.createdAt?.seconds - a.createdAt?.seconds || 0
              );
          break;
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
                          {discussion.sourceType === 'review' && <span className="text-blue-600">[Review] </span>}
                          {discussion.sourceType === 'comment' && <span className="text-green-600">[Comment] </span>}
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