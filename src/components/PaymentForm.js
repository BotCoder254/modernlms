import React, { useState, useEffect } from 'react';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import swal from 'sweetalert';
import { initializePaystack } from '../utils/paystack';

const PaymentForm = ({ course, onSuccess }) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isPaystackReady, setIsPaystackReady] = useState(false);

  // Initialize Paystack
  useEffect(() => {
    const loadPaystack = async () => {
      try {
        await initializePaystack();
        setIsPaystackReady(true);
      } catch (err) {
        setError('Failed to load payment system. Please try again later.');
        console.error('Paystack initialization error:', err);
      }
    };
    
    loadPaystack();
  }, []);

  const processPayment = async (
    payMethod,
    currency,
    responseReference,
    responseTrans,
    selectedMonth,
    finalAmount,
    displayAmount
  ) => {
    try {
      // Record the payment in Firestore
      await addDoc(collection(db, 'payments'), {
        userId: user.uid,
        courseId: course.id,
        amount: course.price,
        status: 'succeeded',
        paymentMethod: payMethod,
        currency: currency,
        reference: responseReference,
        transaction: responseTrans,
        createdAt: serverTimestamp(),
      });

      onSuccess();
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be logged in to make a payment.');
      return;
    }

    if (!isPaystackReady) {
      setError('Payment system is still loading. Please try again in a moment.');
      return;
    }

    setIsProcessing(true);

    try {
      const userEmail = user.email;
      const finalAmountUSD = course.price * 100; // Convert to cents
      const finalAmount = course.price;
      const displayAmount = course.price;
      const selectedMonth = 1; // Default to 1 month

      const handler = window.PaystackPop.setup({
        key: 'pk_live_f75e7fc5c652583410d16789fc9955853373fc8c', // Your public key
        email: userEmail,
        amount: finalAmountUSD, // amount in cents
        currency: "USD",
        callback: function(response) {
          if (response.status === 'success') {
            // Proceed with your logic, e.g., updating the database or displaying a success message
            const payMethod = "Paystack - USD";
            const currency = "USD";
            const responseReference = response.reference;
            const responseTrans = response.trans;
            
            processPayment(
              payMethod, 
              currency, 
              responseReference, 
              responseTrans, 
              selectedMonth, 
              finalAmount, 
              displayAmount
            );
          } else {
            swal('Payment Error', 'Payment failed or was not successful', 'error');
            setIsProcessing(false);
          }
        },
        onClose: function() {
          // Handle payment cancellation
          swal('Payment Error', 'Transaction was not completed, action canceled', 'error');
          setIsProcessing(false);
        }
      });

      // Open the Paystack payment modal
      handler.openIframe();
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="p-3 text-center">
          <p className="text-gray-700 mb-2">You will be charged</p>
          <p className="text-2xl font-bold text-blue-600">${course.price}</p>
          <p className="text-sm text-gray-500 mt-2">
            Secure payment processed by Paystack
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !isPaystackReady}
        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
          isProcessing || !isPaystackReady ? 'opacity-75 cursor-not-allowed' : ''
        }`}
      >
        {isProcessing ? 'Processing...' : `Pay $${course.price}`}
      </button>
    </form>
  );
};

export default PaymentForm; 