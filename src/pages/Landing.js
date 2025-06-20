import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { db } from '../config/firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { AcademicCapIcon, ClockIcon, UserGroupIcon, LightBulbIcon, ArrowRightIcon, CheckCircleIcon, StarIcon } from '@heroicons/react/24/outline';

const Landing = () => {
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const fetchFeaturedCourses = async () => {
      try {
        const q = query(collection(db, 'courses'), limit(3));
        const querySnapshot = await getDocs(q);
        const courses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFeaturedCourses(courses);
      } catch (error) {
        console.error('Error fetching featured courses:', error);
      }
    };

    fetchFeaturedCourses();
  }, []);

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'UX Design Student',
      image: 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=100',
      content: 'The courses here have transformed my career path. The instructors are amazing and the content is top-notch.'
    },
    {
      name: 'Michael Chen',
      role: 'Software Engineering Instructor',
      image: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=100',
      content: 'Teaching on this platform has been incredibly rewarding. The tools and support provided make it easy to create engaging content.'
    },
    {
      name: 'Emily Davis',
      role: 'Data Science Student',
      image: 'https://images.pexels.com/photos/3776023/pexels-photo-3776023.jpeg?auto=compress&cs=tinysrgb&w=100',
      content: 'I love how interactive and engaging the learning experience is. The community support is fantastic!'
    }
  ];

  const benefits = [
    {
      title: 'Expert Instructors',
      description: 'Learn from industry professionals with years of experience.',
      icon: <AcademicCapIcon className="w-8 h-8 text-blue-600" />
    },
    {
      title: 'Flexible Learning',
      description: 'Study at your own pace, anywhere and anytime.',
      icon: <ClockIcon className="w-8 h-8 text-blue-600" />
    },
    {
      title: 'Interactive Content',
      description: 'Engage with multimedia content and hands-on projects.',
      icon: <LightBulbIcon className="w-8 h-8 text-blue-600" />
    },
    {
      title: 'Community Support',
      description: 'Connect with peers and get help when you need it.',
      icon: <UserGroupIcon className="w-8 h-8 text-blue-600" />
    }
  ];

  const stats = [
    { number: "10K+", label: "Students" },
    { number: "200+", label: "Courses" },
    { number: "50+", label: "Instructors" },
    { number: "15+", label: "Categories" }
  ];

  const features = [
    { text: "HD video lessons", icon: <CheckCircleIcon className="w-5 h-5 text-green-500" /> },
    { text: "Hands-on projects", icon: <CheckCircleIcon className="w-5 h-5 text-green-500" /> },
    { text: "Expert feedback", icon: <CheckCircleIcon className="w-5 h-5 text-green-500" /> },
    { text: "Community access", icon: <CheckCircleIcon className="w-5 h-5 text-green-500" /> },
    { text: "Completion certificates", icon: <CheckCircleIcon className="w-5 h-5 text-green-500" /> },
    { text: "Lifetime access", icon: <CheckCircleIcon className="w-5 h-5 text-green-500" /> }
  ];

  return (
    <div className="min-h-screen">
      {/* Header Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className={`text-2xl font-bold ${isScrolled ? 'bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent' : 'text-white'}`}>
                  ModernLMS
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                to="/login" 
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isScrolled 
                    ? 'text-gray-700 hover:text-blue-600' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Sign In
              </Link>
              <Link 
                to="/signup" 
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isScrolled 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-white text-blue-900 hover:bg-gray-100'
                }`}
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Modern Learning Platform"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-indigo-900/80 to-purple-900/90" />
        </div>
        
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block mb-4 px-4 py-1 rounded-full bg-blue-100/20 backdrop-blur-sm text-blue-100 text-sm font-medium"
          >
            Next-Generation Learning Platform
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight"
          >
            Transform Your Future with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Modern Learning</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl sm:text-2xl text-gray-200 mb-10 max-w-3xl mx-auto"
          >
            Join thousands of learners and start your journey to mastery today
          </motion.p>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/signup"
              className="group px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/20 flex items-center justify-center"
            >
              Start Learning
              <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/signup?role=instructor"
              className="group px-8 py-3 bg-white text-blue-900 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center"
            >
              Become an Instructor
              <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Stats Floating Bar */}
        <motion.div 
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-5xl px-4"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-3">
                <p className="text-3xl font-bold text-white">{stat.number}</p>
                <p className="text-blue-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Featured Courses */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Courses</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">Explore our most popular learning paths designed to help you achieve your goals</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {featuredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="bg-white rounded-xl shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="relative">
                <img
                  src={course.thumbnail || `https://images.pexels.com/photos/5905710/pexels-photo-5905710.jpeg?auto=compress&cs=tinysrgb&w=600`}
                  alt={course.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                />
                  <div className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                    FEATURED
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <StarIcon className="w-5 h-5 text-yellow-400" />
                    <StarIcon className="w-5 h-5 text-yellow-400" />
                    <StarIcon className="w-5 h-5 text-yellow-400" />
                    <StarIcon className="w-5 h-5 text-yellow-400" />
                    <StarIcon className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm text-gray-500 ml-2">(120+ reviews)</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{course.title}</h3>
                  <p className="text-gray-600 mb-6 line-clamp-2">{course.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-600 font-bold">{course.price ? `$${course.price}` : 'Free'}</span>
                  <Link
                    to={`/courses/${course.id}`}
                      className="text-blue-600 font-medium hover:text-blue-700 flex items-center"
                  >
                      Learn More
                      <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-2 transition-transform" />
                  </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/courses" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              View All Courses
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Us</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">Experience the benefits of our modern learning platform designed for today's digital world</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-xl p-8 text-center hover:shadow-xl transition-all duration-300"
              >
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100">
                    {benefit.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
          
          {/* Features List */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-20 bg-gray-50 rounded-2xl p-8 shadow-lg max-w-4xl mx-auto"
          >
            <h3 className="text-2xl font-bold text-center mb-8">Everything you need to succeed</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-12">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center">
                  {feature.icon}
                  <span className="ml-3 text-gray-700">{feature.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Our Users Say</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">Hear from our community of learners and instructors about their experiences</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-xl shadow-lg relative"
              >
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4">
                  <div className="text-5xl text-blue-200">"</div>
                </div>
                <p className="text-gray-600 italic mb-6 relative z-10">{testimonial.content}</p>
                <div className="flex items-center">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full mr-4 border-2 border-blue-100"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{testimonial.name}</h3>
                    <p className="text-blue-600">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Instructor CTA */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-center justify-between"
          >
            <div className="mb-8 md:mb-0 md:mr-8 md:w-2/3">
              <h2 className="text-3xl font-bold mb-4">Become an Instructor Today</h2>
              <p className="text-xl text-blue-100 mb-6 max-w-2xl">
                Share your knowledge, build your brand, and earn revenue while helping others learn and grow.
            </p>
            <Link
              to="/signup?role=instructor"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-base font-medium rounded-md text-white hover:bg-white hover:text-blue-700 transition-all duration-300"
            >
                Start Teaching
                <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Link>
            </div>
            <div className="md:w-1/3">
              <img 
                src="https://images.pexels.com/photos/5905918/pexels-photo-5905918.jpeg?auto=compress&cs=tinysrgb&w=600" 
                alt="Instructor teaching"
                className="rounded-lg shadow-2xl transform rotate-1"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Newsletter & Footer */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-2xl font-bold mb-8">Get learning tips and updates in your inbox</h2>
            <form className="flex flex-col sm:flex-row gap-2 mb-10">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button 
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Subscribe
              </button>
            </form>
            
            <div className="border-t border-gray-800 pt-10 text-sm text-gray-400">
              <p>&copy; {new Date().getFullYear()} ModernLMS. All rights reserved.</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Landing; 