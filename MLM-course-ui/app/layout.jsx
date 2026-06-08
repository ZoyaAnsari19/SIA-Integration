import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { AuthProvider } from '../contexts/AuthContext';
import { CartProvider } from '../contexts/CartContext';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Secure Infinite Association - Premium Online Courses',
  description:
    "India's trusted platform for high-quality, self-paced video courses. Explore top investing courses from Secure Infinite Association."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CartProvider>
            <Navbar />
            {children}
            <Footer />
            <Toaster position="top-right" />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
