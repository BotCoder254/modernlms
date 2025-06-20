import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const generateCertificate = async (userId, courseId, courseName, userName, grade, instructorName, completionDate) => {
  try {
    // Get course template information if available
    let templateData = {};
    try {
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (courseDoc.exists()) {
        const courseData = courseDoc.data();
        templateData = courseData.certificateTemplate || {};
      }
    } catch (error) {
      console.warn('Could not fetch certificate template:', error);
      // Continue with default template
    }
    
    // Create certificate data with template customizations
    const certificateData = {
      userId,
      courseId,
      courseName,
      userName,
      grade,
      instructorName: instructorName || templateData.instructorName || 'Course Instructor',
      instructorSignatureUrl: templateData.instructorSignatureUrl || null,
      templateId: templateData.templateId || 'default',
      templateColor: templateData.color || '#1E40AF', // Default blue color
      templateLogo: templateData.logo || null,
      completedAt: completionDate || serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    // Generate certificate URL with template parameters
    const templateParams = new URLSearchParams({
      courseId,
      userId,
      template: certificateData.templateId,
      color: certificateData.templateColor.replace('#', ''),
    }).toString();
    
    // In a real implementation, this would point to an actual certificate generation service
    const certificateUrl = `https://api.yourservice.com/generate-certificate?${templateParams}`;

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