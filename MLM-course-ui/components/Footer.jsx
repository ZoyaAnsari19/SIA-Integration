import Image from 'next/image';
import logo from '../secure-infinite-association.png';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-brand">
          <Image
            src={logo}
            alt="Secure Infinite Association logo"
            className="site-footer-logo-img"
            width={32}
            height={32}
          />
          <span className="site-footer-brand-text">Secure Infinite Association</span>
        </div>

        <nav className="site-footer-links">
          <a href="/about">About</a>
          <a href="/contact">Contact us</a>
          <a href="/privacy">Privacy policy</a>
          <a href="/terms">Terms and condition</a>
          <a href="/refund">Refund and cancellation</a>
          <a href="/shipping">Shipping and delivery</a>
          <a href="/login">Login</a>
        </nav>

        <div className="site-footer-lang">
          <select aria-label="Select language">
            <option>English</option>
          </select>
        </div>
      </div>
    </footer>
  );
}



