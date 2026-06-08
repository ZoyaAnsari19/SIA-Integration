export const metadata = {
  title: 'FAQ - Secure Infinite Association'
};

export default function FAQPage() {
  return (
    <main className="faq-page">
      <section className="faq-hero">
        <div className="container">
          <p className="faq-eyebrow">Support &amp; Trust</p>
          <p className="faq-hero-subtitle">
            Clear, transparent answers about our courses, platform and what you can expect as a
            learner with Secure Infinite Association.
          </p>
        </div>
      </section>

      <section className="faq-section">
        <div className="container faq-layout">
          <div className="faq-intro-card">
            <h2>Learn with full clarity and confidence</h2>
            <p>
              We believe in **zero hype and complete transparency**. Go through these FAQs carefully
              before enrolling so you know exactly what we offer — and what we don&apos;t.
            </p>
            <ul>
              <li>No income or return promises</li>
              <li>100% recorded, self-paced courses</li>
              <li>Education-focused, not an investment platform</li>
            </ul>
            <div className="faq-highlight-box">
              Still have questions? Reach out at{' '}
              <a href="mailto:support@secureinfiniteassociation.com">
                support@secureinfiniteassociation.com
              </a>
              .
            </div>
          </div>

          <div className="faq-list">
            <div className="faq-item">
              <div className="faq-question-row">
                <span className="faq-q-label">Q1</span>
                <h2>Are these live classes?</h2>
              </div>
              <p className="faq-answer">
                No, all courses are <strong>pre‑recorded video programs</strong>. This gives you the
                freedom to learn anytime, pause, rewind and rewatch lessons as many times as you
                want.
              </p>
            </div>

            <div className="faq-item">
              <div className="faq-question-row">
                <span className="faq-q-label">Q2</span>
                <h2>Is there any income guarantee?</h2>
              </div>
              <p className="faq-answer">
                No income or earnings are guaranteed. Our role is to provide **high‑quality
                educational content** — how you implement the learnings and the results you achieve
                will always depend on your own efforts, decisions and market conditions.
              </p>
            </div>

            <div className="faq-item">
              <div className="faq-question-row">
                <span className="faq-q-label">Q3</span>
                <h2>Is the affiliate program mandatory?</h2>
              </div>
              <p className="faq-answer">
                No, the affiliate program is **completely optional**. You can simply purchase and
                consume the courses as a normal student without ever using or joining the affiliate
                system.
              </p>
            </div>

            <div className="faq-item">
              <div className="faq-question-row">
                <span className="faq-q-label">Q4</span>
                <h2>Is this an investment or trading platform?</h2>
              </div>
              <p className="faq-answer">
                No. Secure Infinite Association is an **education platform only**. We do not take
                funds for investment, we do not manage money for anyone, and we do not promise or
                guarantee any profits, returns or fixed income.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


