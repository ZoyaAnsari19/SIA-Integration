'use client';

import { useRouter } from 'next/navigation';

export default function PayNowButton() {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      const isLoggedIn = window.localStorage.getItem('sia_isLoggedIn') === 'true';
      if (!isLoggedIn) {
        router.push('/login');
        return;
      }
    }
    // Demo behaviour when logged in – stay on page for now
    // In real app, you would trigger payment flow here.
  };

  return (
    <button type="button" className="checkout-pay-btn" onClick={handleClick}>
      Pay now
    </button>
  );
}


