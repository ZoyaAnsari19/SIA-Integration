import LoginForm from '../../components/LoginForm';

export const metadata = {
  title: 'Login - Secure Infinite Association'
};

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="container">
          <h1>Login</h1>
          <p className="auth-hero-subtitle">
            Login with your mobile number to continue your learning journey with Secure Infinite Association.
          </p>
        </div>
      </section>

      <section className="auth-section">
        <div className="container auth-single">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
