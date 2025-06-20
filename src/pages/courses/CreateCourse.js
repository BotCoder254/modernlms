import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  doc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable,
} from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  CloudArrowUpIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  DocumentIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  DocumentCheckIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

const categories = ['Programming', 'Design', 'Business', 'Marketing', 'Music', 'Photography'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];
const certificateTemplates = [
  { id: 'default', name: 'Default Template', color: '#1E40AF' },
  { id: 'modern', name: 'Modern', color: '#047857' },
  { id: 'elegant', name: 'Elegant', color: '#7C3AED' },
  { id: 'minimal', name: 'Minimal', color: '#1F2937' },
  { id: 'creative', name: 'Creative', color: '#B45309' },
];

const CreateCourse = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState({
    title: '',
    description: '',
    category: '',
    level: 'beginner',
    price: '',
    isFree: false,
    discountPrice: '',
    thumbnail: null,
    hasDiscount: false,
    discountEndDate: '',
    previewEnabled: false,
    requirements: [],
    outcomes: [],
  });

  // Add certificate template state
  const [certificateTemplate, setCertificateTemplate] = useState({
    templateId: 'default',
    color: '#1E40AF',
    instructorName: user?.displayName || '',
    instructorSignature: null,
    instructorSignatureUrl: '',
    showInstructorName: true,
    logo: null,
    logoUrl: '',
  });

  const [showCertificateSection, setShowCertificateSection] = useState(false);

  const [lessons, setLessons] = useState([{
    title: '',
    description: '',
    videoFile: null,
    previewEnabled: false,
    studyMaterials: [],
    duration: '',
  }]);

  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewThumbnail, setPreviewThumbnail] = useState(null);

  // Add upload progress states
  const [fileUploads, setFileUploads] = useState({
    thumbnail: { progress: 0, uploading: false },
    signature: { progress: 0, uploading: false },
    logo: { progress: 0, uploading: false },
    videos: {},
    materials: {},
  });
  const [uploadError, setUploadError] = useState('');

  // Enhanced onDrop for thumbnail with progress
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      // Create a preview
      setCourseData((prev) => ({
        ...prev,
        thumbnail: file,
        thumbnailPreview: URL.createObjectURL(file),
      }));
    }
  }, []);

  // Upload handler for instructor signature
  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setCertificateTemplate((prev) => ({
        ...prev,
        instructorSignature: file,
        instructorSignaturePreview: URL.createObjectURL(file),
      }));
    }
  };

  // Upload handler for certificate logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setCertificateTemplate((prev) => ({
        ...prev,
        logo: file,
        logoPreview: URL.createObjectURL(file),
      }));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
    },
    maxFiles: 1,
  });

  // Handle certificate template selection
  const handleTemplateChange = (templateId) => {
    const template = certificateTemplates.find(t => t.id === templateId);
    if (template) {
      setCertificateTemplate(prev => ({
        ...prev,
        templateId: templateId,
        color: template.color,
      }));
    }
  };

  // Enhanced video upload with progress tracking
  const handleLessonVideoChange = async (e, index) => {
    const file = e.target.files[0];
    if (file) {
      const updatedLessons = [...lessons];
      updatedLessons[index] = {
        ...updatedLessons[index],
        videoFile: file,
        videoName: file.name,
      };
      setLessons(updatedLessons);
      
      // Reset progress for this video
      setFileUploads(prev => ({
        ...prev,
        videos: {
          ...prev.videos,
          [index]: { progress: 0, uploading: false }
        }
      }));
    }
  };

  const addLesson = () => {
    setLessons([
      ...lessons,
      {
        title: '',
        description: '',
        videoFile: null,
        previewEnabled: false,
        studyMaterials: [],
        duration: '',
      },
    ]);
  };

  const removeLesson = (index) => {
    setLessons((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLessonChange = (index, field, value) => {
    const newLessons = [...lessons];
    newLessons[index][field] = value;
    setLessons(newLessons);
  };

  // Enhanced study material upload with progress
  const handleStudyMaterialUpload = async (index, files) => {
    if (!files || files.length === 0) return;
    
    const newLessons = [...lessons];
    const lessonTitle = newLessons[index].title || `Lesson ${index + 1}`;
    
    // Initialize progress trackers for all files
    setFileUploads(prev => {
      const materialUpdates = { ...prev.materials };
      Array.from(files).forEach((file, fileIndex) => {
        const fileId = `${index}-${fileIndex}`;
        materialUpdates[fileId] = { progress: 0, uploading: true, name: file.name };
      });
      
      return {
        ...prev,
        materials: materialUpdates
      };
    });
    
    // Upload each file with progress tracking
    const uploadPromises = Array.from(files).map(async (file, fileIndex) => {
      const fileId = `${index}-${fileIndex}`;
      const storageRef = ref(storage, `courses/${courseData.title || 'untitled'}/materials/${file.name}`);
      
      try {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Set up progress monitoring
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileUploads(prev => ({
              ...prev,
              materials: {
                ...prev.materials,
                [fileId]: { 
                  ...prev.materials[fileId],
                  progress: Math.round(progress) 
                }
              }
            }));
          }
        );
        
        await uploadTask;
      const url = await getDownloadURL(storageRef);
        
        // Mark as complete
        setFileUploads(prev => ({
          ...prev,
          materials: {
            ...prev.materials,
            [fileId]: { 
              ...prev.materials[fileId],
              progress: 100,
              uploading: false,
              complete: true
            }
          }
        }));
        
        return { 
          name: file.name, 
          url,
          uploadedAt: new Date().toISOString(),
          type: file.type,
          size: file.size
        };
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        setFileUploads(prev => ({
          ...prev,
          materials: {
            ...prev.materials,
            [fileId]: { 
              ...prev.materials[fileId],
              error: true,
              uploading: false
            }
          }
        }));
        
        setUploadError(`Failed to upload ${file.name}`);
        return null;
      }
    });

    try {
      const materialResults = await Promise.all(uploadPromises);
      const validMaterials = materialResults.filter(Boolean);
      
    newLessons[index].studyMaterials = [
      ...(newLessons[index].studyMaterials || []),
        ...validMaterials
      ];
      
      setLessons(newLessons);
      toast.success(`Materials added to ${lessonTitle}`);
    } catch (error) {
      console.error('Error uploading materials:', error);
      toast.error('Some files failed to upload');
    }
  };
  
  // Add function to remove study material
  const removeStudyMaterial = (lessonIndex, materialIndex) => {
    const newLessons = [...lessons];
    newLessons[lessonIndex].studyMaterials.splice(materialIndex, 1);
    setLessons(newLessons);
  };

  // Enhanced submit with version control
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUploadError('');

    try {
      // Upload thumbnail with progress tracking
      let thumbnailUrl = '';
      if (courseData.thumbnail) {
        const thumbnailRef = ref(storage, `courses/thumbnails/${courseData.thumbnail.name}`);
        
        // Start progress tracking
        setFileUploads(prev => ({
          ...prev,
          thumbnail: { progress: 0, uploading: true }
        }));
        
        const uploadTask = uploadBytesResumable(thumbnailRef, courseData.thumbnail);
        
        // Monitor thumbnail upload progress
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileUploads(prev => ({
              ...prev,
              thumbnail: { progress: Math.round(progress), uploading: true }
            }));
          }
        );
        
        await uploadTask;
        thumbnailUrl = await getDownloadURL(thumbnailRef);
        
        // Mark thumbnail upload as complete
        setFileUploads(prev => ({
          ...prev,
          thumbnail: { progress: 100, uploading: false, complete: true }
        }));
      }

      // Upload instructor signature if provided
      let signatureUrl = '';
      if (certificateTemplate.instructorSignature) {
        const signatureRef = ref(
          storage, 
          `courses/certificates/${courseData.title || 'untitled'}/signature.png`
        );
        
        // Start progress tracking
        setFileUploads(prev => ({
          ...prev,
          signature: { progress: 0, uploading: true }
        }));
        
        const uploadTask = uploadBytesResumable(signatureRef, certificateTemplate.instructorSignature);
        
        // Monitor signature upload progress
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileUploads(prev => ({
              ...prev,
              signature: { progress: Math.round(progress), uploading: true }
            }));
          }
        );
        
        await uploadTask;
        signatureUrl = await getDownloadURL(signatureRef);
        
        // Mark signature upload as complete
        setFileUploads(prev => ({
          ...prev,
          signature: { progress: 100, uploading: false, complete: true }
        }));
      }

      // Upload certificate logo if provided
      let logoUrl = '';
      if (certificateTemplate.logo) {
        const logoRef = ref(
          storage, 
          `courses/certificates/${courseData.title || 'untitled'}/logo.png`
        );
        
        // Start progress tracking
        setFileUploads(prev => ({
          ...prev,
          logo: { progress: 0, uploading: true }
        }));
        
        const uploadTask = uploadBytesResumable(logoRef, certificateTemplate.logo);
        
        // Monitor logo upload progress
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFileUploads(prev => ({
              ...prev,
              logo: { progress: Math.round(progress), uploading: true }
            }));
          }
        );
        
        await uploadTask;
        logoUrl = await getDownloadURL(logoRef);
        
        // Mark logo upload as complete
        setFileUploads(prev => ({
          ...prev,
          logo: { progress: 100, uploading: false, complete: true }
        }));
      }
      
      // Upload videos with progress tracking
      const lessonsWithUrls = await Promise.all(
        lessons.map(async (lesson, index) => {
          let videoUrl = '';
          if (lesson.videoFile) {
            const videoRef = ref(storage, `courses/videos/${lesson.videoFile.name}`);
            
            // Start progress tracking
            setFileUploads(prev => ({
              ...prev,
              videos: {
                ...prev.videos,
                [index]: { progress: 0, uploading: true }
              }
            }));
            
            const uploadTask = uploadBytesResumable(videoRef, lesson.videoFile);
            
            // Monitor video upload progress
            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setFileUploads(prev => ({
                  ...prev,
                  videos: {
                    ...prev.videos,
                    [index]: { progress: Math.round(progress), uploading: true }
                  }
                }));
              }
            );
            
            await uploadTask;
            videoUrl = await getDownloadURL(videoRef);
            
            // Mark video upload as complete
            setFileUploads(prev => ({
              ...prev,
              videos: {
                ...prev.videos,
                [index]: { progress: 100, uploading: false, complete: true }
              }
            }));
          }

          return {
            id: crypto.randomUUID(), // Add unique ID to each lesson for versioning
            title: lesson.title,
            description: lesson.description,
            videoUrl,
            previewEnabled: lesson.previewEnabled,
            studyMaterials: lesson.studyMaterials,
            duration: lesson.duration,
            version: 1, // Initial version
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        })
      );

      // Prepare certificate template data
      const certificateTemplateData = {
        templateId: certificateTemplate.templateId,
        color: certificateTemplate.color,
        instructorName: certificateTemplate.instructorName || user.displayName,
        showInstructorName: certificateTemplate.showInstructorName,
        instructorSignatureUrl: signatureUrl,
        logo: logoUrl
      };

      // Create course document with version control
      const courseRef = await addDoc(collection(db, 'courses'), {
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        level: courseData.level,
        isFree: courseData.isFree,
        price: courseData.isFree ? 0 : Number(courseData.price),
        hasDiscount: !courseData.isFree && courseData.hasDiscount,
        discountPrice: courseData.isFree 
          ? 0 
          : (courseData.hasDiscount && courseData.discountPrice ? Number(courseData.discountPrice) : null),
        discountEndDate: courseData.isFree 
          ? null 
          : (courseData.hasDiscount && courseData.discountEndDate ? new Date(courseData.discountEndDate) : null),
        thumbnail: thumbnailUrl,
        lessons: lessonsWithUrls,
        instructorId: user.uid,
        instructorName: user.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        rating: 0,
        reviewCount: 0,
        enrollmentCount: 0,
        requirements: courseData.requirements,
        outcomes: courseData.outcomes,
        version: 1, // Add version control
        certificateTemplate: certificateTemplateData, // Add certificate template data
        versionHistory: [
          {
            version: 1,
            updatedAt: new Date().toISOString(),
            updatedBy: user.uid,
            updaterName: user.displayName,
            changelog: "Initial course creation"
          }
        ]
      });
      
      // Create course versions collection
      await addDoc(collection(db, 'courseVersions'), {
        courseId: courseRef.id,
        version: 1,
        title: courseData.title,
        description: courseData.description,
        lessons: lessonsWithUrls.map(lesson => ({
          ...lesson,
          id: lesson.id
        })),
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
        updaterName: user.displayName,
        changelog: "Initial course creation"
      });

      toast.success('Course created successfully!');
      navigate(`/courses/${courseRef.id}`);
    } catch (error) {
      console.error('Error creating course:', error);
      setUploadError('Failed to create course. Please check upload errors and try again.');
      toast.error('Failed to create course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function for file size formatting
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Course</h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Course Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={courseData.title}
              onChange={(e) => setCourseData((prev) => ({ ...prev, title: e.target.value }))}
              className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter course title"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Course Description
            </label>
            <textarea
              id="description"
              name="description"
              value={courseData.description}
              onChange={(e) => setCourseData((prev) => ({ ...prev, description: e.target.value }))}
              rows={6}
              className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Provide a detailed description of your course"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Course Category
              </label>
              <select
                id="category"
                name="category"
                value={courseData.category}
                onChange={(e) => setCourseData((prev) => ({ ...prev, category: e.target.value }))}
                className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="" disabled>Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-2">
                Course Level
              </label>
              <select
                id="level"
                name="level"
                value={courseData.level}
                onChange={(e) => setCourseData((prev) => ({ ...prev, level: e.target.value }))}
                className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {levels.map((level) => (
                  <option key={level} value={level.toLowerCase()}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="isFree"
                  checked={courseData.isFree}
                  onChange={(e) => setCourseData({
                    ...courseData,
                    isFree: e.target.checked,
                    price: e.target.checked ? '0' : courseData.price,
                    hasDiscount: e.target.checked ? false : courseData.hasDiscount
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isFree" className="ml-2 block text-sm font-medium text-gray-700">
                  Free Course
                </label>
              </div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                Regular Price ($)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={courseData.isFree ? '0' : courseData.price}
                onChange={(e) => setCourseData({ ...courseData, price: e.target.value })}
                min="0"
                step="0.01"
                className={`block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${courseData.isFree ? 'bg-gray-100' : ''}`}
                disabled={courseData.isFree}
                placeholder="Enter regular price"
                required
              />
            </div>

            <div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="hasDiscount"
                  checked={courseData.hasDiscount && !courseData.isFree}
                  onChange={(e) => setCourseData({ ...courseData, hasDiscount: e.target.checked })}
                  disabled={courseData.isFree}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="hasDiscount" className={`ml-2 block text-sm font-medium ${courseData.isFree ? 'text-gray-400' : 'text-gray-700'}`}>
                  Enable Discount
                </label>
              </div>
              {courseData.hasDiscount && !courseData.isFree && (
                <>
                  <input
                    type="number"
                    id="discountPrice"
                    name="discountPrice"
                    value={courseData.discountPrice}
                    onChange={(e) => setCourseData({ ...courseData, discountPrice: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="Discount Price ($)"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-2"
                    required={courseData.hasDiscount}
                  />
                  <input
                    type="date"
                    id="discountEndDate"
                    name="discountEndDate"
                    value={courseData.discountEndDate}
                    onChange={(e) => setCourseData({ ...courseData, discountEndDate: e.target.value })}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Discount End Date"
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              name="duration"
              value={courseData.duration}
              onChange={(e) => setCourseData({ ...courseData, duration: e.target.value })}
              min="1"
              className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Total course duration in minutes"
              required
            />
          </div>

          <div>
            <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 mb-2">
              Course Thumbnail
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition duration-150 cursor-pointer ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <input {...getInputProps()} />
              <CloudArrowUpIcon className="h-12 w-12 text-gray-400" />
              {isDragActive ? (
                <p className="mt-2 text-sm text-gray-600">Drop your image here...</p>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  Drag and drop your course thumbnail here, or click to select file
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Supported formats: JPEG, JPG, PNG</p>
            </div>
            
            {courseData.thumbnailPreview && (
              <div className="mt-4">
                <div className="relative rounded-md overflow-hidden h-40">
                  <img 
                    src={courseData.thumbnailPreview} 
                    alt="Thumbnail preview" 
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCourseData(prev => ({...prev, thumbnail: null, thumbnailPreview: null}))}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                
                {fileUploads.thumbnail.uploading && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${fileUploads.thumbnail.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {fileUploads.thumbnail.progress}% uploaded
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Content
            </label>
            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4">
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
                        placeholder="Enter lesson title"
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
                        placeholder="Describe what this lesson covers"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video File
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition duration-150 cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleLessonVideoChange(e, index)}
                          className="hidden"
                          id={`video-upload-${index}`}
                        />
                        <label htmlFor={`video-upload-${index}`} className="cursor-pointer flex flex-col items-center">
                          <CloudArrowUpIcon className="h-10 w-10 text-gray-400" />
                          <span className="mt-2 text-sm text-gray-600">
                            {lesson.videoName 
                              ? `Selected: ${lesson.videoName}`
                              : 'Click to upload video'
                            }
                          </span>
                        </label>
                      </div>
                      
                      {/* Video upload progress */}
                      {fileUploads.videos[index]?.uploading && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                              style={{ width: `${fileUploads.videos[index].progress}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            {fileUploads.videos[index].progress}% uploaded
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`preview-${index}`}
                        checked={lesson.previewEnabled}
                        onChange={(e) => handleLessonChange(index, 'previewEnabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`preview-${index}`} className="ml-2 block text-sm text-gray-700">
                        Enable preview for this lesson
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Study Materials
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition duration-150 cursor-pointer">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleStudyMaterialUpload(index, e.target.files)}
                          className="hidden"
                          id={`material-upload-${index}`}
                          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                        />
                        <label htmlFor={`material-upload-${index}`} className="cursor-pointer flex flex-col items-center w-full">
                          <DocumentArrowUpIcon className="h-10 w-10 text-gray-400" />
                          <span className="mt-2 text-sm text-gray-600 text-center">
                            Drag and drop study materials here, or click to upload
                          </span>
                          <span className="text-xs text-gray-500 mt-1">
                            PDF, DOC, TXT, Excel, PPT, ZIP, etc.
                          </span>
                        </label>
                      </div>
                      
                      {/* Material upload progress list */}
                      {Object.entries(fileUploads.materials)
                        .filter(([id, _]) => id.startsWith(`${index}-`))
                        .map(([id, upload]) => (
                          <div key={id} className="mt-2 bg-gray-50 rounded-md p-2">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="text-gray-700 truncate">{upload.name}</span>
                              <span className="text-gray-500">{upload.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  upload.error ? 'bg-red-600' : 'bg-blue-600'
                                }`}
                                style={{ width: `${upload.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      
                      {/* Study materials list */}
                      {lesson.studyMaterials && lesson.studyMaterials.length > 0 && (
                        <div className="mt-3 bg-gray-50 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Materials</h4>
                          <ul className="space-y-2">
                          {lesson.studyMaterials.map((material, mIndex) => (
                              <li key={mIndex} className="flex items-center justify-between text-sm text-gray-600 bg-white p-2 rounded-md">
                                <div className="flex items-center">
                                  <DocumentIcon className="h-5 w-5 mr-2 text-gray-500" />
                                  <span className="truncate max-w-xs">{material.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500">
                                    {material.size ? formatBytes(material.size) : ''}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeStudyMaterial(index, mIndex)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                            </li>
                          ))}
                        </ul>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLesson(index)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                    >
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Remove Lesson
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addLesson}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PlusIcon className="h-5 w-5 mr-1" />
                Add Lesson
              </button>
            </div>
          </div>

          {/* Error display */}
          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{uploadError}</p>
            </div>
          )}

          {/* Certificate Template Section */}
          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <DocumentCheckIcon className="h-5 w-5 text-blue-500 mr-2" />
                Certificate Customization
              </h2>
              <button
                type="button"
                onClick={() => setShowCertificateSection(!showCertificateSection)}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              >
                {showCertificateSection ? 'Hide Options' : 'Show Options'}
              </button>
            </div>

            {showCertificateSection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 bg-gray-50 p-4 rounded-lg"
              >
                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Template
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {certificateTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className={`relative rounded-md p-3 text-center cursor-pointer border ${
                          certificateTemplate.templateId === template.id
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleTemplateChange(template.id)}
                      >
                        <div 
                          className="h-8 rounded mb-2" 
                          style={{ backgroundColor: template.color }} 
                        />
                        <span className="block text-xs font-medium">
                          {template.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Customization */}
                <div>
                  <label htmlFor="templateColor" className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Accent Color
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      id="templateColor"
                      value={certificateTemplate.color}
                      onChange={(e) => setCertificateTemplate(prev => ({ ...prev, color: e.target.value }))}
                      className="h-10 w-10 p-0 border-0 rounded-md"
                    />
                    <input
                      type="text"
                      value={certificateTemplate.color}
                      onChange={(e) => setCertificateTemplate(prev => ({ ...prev, color: e.target.value }))}
                      className="block w-36 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                {/* Instructor Name */}
                <div>
                  <label htmlFor="instructorName" className="block text-sm font-medium text-gray-700 mb-2">
                    Instructor Name on Certificate
                  </label>
                  <input
                    type="text"
                    id="instructorName"
                    value={certificateTemplate.instructorName}
                    onChange={(e) => setCertificateTemplate(prev => ({ ...prev, instructorName: e.target.value }))}
                    placeholder="Name as appears on certificates"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex items-center mt-2">
                    <input
                      type="checkbox"
                      id="showInstructorName"
                      checked={certificateTemplate.showInstructorName}
                      onChange={(e) => setCertificateTemplate(prev => ({ 
                        ...prev, 
                        showInstructorName: e.target.checked 
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="showInstructorName" className="ml-2 block text-sm text-gray-700">
                      Show instructor name on certificate
                    </label>
                  </div>
                </div>

                {/* Instructor Signature */}
                <div>
                  <label htmlFor="instructorSignature" className="block text-sm font-medium text-gray-700 mb-2">
                    Instructor Signature
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      {certificateTemplate.instructorSignaturePreview ? (
                        <div className="relative">
                          <img 
                            src={certificateTemplate.instructorSignaturePreview} 
                            alt="Signature preview" 
                            className="mx-auto h-24 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setCertificateTemplate(prev => ({ 
                              ...prev, 
                              instructorSignature: null,
                              instructorSignaturePreview: null
                            }))}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <PencilIcon className="h-12 w-12 text-gray-400 mx-auto" />
                          <div className="flex justify-center text-sm text-gray-600">
                            <label htmlFor="signature-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                              <span>Upload a signature</span>
                              <input 
                                id="signature-upload" 
                                type="file" 
                                className="sr-only" 
                                accept="image/*" 
                                onChange={handleSignatureUpload} 
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG up to 2MB</p>
                        </>
                      )}
                      {fileUploads.signature.uploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${fileUploads.signature.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom Logo */}
                <div>
                  <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Logo (Optional)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      {certificateTemplate.logoPreview ? (
                        <div className="relative">
                          <img 
                            src={certificateTemplate.logoPreview} 
                            alt="Logo preview" 
                            className="mx-auto h-24 object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setCertificateTemplate(prev => ({ 
                              ...prev, 
                              logo: null,
                              logoPreview: null
                            }))}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto" />
                          <div className="flex justify-center text-sm text-gray-600">
                            <label htmlFor="logo-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                              <span>Upload your logo</span>
                              <input 
                                id="logo-upload" 
                                type="file" 
                                className="sr-only" 
                                accept="image/*" 
                                onChange={handleLogoUpload} 
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG up to 2MB</p>
                        </>
                      )}
                      {fileUploads.logo.uploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${fileUploads.logo.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Certificate Preview Placeholder */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-500 mb-3">
                    Preview of how your certificate will look. Actual certificate will include student name, 
                    course title, and completion date.
                  </p>
                  <div 
                    className="border border-gray-300 bg-white rounded-lg p-6 relative"
                    style={{ 
                      borderTop: `4px solid ${certificateTemplate.color}`,
                      minHeight: '180px'
                    }}
                  >
                    {/* Logo */}
                    {certificateTemplate.logoPreview && (
                      <div className="absolute top-4 left-4">
                        <img 
                          src={certificateTemplate.logoPreview} 
                          alt="Certificate logo" 
                          className="h-10 object-contain" 
                        />
                      </div>
                    )}
                    
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Certificate of Completion</h3>
                      <p className="text-gray-700 mb-4">This certifies that</p>
                      <p className="text-xl font-bold mb-4 text-gray-800">[Student Name]</p>
                      <p className="text-gray-700 mb-6">has successfully completed</p>
                      <p className="text-lg font-semibold mb-6">{courseData.title || '[Course Title]'}</p>
                      
                      {/* Signature area */}
                      <div className="mt-8 pt-8 flex items-center justify-center">
                        {certificateTemplate.instructorSignaturePreview ? (
                          <img 
                            src={certificateTemplate.instructorSignaturePreview} 
                            alt="Instructor signature" 
                            className="h-12 object-contain mb-2"
                          />
                        ) : (
                          <div 
                            className="h-px w-40 bg-gray-400 mb-2"
                            style={{ backgroundColor: certificateTemplate.color }}
                          ></div>
                        )}
                      </div>
                      {certificateTemplate.showInstructorName && (
                        <p className="text-sm text-gray-600">
                          {certificateTemplate.instructorName || user?.displayName || 'Instructor Name'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || Object.values(fileUploads).some(item => 
                typeof item === 'object' && item.uploading === true
              )}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Creating Course...
                </>
              ) : (
                'Create Course'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCourse; 