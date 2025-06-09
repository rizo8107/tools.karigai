import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Download, AlertCircle, X, Edit, Save, CheckCircle, FileInput } from 'lucide-react';

interface ManifestEntry {
  trackingNumber: string;
  timestamp: string;
  isEditing?: boolean;
  isDuplicate?: boolean;
  isSelected?: boolean;
  orderId?: string;
  customerName?: string;
  isFound?: boolean;
}

interface ReferenceData {
  orderId: string;
  trackingNumber: string;
  customerName: string;
}

export default function CreateManifest() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [manifestEntries, setManifestEntries] = useState<ManifestEntry[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | ''>('');
  const [duplicateCounts, setDuplicateCounts] = useState<Record<string, number>>({});
  const [referenceLoaded, setReferenceLoaded] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // Load manifest entries from localStorage on component mount
  useEffect(() => {
    const storedEntries = localStorage.getItem('manifestEntries');
    if (storedEntries) {
      try {
        setManifestEntries(JSON.parse(storedEntries));
      } catch (e) {
        console.error('Error parsing manifest entries:', e);
        localStorage.removeItem('manifestEntries');
      }
    }

    const storedReference = localStorage.getItem('referenceData');
    if (storedReference) {
      try {
        setReferenceData(JSON.parse(storedReference));
        setReferenceLoaded(true);
      } catch (e) {
        console.error('Error parsing reference data:', e);
        localStorage.removeItem('referenceData');
      }
    }
  }, []);

  // Save entries to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('manifestEntries', JSON.stringify(manifestEntries));
  }, [manifestEntries]);

  useEffect(() => {
    localStorage.setItem('referenceData', JSON.stringify(referenceData));
  }, [referenceData]);

  // Auto-focus the tracking input on component mount
  useEffect(() => {
    trackingInputRef.current?.focus();
  }, []);

  // Effect to update matched and unmatched counts
  useEffect(() => {
    let currentMatched = 0;
    manifestEntries.forEach(entry => {
      if (entry.isFound) { // 'isFound' means it's matched against referenceData
        currentMatched++;
      }
    });
    setMatchedCount(currentMatched);

    // Unmatched count is total reference records minus successfully matched manifest entries
    const totalReferenceRecords = referenceData.length;
    // Ensure unmatched count isn't negative if, for some reason, more items are matched than exist in reference
    setUnmatchedCount(Math.max(0, totalReferenceRecords - currentMatched)); 

  }, [manifestEntries, referenceData]); // Added referenceData to dependencies

  const handleTrackingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && trackingNumber.trim()) {
      e.preventDefault();
      addTrackingNumber();
    }
  };

  // Effect to update duplicates list and isDuplicate flags on entries based on scan counts
  useEffect(() => {
    const newDuplicates = Object.entries(duplicateCounts)
      .filter(([_, count]) => count > 1)
      .map(([trackingNumber, _]) => trackingNumber);
    setDuplicates(newDuplicates);

    setManifestEntries(prevEntries => {
      let hasChanged = false;
      const updatedEntries = prevEntries.map(entry => {
        const currentIsDuplicate = (duplicateCounts[entry.trackingNumber] || 0) > 1;
        if (entry.isDuplicate !== currentIsDuplicate) {
          hasChanged = true;
          return { ...entry, isDuplicate: currentIsDuplicate };
        }
        return entry;
      });

      if (hasChanged) {
        return updatedEntries;
      }
      return prevEntries; // Important to return prevEntries if no change
    });
  }, [duplicateCounts, setManifestEntries, setDuplicates]);

  // Match tracking number against reference data
  const matchTrackingToReference = (tracking: string): Pick<ManifestEntry, 'orderId' | 'customerName' | 'isFound'> => {
    const match = referenceData.find(
      item => item.trackingNumber === tracking
    );
    
    return match ? {
      orderId: match.orderId,
      customerName: match.customerName,
      isFound: true
    } : {
      orderId: undefined,
      customerName: undefined,
      isFound: false
    };
  };

  const addTrackingNumber = () => {
    const trimmedNumber = trackingNumber.trim();
    if (!trimmedNumber) return;

    // Update scan counts
    const newScanCount = (duplicateCounts[trimmedNumber] || 0) + 1;
    setDuplicateCounts(prevCounts => ({
      ...prevCounts,
      [trimmedNumber]: newScanCount
    }));

    // Check reference data if loaded
    const referenceMatch = referenceLoaded
      ? matchTrackingToReference(trimmedNumber)
      : { isFound: false, orderId: undefined, customerName: undefined };

    if (newScanCount === 1) { // First time scanning this number
      const newEntry: ManifestEntry = {
        trackingNumber: trimmedNumber,
        timestamp: new Date().toISOString(),
        isEditing: false,
        isDuplicate: false, // Will be updated by useEffect if it becomes a duplicate later
        isSelected: false,
        orderId: referenceMatch.orderId,
        customerName: referenceMatch.customerName,
        isFound: referenceMatch.isFound
      };
      setManifestEntries(prev => [newEntry, ...prev]);
      setMessage(referenceMatch.isFound 
        ? `Added: ${trimmedNumber} (${referenceMatch.customerName})` 
        : `Added: ${trimmedNumber} - Not in reference data`
      );
      setMessageType(referenceMatch.isFound ? 'success' : 'info');
    } else { // Duplicate scan
      setMessage(`Duplicate tracking number: ${trimmedNumber} (Scan count: ${newScanCount})`);
      setMessageType('error');
      // The useEffect depending on duplicateCounts will handle updating isDuplicate flags
      // and the duplicates array.
    }
    
    setTrackingNumber('');
    setTimeout(() => {
      trackingInputRef.current?.focus();
    }, 100);
  };

  // ... (removeEntry, startEditEntry, saveEditEntry, cancelEdit functions remain mostly the same)

  const loadReferenceData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        
        // Skip header if exists
        const headers = lines[0].toLowerCase().split(',');
        const trackingIndex = headers.findIndex(h => 
          h.includes('track') || h.includes('number')
        );
        const orderIdIndex = headers.findIndex(h => 
          h.includes('order') || h.includes('id')
        );
        const nameIndex = headers.findIndex(h => 
          h.includes('name') || h.includes('customer')
        );
        
        const startIndex = trackingIndex >= 0 && orderIdIndex >= 0 ? 1 : 0;
        const newReference: ReferenceData[] = [];
        
        for (let i = startIndex; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length < 3) continue;
          
          const trackingNumber = trackingIndex >= 0 
            ? values[trackingIndex].trim() 
            : values[0].trim();
            
          const orderId = orderIdIndex >= 0 
            ? values[orderIdIndex].trim() 
            : values[1].trim();
            
          const customerName = nameIndex >= 0 
            ? values[nameIndex].trim() 
            : values[2].trim();
          
          newReference.push({
            trackingNumber,
            orderId,
            customerName
          });
        }
        
        setReferenceData(newReference);
        setReferenceLoaded(true);
        setMessage(`Reference data loaded: ${newReference.length} records`);
        setMessageType('success');
        
        // Update existing manifest entries with reference data
        setManifestEntries(prev => 
          prev.map(entry => {
            const match = newReference.find(
              ref => ref.trackingNumber === entry.trackingNumber
            );
            return match 
              ? { ...entry, ...match, isFound: true }
              : { ...entry, isFound: false };
          })
        );
      } catch (error) {
        console.error('Error loading reference data:', error);
        setMessage('Error loading reference CSV. Please check format.');
        setMessageType('error');
      }
      
      // Reset file input
      if (referenceInputRef.current) {
        referenceInputRef.current.value = '';
      }
    };
    
    reader.readAsText(file);
  };

  const resolveDuplicate = (trackingNumToResolve: string) => {
    setDuplicateCounts(prevCounts => ({
      ...prevCounts,
      [trackingNumToResolve]: 1 // Reset scan count to 1
    }));
    // The useEffect hook dependent on duplicateCounts will automatically update
    // the 'duplicates' array and the 'isDuplicate' flag on the manifest entry.
    setMessage(`Duplicate status resolved for ${trackingNumToResolve}.`);
    setMessageType('info');
  };

  const removeEntry = (trackingNumToRemove: string) => {
    setManifestEntries(prevEntries => prevEntries.filter(entry => entry.trackingNumber !== trackingNumToRemove));
    setDuplicateCounts(prevCounts => {
      const newCounts = { ...prevCounts };
      delete newCounts[trackingNumToRemove]; // Remove from scan counts
      return newCounts;
    });
    // Matched/unmatched counts and duplicates list will update via their respective useEffect hooks.
    setMessage(`Entry ${trackingNumToRemove} removed.`);
    setMessageType('info');
  };

  const downloadCSV = () => {
    if (manifestEntries.length === 0) {
      setMessage('No entries to download');
      setMessageType('error');
      return;
    }

    // Create CSV content with only Tracking Numbers
    const csvContent = [
      'Tracking Number', // Header
      ...manifestEntries.map(entry => entry.trackingNumber) // Data rows
    ].join('\n');

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'manifest_tracking_numbers.csv'); // Changed filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setMessage('Manifest CSV downloaded successfully');
    setMessageType('success');
  };

  // ... (other functions remain similar with added reference data checks)

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create Manifest</h2>
      
      <div className="space-y-6 max-w-3xl">
        {/* Reference Data Loader */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-medium text-blue-800 mb-2">
            Reference Data
          </h3>
          <div className="flex items-center justify-between">
            <div>
              {referenceLoaded ? (
                <div className="text-sm text-green-700 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Loaded {referenceData.length} records
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  No reference data loaded. Upload CSV with order details.
                </p>
              )}
            </div>
            <label className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer text-sm">
              <FileInput className="h-4 w-4 mr-2" />
              Load Reference
              <input
                type="file"
                ref={referenceInputRef}
                accept=".csv"
                onChange={loadReferenceData}
                className="hidden"
              />
            </label>
          </div>
          <button
            onClick={downloadCSV}
            className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm mt-2 sm:mt-0 sm:ml-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Manifest
          </button>
        </div>

        {/* Message Display - Assuming it's handled or to be placed by user if needed */}
        {/* {message && messageType && (...)} */}

        {/* Counts Display */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="px-3 py-1 bg-gray-100 rounded-lg text-gray-700 font-medium">Total: <b>{manifestEntries.length}</b></div>
          <div className="px-3 py-1 bg-green-50 rounded-lg text-green-700 font-medium">Matched: <b>{matchedCount}</b></div>
          <div className="px-3 py-1 bg-orange-50 rounded-lg text-orange-700 font-medium">Unmatched: <b>{unmatchedCount}</b></div>
          <div className="px-3 py-1 bg-amber-50 rounded-lg text-amber-700 font-medium">Duplicates: <b>{duplicates.length}</b></div>
        </div>

        {/* Tracking Number Input */}
        <div>
          <label htmlFor="trackingNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Scan Tracking Number
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="trackingNumber"
              ref={trackingInputRef}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              onKeyDown={handleTrackingKeyDown}
              placeholder="Scan or enter tracking number"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
              autoFocus
            />
            <button
              onClick={addTrackingNumber}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
        
        {/* Duplicates Section */}
        {duplicates.length > 0 && (
          <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-amber-800 mb-3">Duplicate Tracking Numbers</h3>
            <div className="space-y-2">
              {duplicates.map((dupTrackingNumber, index) => {
                const entryDetails = manifestEntries.find(entry => entry.trackingNumber === dupTrackingNumber);
                const orderId = entryDetails?.orderId;
                const customerName = entryDetails?.customerName;
                const count = duplicateCounts[dupTrackingNumber] || 0;

                return (
                  <div key={`dup-${index}`} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 rounded border border-amber-300 shadow-sm">
                    <div className="flex items-center mb-1 sm:mb-0">
                      <AlertCircle className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" />
                      <span className="font-mono text-sm text-amber-900 break-all">{dupTrackingNumber}</span>
                      {count > 1 && <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">x{count}</span>}
                    </div>
                    {entryDetails && (orderId || customerName) && (
                      <div className="text-xs text-gray-700 sm:ml-4 mt-1 sm:mt-0 bg-gray-100 px-2 py-1 rounded">
                        {customerName && <span className="font-medium">{customerName}</span>}
                        {orderId && customerName && <span className="mx-1 text-gray-400">|</span>}
                        {orderId && <span>Order: <span className="font-semibold">{orderId}</span></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manifest Entries */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Manifest Entries ({manifestEntries.length})
          </h3>
          
          {manifestEntries.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {manifestEntries.map((entry, index) => (
                <div key={index} className={`flex items-center justify-between p-3 rounded border hover:shadow-sm ${entry.isSelected ? 'bg-blue-50 border-blue-300' : entry.isDuplicate ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                  {/* ... existing checkbox and buttons ... */}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-mono truncate">{entry.trackingNumber}</div>
                    {entry.orderId ? (
                      <div className="text-xs text-gray-600 truncate">
                        {entry.customerName} • {entry.orderId}
                      </div>
                    ) : referenceLoaded ? (
                      <div className="text-xs text-amber-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not found in reference
                      </div>
                    ) : null}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {entry.isDuplicate && (
                      <button
                        onClick={() => resolveDuplicate(entry.trackingNumber)}
                        className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md transition-colors"
                        title="Resolve Duplicate (Mark as not a duplicate)"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                    {/* Edit/Save/Cancel buttons can be added here if needed in the future */}
                    <button
                      onClick={() => removeEntry(entry.trackingNumber)}
                      className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-colors"
                      title="Remove Entry"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
              No entries yet. Scan tracking numbers to add them to the manifest.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Upload icon component (same as before)