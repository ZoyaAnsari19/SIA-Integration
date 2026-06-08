'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { cartAPI } from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
    } else {
      // Immediately clear cart when user logs out
      setCartItems([]);
      setCartCount(0);
    }
  }, [isAuthenticated]);

  const fetchCart = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      console.log('CartContext: Fetching cart...');
      const data = await cartAPI.get();
      console.log('CartContext: Cart API response:', data);
      // Backend returns { cart: { items: [...], total: ..., itemCount: ... } }
      const items = data.cart?.items || data.items || [];
      setCartItems(items);
      setCartCount(items.length);
      console.log('CartContext: Cart updated with', items.length, 'items');
    } catch (error) {
      console.error('CartContext: Error fetching cart:', error);
      setCartItems([]);
      setCartCount(0);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (courseId, requestType) => {
    if (!isAuthenticated) {
      throw new Error('Please login to add items to cart');
    }
    try {
      console.log('CartContext: Adding course to cart:', courseId, 'requestType:', requestType);
      const response = await cartAPI.addItem(courseId, requestType);
      console.log('CartContext: Add item API response:', response);
      // Wait a bit before fetching to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchCart(); // Refresh cart
      console.log('CartContext: Cart refreshed, items:', cartItems.length);
      return { success: true };
    } catch (error) {
      console.error('CartContext: Add to cart error:', error);
      return { success: false, error: error.message || 'Failed to add to cart' };
    }
  };

  const removeFromCart = async (courseId) => {
    try {
      await cartAPI.removeItem(courseId);
      await fetchCart(); // Refresh cart
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const clearCart = async () => {
    try {
      await cartAPI.clear();
      await fetchCart(); // Refresh cart
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      // Handle both string and number prices (backend returns string)
      const price = typeof item.course?.price === 'number' 
        ? item.course.price 
        : (typeof item.course?.price === 'string' ? parseFloat(item.course.price) || 0 : 0);
      return total + price * (item.quantity || 1);
    }, 0);
  };

  const value = {
    cartItems,
    cartCount,
    loading,
    addToCart,
    removeFromCart,
    clearCart,
    fetchCart,
    calculateTotal,
    isInCart: (courseId) => cartItems.some((item) => (item.course_id || item.courseId) === courseId),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

