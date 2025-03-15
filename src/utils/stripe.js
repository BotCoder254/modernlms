import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "pk_test_51JMihKFmxId2hxxFi0AXS1khPIQgFDkZt4hf0zL5tnpFvDvDtuPA19wFLRQp7DJ7MKz9IkoFz0JO4IspKKk1DiaC00CNojZg4v");

export const createPaymentIntent = async (courseId, price) => {
  try {
    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ courseId, price }),
    });

    const data = await response.json();
    return data.clientSecret;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

export const processPayment = async (stripe, elements, clientSecret) => {
  try {
    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement('card'),
        billing_details: {
          name: 'User Name',
        },
      },
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error processing payment:', error);
    throw error;
  }
};

export default stripePromise; 