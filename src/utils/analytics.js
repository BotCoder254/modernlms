import { db } from '../config/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const trackUserEngagement = async (userId, courseId, lessonId, action, data = {}) => {
  try {
    await addDoc(collection(db, 'user_engagement'), {
      userId,
      courseId,
      lessonId,
      action,
      data,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error tracking user engagement:', error);
  }
};

export const trackLessonProgress = async (userId, courseId, lessonId, watchTime, completed) => {
  try {
    await addDoc(collection(db, 'lesson_progress'), {
      userId,
      courseId,
      lessonId,
      watchTime,
      completed,
      timestamp: serverTimestamp(),
    });

    if (completed) {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        completedLessonsCount: increment(1),
      });
    }
  } catch (error) {
    console.error('Error tracking lesson progress:', error);
  }
};

export const trackCourseEngagement = async (courseId, action, data = {}) => {
  try {
    await addDoc(collection(db, 'course_engagement'), {
      courseId,
      action,
      data,
      timestamp: serverTimestamp(),
    });

    const courseRef = doc(db, 'courses', courseId);
    if (action === 'view') {
      await updateDoc(courseRef, {
        viewCount: increment(1),
      });
    }
  } catch (error) {
    console.error('Error tracking course engagement:', error);
  }
};

export const trackStudentActivity = async (userId, action, data = {}) => {
  try {
    await addDoc(collection(db, 'student_activity'), {
      userId,
      action,
      data,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error tracking student activity:', error);
  }
};

export const trackInstructorActivity = async (instructorId, action, data = {}) => {
  try {
    await addDoc(collection(db, 'instructor_activity'), {
      instructorId,
      action,
      data,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error tracking instructor activity:', error);
  }
}; 