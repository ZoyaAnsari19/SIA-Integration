"use client";

import { useState } from "react";
import { User, Mail, Phone, Lock, Save, Camera } from "lucide-react";

export default function SettingsPage() {
  const [profileData, setProfileData] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+91 98765 43210"
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    courseUpdates: true,
    affiliateReports: true
  });

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNotifications(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle profile update
    console.log("Profile updated:", profileData);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle password update
    console.log("Password updated:", passwordData);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account preferences and security settings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Profile Information
              </h2>
              
              <div className="flex items-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-400" />
                  </div>
                  <button 
                    className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1.5 text-white"
                    aria-label="Change profile photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div className="ml-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {profileData.firstName} {profileData.lastName}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Update your profile photo and personal details
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleProfileSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label 
                      htmlFor="firstName" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={profileData.firstName}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="lastName" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={profileData.lastName}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="email" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleProfileChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="phone" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleProfileChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
            
            {/* Password Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Change Password
              </h2>
              
              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-6 mb-6">
                  <div>
                    <label 
                      htmlFor="currentPassword" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        id="currentPassword"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="newPassword" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label 
                      htmlFor="confirmPassword" 
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* Notifications Section */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Notifications
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive updates via email
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="emailNotifications"
                      checked={notifications.emailNotifications}
                      onChange={handleNotificationChange}
                      className="sr-only peer"
                      aria-label="Toggle email notifications"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">SMS Notifications</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Receive updates via SMS
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="smsNotifications"
                      checked={notifications.smsNotifications}
                      onChange={handleNotificationChange}
                      className="sr-only peer"
                      aria-label="Toggle SMS notifications"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                    Email Preferences
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        id="course-updates"
                        name="courseUpdates"
                        type="checkbox"
                        checked={notifications.courseUpdates}
                        onChange={handleNotificationChange}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label 
                        htmlFor="course-updates" 
                        className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
                      >
                        Course updates and new content
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        id="affiliate-reports"
                        name="affiliateReports"
                        type="checkbox"
                        checked={notifications.affiliateReports}
                        onChange={handleNotificationChange}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <label 
                        htmlFor="affiliate-reports" 
                        className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
                      >
                        Monthly affiliate reports
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Danger Zone */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mt-8 border border-red-200 dark:border-red-900">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">
                Danger Zone
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Delete Account</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                
                <button
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  aria-label="Delete account"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}