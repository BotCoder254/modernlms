import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  ClockIcon,
  CurrencyDollarIcon,
  StarIcon,
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserIcon,
  TagIcon,
  AdjustmentsVerticalIcon
} from '@heroicons/react/24/outline';

const categories = ['Programming', 'Design', 'Business', 'Marketing', 'Music', 'Photography'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];
const priceRanges = [
  { label: 'All', min: 0, max: Infinity },
  { label: 'Free', min: 0, max: 0 },
  { label: 'Under $50', min: 0.01, max: 50 },
  { label: '$50 - $100', min: 50, max: 100 },
  { label: 'Over $100', min: 100, max: Infinity },
];
const ratingOptions = [
  { label: 'All Ratings', min: 0 },
  { label: '4+ Stars', min: 4 },
  { label: '3+ Stars', min: 3 },
  { label: '2+ Stars', min: 2 },
];

const CourseList = () => {
  const [filters, setFilters] = useState({
    category: '',
    level: '',
    priceRange: priceRanges[0],
    ratingFilter: ratingOptions[0],
    instructor: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [instructors, setInstructors] = useState([]);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', filters],
    queryFn: async () => {
      let q = collection(db, 'courses');
      let constraints = [];
      
      if (filters.category && filters.category !== '') {
        constraints.push(where('category', '==', filters.category));
      }
      if (filters.level && filters.level !== '') {
        constraints.push(where('level', '==', filters.level));
      }
      
      if (constraints.length > 0) {
        q = query(q, ...constraints);
      } else {
        q = query(q);
      }
      
      const querySnapshot = await getDocs(q);
      let results = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by price range
        const effectivePrice = data.hasDiscount ? data.discountPrice : data.price;
        const matchesPrice = 
          effectivePrice >= filters.priceRange.min &&
          effectivePrice <= filters.priceRange.max;

        // Filter by instructor if selected
        const matchesInstructor = 
          !filters.instructor || 
          data.instructorId === filters.instructor ||
          data.instructorName === filters.instructor;
          
        // Filter by rating
        const rating = ((data.rating || 0) / (data.reviewCount || 1));
        const matchesRating = rating >= filters.ratingFilter.min;
        
        // Filter by search text
        const matchesSearch = 
          !filters.search ||
          data.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          data.description.toLowerCase().includes(filters.search.toLowerCase()) ||
          (data.instructorName && data.instructorName.toLowerCase().includes(filters.search.toLowerCase()));
        
        if (matchesPrice && matchesInstructor && matchesRating && matchesSearch) {
          results.push({ id: doc.id, ...data });
        }
      });
      
      // Collect unique instructors for the filter dropdown
      const uniqueInstructors = [...new Set(results.map(course => course.instructorName))]
        .filter(Boolean)
        .sort();
      setInstructors(uniqueInstructors);
      
      return results;
    },
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      level: '',
      priceRange: priceRanges[0],
      ratingFilter: ratingOptions[0],
      instructor: '',
      search: '',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Browse Courses</h1>
            <p className="mt-2 text-gray-600">Discover courses to enhance your skills and advance your career</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search courses..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              {showFilters ? (
                <XMarkIcon className="h-5 w-5 mr-2" />
              ) : (
                <AdjustmentsVerticalIcon className="h-5 w-5 mr-2" />
              )}
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={false}
          animate={{ height: showFilters ? 'auto' : 0 }}
          className="overflow-hidden mb-8"
        >
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Category Filter */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <TagIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Level Filter */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <AcademicCapIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Level
                </label>
                <select
                  value={filters.level}
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Levels</option>
                  {levels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range Filter */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Price Range
                </label>
                <select
                  value={filters.priceRange.label}
                  onChange={(e) => {
                    const range = priceRanges.find((r) => r.label === e.target.value);
                    handleFilterChange('priceRange', range);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {priceRanges.map((range) => (
                    <option key={range.label} value={range.label}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Instructor Filter */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <UserIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Instructor
                </label>
                <select
                  value={filters.instructor}
                  onChange={(e) => handleFilterChange('instructor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Instructors</option>
                  {instructors.map((instructor) => (
                    <option key={instructor} value={instructor}>
                      {instructor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <StarIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Rating
                </label>
                <select
                  value={filters.ratingFilter.label}
                  onChange={(e) => {
                    const option = ratingOptions.find((r) => r.label === e.target.value);
                    handleFilterChange('ratingFilter', option);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {ratingOptions.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 mr-2" />
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Course Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md animate-pulse border border-gray-100">
                <div className="h-48 bg-gray-200 rounded-t-xl" />
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 overflow-hidden"
              >
                <Link to={`/courses/${course.id}`} className="block">
                  <div className="relative">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute top-3 right-3 flex space-x-2">
                      {course.isFree || course.price === 0 ? (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Free</span>
                      ) : course.hasDiscount ? (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          -{Math.round((1 - course.discountPrice / course.price) * 100)}%
                        </span>
                      ) : null}
                      
                      {course.category && (
                        <span className="bg-blue-600/80 text-white text-xs px-2 py-1 rounded-full">
                          {course.category}
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 p-4">
                      <div className="flex items-center text-white mb-1">
                        <StarIcon className="h-4 w-4 text-yellow-400 mr-1" />
                        <span>{((course.rating || 0) / (course.reviewCount || 1)).toFixed(1)}</span>
                        <span className="mx-1">•</span>
                        <span className="text-sm">{course.reviewCount || 0} reviews</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">{course.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-600">
                        <AcademicCapIcon className="h-5 w-5 mr-1" />
                        {course.level}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <UserIcon className="h-5 w-5 mr-1" />
                        <span className="truncate max-w-[100px]">{course.instructorName}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <div className="font-medium">
                        {course.hasDiscount ? (
                          <div className="flex items-center">
                            <span className="text-gray-400 line-through text-sm mr-2">${course.price}</span>
                            <span className="text-blue-600">${course.discountPrice}</span>
                          </div>
                        ) : (
                          <span className="text-blue-600">
                            {course.isFree || course.price === 0 ? 'Free' : `$${course.price}`}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-blue-600 hover:text-blue-800 flex items-center font-medium">
                        View Details
                        <ArrowRightIcon className="h-4 w-4 ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && courses.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100"
          >
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">No courses found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your filters to find more courses</p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Clear Filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CourseList;