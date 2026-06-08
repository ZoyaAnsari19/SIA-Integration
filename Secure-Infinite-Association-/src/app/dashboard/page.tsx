"use client";

import Link from "next/link";
import { 
  BookOpen, 
  Download, 
  BarChart3, 
  User, 
  Settings, 
  LogOut,
  Play,
  Clock,
  TrendingUp,
  IndianRupee,
  CheckCircle
} from "lucide-react";

export default function DashboardPage() {
  // Consistent number formatting to prevent hydration errors
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Dummy data
  const enrolledCourses = [
    {
      id: 1,
      title: "Financial Literacy Fundamentals",
      progress: 65,
      lastAccessed: "2 days ago",
      image: "/course1.jpg"
    },
    {
      id: 2,
      title: "Digital Marketing Mastery",
      progress: 30,
      lastAccessed: "1 week ago",
      image: "/course2.jpg"
    },
    {
      id: 3,
      title: "Entrepreneurship Essentials",
      progress: 10,
      lastAccessed: "3 weeks ago",
      image: "/course3.jpg"
    }
  ];

  const downloadedResources = [
    {
      id: 1,
      title: "Personal Finance Handbook",
      type: "eBook",
      date: "2023-05-15"
    },
    {
      id: 2,
      title: "Investment Basics",
      type: "Video Series",
      date: "2023-05-10"
    }
  ];

  const affiliateStats = {
    totalEarnings: 12500,
    pendingEarnings: 3200,
    totalSales: 42,
    commissionRate: "15%"
  };

  const sidebarItems = [
    { name: "My Courses", icon: <BookOpen className="w-5 h-5" />, href: "/dashboard" },
    { name: "Downloads", icon: <Download className="w-5 h-5" />, href: "/dashboard/downloads" },
    { name: "Affiliate Stats", icon: <BarChart3 className="w-5 h-5" />, href: "/dashboard/affiliate" },
    { name: "Account Settings", icon: <Settings className="w-5 h-5" />, href: "/dashboard/settings" }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="md:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex items-center mb-8">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-3">
                  <h2 className="font-bold text-gray-900 dark:text-white">John Doe</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Premium Member</p>
                </div>
              </div>

              <nav className="space-y-2">
                {sidebarItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center w-full px-4 py-3 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {item.icon}
                    <span className="ml-3 font-medium">{item.name}</span>
                  </Link>
                ))}
              </nav>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button className="flex items-center w-full px-4 py-3 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <LogOut className="w-5 h-5" />
                  <span className="ml-3 font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-grow">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome back! Here&apos;s what&apos;s happening with your learning journey.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Enrolled Courses</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{formatNumber(affiliateStats.totalEarnings)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Affiliate Sales</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{affiliateStats.totalSales}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* My Courses */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Courses</h2>
                <Link 
                  href="/courses" 
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  View All
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledCourses.map((course) => (
                  <div 
                    key={course.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 relative">
                      <div className="bg-gray-300 border-2 border-dashed rounded-xl w-full h-full" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{course.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {course.lastAccessed}
                        </span>
                        <Link
                          href={`/courses/${course.id}`}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors flex items-center"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Continue
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Affiliate Earnings */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Affiliate Earnings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-lg p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-blue-100">Total Earnings</p>
                      <p className="text-3xl font-bold mt-2">₹{formatNumber(affiliateStats.totalEarnings)}</p>
                    </div>
                    <IndianRupee className="w-8 h-8 text-blue-200" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-500 to-green-700 rounded-lg p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-green-100">Pending Earnings</p>
                      <p className="text-3xl font-bold mt-2">₹{formatNumber(affiliateStats.pendingEarnings)}</p>
                    </div>
                    <Clock className="w-8 h-8 text-green-200" />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Commission Rate</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{affiliateStats.commissionRate}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Total Sales</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{affiliateStats.totalSales}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <Link
                  href="/dashboard/affiliate"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Detailed Report
                </Link>
              </div>
            </div>

            {/* Recent Downloads */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Downloads</h2>
                <Link 
                  href="/books" 
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-4">
                {downloadedResources.map((resource) => (
                  <div 
                    key={resource.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium text-gray-900 dark:text-white">{resource.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{resource.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{resource.date}</p>
                      <button className="mt-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                        Download Again
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}