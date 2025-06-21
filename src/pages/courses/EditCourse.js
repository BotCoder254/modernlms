import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  DocumentIcon,
  InformationCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

const EditCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [changelog, setChangelog] = useState('');
  const [updateType, setUpdateType] = useState('minor'); // minor, major
  
  // Fetch course data
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const docRef = doc(db, 'courses', courseId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Course not found');
      }
      
      const courseData = { id: docSnap.id, ...docSnap.data() };
      
      // Check if current user is the instructor
      if (courseData.instructorId !== user?.uid) {
        navigate('/dashboard/courses');
        toast.error('You do not have permission to edit this course');
        return null;
      }
      
      setCourseData(courseData);
      setLessons(courseData.lessons || []);
      
      return courseData;
    },
    enabled: !!courseId && !!user?.uid
  });

  // Fetch course versions
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
    enabled: !!courseId && !!user?.uid
  });

  const handleLessonChange = (index, field, value) => {
    const newLessons = [...lessons];
    newLessons[index][field] = value;
    setLessons(newLessons);
  };

  const addLesson = () => {
    const newLesson = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      videoUrl: '',
      previewEnabled: false,
      studyMaterials: [],
      duration: '',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setLessons([...lessons, newLesson]);
  };

  const removeLesson = (index) => {
    setLessons(lessons.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!changelog.trim()) {
      toast.error('Please provide a changelog description');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get the latest version number
      const currentVersion = courseVersions && courseVersions.length > 0 
        ? courseVersions[0].version 
        : course?.version || 0;
      
      const newVersion = currentVersion + 1;
      
      // First, create the new course version entry
      await addDoc(collection(db, 'courseVersions'), {
        courseId: courseId,
        version: newVersion,
        title: courseData.title,
        description: courseData.description,
        lessons: lessons.map(lesson => ({
          ...lesson,
          id: lesson.id
        })),
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
        updaterName: user.displayName,
        changelog: changelog,
        updateType: updateType
      });
      
      // Then update the main course document
      // We're preserving lesson IDs to maintain student progress
      await updateDoc(doc(db, 'courses', courseId), {
        lessons: lessons,
        updatedAt: serverTimestamp(),
        version: newVersion,
        versionHistory: [
          {
            version: newVersion,
            updatedAt: new Date().toISOString(),
            updatedBy: user.uid,
            updaterName: user.displayName,
            changelog: changelog
          },
          ...(course.versionHistory || [])
        ]
      });

      // If there are enrolled students, we need to update their enrollment records 
      // with the new lesson metadata while preserving their progress
      const enrollmentsRef = collection(db, 'enrollments');
      const q = query(enrollmentsRef, where('courseId', '==', courseId));
      const querySnapshot = await getDocs(q);
      
      const enrollmentUpdates = querySnapshot.docs.map(enrollDoc => {
        const enrollmentData = enrollDoc.data();
        const progress = enrollmentData.progress || {};
        
        // Update the courseData but preserve user progress
        return updateDoc(doc(db, 'enrollments', enrollDoc.id), {
          'courseData.lessons': lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            duration: lesson.duration
          }))
        });
      });
      
      // Wait for all enrollment updates to complete
      if (enrollmentUpdates.length > 0) {
        await Promise.all(enrollmentUpdates);
      }
      
      toast.success('Course updated successfully!');
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  if (!course) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link to={`/courses/${courseId}`} className="mr-4">
              <ArrowLeftIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Edit Course: {courseData?.title}</h1>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          {/* Course Information Notice */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Dynamic Curriculum Updates</h3>
                <p className="mt-2 text-sm text-blue-700">
                  Updates to your course content will be versioned. Students will see the latest content while 
                  preserving their progress. Each update should include a changelog description.
                </p>
              </div>
            </div>
          </div>

          {/* Course Content Editing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Content
            </label>
            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Lesson {index + 1}</h3>
                    <button 
                      type="button" 
                      onClick={() => removeLesson(index)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lesson Title
                      </label>
                      <input
                        type="text"
                        value={lesson.title}
                        onChange={(e) => handleLessonChange(index, 'title', e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lesson Description
                      </label>
                      <textarea
                        value={lesson.description}
                        onChange={(e) => handleLessonChange(index, 'description', e.target.value)}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addLesson}
                className="flex items-center justify-center w-full py-3 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-800"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Lesson
              </button>
            </div>
          </div>

          {/* Update Information */}
          <div>
            <label htmlFor="changelog" className="block text-sm font-medium text-gray-700 mb-2">
              Changelog Description (What's new or changed?)
            </label>
            <textarea
              id="changelog"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={3}
              className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder="Describe what you've changed in this update..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="updateType"
                  value="minor"
                  checked={updateType === 'minor'}
                  onChange={() => setUpdateType('minor')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Minor Update (Content Adjustments)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="updateType"
                  value="major"
                  checked={updateType === 'major'}
                  onChange={() => setUpdateType('major')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Major Update (Significant Changes)</span>
              </label>
            </div>
          </div>

          {/* Version History */}
          {courseVersions && courseVersions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Previous Versions
              </label>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changelog</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {courseVersions.map((version) => (
                      <tr key={version.id}>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">v{version.version}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(version.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">{version.changelog || "No description"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Link
              to={`/courses/${courseId}`}
              className="mr-4 px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <PencilIcon className="h-5 w-5 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCourse; 