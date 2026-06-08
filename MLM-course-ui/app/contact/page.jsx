export const metadata = {
  title: 'Contact Us - Secure Infinite Association'
};

export default function ContactPage() {
  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="container">
          <h1>Contact us</h1>
            <p className="contact-hero-subtitle">
              Have a question about our courses or your account? Reach out to Secure Infinite
              Association and our team will be happy to help.
            </p>
        </div>
      </section>

      <section className="contact-section">
        <div className="container contact-grid">
          <div className="contact-card">
            <h2>Address</h2>
            <p>
              Welcome to <strong>Secure Infinite Association (SIA)</strong>,<br />
              Kabrastan Road, Wadsa Bypass, Desaiganj Wadsa,<br />
              Gadchiroli, Maharashtra, 441207.
            </p>
          </div>

          <div className="contact-card">
            <h2>Mobile</h2>
            <p>02269621972</p>
          </div>

          <div className="contact-card">
            <h2>Email</h2>
            <p>support@secureinfiniteassociation.com</p>
          </div>
        </div>
      </section>
    </main>
  );
}


