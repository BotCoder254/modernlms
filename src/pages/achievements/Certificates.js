import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import {
  AcademicCapIcon,
  TrophyIcon,
  DocumentArrowDownIcon,
  StarIcon,
  ShareIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

const Certificates = () => {
  const { user } = useAuth();

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['certificates', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const certificatesRef = collection(db, 'certificates');
      const q = query(certificatesRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const achievementsRef = collection(db, 'achievements');
      const q = query(achievementsRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
  });

  // Function to share certificate
  const shareCertificate = (certificate) => {
    if (navigator.share) {
      navigator.share({
        title: `${certificate.courseName} Certificate`,
        text: `I completed ${certificate.courseName} course!`,
        url: certificate.pdfUrl,
      })
      .catch((error) => console.error('Error sharing:', error));
    } else {
      // Fallback for browsers that don't support navigator.share
      navigator.clipboard.writeText(certificate.pdfUrl)
        .then(() => alert('Certificate link copied to clipboard!'))
        .catch((error) => console.error('Error copying link:', error));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Certificates & Achievements</h1>
            <p className="mt-2 text-gray-600">Track your learning progress and accomplishments</p>
          </div>
        </div>

        {/* Certificates Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <AcademicCapIcon className="h-6 w-6 mr-2 text-blue-600" />
            Your Certificates
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : certificates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((certificate) => (
                <motion.div
                  key={certificate.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-shadow border border-gray-100"
                  style={{ 
                    borderTop: `4px solid ${certificate.templateColor || '#1E40AF'}` 
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {certificate.courseName}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Completed on {new Date(certificate.completedAt?.seconds * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => shareCertificate(certificate)}
                        className="p-2 text-gray-600 hover:text-blue-600"
                        title="Share Certificate"
                      >
                        <ShareIcon className="h-5 w-5" />
                      </button>
                    <button
                      onClick={() => window.open(certificate.pdfUrl, '_blank')}
                      className="p-2 text-blue-600 hover:text-blue-700"
                        title="Download Certificate"
                    >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                    </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600 mb-3">
                    <StarIcon className="h-5 w-5 text-yellow-400 mr-1" />
                    {certificate.grade || 'Pass'}
                  </div>
                  
                  {/* Instructor info */}
                  {certificate.instructorName && (
                    <div className="flex items-center mt-4 pt-4 border-t border-gray-100">
                      <UserCircleIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-600">
                        Certified by {certificate.instructorName}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates yet</h3>
              <p className="text-gray-600">Complete courses to earn certificates</p>
            </div>
          )}
        </div>

        {/* Achievements Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <TrophyIcon className="h-6 w-6 mr-2 text-yellow-500" />
            Your Achievements
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 rounded-lg p-6 text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 mb-4">
                  <TrophyIcon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {achievement.title}
                </h3>
                <p className="text-sm text-gray-600">{achievement.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Earned on {new Date(achievement.earnedAt?.seconds * 1000).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
          </div>

          {achievements.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No achievements yet</h3>
              <p className="text-gray-600">Keep learning to unlock achievements</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Certificates; 