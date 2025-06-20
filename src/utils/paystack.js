// Paystack utility functions for the ModernLMS platform

/**
 * Initializes the Paystack script on the page
 * @returns {Promise} A promise that resolves when the script is loaded
 */
export const initializePaystack = () => {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve(window.PaystackPop);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    
    script.onload = () => {
      if (window.PaystackPop) {
        resolve(window.PaystackPop);
      } else {
        reject(new Error('Paystack failed to load'));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Error loading Paystack script'));
    };
    
    document.body.appendChild(script);
  });
};

/**
 * Opens the Paystack payment modal
 * @param {Object} options Payment options including email, amount, etc.
 * @returns {Object} The Paystack handler
 */
export const openPaystackModal = (options) => {
  const handler = window.PaystackPop.setup({
    key: 'pk_live_f75e7fc5c652583410d16789fc9955853373fc8c',
    ...options
  });
  
  handler.openIframe();
  return handler;
};

export default {
  initializePaystack,
  openPaystackModal
}; 