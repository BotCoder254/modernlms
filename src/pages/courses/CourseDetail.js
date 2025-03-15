import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import ReactPlayer from 'react-player';
import { toast } from 'react-hot-toast';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  increment,
  serverTimestamp,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  PlayIcon,
  LockClosedIcon,
  CheckCircleIcon,
  StarIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BookmarkIcon as BookmarkOutline,
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from '../../utils/stripe';
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
      if (user.role === 'instructor' && course.instructorId === user.uid) {
        throw new Error('Course creators cannot enroll in their own courses');
      }

      // Apply discount if available
      const finalPrice = course.discountPrice || course.price || 0;

      const enrollmentRef = await addDoc(collection(db, 'enrollments'), {
        userId: user.uid,
        courseId,
        enrolledAt: serverTimestamp(),
        progress: {},
        paidAmount: finalPrice,
        userRole: user.role
      });

      await updateDoc(doc(db, 'courses', courseId), {
        enrollmentCount: increment(1),
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
      const reviewRef = await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        courseId,
        rating,
        review,
        createdAt: serverTimestamp(),
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
        const completed = watchTime >= (selectedLesson.duration || 0) * 60;
        
        // Add progress data with timestamp
        await addDoc(collection(db, 'progress'), {
          userId: user.uid,
          courseId,
          lessonId: selectedLesson.id,
          watchTime,
          completed,
          lastUpdated: serverTimestamp()
        });

        // Track lesson progress
        await trackLessonProgress(user.uid, courseId, selectedLesson.id, watchTime, completed);
        
        setLastSavedTime(watchTime);

        // Update enrollment progress
        if (completed) {
          const enrollmentRef = collection(db, 'enrollments');
          const enrollmentSnapshot = await getDocs(
            query(enrollmentRef, where('userId', '==', user.uid), where('courseId', '==', courseId))
          );

          if (!enrollmentSnapshot.empty) {
            const enrollmentDoc = enrollmentSnapshot.docs[0];
            await updateDoc(doc(db, 'enrollments', enrollmentDoc.id), {
              [`progress.${selectedLesson.id}`]: true,
              lastUpdated: serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.error('Error saving progress:', error);
      }
    };

    const interval = setInterval(saveProgress, 5000);
    return () => clearInterval(interval);
  }, [watchTime, lastSavedTime, selectedLesson, isWatching, user?.uid, courseId]);

  // Update the handleAddComment function
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedLesson || !user?.uid) {
      toast.error('Please write a comment first');
      return;
    }
    
    try {
      const timestamp = serverTimestamp();
      const commentData = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        courseId,
        lessonId: selectedLesson.id,
        comment: newComment.trim(),
        timestamp: currentTime,
        createdAt: timestamp,
        userRole: user.role,
        userAvatar: user.photoURL || null
      };

      const commentRef = await addDoc(collection(db, 'comments'), commentData);

      // Update local state optimistically
      setComments(prev => [{
        id: commentRef.id,
        ...commentData,
        createdAt: new Date()
      }, ...prev]);

      // Track comment activity
      await trackUserEngagement(user.uid, courseId, selectedLesson.id, 'add_comment', {
        commentId: commentRef.id,
        timestamp: new Date()
      });

      // Update course engagement
      await updateDoc(doc(db, 'courses', courseId), {
        commentCount: increment(1),
        lastActivity: timestamp
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
      collection(db, 'comments'),
      (snapshot) => {
        try {
          const commentData = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() || new Date()
            }))
            .filter(comment => 
              comment.lessonId === selectedLesson.id && 
              comment.courseId === courseId
            )
            .sort((a, b) => b.createdAt - a.createdAt);

          setComments(commentData);
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

  // Add real-time progress tracking with error handling
  useEffect(() => {
    if (!selectedLesson?.id || !isWatching || !user?.uid || !courseId) return;

    let progressInterval;
    const startProgressTracking = () => {
      progressInterval = setInterval(async () => {
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
            }
          }
        } catch (error) {
          console.error('Error saving progress:', error);
          toast.error('Failed to save progress');
        }
      }, 5000);
    };

    startProgressTracking();
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [watchTime, lastSavedTime, selectedLesson, isWatching, user?.uid, courseId]);

  // Add real-time bookmarks subscription
  useEffect(() => {
    if (!user?.uid || !courseId) return;

    const unsubscribe = onSnapshot(
      collection(db, 'bookmarks'),
      (snapshot) => {
        const bookmarkData = {};
        snapshot.docs
          .filter(doc => {
            const data = doc.data();
            return data.userId === user.uid && data.courseId === courseId;
          })
          .forEach(doc => {
            const data = doc.data();
            bookmarkData[data.lessonId] = data.timestamp;
          });
        setBookmarks(bookmarkData);
      },
      (error) => console.error('Bookmarks subscription error:', error)
    );

    return () => unsubscribe();
  }, [user?.uid, courseId]);

  // Add real-time enrollment check
  useEffect(() => {
    if (!user?.uid || !courseId) return;

    const unsubscribe = onSnapshot(
      collection(db, 'enrollments'),
      (snapshot) => {
        const userEnrollments = snapshot.docs
          .filter(doc => {
            const data = doc.data();
            return data.userId === user.uid && data.courseId === courseId;
          });

        setIsEnrolled(!userEnrollments.empty);

        if (!userEnrollments.empty) {
          const enrollmentData = userEnrollments[0].data();
          setProgress(enrollmentData.progress || {});
        }
      },
      (error) => console.error('Enrollment subscription error:', error)
    );

    return () => unsubscribe();
  }, [user?.uid, courseId]);

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

  // Add preview functionality
  const canAccessLesson = (lesson) => {
    if (!lesson) return false;
    if (isEnrolled) return true;
    return lesson.previewEnabled;
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
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{course.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center">
              <AcademicCapIcon className="h-5 w-5 mr-1" />
              {course.level}
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 mr-1" />
              {totalLessons} lessons
            </div>
            <div className="flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-1" />
              {course.enrollmentCount} students
            </div>
            <div className="flex items-center">
              <StarIcon className="h-5 w-5 mr-1 text-yellow-400" />
              {(course.rating / course.reviewCount || 0).toFixed(1)} ({course.reviewCount} reviews)
            </div>
          </div>
          <p className="text-gray-600 mb-6">{course.description}</p>
          {!isEnrolled && (
            <button
              onClick={handleEnrollClick}
              disabled={enrollMutation.isLoading}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {enrollMutation.isLoading
                ? 'Processing...'
                : course.price > 0
                ? `Enroll for $${course.discountPrice || course.price}`
                : 'Enroll for Free'}
            </button>
          )}
        </div>

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
                        <BookmarkSolid className="h-5 w-5 text-blue-600" />
                      ) : (
                        <BookmarkOutline className="h-5 w-5 text-gray-600" />
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
                      {course.lessons.map((lesson, index) => (
                        <button
                          key={lesson.id}
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
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex space-x-3">
                          <div className="flex-1 bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">{comment.userName}</span>
                              <span className="text-sm text-gray-500">
                                {new Date(comment.timestamp * 1000).toISOString().substr(11, 8)}
                              </span>
                            </div>
                            <p className="text-gray-600">{comment.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="text-center">
                  <LockClosedIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    This lesson is locked
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Enroll in this course to access all lessons and materials.
                  </p>
                  <button
                    onClick={handleEnrollClick}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Enroll Now
                  </button>
                </div>
              </div>
            ))}

            {/* Course Content */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Course Content</h2>
                {isEnrolled && (
                  <p className="text-sm text-gray-600 mt-1">
                    {completedLessons} of {totalLessons} lessons completed ({completionPercentage}%)
                  </p>
                )}
              </div>
              <div className="divide-y">
                {course.lessons.map((lesson, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      selectedLesson?.id === lesson.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => isEnrolled && setSelectedLesson(lesson)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
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
                            {index + 1}. {lesson.title}
                          </h3>
                          <p className="text-sm text-gray-500">{lesson.duration}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Review Section */}
            {isEnrolled && (
              <div className="bg-white rounded-lg shadow-sm mt-8 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Leave a Review</h2>
                <div className="flex items-center mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 focus:outline-none"
                    >
                      {star <= rating ? (
                        <StarIconSolid className="h-6 w-6 text-yellow-400" />
                      ) : (
                        <StarIcon className="h-6 w-6 text-gray-300" />
                      )}
                    </button>
                  ))}
                </div>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Write your review..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                />
                <button
                  onClick={() => submitReviewMutation.mutate()}
                  disabled={!rating || !review || submitReviewMutation.isLoading}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitReviewMutation.isLoading ? 'Submitting...' : 'Submit Review'}
                </button>
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
                  {course.lessons.map((lesson, index) => (
                    <div
                      key={index}
                      className="flex items-center text-sm"
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
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentForm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Complete Purchase
                </h3>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500">
                  Course: {course.title}
                </p>
                <p className="text-lg font-medium text-gray-900">
                  Price: ${course.discountPrice || course.price}
                </p>
              </div>

              <Elements stripe={stripePromise}>
                <PaymentForm
                  course={course}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseDetail; 