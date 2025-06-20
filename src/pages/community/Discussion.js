import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpSolidIcon } from '@heroicons/react/24/solid';

const Discussion = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [messagePage, setMessagePage] = useState(1);
  const messagesPerPage = 5;

  // Fetch course details
  const { data: course } = useQuery({
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

  // Real-time messages subscription
  useEffect(() => {
    const messagesRef = collection(db, 'discussions');
    const q = query(
      messagesRef,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        // Use a Map to ensure we don't have duplicate IDs
        const messagesMap = new Map();
      snapshot.forEach((doc) => {
          const data = doc.data();
          // Create a truly unique key by combining id with timestamp
          const uniqueId = `${doc.id}-${data.createdAt ? data.createdAt.seconds : Date.now()}`;
          messagesMap.set(uniqueId, { 
            id: doc.id, 
            uniqueId,
            ...data,
            // Ensure createdAt is properly formatted
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : new Timestamp(0, 0)
          });
        });
        // Convert Map back to array
        const newMessages = Array.from(messagesMap.values());
      setMessages(newMessages);
      } catch (error) {
        console.error("Error processing messages:", error);
      }
    });

    return () => unsubscribe();
  }, [courseId]);

  // Pagination function
  const paginateMessages = (items, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return items.slice(startIndex, endIndex);
  };

  // Add message mutation
  const addMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      const docRef = await addDoc(collection(db, 'discussions'), {
        ...messageData,
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        responseCount: 0,
      });
      return docRef;
    },
    onSuccess: () => {
      setNewMessage('');
      setMessagePage(1); // Go to first page when new message is sent
      toast.success('Message sent successfully!');
    },
    onError: (error) => {
      console.error('Message send error:', error);
      toast.error('Failed to send message');
    },
  });

  // Like message mutation
  const likeMessageMutation = useMutation({
    mutationFn: async ({ messageId, liked }) => {
      try {
      const messageRef = doc(db, 'discussions', messageId);
        const message = messages.find(m => m.id === messageId);
        if (!message) return;
        
        const likedBy = message.likedBy || [];
        const updatedLikedBy = liked 
          ? [...likedBy, user.uid]
          : likedBy.filter(id => id !== user.uid);
          
      await updateDoc(messageRef, {
        likes: increment(liked ? 1 : -1),
          likedBy: updatedLikedBy,
        });
      } catch (error) {
        console.error("Like update error:", error);
        throw error;
      }
    },
    onError: (error) => {
      toast.error('Failed to update like status');
      console.error('Like error:', error);
    }
  });

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Fix Anonymous User issue
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Student');
    
    addMessageMutation.mutate({
      courseId,
      userId: user.uid,
      userName: displayName,
      userRole: user.role,
      message: newMessage.trim(),
    });
  };

  const handleLike = (messageId) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const liked = !message.likedBy?.includes(user.uid);
    likeMessageMutation.mutate({ messageId, liked });
  };

  // Get paginated messages
  const paginatedMessages = paginateMessages(messages, messagePage, messagesPerPage);
  const totalPages = Math.ceil(messages.length / messagesPerPage);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Course Discussion</h1>
          <p className="mt-2 text-gray-600">
            {course?.title} - Join the conversation and ask questions
          </p>
        </div>

        {/* Message List */}
        <div className="space-y-4 mb-8">
          <AnimatePresence>
            {paginatedMessages.map((message, index) => (
              <motion.div
                key={`message-${message.uniqueId}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-sm p-4"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <UserCircleIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {message.userName || (message.userId ? message.userId.slice(0, 5) + '...' : 'Student')}
                          {message.userRole === 'instructor' && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                              Instructor
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {message.createdAt?.seconds
                            ? new Date(message.createdAt.seconds * 1000).toLocaleString()
                            : 'Just now'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLike(message.id)}
                        className="flex items-center space-x-1 text-sm text-gray-500 hover:text-blue-600"
                      >
                        {message.likedBy?.includes(user.uid) ? (
                          <HandThumbUpSolidIcon className="h-5 w-5 text-blue-600" />
                        ) : (
                          <HandThumbUpIcon className="h-5 w-5" />
                        )}
                        <span>{message.likes || 0}</span>
                      </button>
                    </div>
                    <p className="mt-2 text-gray-700">{message.message}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {/* Pagination */}
          {messages.length > 0 && (
            <Pagination 
              currentPage={messagePage} 
              totalPages={totalPages} 
              onPageChange={setMessagePage} 
            />
          )}
          
          {messages.length === 0 && (
            <div className="text-center py-12">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Be the first to start a discussion!
              </p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <form onSubmit={handleSubmit} className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <UserCircleIcon className="h-10 w-10 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write your message..."
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                rows={3}
              />
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={!newMessage.trim() || addMessageMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                  Send Message
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Discussion; 