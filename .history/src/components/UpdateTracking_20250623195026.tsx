import { useState } from 'react';
import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { updateOrderTracking } from '../services/orderService';

interface TrackingEntry {
  orderNumber: string;
  trackingCode: string;
  timestamp: string;
}

export default function UpdateTracking() {
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [trackingHistory, setTrackingHistory] = useState<TrackingEntry[]>([]);
  
  // References for form inputs
  const orderNumberRef = React.useRef<HTMLInputElement>(null);
  const trackingCodeRef = React.useRef<HTMLInputElement>(null);

  // Load tracking history from localStorage on component mount
  useState(() => {
    const storedHistory = localStorage.getItem('trackingHistory');
    if (storedHistory) {
      try {
        setTrackingHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error('Error parsing tracking history:', e);
        localStorage.removeItem('trackingHistory');
      }
    }
  });

  // Handle order number input keydown
  const handleOrderNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      trackingCodeRef.current?.focus();
    }
  };

  // Handle tracking code input keydown
  const handleTrackingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Reset form and focus order number input
  const resetForm = () => {
    setOrderNumber('');
    setTrackingCode('');
    setTimeout(() => {
      orderNumberRef.current?.focus();
    }, 100);
  };

  // Handle successful tracking update
  const handleSuccessfulUpdate = async (trackingData: TrackingEntry) => {
    // Save to tracking history
    const updatedHistory = [trackingData, ...trackingHistory].slice(0, 50);
    setTrackingHistory(updatedHistory);
    localStorage.setItem('trackingHistory', JSON.stringify(updatedHistory));
    
    try {
      // Update the order in the shared order service (now async with Supabase)
      await updateOrderTracking(trackingData.orderNumber, trackingData.trackingCode);
      
      setStatus('success');
      setMessage('Tracking code updated successfully!');
      resetForm();
    } catch (error) {
      console.error('Error updating tracking in Supabase:', error);
      setStatus('error');
      setMessage('Tracking updated in local history but failed to sync with database');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderNumber.trim() || !trackingCode.trim()) {
      setStatus('error');
      setMessage('Please fill in all fields');
      return;
    }

    setStatus('submitting');
    setMessage('');

    // Create the payload
    const payload = {
      orderNumber: orderNumber.trim(),
      trackingCode: trackingCode.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      // Try to fetch from the API
      const response = await fetch('https://auto-n8n.9krcxo.easypanel.host/webhook-change/268073e1-6504-48d4-b4ac-1a66a51865a2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        // API call was successful, update tracking (now async)
        await handleSuccessfulUpdate(payload);
      } else {
        throw new Error('Failed to update tracking');
      }
    } catch (error) {
      console.error('Error updating tracking:', error);
      setStatus('error');
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setMessage('Could not connect to the server. Please check your internet connection or try again later.');
      } else {
        setMessage(error instanceof Error ? error.message : 'An error occurred while updating tracking');
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Update Tracking Information</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <div className="space-y-4">
          <div>
            <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Order Number
            </label>
            <input
              type="text"
              id="orderNumber"
              ref={orderNumberRef}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={handleOrderNumberKeyDown}
              placeholder="Enter order number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={status === 'submitting'}
              autoFocus
            />
          </div>
          
          <div>
            <label htmlFor="trackingCode" className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Code
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="trackingCode"
                ref={trackingCodeRef}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                onKeyDown={handleTrackingKeyDown}
                placeholder="Scan or enter tracking code"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={status === 'submitting'}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => {
                  // This will trigger the device's barcode scanner on mobile
                  // On desktop, it will just focus the input
                  document.getElementById('trackingCode')?.focus();
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Scan
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`px-6 py-2 rounded-lg font-medium text-white ${
              status === 'submitting'
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {status === 'submitting' ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Updating...
              </span>
            ) : (
              'Update Tracking'
            )}
          </button>

          {(status === 'success' || status === 'error') && (
            <div className={`flex items-center text-sm ${
              status === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {status === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-1.5" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-1.5" />
              )}
              {message}
            </div>
          )}
        </div>
      </form>
      
      <div className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Tracking Updates</h3>
        
        {trackingHistory.length > 0 ? (
          <div className="space-y-3">
            {trackingHistory.map((entry, index) => {
              const date = new Date(entry.timestamp);
              const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
              
              return (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Order:</span>
                        <span className="text-gray-800">{entry.orderNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Tracking:</span>
                        <span className="text-gray-800">{entry.trackingCode}</span>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 text-sm text-gray-500">
                      {formattedDate}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              No tracking updates yet. Scan a tracking code using your device's barcode scanner or enter it manually.
              The order number and tracking code will be sent to our system and displayed here.
            </p>
          </div>
        )}
        
        {trackingHistory.length > 0 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                localStorage.removeItem('trackingHistory');
                setTrackingHistory([]);
              }}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              Clear History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
