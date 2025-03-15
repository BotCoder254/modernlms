import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const generateCertificate = async (userId, courseId, courseName, userName, grade) => {
  try {
    // Create certificate data
    const certificateData = {
      userId,
      courseId,
      courseName,
      userName,
      grade,
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    // Generate certificate PDF (you would need to implement this part)
    // For now, we'll just create a placeholder certificate URL
    const certificateUrl = `https://api.yourservice.com/generate-certificate?courseId=${courseId}&userId=${userId}`;

    // Add certificate to Firestore
    const certificateRef = await addDoc(collection(db, 'certificates'), {
      ...certificateData,
      pdfUrl: certificateUrl,
    });

    // Create achievement for course completion
    await addDoc(collection(db, 'achievements'), {
      userId,
      title: 'Course Completed',
      description: `Completed ${courseName} with ${grade}% score`,
      type: 'course_completion',
      earnedAt: serverTimestamp(),
    });

    return {
      success: true,
      certificateId: certificateRef.id,
      pdfUrl: certificateUrl,
    };
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
}; 