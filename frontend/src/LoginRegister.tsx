import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp, resetPassword } from './api/auth';
import { supabase } from './supabaseClient';
import { useSession } from './hooks/useSession';

const SetNewPasswordScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(error.message);
      else setSuccess('Password updated! You can now log in.');
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Main app styles
  const accentButton = 'bg-teal-500 hover:bg-orange-500 text-white';
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 text-gray-900';
  const buttonClass = 'px-5 py-3 rounded font-semibold text-base transition flex-shrink-0';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200" style={{ minHeight: '100dvh' }}>
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md flex flex-col gap-4">
        <h2 className="text-2xl font-bold mb-2 text-center text-teal-600">Set New Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-800 font-medium mb-1" htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              placeholder="New Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-gray-800 font-medium mb-1" htmlFor="confirmNewPassword">Confirm New Password</label>
            <input
              id="confirmNewPassword"
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <button
            type="submit"
            className={`${buttonClass} ${accentButton} w-full`}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

function isRecoveryMode() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('type') === 'recovery';
}

const LoginRegister: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useSession();

  useEffect(() => {
    if (user) {
      navigate('/briefing');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
        else setSuccess('Logged in!');
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password);
        if (error) setError(error.message);
        else setSuccess('Check your email for a confirmation link!');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    setLoading(true);
    try {
      const { error } = await resetPassword(resetEmail);
      if (error) setResetMessage(error.message);
      else setResetMessage('Check your email for a password reset link.');
    } catch (err: any) {
      setResetMessage(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Main app styles
  const accentButton = 'bg-teal-500 hover:bg-orange-500 text-white';
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 text-gray-900';
  const buttonClass = 'px-5 py-3 rounded font-semibold text-base transition flex-shrink-0';

  if (isRecoveryMode()) {
    return <SetNewPasswordScreen />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200" style={{ minHeight: '100dvh' }}>
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md flex flex-col gap-4">
        <h2 className="text-2xl font-bold mb-2 text-center text-teal-600">{isLogin ? 'Login' : 'Register'}</h2>
        {showReset ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-gray-800 font-medium mb-1" htmlFor="resetEmail">Email</label>
              <input
                id="resetEmail"
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            {resetMessage && <div className={resetMessage.startsWith('Check') ? 'text-green-600 text-sm' : 'text-red-500 text-sm'}>{resetMessage}</div>}
            <button
              type="submit"
              className={`${buttonClass} ${accentButton} w-full`}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>
            <div className="mt-2 text-center">
              <button
                type="button"
                className="text-teal-600 hover:text-orange-500 underline font-medium transition"
                onClick={() => { setShowReset(false); setResetMessage(null); setResetEmail(''); }}
              >
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-800 font-medium mb-1" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-gray-800 font-medium mb-1" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              {!isLogin && (
                <div>
                  <label className="block text-gray-800 font-medium mb-1" htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              )}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
              <button
                type="submit"
                className={`${buttonClass} ${accentButton} w-full`}
                disabled={loading}
              >
                {loading ? (isLogin ? 'Logging in...' : 'Registering...') : (isLogin ? 'Login' : 'Register')}
              </button>
            </form>
            {isLogin && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  className="text-teal-600 hover:text-orange-500 underline font-medium transition"
                  onClick={() => { setShowReset(true); setResetMessage(null); setResetEmail(''); }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </>
        )}
        <div className="mt-2 text-center">
          <button
            className="text-teal-600 hover:text-orange-500 underline font-medium transition"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccess(null);
              setPassword('');
              setConfirmPassword('');
            }}
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginRegister; 