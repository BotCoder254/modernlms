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
  EyeIcon,
  EyeSlashIcon,
  CalendarIcon,
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
  const [accessControl, setAccessControl] = useState({
    isAccessible: true,
    temporaryAccess: false,
    accessibleUntil: '',
    accessReason: ''
  });
  
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
      
      // Set access control from existing data
      setAccessControl({
        isAccessible: courseData.isAccessible !== false,
        temporaryAccess: courseData.accessibleUntil ? true : false,
        accessibleUntil: courseData.accessibleUntil ? new Date(courseData.accessibleUntil).toISOString().split('T')[0] : '',
        accessReason: courseData.accessReason || ''
      });
      
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

  const handleAccessControlChange = (field, value) => {
    setAccessControl({
      ...accessControl,
      [field]: value
    });
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
    
    if (!changelog.trim() && updateType !== 'access') {
      toast.error('Please provide a changelog description');
      return;
    }
    
    try {
      setLoading(true);
      
      // Access control settings
      const accessSettings = {
        isAccessible: accessControl.isAccessible,
        accessReason: accessControl.isAccessible ? '' : accessControl.accessReason,
        accessibleUntil: accessControl.temporaryAccess && accessControl.accessibleUntil 
          ? new Date(accessControl.accessibleUntil) 
          : null
      };
      
      // Get the latest version number
      const currentVersion = courseVersions && courseVersions.length > 0 
        ? courseVersions[0].version 
        : course?.version || 0;
      
      const newVersion = updateType === 'access' ? currentVersion : currentVersion + 1;
      
      // First, create the new course version entry if not just an access update
      if (updateType !== 'access') {
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
      }
      
      // Then update the main course document
      // We're preserving lesson IDs to maintain student progress
      await updateDoc(doc(db, 'courses', courseId), {
        ...accessSettings,
        lessons: updateType !== 'access' ? lessons : course.lessons,
        updatedAt: serverTimestamp(),
        version: newVersion,
        ...(updateType !== 'access' && {
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
        })
      });
      
      // If there are enrolled students and content changed, update their enrollment records 
      // with the new lesson metadata while preserving their progress
      if (updateType !== 'access') {
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
      }
      
      toast.success(updateType === 'access' ? 'Course access settings updated!' : 'Course updated successfully!');
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to move this course to the recycle bin?')) {
      return;
    }
    
    try {
      setLoading(true);
      await updateDoc(doc(db, 'courses', courseId), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
      });
      toast.success('Course moved to recycle bin');
      navigate('/dashboard/my-courses');
    } catch (error) {
      console.error('Error moving course to recycle bin:', error);
      toast.error('Failed to delete course');
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
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Move to Recycle Bin
          </button>
        </div>
        
        <div className="mb-6">
          <ul className="flex space-x-1 md:space-x-4 text-sm text-gray-600 overflow-x-auto pb-2">
            <li>
              <button 
                onClick={() => setUpdateType('access')}
                className={`px-3 py-2 rounded-md ${updateType === 'access' 
                  ? 'bg-blue-100 text-blue-800 font-medium' 
                  : 'hover:bg-gray-100'
                }`}
              >
                Access Settings
              </button>
            </li>
            <li>
              <button 
                onClick={() => setUpdateType('minor')}
                className={`px-3 py-2 rounded-md ${updateType === 'minor' 
                  ? 'bg-blue-100 text-blue-800 font-medium' 
                  : 'hover:bg-gray-100'
                }`}
              >
                Content Updates
              </button>
            </li>
            <li>
              <button 
                onClick={() => setUpdateType('major')}
                className={`px-3 py-2 rounded-md ${updateType === 'major' 
                  ? 'bg-blue-100 text-blue-800 font-medium' 
                  : 'hover:bg-gray-100'
                }`}
              >
                Major Revision
              </button>
            </li>
          </ul>
        </div>
        
        <form onSubmit={handleSubmit} className={`bg-white rounded-lg shadow-sm p-6 space-y-6 ${updateType === 'access' ? 'min-h-[400px]' : ''}`}>
          {/* Course Information Notice */}
          {updateType !== 'access' && (
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
          )}

          {/* Access Control Settings */}
          {updateType === 'access' && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Course Accessibility Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="isAccessible"
                      checked={accessControl.isAccessible}
                      onChange={(e) => handleAccessControlChange('isAccessible', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isAccessible" className="ml-2 block text-sm font-medium text-gray-700">
                      Course is accessible to enrolled students
                    </label>
                  </div>
                  
                  {!accessControl.isAccessible && (
                    <div className="mt-2">
                      <label htmlFor="accessReason" className="block text-sm font-medium text-gray-700">
                        Reason for restricting access (visible to students)
                      </label>
                      <textarea
                        id="accessReason"
                        value={accessControl.accessReason}
                        onChange={(e) => handleAccessControlChange('accessReason', e.target.value)}
                        rows={2}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Course under maintenance, Content being updated, etc."
                        required={!accessControl.isAccessible}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="temporaryAccess"
                      checked={accessControl.temporaryAccess}
                      onChange={(e) => handleAccessControlChange('temporaryAccess', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={!accessControl.isAccessible}
                    />
                    <label htmlFor="temporaryAccess" className={`ml-2 block text-sm font-medium ${!accessControl.isAccessible ? 'text-gray-400' : 'text-gray-700'}`}>
                      Set time-limited access (course will become inaccessible after this date)
                    </label>
                  </div>
                  
                  {accessControl.temporaryAccess && accessControl.isAccessible && (
                    <div className="mt-2">
                      <label htmlFor="accessibleUntil" className="block text-sm font-medium text-gray-700">
                        Accessible until
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <CalendarIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="date"
                          id="accessibleUntil"
                          value={accessControl.accessibleUntil}
                          onChange={(e) => handleAccessControlChange('accessibleUntil', e.target.value)}
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                          required={accessControl.temporaryAccess}
                          min={new Date().toISOString().split('T')[0]} // Today or later
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4 mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <InformationCircleIcon className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Access Control Information</h3>
                    <p className="mt-1 text-sm text-yellow-700">
                      {accessControl.isAccessible 
                        ? accessControl.temporaryAccess 
                          ? `Course will be available until ${new Date(accessControl.accessibleUntil).toLocaleDateString()}. After this date, students will not be able to access the content.`
                          : 'Course is accessible to all enrolled students.'
                        : 'Course is currently not accessible to students. They will see the provided reason when they attempt to access it.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Course Content Editing */}
          {updateType !== 'access' && (
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
          )}

          {/* Update Information */}
          {updateType !== 'access' && (
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
          )}

          {/* Version History */}
          {courseVersions && courseVersions.length > 0 && updateType !== 'access' && (
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
                  {updateType === 'access' ? 'Updating Access...' : 'Updating...'}
                </>
              ) : (
                <>
                  {updateType === 'access' ? (
                    <>
                      {accessControl.isAccessible ? <EyeIcon className="h-5 w-5 mr-2" /> : <EyeSlashIcon className="h-5 w-5 mr-2" />}
                      Update Access Settings
                    </>
                  ) : (
                    <>
                      <PencilIcon className="h-5 w-5 mr-2" />
                      Save Changes
                    </>
                  )}
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