import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import ReactPlayer from 'react-player';
import { toast } from 'react-hot-toast';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpenIcon,
  AcademicCapIcon,
  LockClosedIcon,
  PlayIcon,
  ClockIcon,
  PencilIcon,
  CheckCircleIcon,
  StarIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  DocumentIcon,
  UserIcon,
  UserCircleIcon,
  XMarkIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookmarkIcon as BookmarkOutlineIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, BookmarkIcon as BookmarkSolidIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import PaymentForm from '../../components/PaymentForm';
import { trackUserEngagement, trackLessonProgress, trackCourseEngagement } from '../../utils/analytics';

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [progress, setProgress] = useState({});
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [bookmarks, setBookmarks] = useState({});
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [watchTime, setWatchTime] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(0);
  const playerRef = useRef(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [commentPage, setCommentPage] = useState(1);
  const [lessonPage, setLessonPage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const itemsPerPage = 5;
  const [reviews, setReviews] = useState([]);
  const [progressPage, setProgressPage] = useState(1);

  // Fetch course data
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const docRef = doc(db, 'courses', courseId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Course not found');
      }
      return { id: docSnap.id, ...docSnap.data() };
    },
  });

  // Check enrollment status
  useEffect(() => {
    const checkEnrollment = async () => {
      if (user?.uid && courseId) {
        const enrollmentRef = collection(db, 'enrollments');
        const q = query(
          enrollmentRef,
          where('userId', '==', user.uid),
          where('courseId', '==', courseId)
        );
        const querySnapshot = await getDocs(q);
        setIsEnrolled(!querySnapshot.empty);

        if (!querySnapshot.empty) {
          const enrollmentDoc = querySnapshot.docs[0];
          const enrollmentData = enrollmentDoc.data();
          setProgress(enrollmentData.progress || {});
        }
      }
    };

    checkEnrollment();
  }, [user?.uid, courseId]);

  // Fetch bookmarks
  useEffect(() => {
    const fetchBookmarks = async () => {
      if (user && courseId) {
        const bookmarksRef = collection(db, 'bookmarks');
        const q = query(
          bookmarksRef,
          where('userId', '==', user.uid),
          where('courseId', '==', courseId)
        );
        const snapshot = await getDocs(q);
        const bookmarkData = {};
        snapshot.forEach(doc => {
          bookmarkData[doc.data().lessonId] = doc.data().timestamp;
        });
        setBookmarks(bookmarkData);
      }
    };
    fetchBookmarks();
  }, [user, courseId]);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!selectedLesson?.id || !courseId || !user?.uid) return;

      try {
        const commentsRef = collection(db, 'comments');
        const q = query(
          commentsRef,
          where('lessonId', '==', selectedLesson.id),
          where('courseId', '==', courseId)
        );
        const snapshot = await getDocs(q);
        const commentData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setComments(commentData);
      } catch (error) {
        console.error('Error fetching comments:', error);
        setComments([]);
      }
    };

    fetchComments();
  }, [selectedLesson?.id, courseId, user?.uid]);

  // Enroll in course mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid || !courseId || !course) {
        throw new Error('Missing required information for enrollment');
      }

      // Check if user is instructor and course creator
      if (user.role === 'instructor') {
        throw new Error('Instructors cannot enroll in courses');
      }

      // Apply discount if available
      const finalPrice = course.hasDiscount && new Date() < new Date(course.discountEndDate) 
        ? course.discountPrice 
        : course.price || 0;

      const enrollmentRef = await addDoc(collection(db, 'enrollments'), {
        userId: user.uid,
        courseId,
        enrolledAt: serverTimestamp(),
        progress: {},
        paidAmount: finalPrice,
        userRole: user.role,
        courseData: {
          title: course.title,
          lessons: course.lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            duration: lesson.duration
          }))
        }
      });

      await updateDoc(doc(db, 'courses', courseId), {
        enrollmentCount: increment(1),
        lastActivity: serverTimestamp()
      });

      return enrollmentRef;
    },
    onSuccess: () => {
      setIsEnrolled(true);
      toast.success('Successfully enrolled in course!');
      queryClient.invalidateQueries(['course', courseId]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to enroll in course');
      console.error('Enrollment error:', error);
    },
  });

  // Mark lesson as complete mutation
  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId) => {
      if (!user?.uid || !courseId) {
        throw new Error('Missing required information');
      }

      const enrollmentRef = collection(db, 'enrollments');
      const q = query(
        enrollmentRef,
        where('userId', '==', user.uid),
        where('courseId', '==', courseId)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Enrollment not found');
      }

      const enrollmentDoc = querySnapshot.docs[0];
      const updatedProgress = {
        ...progress,
        [lessonId]: true,
      };

      await updateDoc(doc(db, 'enrollments', enrollmentDoc.id), {
        progress: updatedProgress,
      });

      return updatedProgress;
    },
    onSuccess: (updatedProgress) => {
      setProgress(updatedProgress);
      toast.success('Lesson marked as complete!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to mark lesson as complete');
    },
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      // Fix Anonymous User issue
      const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Student');
      const userAvatar = user.photoURL || null;
      
      const reviewRef = await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        userName: displayName,
        userAvatar: userAvatar,
        courseId,
        rating,
        comment: review,
        createdAt: serverTimestamp(),
      });

      // Also add to discussions collection so it appears in the community section
      await addDoc(collection(db, 'discussions'), {
        userId: user.uid || 'unknown',
        userName: displayName,
        courseId: courseId,
        message: `Review (${rating}/5): ${review}`,
        createdAt: serverTimestamp(),
        userRole: user.role || 'student',
        likes: 0,
        likedBy: [],
        responseCount: 0,
        sourceId: reviewRef.id,
        sourceType: 'review'
      });

      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        rating: increment(rating),
        reviewCount: increment(1),
      });

      return reviewRef;
    },
    onSuccess: () => {
      toast.success('Review submitted successfully!');
      setRating(0);
      setReview('');
      queryClient.invalidateQueries(['course', courseId]);
    },
    onError: () => {
      toast.error('Failed to submit review');
    },
  });

  // Update the progress tracking useEffect
  useEffect(() => {
    if (!selectedLesson?.id || !isWatching || !user?.uid || !courseId) return;

    const saveProgress = async () => {
      if (watchTime === lastSavedTime) return;

      try {
        const timestamp = serverTimestamp();
        const completed = watchTime >= (selectedLesson.duration || 0) * 60;
        
        // Add progress data
        const progressRef = await addDoc(collection(db, 'progress'), {
          userId: user.uid,
          courseId,
          lessonId: selectedLesson.id,
          watchTime,
          completed,
          lastUpdated: timestamp,
          userRole: user.role
        });

        // Track progress
        await trackLessonProgress(user.uid, courseId, selectedLesson.id, watchTime, completed);
        
        setLastSavedTime(watchTime);

        // Update enrollment if completed
        if (completed) {
          const enrollmentQuery = query(
            collection(db, 'enrollments'),
            where('userId', '==', user.uid),
            where('courseId', '==', courseId)
          );

          const enrollmentSnapshot = await getDocs(enrollmentQuery);
          if (!enrollmentSnapshot.empty) {
            const enrollmentDoc = enrollmentSnapshot.docs[0];
            await updateDoc(doc(db, 'enrollments', enrollmentDoc.id), {
              [`progress.${selectedLesson.id}`]: true,
              lastUpdated: timestamp,
              completedLessons: increment(1)
            });

            // Update course completion stats
            await updateDoc(doc(db, 'courses', courseId), {
              totalCompletions: increment(1),
              lastActivity: timestamp
            });

            // Update local progress state
            setProgress(prev => ({
              ...prev,
              [selectedLesson.id]: true
            }));
          }
        }
      } catch (error) {
        console.error('Error saving progress:', error);
        toast.error('Failed to save progress');
      }
    };

    const progressInterval = setInterval(saveProgress, 5000);
    return () => clearInterval(progressInterval);
  }, [watchTime, lastSavedTime, selectedLesson, isWatching, user?.uid, courseId]);

  // Update real-time progress subscription
  useEffect(() => {
    if (!user?.uid || !courseId || user?.role === 'instructor') return;

    const unsubscribeProgress = onSnapshot(
      query(collection(db, 'enrollments'), where('userId', '==', user.uid), where('courseId', '==', courseId)),
      (snapshot) => {
        try {
          if (!snapshot.empty) {
            const enrollmentData = snapshot.docs[0].data();
            setProgress(enrollmentData.progress || {});
            setIsEnrolled(true);
          } else {
            setIsEnrolled(false);
            setProgress({});
          }
        } catch (error) {
          console.error('Error processing progress:', error);
        }
      }
    );

    return () => unsubscribeProgress();
  }, [user?.uid, courseId, user?.role]);

  // Add real-time student enrollment tracking for instructors
  useEffect(() => {
    if (!user?.uid || !courseId || user?.role !== 'instructor' || !course?.instructorId || course?.instructorId !== user?.uid) return;

    const unsubscribeEnrollments = onSnapshot(
      query(collection(db, 'enrollments'), where('courseId', '==', courseId)),
      (snapshot) => {
        try {
          // Update real-time student count in UI without requiring page reload
          if (course) {
            const updatedEnrollmentCount = snapshot.size;
            queryClient.setQueryData(['course', courseId], {
              ...course,
              enrollmentCount: updatedEnrollmentCount
            });
          }
        } catch (error) {
          console.error('Error processing enrollments:', error);
        }
      }
    );

    return () => unsubscribeEnrollments();
  }, [user?.uid, courseId, user?.role, course, queryClient]);

  // Add function to check for course updates
  const { data: courseVersions } = useQuery({
    queryKey: ['courseVersions', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      
      const versionsRef = collection(db, 'courseVersions');
      const q = query(versionsRef, where('courseId', '==', courseId));
      const snapshot = await getDocs(q);
      
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.version - a.version);
    },
    enabled: !!courseId && !!user
  });

  // Update the handleAddComment function
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedLesson?.id || !user?.uid || !courseId) {
      toast.error('Please write a comment first');
      return;
    }

    try {
      // Check if user is enrolled or is the instructor
      const isInstructor = user.role === 'instructor' && course.instructorId === user.uid;
      if (!isEnrolled && !isInstructor) {
        toast.error('You must be enrolled in this course to add comments');
        return;
      }

      // Fix Anonymous User issue
      const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Student');
      
      const commentData = {
        userId: user.uid,
        userName: displayName,
        courseId,
        lessonId: selectedLesson.id,
        comment: newComment.trim(),
        timestamp: currentTime,
        createdAt: serverTimestamp(),
        userRole: user.role || 'student',
        userAvatar: user.photoURL || null
      };

      // Add comment to Firestore
      const commentRef = await addDoc(collection(db, 'comments'), commentData);

      // Also add to discussions collection so it appears in the community section
      await addDoc(collection(db, 'discussions'), {
        userId: user.uid || 'unknown',
        userName: displayName,
        courseId: courseId,
        message: newComment.trim(),
        createdAt: serverTimestamp(),
        userRole: user.role || 'student',
        likes: 0,
        likedBy: [],
        responseCount: 0,
        sourceId: commentRef.id,
        sourceType: 'comment'
      });

      // Update local state optimistically
      const newCommentData = {
        id: commentRef.id,
        ...commentData,
        createdAt: new Date()
      };
      setComments(prev => [newCommentData, ...prev]);

      // Track comment activity
      await trackUserEngagement(user.uid, courseId, selectedLesson.id, 'add_comment', {
        commentId: commentRef.id,
        timestamp: new Date()
      });

      // Update course engagement
      await updateDoc(doc(db, 'courses', courseId), {
        commentCount: increment(1),
        lastActivity: serverTimestamp()
      });

      setNewComment('');
      toast.success('Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment. Please try again.');
    }
  };

  // Update the real-time comments subscription
  useEffect(() => {
    if (!selectedLesson?.id || !courseId) return;

    const unsubscribe = onSnapshot(
      query(
      collection(db, 'comments'),
        where('lessonId', '==', selectedLesson.id),
        where('courseId', '==', courseId)
      ),
      (snapshot) => {
        try {
          // Use a Map to ensure we don't have duplicate IDs
          const commentsMap = new Map();
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            // Create a truly unique key by combining id with timestamp
            const uniqueId = `${doc.id}-${data.createdAt ? data.createdAt.seconds : Date.now()}`;
            commentsMap.set(uniqueId, { 
              id: doc.id,
              ...data,
              uniqueId,  // Store the unique ID
              createdAt: data.createdAt?.toDate() || new Date()
            });
          });
          
          // Convert Map back to array and sort
          const commentsList = Array.from(commentsMap.values())
            .sort((a, b) => b.createdAt - a.createdAt);

          setComments(commentsList);
        } catch (error) {
          console.error('Error processing comments:', error);
        }
      },
      (error) => {
        console.error('Comments subscription error:', error);
        toast.error('Failed to load comments');
      }
    );

    return () => unsubscribe();
  }, [selectedLesson?.id, courseId]);

  // Add real-time course data subscription
  useEffect(() => {
    if (!courseId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'courses', courseId),
      (doc) => {
        if (doc.exists()) {
          const courseData = { id: doc.id, ...doc.data() };
          queryClient.setQueryData(['course', courseId], courseData);
        }
      },
      (error) => {
        console.error('Course subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [courseId, queryClient]);

  // Add new function for handling video progress
  const handleProgress = ({ playedSeconds }) => {
    setWatchTime(playedSeconds);
    setCurrentTime(playedSeconds);
  };

  // Add new function for navigating between lessons
  const navigateLesson = (direction) => {
    if (!course?.lessons) return;
    
    const currentIndex = course.lessons.findIndex(lesson => lesson.id === selectedLesson?.id);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < course.lessons.length) {
      setSelectedLesson(course.lessons[newIndex]);
      setWatchTime(0);
      setLastSavedTime(0);
    }
  };

  const handleBookmark = async () => {
    if (!selectedLesson) return;
    
    try {
      const bookmarkRef = collection(db, 'bookmarks');
      const q = query(
        bookmarkRef,
        where('userId', '==', user.uid),
        where('courseId', '==', courseId),
        where('lessonId', '==', selectedLesson.id)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        const bookmarkDoc = await addDoc(bookmarkRef, {
          userId: user.uid,
          courseId,
          lessonId: selectedLesson.id,
          timestamp: currentTime,
          createdAt: serverTimestamp()
        });

        setBookmarks(prev => ({
          ...prev,
          [selectedLesson.id]: currentTime
        }));

        // Track bookmark addition
        await trackUserEngagement(user.uid, courseId, selectedLesson.id, 'add_bookmark', {
          bookmarkId: bookmarkDoc.id
        });

        toast.success('Bookmark added!');
      } else {
        const docRef = doc(db, 'bookmarks', snapshot.docs[0].id);
        await deleteDoc(docRef);
        const newBookmarks = { ...bookmarks };
        delete newBookmarks[selectedLesson.id];
        setBookmarks(newBookmarks);

        // Track bookmark removal
        await trackUserEngagement(user.uid, courseId, selectedLesson.id, 'remove_bookmark');

        toast.success('Bookmark removed!');
      }
    } catch (error) {
      toast.error('Failed to update bookmark');
    }
  };

  // Update the enroll button click handler
  const handleEnrollClick = () => {
    if (course.price > 0) {
      setShowPaymentForm(true);
    } else {
      enrollMutation.mutate();
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    enrollMutation.mutate();
  };

  // Update the lesson selection handler
  const handleLessonSelect = async (lesson) => {
    if (!canAccessLesson(lesson)) {
      toast.error('Please enroll in the course to access this lesson');
      return;
    }
    setSelectedLesson(lesson);
    setWatchTime(0);
    setLastSavedTime(0);

    // Track lesson selection
    if (user?.uid) {
      await trackUserEngagement(user.uid, courseId, lesson.id, 'select_lesson');
    }
  };

  // Update the canAccessLesson function to handle instructor access
  const canAccessLesson = (lesson) => {
    if (!lesson) return false;
    if (user?.role === 'instructor' && course?.instructorId === user?.uid) return true;
    if (isEnrolled) return true;
    return lesson.previewEnabled;
  };

  // Add useEffect for course view tracking
  useEffect(() => {
    const trackCourseView = async () => {
      if (user?.uid && courseId) {
        await trackCourseEngagement(courseId, 'view', {
          userId: user.uid,
          timestamp: new Date()
        });
      }
    };
    trackCourseView();
  }, [user?.uid, courseId]);

  // First, add a function to handle deleting comments
  const handleDeleteComment = async (commentId) => {
    if (!commentId || !user?.uid) {
      toast.error('Cannot delete comment');
      return;
    }

    try {
      // Find the comment to check ownership
      const comment = comments.find(c => c.id === commentId);
      if (!comment) {
        toast.error('Comment not found');
        return;
      }

      // Only allow users to delete their own comments, or instructors to delete any comment
      const isInstructor = user.role === 'instructor' && course.instructorId === user.uid;
      if (comment.userId !== user.uid && !isInstructor) {
        toast.error('You can only delete your own comments');
        return;
      }

      // Delete from Firestore
      await deleteDoc(doc(db, 'comments', commentId));

      // Update local state optimistically
      setComments(prev => prev.filter(c => c.id !== commentId));

      // Update course engagement
      await updateDoc(doc(db, 'courses', courseId), {
        commentCount: increment(-1)
      });

      toast.success('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  // Calculate pagination for comments
  const paginateArray = (items, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return items.slice(startIndex, endIndex);
  };

  // Helper function for generating unique keys
  const generateUniqueKey = (prefix, id, index) => {
    return `${prefix}-${id}-${index}`;
  };

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    return (
      <div className="flex items-center justify-center mt-4">
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

  // Add fetchReviews function
  const fetchReviews = async () => {
    if (!courseId) return;
    
    try {
      const reviewsSnapshot = await getDocs(
        query(
          collection(db, 'reviews'),
          where('courseId', '==', courseId)
        )
      );
      
      // Use a Map to ensure unique IDs
      const reviewsMap = new Map();
      reviewsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        reviewsMap.set(doc.id, {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      
      // Convert Map to array and sort by date
      const reviewsList = Array.from(reviewsMap.values())
        .sort((a, b) => b.createdAt - a.createdAt);
        
      setReviews(reviewsList);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    }
  };

  // Call fetchReviews in useEffect
  useEffect(() => {
    if (courseId) {
      fetchReviews();
    }
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-8" />
            <div className="aspect-video bg-gray-200 rounded-lg mb-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Course not found</h1>
          <p className="mt-2 text-gray-600">The course you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const completedLessons = Object.values(progress).filter(Boolean).length;
  const totalLessons = course.lessons.length;
  const completionPercentage = Math.round((completedLessons / totalLessons) * 100) || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Course Header */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="relative">
            <img 
              src={course.thumbnail} 
              alt={course.title} 
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-center space-x-3 mb-2">
                {course.isFree || course.price === 0 ? (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Free</span>
                ) : course.hasDiscount ? (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    -{Math.round((1 - course.discountPrice / course.price) * 100)}% OFF
                  </span>
                ) : null}
                <span className="bg-blue-600/90 text-white text-xs px-2 py-1 rounded-full">
                  {course.category}
                </span>
                <span className="bg-gray-700/90 text-white text-xs px-2 py-1 rounded-full">
              {course.level}
                </span>
            </div>
              <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
              <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
                  <StarIcon className="h-4 w-4 text-yellow-400 mr-1" />
                  {(course.rating / course.reviewCount || 0).toFixed(1)} ({course.reviewCount} reviews)
            </div>
            <div className="flex items-center">
                  <UserGroupIcon className="h-4 w-4 mr-1" />
              {course.enrollmentCount} students
            </div>
            <div className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  {totalLessons} lessons
            </div>
          </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                {course.instructorName ? course.instructorName.charAt(0).toUpperCase() : 'I'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Instructor</p>
                <p className="text-lg font-medium">{course.instructorName}</p>
              </div>
            </div>
            
            <div className="border-t border-b border-gray-100 py-6 my-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">About This Course</h2>
              <p className="text-gray-600">{course.description}</p>
              
              {/* Course outcomes */}
              {course.outcomes && course.outcomes.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">What you'll learn</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {course.outcomes.map((outcome, index) => (
                      <div key={index} className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{outcome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Course requirements */}
              {course.requirements && course.requirements.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Requirements</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {course.requirements.map((requirement, index) => (
                      <li key={index}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Enrollment CTA */}
          {!isEnrolled && (
              <div className="flex flex-col md:flex-row items-center justify-between mt-4">
                <div className="mb-4 md:mb-0">
                  <p className="text-sm text-gray-500 mb-1">Price</p>
                  <div className="flex items-center">
                    {course.hasDiscount && (
                      <span className="text-gray-400 line-through text-lg mr-2">${course.price}</span>
                    )}
                    <span className="text-2xl font-bold text-blue-600">
                      {course.isFree || course.price === 0 ? 'Free' : `$${course.discountPrice || course.price}`}
                    </span>
                  </div>
                </div>
            <button
              onClick={handleEnrollClick}
              disabled={enrollMutation.isLoading}
                  className="w-full md:w-auto px-8 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {enrollMutation.isLoading
                ? 'Processing...'
                : course.price > 0
                    ? `Enroll Now - $${course.discountPrice || course.price}`
                    : 'Enroll For Free'}
            </button>
              </div>
          )}
          </div>
        </div>

        {isEnrolled && courseVersions && courseVersions.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Course Updates</h3>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    This course was updated on {new Date(courseVersions[0].updatedAt).toLocaleDateString()}
                  </h4>
                  <p className="mt-1 text-sm text-blue-700">
                    {courseVersions[0].changelog || 'Course content has been updated.'}
                  </p>
                  <details className="mt-2">
                    <summary className="text-xs text-blue-800 cursor-pointer hover:underline">
                      Version history
                    </summary>
                    <div className="mt-2 space-y-2">
                      {courseVersions.map((version, index) => (
                        <div key={`version-${index}`} className="text-xs">
                          <span className="font-medium">v{version.version}</span> - 
                          {new Date(version.updatedAt).toLocaleDateString()} - 
                          {version.changelog}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Content */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            {selectedLesson && (canAccessLesson(selectedLesson) ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
                <div className="aspect-video relative">
                  <ReactPlayer
                    ref={playerRef}
                    url={selectedLesson.videoUrl}
                    width="100%"
                    height="100%"
                    controls
                    onProgress={handleProgress}
                    onPlay={() => setIsWatching(true)}
                    onPause={() => setIsWatching(false)}
                    onEnded={() => {
                      setIsWatching(false);
                      if (isEnrolled) {
                        completeLessonMutation.mutate(selectedLesson.id);
                      }
                    }}
                    progressInterval={1000}
                    config={{
                      file: {
                        attributes: {
                          controlsList: 'nodownload'
                        }
                      }
                    }}
                  />
                  <div className="absolute top-4 right-4 z-10 flex space-x-2">
                    <button
                      onClick={handleBookmark}
                      className="p-2 bg-white rounded-full shadow hover:bg-gray-100"
                    >
                      {bookmarks[selectedLesson?.id] ? (
                        <BookmarkSolidIcon className="h-5 w-5 text-blue-600" />
                      ) : (
                        <BookmarkOutlineIcon className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedLesson.title}
                    </h2>
                    <div className="flex items-center space-x-4">
                      {bookmarks[selectedLesson?.id] && (
                        <div className="flex items-center text-sm text-gray-600">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          Bookmarked at {new Date(bookmarks[selectedLesson.id] * 1000).toISOString().substr(11, 8)}
                        </div>
                      )}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => navigateLesson('prev')}
                          disabled={course.lessons.indexOf(selectedLesson) === 0}
                          className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => navigateLesson('next')}
                          disabled={course.lessons.indexOf(selectedLesson) === course.lessons.length - 1}
                          className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          <ChevronRightIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-6">{selectedLesson.description}</p>
                  
                  {/* Chapter Navigation */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Chapters</h3>
                    <div className="space-y-2">
                      {paginateArray(course.lessons, lessonPage, itemsPerPage).map((lesson, index) => (
                        <button
                          key={`lesson-${lesson.id}-${index}`}
                          onClick={() => handleLessonSelect(lesson)}
                          className={`w-full text-left px-4 py-2 rounded-lg flex items-center justify-between ${
                            selectedLesson.id === lesson.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="mr-3 text-sm font-medium">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="font-medium">{lesson.title}</span>
                          </div>
                          {progress[lesson.id] && (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Discussion Section */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Discussion</h3>
                    
                    <div className="flex space-x-3 mb-6">
                      <div className="flex-shrink-0">
                        {user?.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt={user.displayName || 'User'} 
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <UserCircleIcon className="h-8 w-8 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add to the discussion..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                        />
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChatBubbleLeftIcon className="h-5 w-5 mr-2" />
                            Add Comment
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {paginateArray(comments, commentPage, itemsPerPage).map((comment, index) => (
                        <div key={generateUniqueKey('comment', comment.id, index)} className="flex space-x-3">
                          <div className="flex-shrink-0">
                            {comment.userAvatar ? (
                              <img 
                                src={comment.userAvatar} 
                                alt={comment.userName || 'User'} 
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <UserCircleIcon className="h-8 w-8 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">
                                {comment.userName || (comment.userId ? comment.userId.slice(0, 5) + '...' : 'Student')}
                                {comment.userRole === 'instructor' && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                                    Instructor
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center">
                                <span className="text-sm text-gray-500 mr-3">
                                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'Just now'}
                                </span>
                                {(comment.userId === user?.uid || (user?.role === 'instructor' && course?.instructorId === user?.uid)) && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-gray-400 hover:text-red-500"
                                    title="Delete comment"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600">{comment.comment}</p>
                          </div>
                        </div>
                      ))}
                      {comments.length === 0 && (
                        <div className="text-center py-8">
                          <ChatBubbleLeftRightIcon className="mx-auto h-10 w-10 text-gray-300" />
                          <p className="mt-2 text-gray-500">No comments yet. Be the first to comment!</p>
                        </div>
                      )}
                      {comments.length > itemsPerPage && (
                        <Pagination 
                          currentPage={commentPage} 
                          totalPages={Math.ceil(comments.length / itemsPerPage)} 
                          onPageChange={setCommentPage} 
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-8 mb-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-indigo-600/5"></div>
                <div className="relative text-center">
                  <div className="bg-gray-100 p-4 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-6">
                    <LockClosedIcon className="h-12 w-12 text-blue-600" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Premium Content
                  </h3>
                  
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    This lesson is part of the full course. Enroll now to unlock all lessons, assignments, and course materials.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-6 mb-4">
                      <div className="flex items-center text-gray-800">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                        <span>{totalLessons} Lessons</span>
                      </div>
                      <div className="flex items-center text-gray-800">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                        <span>Certificate</span>
                      </div>
                      <div className="flex items-center text-gray-800">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                        <span>Lifetime Access</span>
                      </div>
                    </div>
                    
                  <button
                    onClick={handleEnrollClick}
                      className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                      {course.price > 0 ? 
                        `Enroll Now - $${course.discountPrice || course.price}` : 
                        'Enroll For Free'}
                  </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Course Content */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <BookOpenIcon className="h-6 w-6 mr-2" />
                  Course Content
                {isEnrolled && (
                    <span className="ml-auto text-sm text-white/90 bg-white/20 px-3 py-1 rounded-full">
                      {completedLessons} of {totalLessons} lessons complete
                    </span>
                )}
                </h2>
              </div>
              
              {isEnrolled && (
                <div className="px-4 py-3 bg-blue-50">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span className="font-medium">{completionPercentage}% Complete</span>
                    <span>{completedLessons}/{totalLessons} Lessons</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="divide-y">
                {paginateArray(course.lessons, lessonPage, itemsPerPage).map((lesson, index) => (
                  <motion.div
                    key={`lesson-${lesson.id}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${
                      selectedLesson?.id === lesson.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    onClick={() => isEnrolled && setSelectedLesson(lesson)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 text-sm font-medium mr-3">
                          {index + 1}
                        </span>
                        
                        {isEnrolled ? (
                          progress[lesson.id] ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
                          ) : (
                            <PlayIcon className="h-5 w-5 text-blue-500 mr-3" />
                          )
                        ) : (
                          <LockClosedIcon className="h-5 w-5 text-gray-400 mr-3" />
                        )}
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {lesson.title}
                          </h3>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            <span>{lesson.duration || "10 min"}</span>
                            
                            {lesson.studyMaterials && lesson.studyMaterials.length > 0 && (
                              <span className="flex items-center ml-3">
                                <DocumentIcon className="h-3 w-3 mr-1" />
                                {lesson.studyMaterials.length} {lesson.studyMaterials.length === 1 ? 'material' : 'materials'}
                              </span>
                            )}
                        </div>
                      </div>
                      </div>
                      
                      {lesson.previewEnabled && !isEnrolled && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          Preview
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Course Materials */}
            {isEnrolled && selectedLesson && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden mt-6">
                <div className="bg-gradient-to-r from-green-600 to-teal-600 p-4">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <DocumentIcon className="h-6 w-6 mr-2" />
                    Course Materials
                  </h2>
                </div>
                
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    {selectedLesson.title} - Materials
                  </h3>
                  
                  {selectedLesson.studyMaterials && selectedLesson.studyMaterials.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {paginateArray(selectedLesson.studyMaterials, materialPage, itemsPerPage).map((material, mIndex) => (
                          <div key={`material-${selectedLesson.id}-${mIndex}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center text-gray-700">
                              <DocumentIcon className="h-5 w-5 mr-3 text-blue-500" />
                              <div>
                                <p className="font-medium">{material.name}</p>
                                {material.size && (
                                  <p className="text-xs text-gray-500">
                                    {typeof material.size === 'number' 
                                      ? Math.round(material.size / 1024) + ' KB' 
                                      : material.size}
                                  </p>
                                )}
                              </div>
                            </div>
                            <a 
                              href={material.url} 
                              download={material.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                      {selectedLesson.studyMaterials.length > itemsPerPage && (
                        <Pagination 
                          currentPage={materialPage} 
                          totalPages={Math.ceil(selectedLesson.studyMaterials.length / itemsPerPage)} 
                          onPageChange={setMaterialPage} 
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <DocumentIcon className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-2 text-gray-500">No materials available for this lesson</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Review Section */}
            {isEnrolled && (
              <div className="bg-white rounded-xl shadow-md overflow-hidden mt-8">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <StarIcon className="h-6 w-6 mr-2" />
                    Course Review
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Share Your Experience</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Your feedback helps other students make informed decisions and helps the instructor improve the course.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 mb-6">
                    <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-3">Rating</label>
                    <div className="flex items-center" id="rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                          className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      {star <= rating ? (
                            <StarIconSolid className="h-8 w-8 text-yellow-400" />
                      ) : (
                            <StarIcon className="h-8 w-8 text-gray-300" />
                      )}
                    </button>
                  ))}
                      <span className="ml-3 text-gray-700 font-medium">
                        {rating === 1 && "Poor"}
                        {rating === 2 && "Fair"}
                        {rating === 3 && "Average"}
                        {rating === 4 && "Good"}
                        {rating === 5 && "Excellent"}
                      </span>
                </div>
                  </div>
                  
                  <div className="mb-6">
                    <label htmlFor="review-text" className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
                <textarea
                      id="review-text"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                      placeholder="Share details about your experience taking this course..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows={5}
                />
                  </div>
                  
                  <div className="flex justify-end">
                <button
                  onClick={() => submitReviewMutation.mutate()}
                  disabled={!rating || !review || submitReviewMutation.isLoading}
                      className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                      {submitReviewMutation.isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>Submit Review</>
                      )}
                </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Course Progress */}
          {isEnrolled && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Progress</h2>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{completionPercentage}% Complete</span>
                    <span>
                      {completedLessons}/{totalLessons} Lessons
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {paginateArray(course.lessons, progressPage, 5).map((lesson, index) => (
                    <div
                      key={`progress-${lesson.id}-${index}`}
                      className="flex items-center text-sm"
                      onClick={() => handleLessonSelect(lesson)}
                      style={{ cursor: 'pointer' }}
                    >
                      {progress[lesson.id] ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <div className="h-5 w-5 border-2 border-gray-300 rounded-full mr-2" />
                      )}
                      <span className={progress[lesson.id] ? 'text-gray-600' : 'text-gray-500'}>
                        {lesson.title}
                      </span>
                    </div>
                  ))}
                  {course.lessons.length > 5 && (
                    <Pagination 
                      currentPage={progressPage} 
                      totalPages={Math.ceil(course.lessons.length / 5)} 
                      onPageChange={setProgressPage} 
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentForm && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-xl overflow-hidden max-w-md w-full"
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold">
                    Complete Your Enrollment
                </h3>
                <button
                  onClick={() => setShowPaymentForm(false)}
                    className="text-white/80 hover:text-white focus:outline-none transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" />
                </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-start space-x-4 mb-6 pb-6 border-b border-gray-100">
                  <img 
                    src={course.thumbnail}
                    alt={course.title}
                    className="h-20 w-20 object-cover rounded-md flex-shrink-0"
                  />
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-1">
                      {course.title}
                    </h4>
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <UserIcon className="h-4 w-4 mr-1" />
                      {course.instructorName}
                    </div>
                    <div className="flex items-center">
                      {course.hasDiscount && (
                        <span className="text-gray-400 line-through text-sm mr-2">${course.price}</span>
                      )}
                      <span className="text-xl font-bold text-blue-600">
                        ${course.discountPrice || course.price}
                      </span>
                    </div>
                  </div>
              </div>

                <PaymentForm
                  course={{
                    ...course,
                    price: course.discountPrice || course.price
                  }}
                  onSuccess={handlePaymentSuccess}
                />
                
                <div className="mt-4 text-xs text-gray-500 text-center">
                  <p>By completing this purchase you agree to our <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
            </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Review Section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Course Reviews</h3>
          
          {reviews && reviews.length > 0 ? (
            <>
              <div className="space-y-4">
                {paginateArray(reviews, reviewPage, itemsPerPage).map((review, index) => (
                  <div key={generateUniqueKey('review', review.id, index)} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {review.userAvatar ? (
                          <img 
                            src={review.userAvatar} 
                            alt={review.userName || 'User'} 
                            className="h-8 w-8 rounded-full mr-3"
                          />
                        ) : (
                          <UserCircleIcon className="h-8 w-8 text-gray-400 mr-3" />
                        )}
                        <span className="font-medium text-gray-900">
                          {review.userName || (review.userId ? review.userId.slice(0, 5) + '...' : 'Student')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className="flex mr-2">
                          {[...Array(5)].map((_, i) => (
                            <StarIconSolid 
                              key={`star-${review.id}-${i}`} 
                              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`} 
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">
                          {review.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600">{review.comment}</p>
                  </div>
                ))}
              </div>
              {reviews.length > itemsPerPage && (
                <Pagination 
                  currentPage={reviewPage} 
                  totalPages={Math.ceil(reviews.length / itemsPerPage)} 
                  onPageChange={setReviewPage} 
                />
              )}
            </>
          ) : (
            <p className="text-gray-500 text-center py-6">No reviews yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetail; 