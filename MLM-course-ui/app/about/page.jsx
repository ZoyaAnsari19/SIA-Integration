export const metadata = {
  title: 'About Us - Secure Infinite Association'
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="container">
          <h1>About Secure Infinite Association</h1>
          <p className="about-hero-subtitle">
            India’s trusted platform for high-quality, self-paced video courses that empower you to
            learn and grow at your own pace.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="container about-grid">
          <div className="about-block">
            <h2>Who We Are</h2>
            <p>
              Welcome to <strong>Secure Infinite Association (SIA)</strong>, India's
              trusted platform for high-quality, self-paced video courses. We are dedicated to
              empowering learners across the country by providing expert-led, recorded courses that
              help individuals upskill, advance in their careers, and achieve their learning goals
              — all at their own convenience.
            </p>
            <p>
              At Secure Infinite Association, we believe that learning should be accessible, flexible, and
              impactful. Our platform is designed to offer premium online courses across various
              fields, ensuring that students and professionals can gain the skills they need without
              geographical or time constraints.
            </p>
          </div>

          <div className="about-block">
            <h2>What We Offer</h2>
            <ul>
              <li>
                <strong>Expert‑Curated Courses</strong> – Our courses are created and taught by
                industry experts, ensuring up‑to‑date and high‑quality learning materials.
              </li>
              <li>
                <strong>Flexible Learning</strong> – Access our video lectures anytime, anywhere,
                and learn at your own pace.
              </li>
              <li>
                <strong>Affordable Pricing</strong> – We offer cost‑effective courses to make
                learning accessible to everyone.
              </li>
              <li>
                <strong>Certification</strong> – Upon course completion, earn certificates that
                enhance your resume and career opportunities.
              </li>
            </ul>
          </div>

          <div className="about-block">
            <h2>Why Choose Secure Infinite Association?</h2>
            <ul>
              <li>
                <strong>Comprehensive Course Library</strong> – Covering a wide range of subjects to
                cater to different learning needs.
              </li>
              <li>
                <strong>User‑Friendly Platform</strong> – Enjoy a seamless browsing, purchasing and
                learning experience.
              </li>
              <li>
                <strong>Lifetime Access</strong> – Revisit your purchased courses anytime for deeper
                understanding.
              </li>
              <li>
                <strong>Dedicated Support</strong> – Our team is always ready to assist you with any
                queries.
              </li>
            </ul>
            <p>
              Join thousands of learners who are transforming their careers with Secure Infinite Association.
              Take the next step in your learning journey today!
            </p>
          </div>

          <div className="about-block about-disclaimer">
            <h2>Disclaimer</h2>
            <p>
              We are educators and course providers. Our courses are for educational purposes only
              and do not guarantee any specific financial results, profits, or losses. Any decisions
              you make based on our content are your own responsibility. We do not provide
              financial, investment, or legal advice.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}


