import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

const PaymentHistory = () => {
  const { user } = useAuth();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];

      const paymentsRef = collection(db, 'payments');
      const q = query(
        paymentsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const courseRef = await getDoc(doc(db, 'courses', data.courseId));
        const courseData = courseRef.data();
        
        return {
          id: doc.id,
          ...data,
          course: {
            id: courseRef.id,
            title: courseData.title,
            thumbnail: courseData.thumbnail,
          },
          date: data.createdAt?.toDate(),
        };
      }));
    },
    enabled: !!user?.uid,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Payment History</h1>

        {payments?.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500">No payment history available.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments?.map((payment) => (
              <div key={payment.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={payment.course.thumbnail}
                      alt={payment.course.title}
                      className="h-16 w-16 object-cover rounded"
                    />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {payment.course.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {format(payment.date, 'PPP')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {payment.reference && `Ref: ${payment.reference}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-medium text-gray-900">
                      {payment.currency === "USD" ? "$" : ""}
                      {payment.amount}
                    </p>
                    <p className="text-sm text-gray-600">
                      {payment.paymentMethod || "Paystack"}
                    </p>
                    <p className="text-sm">
                      {payment.status === 'succeeded' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Paid</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Failed</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory; 