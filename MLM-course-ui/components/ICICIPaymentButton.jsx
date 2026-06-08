'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { paymentsAPI } from '../lib/api';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ICICIPaymentButton({ courseIds = [], amount, courseName, requestType, previousPurchaseId }) {
  const router = useRouter();
  const { cartItems, clearCart, calculateTotal } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
  });

  // Get course IDs from props or cart
  // Handle both course_id (from backend) and courseId (camelCase)
  const coursesToPurchase = courseIds.length > 0 
    ? courseIds.filter(id => id) // Filter out null/undefined
    : cartItems.map(item => item.course_id || item.courseId || item.course?.id).filter(id => id);

  // Get total amount
  const totalAmount = amount || calculateTotal();

  const validateCustomerData = () => {
    if (!customerData.name || !customerData.email || !customerData.mobile) {
      toast.error('Please fill all customer details');
      return false;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerData.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    // Validate mobile (10 digits)
    if (customerData.mobile.length !== 10 || !/^\d+$/.test(customerData.mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    if (coursesToPurchase.length === 0) {
      toast.error('No courses to purchase');
      return;
    }

    // If user is not logged in or missing data, show form
    if (!isAuthenticated || !user?.name || !user?.email || !user?.mobile) {
      if (!showCustomerForm) {
        setShowCustomerForm(true);
        return;
      }

      // Validate form data
      if (!validateCustomerData()) {
        return;
      }
    }

    setLoading(true);

    try {
      toast.loading('Initiating payment...', { id: 'payment' });

      // Prepare payment data
      // Ensure we have a valid courseId
      const validCourseId = coursesToPurchase.find(id => id && id.trim() !== '');
      if (!validCourseId) {
        toast.error('No valid course ID found. Please try again.', { id: 'payment' });
        setLoading(false);
        return;
      }

      const paymentData = {
        courseId: validCourseId, // Use first valid course
        courseIds: coursesToPurchase.filter(id => id && id.trim() !== ''),
        amount: totalAmount,
        customerName: isAuthenticated && user?.name ? user.name : customerData.name,
        customerEmail: isAuthenticated && user?.email ? user.email : customerData.email,
        customerMobile: isAuthenticated && user?.mobile ? user.mobile : customerData.mobile,
      };
      if (requestType) paymentData.request_type = requestType;
      if (previousPurchaseId) paymentData.previous_purchase_id = String(previousPurchaseId);

      console.log('Sending payment data:', { ...paymentData, courseIds: paymentData.courseIds });

      // Call ICICI create payment API
      const response = await paymentsAPI.icici.createPayment(paymentData);

      if (response.success && response.redirectURL) {
        toast.success('Redirecting to payment gateway...', { id: 'payment' });
        
        // Redirect to gateway
        window.location.href = response.redirectURL;
      } else {
        throw new Error(response.error || 'Payment initiation failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to initiate payment. Please try again.';
      toast.error(errorMessage, { id: 'payment' });
      setLoading(false);
    }
  };

  return (
    <div>
      {showCustomerForm && (
        <div className="customer-form" style={{
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
            Customer Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Full Name *
              </label>
              <input
                type="text"
                value={customerData.name}
                onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                placeholder="Enter your name"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Email *
              </label>
              <input
                type="email"
                value={customerData.email}
                onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                placeholder="your.email@example.com"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                Mobile Number *
              </label>
              <input
                type="tel"
                value={customerData.mobile}
                onChange={(e) => setCustomerData({ ...customerData, mobile: e.target.value })}
                placeholder="10-digit mobile number"
                maxLength="10"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="checkout-pay-btn"
        onClick={handlePayment}
        disabled={loading || coursesToPurchase.length === 0}
        style={{
          opacity: (loading || coursesToPurchase.length === 0) ? 0.6 : 1,
          cursor: (loading || coursesToPurchase.length === 0) ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Processing...' : 'Proceed to Payment'}
      </button>
    </div>
  );
}
