import { useState, useEffect } from 'react';
import { Lock, X, Check } from 'lucide-react';

interface AuthProps {
  onAuthenticated: () => void;
}

export default function Auth({ onAuthenticated }: AuthProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  
  // Correct PIN - in a real app, this would be stored securely, not hardcoded
  const CORRECT_PIN = '7107';
  
  // Check if already authenticated
  useEffect(() => {
    const isAuth = localStorage.getItem('auth_token');
    if (isAuth === 'authenticated') {
      onAuthenticated();
    }
  }, [onAuthenticated]);
  
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const value = e.target.value.replace(/[^0-9]/g, '');
    
    // Limit to 4 digits
    if (value.length <= 4) {
      setPin(value);
      setError('');
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin === CORRECT_PIN) {
      setShowSuccess(true);
      
      // Store authentication in localStorage
      localStorage.setItem('auth_token', 'authenticated');
      
      // Delay to show success animation
      setTimeout(() => {
        onAuthenticated();
      }, 1000);
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Order Tracking System</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your PIN to access the system
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="pin" className="sr-only">PIN</label>
            <input
              id="pin"
              name="pin"
              type="password"
              autoComplete="off"
              required
              value={pin}
              onChange={handlePinChange}
              placeholder="Enter 4-digit PIN"
              className={`appearance-none relative block w-full px-3 py-3 border ${
                error ? 'border-red-300 text-red-900 placeholder-red-300' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-lg text-center tracking-widest`}
              maxLength={4}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center justify-center">
                <X className="h-4 w-4 mr-1" />
                {error}
              </p>
            )}
          </div>
          
          <div className="flex justify-center">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => {
                  if (pin.length < 4) {
                    setPin(prev => prev + digit);
                  }
                }}
                className="m-1 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150"
              >
                {digit}
              </button>
            ))}
          </div>
          
          <div>
            <button
              type="submit"
              disabled={pin.length !== 4 || showSuccess}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                showSuccess 
                  ? 'bg-green-600' 
                  : pin.length !== 4 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {showSuccess ? (
                <span className="flex items-center">
                  <Check className="h-5 w-5 mr-2" />
                  Access Granted
                </span>
              ) : (
                'Verify PIN'
              )}
            </button>
          </div>
          
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setPin('')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          </div>
        </form>
        
        <div className="text-center text-xs text-gray-500 mt-8">
          <p>If you forgot your PIN, please contact your administrator.</p>
        </div>
      </div>
    </div>
  );
}
