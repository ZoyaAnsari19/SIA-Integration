"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (this would typically check a token or session)
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse user data:", error);
      }
    }
    setLoading(false);
  }, []);

  const signIn = (userData: User) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const isAuthenticated = !!user;

  return {
    user,
    loading,
    isAuthenticated,
    signIn,
    signOut
  };
}