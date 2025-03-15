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
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpSolidIcon } from '@heroicons/react/24/solid';

const Discussion = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState([]);

  // Fetch course details
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const docRef = doc(db, 'courses', courseId);
      const docSnap = await docRef.get();
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
      const newMessages = [];
      snapshot.forEach((doc) => {
        newMessages.push({ id: doc.id, ...doc.data() });
      });
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [courseId]);

  // Add message mutation
  const addMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      const docRef = await addDoc(collection(db, 'discussions'), {
        ...messageData,
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
      });
      return docRef;
    },
    onSuccess: () => {
      setNewMessage('');
      toast.success('Message sent successfully!');
    },
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  // Like message mutation
  const likeMessageMutation = useMutation({
    mutationFn: async ({ messageId, liked }) => {
      const messageRef = doc(db, 'discussions', messageId);
      await updateDoc(messageRef, {
        likes: increment(liked ? 1 : -1),
        likedBy: liked
          ? [...(messages.find(m => m.id === messageId)?.likedBy || []), user.uid]
          : messages.find(m => m.id === messageId)?.likedBy.filter(id => id !== user.uid) || [],
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    addMessageMutation.mutate({
      courseId,
      userId: user.uid,
      userName: user.displayName,
      userRole: user.role,
      message: newMessage.trim(),
    });
  };

  const handleLike = (messageId) => {
    const message = messages.find(m => m.id === messageId);
    const liked = !message.likedBy?.includes(user.uid);
    likeMessageMutation.mutate({ messageId, liked });
  };

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
            {messages.map((message) => (
              <motion.div
                key={message.id}
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
                          {message.userName}
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