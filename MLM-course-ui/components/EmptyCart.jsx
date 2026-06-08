import Link from 'next/link';

export default function EmptyCart() {
  return (
    <section className="cart-page">
      <div className="container">
        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h1 className="empty-cart-title">Your cart is empty.</h1>
          <p className="empty-cart-text">
            Keep shopping and explore our latest Secure Infinite Association courses.
          </p>
          <Link href="/" className="continue-shopping-btn">
            Keep Shopping
          </Link>
        </div>
      </div>
    </section>
  );
}


