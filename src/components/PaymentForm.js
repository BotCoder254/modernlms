import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { createPaymentIntent, processPayment } from '../utils/stripe';

const PaymentForm = ({ course, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements || !user) {
      return;
    }

    setIsProcessing(true);

    try {
      // First create a payment intent
      const clientSecret = await createPaymentIntent(course.id, course.price);
      
      // Process the payment with the client secret
      const success = await processPayment(stripe, elements, clientSecret);

      if (success) {
        // Record the payment in Firestore
        await addDoc(collection(db, 'payments'), {
          userId: user.uid,
          courseId: course.id,
          amount: course.price,
          status: 'succeeded',
          createdAt: serverTimestamp(),
        });

        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
          isProcessing ? 'opacity-75 cursor-not-allowed' : ''
        }`}
      >
        {isProcessing ? 'Processing...' : `Pay $${course.price}`}
      </button>
    </form>
  );
};

export default PaymentForm; 