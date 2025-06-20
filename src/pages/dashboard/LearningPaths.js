import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  MapIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  DocumentIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  ClockIcon,
  BookmarkIcon,
  LightBulbIcon,
  ChevronRightIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

const LearningPaths = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPathForm, setShowPathForm] = useState(false);
  const [pathName, setPathName] = useState('');
  const [pathDescription, setPathDescription] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [editingPath, setEditingPath] = useState(null);
  const [suggestedPathsVisible, setSuggestedPathsVisible] = useState(true);

  // Fetch user's enrollments and completed courses
  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ['enrollments', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const enrollmentsRef = collection(db, 'enrollments');
      const q = query(enrollmentsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const enrollmentData = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const courseSnapshot = await getDocs(doc(db, 'courses', data.courseId));
        const courseData = courseSnapshot.exists() ? courseSnapshot.data() : null;
        
        const completedLessons = Object.values(data.progress || {}).filter(Boolean).length;
        const totalLessons = courseData?.lessons?.length || 0;
        const isCompleted = totalLessons > 0 && completedLessons === totalLessons;
        
        return {
          id: doc.id,
          ...data,
          course: courseData ? { id: data.courseId, ...courseData } : null,
          completedLessons,
          totalLessons,
          isCompleted,
          completionPercentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
        };
      }));
      
      return enrollmentData;
    },
    enabled: !!user?.uid,
  });

  // Fetch all available courses for selection
  const { data: availableCourses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ['allCourses'],
    queryFn: async () => {
      const coursesRef = collection(db, 'courses');
      const snapshot = await getDocs(coursesRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!user?.uid,
  });

  // Fetch user's learning paths
  const { data: userPaths = [], isLoading: isLoadingPaths } = useQuery({
    queryKey: ['learningPaths', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const pathsRef = collection(db, 'learningPaths');
      const q = query(pathsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!user?.uid,
  });

  // Create learning path mutation
  const createPathMutation = useMutation({
    mutationFn: async () => {
      if (!pathName || selectedCourses.length === 0) {
        throw new Error('Please provide a name and select at least one course');
      }

      const pathData = {
        name: pathName,
        description: pathDescription || '',
        courses: selectedCourses.map(course => ({
          id: course.id,
          title: course.title,
          thumbnail: course.thumbnail,
          category: course.category,
          level: course.level
        })),
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isCustom: true
      };

      const pathRef = editingPath 
        ? await updateDoc(doc(db, 'learningPaths', editingPath.id), pathData)
        : await addDoc(collection(db, 'learningPaths'), pathData);
      
      return pathRef;
    },
    onSuccess: () => {
      toast.success(editingPath ? 'Learning path updated!' : 'Learning path created!');
      setShowPathForm(false);
      setPathName('');
      setPathDescription('');
      setSelectedCourses([]);
      setEditingPath(null);
      queryClient.invalidateQueries(['learningPaths', user?.uid]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create learning path');
    },
  });

  // Delete learning path mutation
  const deletePathMutation = useMutation({
    mutationFn: async (pathId) => {
      await deleteDoc(doc(db, 'learningPaths', pathId));
    },
    onSuccess: () => {
      toast.success('Learning path deleted');
      queryClient.invalidateQueries(['learningPaths', user?.uid]);
    },
    onError: () => {
      toast.error('Failed to delete learning path');
    },
  });

  // Generate suggested learning paths based on user's course history
  const generateSuggestedPaths = () => {
    if (!enrollments || !availableCourses) return [];

    // Get categories user has shown interest in
    const completedCourses = enrollments.filter(e => e.isCompleted);
    const interestedCategories = new Set(completedCourses.map(e => e.course?.category).filter(Boolean));
    
    // Get current skill level based on completed courses
    const courseLevels = {
      'Beginner': 1,
      'Intermediate': 2,
      'Advanced': 3
    };

    const userLevels = {};
    completedCourses.forEach(course => {
      const category = course.course?.category;
      const level = course.course?.level;
      if (category && level) {
        userLevels[category] = Math.max(userLevels[category] || 0, courseLevels[level] || 0);
      }
    });

    // Create suggested paths
    const suggestedPaths = [];
    
    // For each interested category, create next level path
    interestedCategories.forEach(category => {
      const currentLevel = userLevels[category] || 0;
      
      if (currentLevel < 3) { // Not yet at Advanced level
        const nextLevel = Object.entries(courseLevels).find(([_, value]) => value === currentLevel + 1)?.[0];
        
        if (nextLevel) {
          // Find courses in this category at the next level that user hasn't completed
          const nextLevelCourses = availableCourses
            .filter(course => 
              course.category === category && 
              course.level === nextLevel &&
              !completedCourses.some(cc => cc.courseId === course.id)
            )
            .slice(0, 3); // Limit to 3 courses
            
          if (nextLevelCourses.length > 0) {
            suggestedPaths.push({
              name: `${nextLevel} ${category} Path`,
              description: `Continue your journey in ${category} with these ${nextLevel.toLowerCase()} level courses.`,
              courses: nextLevelCourses,
              isAutoGenerated: true
            });
          }
        }
      }
    });
    
    // Create cross-category suggestions for complementary skills
    const complementaryCategories = {
      'Programming': ['Design', 'Business'],
      'Design': ['Programming', 'Marketing'],
      'Business': ['Marketing', 'Programming'],
      'Marketing': ['Business', 'Design'],
      'Music': ['Design'],
      'Photography': ['Design', 'Marketing']
    };
    
    interestedCategories.forEach(category => {
      const complements = complementaryCategories[category] || [];
      
      complements.forEach(complementCategory => {
        if (!interestedCategories.has(complementCategory)) {
          // Find beginner courses in this complementary category
          const complementaryCourses = availableCourses
            .filter(course => 
              course.category === complementCategory && 
              course.level === 'Beginner' &&
              !completedCourses.some(cc => cc.courseId === course.id)
            )
            .slice(0, 3);
            
          if (complementaryCourses.length > 0) {
            suggestedPaths.push({
              name: `${category} + ${complementCategory} Path`,
              description: `Enhance your ${category} skills with complementary knowledge in ${complementCategory}.`,
              courses: complementaryCourses,
              isAutoGenerated: true
            });
          }
        }
      });
    });
    
    return suggestedPaths;
  };

  const suggestedPaths = generateSuggestedPaths();

  const handleEditPath = (path) => {
    setEditingPath(path);
    setPathName(path.name);
    setPathDescription(path.description || '');
    setSelectedCourses(path.courses.map(course => {
      // Find full course data
      const fullCourse = availableCourses.find(c => c.id === course.id);
      return fullCourse || course;
    }));
    setShowPathForm(true);
  };

  const toggleCourseSelection = (course) => {
    setSelectedCourses(prev => {
      const isSelected = prev.some(c => c.id === course.id);
      if (isSelected) {
        return prev.filter(c => c.id !== course.id);
      } else {
        return [...prev, course];
      }
    });
  };

  const cancelPathForm = () => {
    setShowPathForm(false);
    setPathName('');
    setPathDescription('');
    setSelectedCourses([]);
    setEditingPath(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Learning Paths</h2>
          <p className="text-gray-600">Create custom learning paths or follow our suggested paths to reach your goals</p>
        </motion.div>
        
        {/* Create/Edit Path Form */}
        {showPathForm ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 mb-8"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingPath ? 'Edit Learning Path' : 'Create New Learning Path'}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="pathName" className="block text-sm font-medium text-gray-700 mb-1">
                  Path Name
                </label>
                <input
                  type="text"
                  id="pathName"
                  value={pathName}
                  onChange={(e) => setPathName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Web Development Mastery"
                />
              </div>
              
              <div>
                <label htmlFor="pathDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="pathDescription"
                  value={pathDescription}
                  onChange={(e) => setPathDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe the goal or focus of this learning path"
                />
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Select Courses for Your Path</h4>
              <p className="text-xs text-gray-500 mb-4">Choose courses in the order you want to take them</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoadingCourses ? (
                  <div className="col-span-full flex justify-center py-8">
                    <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
                  </div>
                ) : (
                  availableCourses.map((course) => (
                    <div 
                      key={course.id}
                      onClick={() => toggleCourseSelection(course)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors flex items-start ${
                        selectedCourses.some(c => c.id === course.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                    >
                      <div className="flex-shrink-0 w-12 h-12 mr-3 overflow-hidden rounded-md">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-gray-900 text-sm">{course.title}</h5>
                          {selectedCourses.some(c => c.id === course.id) && (
                            <CheckIcon className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <span className="mr-2">{course.category}</span>
                          <span>{course.level}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex space-x-4 justify-end">
              <button
                onClick={cancelPathForm}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createPathMutation.mutate()}
                disabled={!pathName || selectedCourses.length === 0 || createPathMutation.isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {createPathMutation.isLoading && (
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingPath ? 'Update Path' : 'Create Path'}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => setShowPathForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Learning Path
            </button>
            
            <button
              onClick={() => setSuggestedPathsVisible(!suggestedPathsVisible)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
            >
              <LightBulbIcon className="h-5 w-5 mr-2 text-yellow-500" />
              {suggestedPathsVisible ? 'Hide Suggestions' : 'Show Suggestions'}
            </button>
          </div>
        )}
        
        {/* Custom Learning Paths */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">My Learning Paths</h3>
          
          {isLoadingPaths ? (
            <div className="flex justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
            </div>
          ) : userPaths.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {userPaths.map((path) => (
                <motion.div
                  key={path.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{path.name}</h4>
                        <p className="text-gray-600 text-sm mt-1">{path.description}</p>
                      </div>
                      
                      <div className="flex">
                        <button
                          onClick={() => handleEditPath(path)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Edit path"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deletePathMutation.mutate(path.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                          title="Delete path"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                      {path.courses.map((course, index) => (
                        <Link
                          key={`${path.id}-course-${course.id}-${index}`}
                          to={`/courses/${course.id}`}
                          className="flex items-center p-3 rounded-lg border border-gray-100 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex-shrink-0 w-10 h-10 mr-3 overflow-hidden rounded-md">
                            <img
                              src={course.thumbnail}
                              alt={course.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-grow">
                            <h5 className="font-medium text-gray-900 text-sm">
                              {index + 1}. {course.title}
                            </h5>
                            <div className="flex items-center text-xs text-gray-500 mt-0.5">
                              <span className="mr-2">{course.category}</span>
                              <span>{course.level}</span>
                            </div>
                          </div>
                          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
              <MapIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No learning paths yet</h3>
              <p className="text-gray-600 mb-4">Create your first custom learning path to organize your learning journey.</p>
              <button
                onClick={() => setShowPathForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Learning Path
              </button>
            </div>
          )}
        </div>
        
        {/* Suggested Learning Paths */}
        {suggestedPathsVisible && (
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <LightBulbIcon className="h-5 w-5 mr-2 text-yellow-500" />
              Suggested Paths for You
            </h3>
            
            {suggestedPaths.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {suggestedPaths.map((path, pathIndex) => (
                  <motion.div
                    key={`suggested-${pathIndex}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: pathIndex * 0.1 }}
                    className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
                  >
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-blue-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{path.name}</h4>
                          <p className="text-gray-600 text-sm mt-1">{path.description}</p>
                        </div>
                        
                        <button
                          onClick={() => {
                            // Save suggested path as custom path
                            setPathName(path.name);
                            setPathDescription(path.description);
                            setSelectedCourses(path.courses);
                            setShowPathForm(true);
                          }}
                          className="ml-4 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center"
                        >
                          <BookmarkIcon className="h-4 w-4 mr-1.5" />
                          Save Path
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <div className="space-y-3">
                        {path.courses.map((course, index) => (
                          <Link
                            key={`suggested-${pathIndex}-course-${course.id}-${index}`}
                            to={`/courses/${course.id}`}
                            className="flex items-center p-3 rounded-lg border border-gray-100 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex-shrink-0 w-10 h-10 mr-3 overflow-hidden rounded-md">
                              <img
                                src={course.thumbnail}
                                alt={course.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-grow">
                              <h5 className="font-medium text-gray-900 text-sm">
                                {index + 1}. {course.title}
                              </h5>
                              <div className="flex items-center text-xs text-gray-500 mt-0.5">
                                <span className="mr-2">{course.category}</span>
                                <span>{course.level}</span>
                              </div>
                            </div>
                            <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-100">
                <AcademicCapIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No suggestions available yet</h3>
                <p className="text-gray-600 mb-4">Complete a few courses to get personalized learning path suggestions.</p>
                <Link
                  to="/courses"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                >
                  Browse Courses
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningPaths; 