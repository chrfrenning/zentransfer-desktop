import React, { useState, useEffect, useRef } from 'react';
import { getElectronAPI } from '../api/ZenTransferAPI';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onCancel?: () => void;
  onSkipLogin?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onCancel, onSkipLogin }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const api = getElectronAPI();

  useEffect(() => {
    // Initialize version and saved email
    const initialize = async () => {
      try {
        const version = await api.app.getVersion();
        setAppVersion(version);
        
        // Try to get saved email from config
        const savedEmail = await api.config.get('email');
        if (typeof savedEmail === 'string' && savedEmail) {
          setEmail(savedEmail);
        }
      } catch (error) {
        console.error('Failed to initialize login screen:', error);
      }
    };
    
    initialize();
    
    // Focus on email input when component mounts
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    // Focus OTP input when switching to OTP step
    if (isEmailSubmitted && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [isEmailSubmitted]);

  useEffect(() => {
    // Auto-submit when 6 digits are entered for OTP
    if (isEmailSubmitted && otp.length === 6) {
      setTimeout(() => {
        handleFinalizeLogin();
      }, 100);
    }
  }, [otp, isEmailSubmitted]);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !isValidEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Sending OTP...');
    setError(null);

    try {
      const result = await api.auth.initializeLogin(email.trim());
      
      if (result.success) {
        setIsEmailSubmitted(true);
        setIsLoading(false);
        setLoadingMessage('');
      } else {
        throw new Error(result.error || 'Failed to send OTP');
      }
    } catch (error) {
      setIsLoading(false);
      setLoadingMessage('');
      setError(error instanceof Error ? error.message : 'Failed to send OTP');
      console.error('Login initialization failed:', error);
    }
  };

  const handleFinalizeLogin = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Verifying OTP...');
    setError(null);

    try {
      const result = await api.auth.finalizeLogin(otp.trim());
      
      if (result.success) {
        setIsLoading(false);
        setLoadingMessage('');
        onLoginSuccess();
      } else {
        throw new Error(result.error || 'Invalid OTP code');
      }
    } catch (error) {
      setIsLoading(false);
      setLoadingMessage('');
      setError(error instanceof Error ? error.message : 'Failed to verify OTP');
      console.error('Login finalization failed:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isEmailSubmitted) {
      handleEmailSubmit();
    } else {
      handleFinalizeLogin();
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
    
    // Reset to email step if user modifies email after it was submitted
    if (isEmailSubmitted) {
      resetToEmailStep();
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const value = e.target.value.replace(/\D/g, '');
    setOtp(value);
    setError(null);
  };

  const resetToEmailStep = () => {
    setIsEmailSubmitted(false);
    setOtp('');
    setError(null);
    setIsLoading(false);
    setLoadingMessage('');
    
    // Focus email input
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);
  };

  const openExternal = (url: string) => {
    api.shell.openExternal(url);
  };

  const canSubmit = () => {
    if (isLoading) return false;
    
    if (!isEmailSubmitted) {
      return email.trim().length > 0 && isValidEmail(email.trim());
    } else {
      return otp.trim().length === 6;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">ZenTransfer.io</h2>
          <p className="mt-2 text-sm text-gray-600">
            {!isEmailSubmitted ? 'Sign in to your account' : 'Enter verification code'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isEmailSubmitted || isLoading}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Enter your email"
                value={email}
                onChange={handleEmailChange}
              />
            </div>

            {isEmailSubmitted && (
              <div className="space-y-2">
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  Verification code
                </label>
                <input
                  ref={otpInputRef}
                  id="otp"
                  name="otp"
                  type="text"
                  maxLength={6}
                  disabled={isLoading}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-widest disabled:bg-gray-50"
                  placeholder="000000"
                  value={otp}
                  onChange={handleOtpChange}
                />
                <div className="text-center">
                  <button
                    type="button"
                    onClick={resetToEmailStep}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium bg-transparent border-none cursor-pointer"
                  >
                    Change email address
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={!canSubmit()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {loadingMessage}
                </div>
              ) : (
                isEmailSubmitted ? 'Verify OTP' : 'Login'
              )}
            </button>
          </div>

          {onCancel && (
            <div className="text-center">
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-gray-600 hover:text-gray-700 font-medium bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="text-center space-y-2">
            <p className="text-xs text-gray-500">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => openExternal('https://zentransfer.io/register')}
                className="text-blue-600 hover:text-blue-700 font-medium bg-transparent border-none cursor-pointer"
              >
                Sign up
              </button>
            </p>
            <p className="text-xs text-gray-400">
              <button
                type="button"
                onClick={() => openExternal('https://zentransfer.io')}
                className="hover:text-gray-600 bg-transparent border-none cursor-pointer underline"
              >
                Learn more about ZenTransfer.io
              </button>
            </p>
            {onSkipLogin && (
              <p className="text-sm text-gray-600 mt-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onSkipLogin}
                  className="text-gray-600 hover:text-gray-800 font-medium bg-transparent border-none cursor-pointer underline"
                >
                  Use app without account
                </button>
              </p>
            )}
            
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
