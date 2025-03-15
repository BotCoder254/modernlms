import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  CloudArrowUpIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';

const categories = ['Programming', 'Design', 'Business', 'Marketing', 'Music', 'Photography'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];

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
    discountPrice: '',
    thumbnail: null,
  });

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

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setCourseData((prev) => ({
        ...prev,
        thumbnail: file,
        thumbnailPreview: URL.createObjectURL(file),
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

  const handleStudyMaterialUpload = async (index, files) => {
    const newLessons = [...lessons];
    const uploadPromises = Array.from(files).map(async (file) => {
      const storageRef = ref(storage, `courses/${courseData.title}/materials/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return { name: file.name, url };
    });

    const materials = await Promise.all(uploadPromises);
    newLessons[index].studyMaterials = [
      ...(newLessons[index].studyMaterials || []),
      ...materials
    ];
    setLessons(newLessons);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload thumbnail
      let thumbnailUrl = '';
      if (courseData.thumbnail) {
        const thumbnailRef = ref(storage, `courses/thumbnails/${courseData.thumbnail.name}`);
        await uploadBytes(thumbnailRef, courseData.thumbnail);
        thumbnailUrl = await getDownloadURL(thumbnailRef);
      }

      // Upload videos and get URLs
      const lessonsWithUrls = await Promise.all(
        lessons.map(async (lesson) => {
          let videoUrl = '';
          if (lesson.videoFile) {
            const videoRef = ref(storage, `courses/videos/${lesson.videoFile.name}`);
            await uploadBytes(videoRef, lesson.videoFile);
            videoUrl = await getDownloadURL(videoRef);
          }

          return {
            title: lesson.title,
            description: lesson.description,
            videoUrl,
            previewEnabled: lesson.previewEnabled,
            studyMaterials: lesson.studyMaterials,
            duration: lesson.duration,
          };
        })
      );

      // Create course document
      const courseRef = await addDoc(collection(db, 'courses'), {
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        level: courseData.level,
        price: Number(courseData.price),
        discountPrice: courseData.discountPrice ? Number(courseData.discountPrice) : null,
        thumbnail: thumbnailUrl,
        lessons: lessonsWithUrls,
        instructorId: user.uid,
        instructorName: user.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        rating: 0,
        reviewCount: 0,
        enrollmentCount: 0,
      });

      toast.success('Course created successfully!');
      navigate(`/courses/${courseRef.id}`);
    } catch (error) {
      console.error('Error creating course:', error);
      toast.error('Failed to create course. Please try again.');
    } finally {
      setLoading(false);
    }
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
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                Price ($)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={courseData.price}
                onChange={(e) => setCourseData({ ...courseData, price: e.target.value })}
                min="0"
                step="0.01"
                className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
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
                <option value="">Select Level</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
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
              required
            />
          </div>

          <div>
            <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 mb-2">
              Course Thumbnail
            </label>
            <input
              type="file"
              id="thumbnail"
              name="thumbnail"
              accept="image/*"
              onChange={onDrop}
              className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video File
                      </label>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleLessonVideoChange(e, index)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLesson(index)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                    >
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
                Add Lesson
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating Course...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCourse; 