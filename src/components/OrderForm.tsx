import { useState, useEffect } from 'react';
import { Send, CheckCircle, AlertCircle, Clock, ClipboardList, ChevronLeft, ChevronRight, Trash2, Printer } from 'lucide-react';
import { addOrder } from '../services/orderService';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

interface WebhookResponse {
  [key: string]: string | number | boolean | null | WebhookResponse | Array<string | number | boolean | null | WebhookResponse>;
}

interface OrderEntry {
  orderNumber: string;
  timestamp: string;
  status: 'success' | 'error';
  responseData?: WebhookResponse;
}

export default function OrderForm() {
  // State for selected orders (for bulk printing)
  const [selectedOrders, setSelectedOrders] = useState<{[key: string]: boolean}>({});
  
  // State for batch processing
  const [orderQueue, setOrderQueue] = useState<string[]>([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(-1);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{total: number, completed: number, success: number, failed: number}>({ 
    total: 0, 
    completed: 0, 
    success: 0, 
    failed: 0 
  });
  
  // State for JSON preview
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<string[]>([]);
  
  // Toggle selection of an order for bulk printing
  const toggleOrderSelection = (orderIndex: number) => {
    const indexKey = orderIndex.toString();
    setSelectedOrders(prev => ({
      ...prev,
      [indexKey]: !prev[indexKey]
    }));
  };
  
  // Check if any orders are selected
  const hasSelectedOrders = () => Object.values(selectedOrders).some(selected => selected);
  
  // Print all selected orders across all pages
  const printSelectedOrders = () => {
    // Get all selected orders from the entire order history, not just current page
    const selectedOrdersList = orderHistory.filter((_, index) => selectedOrders[index.toString()]);
    
    if (selectedOrdersList.length === 0) {
      alert('Please select at least one order to print');
      return;
    }
    
    // Create input text for all selected orders
    const slipInputs = selectedOrdersList.map(order => {
      const data = order.responseData || {};
      
      // Format date as DD-MM-YYYY
      const orderDate = new Date(order.timestamp);
      const formattedDate = `${orderDate.getDate().toString().padStart(2, '0')}-${(orderDate.getMonth() + 1).toString().padStart(2, '0')}-${orderDate.getFullYear()}`;
      
      const status = data.status || 'processing';
      const orderId = data.order_number || order.orderNumber;
      const qty = data.quantity || '1';
      const mode = 'Manual';
      const address = data.address || '-';
      const customerName = data.customer_name || '-';
      const phone = data.phone || '';
      
      // Combine the address and phone in the format expected by PrintSlip
      const addressWithPhone = `${customerName}, ${address}  Phone ${phone}`;
      
      // Create the formatted input string
      return `${status}\t${formattedDate}\t${orderId}\t${qty}\t\t${mode}\t${addressWithPhone}`;
    }).join('\n');
    
    // Generate and print all slips
    generateAndPrintSlip(slipInputs);
    
    // Clear selections after printing
    setSelectedOrders({});
  };
  
  // Clear all selections
  const clearSelections = () => {
    setSelectedOrders({});
  };
  
  // Select all orders across all pages
  const selectAllOrders = () => {
    const newSelections: {[key: string]: boolean} = {};
    orderHistory.forEach((_, index) => {
      newSelections[index.toString()] = true;
    });
    setSelectedOrders(newSelections);
  };
  
  // Check if all orders across all pages are selected
  const areAllOrdersSelected = () => {
    return orderHistory.length > 0 && orderHistory.every((_, index) => selectedOrders[index.toString()]);
  };

  // Function to print shipping slip for an order
  const printShippingSlip = (order: OrderEntry) => {
    const data = order.responseData || {};
    if (!data.order_number && !order.orderNumber) {
      alert('Cannot print slip: Missing order number');
      return;
    }
    
    // Format date as DD-MM-YYYY
    const orderDate = new Date(order.timestamp);
    const formattedDate = `${orderDate.getDate().toString().padStart(2, '0')}-${(orderDate.getMonth() + 1).toString().padStart(2, '0')}-${orderDate.getFullYear()}`;
    
    // Create the formatted input string for the slip generator
    // Format: status\tdate\torderID\tqty\t\tmode\taddress with Phone number
    const status = data.status || 'processing';
    const orderId = data.order_number || order.orderNumber;
    const qty = data.quantity || '1';
    const mode = 'Manual';
    const address = data.address || '-';
    const customerName = data.customer_name || '-';
    const phone = data.phone || '';
    
    // Combine the address and phone in the format expected by PrintSlip
    const addressWithPhone = `${customerName}, ${address}  Phone ${phone}`;
    
    // Create the formatted input string
    const slipInput = `${status}\t${formattedDate}\t${orderId}\t${qty}\t\t${mode}\t${addressWithPhone}`;
    
    // Generate and print the slip
    generateAndPrintSlip(slipInput);
  };
  
  // Function to generate and print shipping slip
  const generateAndPrintSlip = (inputText: string) => {
    const lines = inputText.split('\n');
    let outputHtml = '';

    const fromAddress = `TSMC Creations India\n14/5 2nd Floor, Sri Saara Towers,\nBalasundaram Road, Paapanaickenpalayam,\nCoimbatore, Tamil Nadu - 641037\nPhone: 8610554711`;

    lines.forEach((line) => {
      const parts = line.split('\t');
      if (parts.length < 7) return;

      const date = parts[1];
      const orderId = parts[2];
      const qty = parts[3] || '1';
      const mode = parts[5];
      const toRaw = parts.slice(6).join(' ');
      const phoneMatch = toRaw.match(/Phone\s*=?\s*(\d+)/i);
      const phone = phoneMatch ? phoneMatch[1] : '';
      const toAddress = toRaw.replace(/Phone\s*=?\s*\d+/i, '').trim();
      
      // Calculate weight based on quantity (450g per packet)
      const singlePacketWeight = 450; // in grams
      const totalWeightGrams = parseInt(qty) * singlePacketWeight;
      const totalWeightKg = (totalWeightGrams / 1000).toFixed(2) + ' KG';

      const html = `
        <div class="slip">
          <div class="slip-header">
            <div class="ship-to" style="width: 100%; border-right: none;">
              <div class="ship-to-label">SHIP TO:</div>
              <div class="address">${toAddress}\n${phone ? `<span class="phone-highlight">${phone}</span>` : ''}</div>
            </div>
          </div>
          
          <div class="slip-details">
            <div class="details-left">
              <div class="detail-row">
                <div class="detail-label">ORDER ID:</div>
                <div class="detail-value">${orderId}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">WEIGHT:</div>
                <div class="detail-value">${totalWeightKg} (${qty} × 450g)</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">DIMENSIONS:</div>
                <div class="detail-value">-</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">SHIPPING DATE:</div>
                <div class="detail-value">${date}</div>
              </div>
            </div>
            <div class="details-right">
              <div class="remarks">
                <div class="remarks-label">REMARKS:</div>
                <div>Mode: ${mode} | Qty: ${qty}</div>
              </div>
            </div>
          </div>
          
          <div class="barcode-container">
            <div class="barcode-column">
              <svg class="barcode" jsbarcode-format="code128" jsbarcode-value="${orderId}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold"></svg>
            </div>
            <div class="from-column">
              <div class="from-label" style="margin-bottom: 5px;">FROM:</div>
              <img src="https://aurawill.in/cdn/shop/files/White-label.png?v=1741582343&width=200" style="height: 50px; object-fit: contain; margin-bottom: 10px;" alt="Aurawill Logo" />
              <div class="address" style="font-size: 14px;">${fromAddress}</div>
            </div>
          </div>
        </div>
      `;
      outputHtml += html;
    });
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print shipping slips');
      return;
    }
    
    // Write the HTML content to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shipping Slip</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .slip {
              width: 100%;
              max-width: 800px;
              margin: 0 auto 20px;
              border: 2px solid #000;
              background: white;
              page-break-after: always;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .slip-header {
              display: flex;
              border-bottom: 2px solid #000;
            }
            .ship-to, .ship-from {
              padding: 20px;
              width: 50%;
            }
            .ship-to {
              border-right: 2px solid #000;
            }
            .ship-to-label, .ship-from-label, .from-label {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
              color: #555;
            }
            .address {
              white-space: pre-line;
              line-height: 1.5;
            }
            .slip-details {
              display: flex;
              border-bottom: 2px solid #000;
            }
            .details-left {
              width: 60%;
              padding: 20px;
              border-right: 2px solid #000;
            }
            .details-right {
              width: 40%;
            }
            .detail-row {
              display: flex;
              margin-bottom: 15px;
            }
            .detail-row:last-child {
              margin-bottom: 0;
            }
            .detail-label {
              width: 40%;
              font-weight: bold;
              font-size: 16px;
              color: #555;
            }
            .detail-value {
              width: 60%;
              font-size: 16px;
            }
            .remarks {
              padding: 10px 20px;
              min-height: 100px;
            }
            .remarks-label {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
              color: #555;
            }
            .barcode-container {
              padding: 20px;
              border-top: 2px solid #000;
              display: flex;
            }
            .barcode-column {
              width: 55%;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .from-column {
              width: 45%;
              text-align: left;
              padding-left: 20px;
              border-left: 1px solid #ddd;
            }
            .phone-highlight {
              background-color: #ffff00;
              padding: 2px 5px;
              font-weight: bold;
              border-radius: 3px;
            }
            .barcode {
              width: 90%;
              max-height: 120px;
            }
            @media print {
              body {
                background: white;
              }
              .slip {
                margin: 0;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div id="output">${outputHtml}</div>
          <script>
            window.onload = function() {
              JsBarcode(".barcode").init();
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [orderNumber, setOrderNumber] = useState('');
  const [orderInput, setOrderInput] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderHistory, setOrderHistory] = useState<OrderEntry[]>([]);
  const [responseData, setResponseData] = useState<WebhookResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;

  useEffect(() => {
    const savedOrders = localStorage.getItem('orderHistory');
    if (savedOrders) {
      try {
        setOrderHistory(JSON.parse(savedOrders));
      } catch (err) {
        console.error('Error parsing order history:', err);
      }
    }
  }, []);

  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orderHistory.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(orderHistory.length / ordersPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const clearOrderHistory = () => {
    if (window.confirm('Are you sure you want to clear all order history?')) {
      setOrderHistory([]);
      localStorage.removeItem('orderHistory');
    }
  };

  const saveOrder = async (entry: OrderEntry) => {
    const updatedHistory = [entry, ...orderHistory].slice(0, 10); 
    setOrderHistory(updatedHistory);
    localStorage.setItem('orderHistory', JSON.stringify(updatedHistory));
    
    // If the order was successful, add it to the shared order list
    if (entry.status === 'success' && entry.responseData) {
      try {
        // Add the order to the shared order service (now async with Supabase)
        await addOrder({
          ...entry.responseData,
          orderNumber: entry.orderNumber
        });
      } catch (error) {
        console.error('Error adding order to Supabase:', error);
        // Continue with the flow even if Supabase fails
      }
    }
  };
  
  // Delete a specific order from history
  const deleteOrder = (orderIndex: number) => {
    // Get the actual index in the full orderHistory array
    const actualIndex = indexOfFirstOrder + orderIndex;
    
    // Create a new array without the deleted order
    const updatedHistory = [...orderHistory];
    updatedHistory.splice(actualIndex, 1);
    
    // Update state and localStorage
    setOrderHistory(updatedHistory);
    localStorage.setItem('orderHistory', JSON.stringify(updatedHistory));
    
    // Clear selection for the deleted order
    const newSelections = {...selectedOrders};
    delete newSelections[orderIndex];
    setSelectedOrders(newSelections);
    
    // Adjust current page if needed
    if (currentOrders.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Process a single order from the queue
  const processNextOrder = async () => {
    // Check if we're done processing all orders
    if (orderQueue.length === 0) {
      // Batch processing complete
      setIsBatchProcessing(false);
      setCurrentOrderIndex(-1);
      setOrderNumber('');
      setStatus('idle');
      console.log('Batch processing complete');
      return;
    }
    
    // Take the first order from the queue
    const currentOrderNumber = orderQueue[0];
    console.log('Processing order:', currentOrderNumber, 'Queue length:', orderQueue.length);
    
    // Update UI state
    setOrderNumber(currentOrderNumber);
    setCurrentOrderIndex(batchProgress.completed);
    setStatus('submitting');
    
    try {
      // Process the current order with JSON format
      const payload = { 
        Order: currentOrderNumber,
        isJsonFormat: true
      };
      
      const response = await fetch('https://auto-n8n.9krcxo.easypanel.host/webhook/cbf01aea-9be4-4cba-9b1c-0a0367a6f823', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setResponseData(data);
      setStatus('success');
      setErrorMessage('');
      
      // Save the order
      await saveOrder({
        orderNumber: currentOrderNumber,
        timestamp: new Date().toISOString(),
        status: 'success',
        responseData: data
      });
      
      // Update batch progress
      setBatchProgress(prev => ({
        ...prev,
        completed: prev.completed + 1,
        success: prev.success + 1
      }));
    } catch (error) {
      console.error('Submission error:', error);
      setStatus('error');
      setErrorMessage(`Failed to submit order ${currentOrderNumber}. Continuing with next order...`);
      
      // Save the failed order
      await saveOrder({
        orderNumber: currentOrderNumber,
        timestamp: new Date().toISOString(),
        status: 'error'
      });
      
      // Update batch progress
      setBatchProgress(prev => ({
        ...prev,
        completed: prev.completed + 1,
        failed: prev.failed + 1
      }));
    } finally {
      // Remove the processed order from the queue
      setOrderQueue(prevQueue => {
        const newQueue = [...prevQueue];
        newQueue.shift(); // Remove the first item
        console.log('Updated queue:', newQueue);
        return newQueue;
      });
      
      // Wait before processing the next order
      setTimeout(() => {
        setStatus('idle');
        processNextOrder();
      }, 1500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get the order input and clean it
    const input = orderInput.trim();
    
    if (!input) {
      setErrorMessage('Please enter at least one order number');
      setStatus('error');
      return;
    }
    
    // Check if there are comma-separated values
    if (input.includes(',')) {
      // Split by comma and clean each order number
      const orderNumbers = input.split(',').map(num => num.trim()).filter(num => num !== '');
      
      // Remove any duplicates
      const uniqueOrderNumbers = [...new Set(orderNumbers)];
      
      if (uniqueOrderNumbers.length === 0) {
        setErrorMessage('Please enter valid order numbers');
        setStatus('error');
        return;
      }
      
      // Show preview of the JSON conversion
      setPreviewData(uniqueOrderNumbers);
      setShowPreview(true);
      
      // Clear the input field
      setOrderInput('');
      
      // Don't start processing yet - wait for user confirmation
      return;
      
    } else {
      // Check if it might be JSON format (starts with [ and ends with ])
      if (input.trim().startsWith('[') && input.trim().endsWith(']')) {
        try {
          // Try to parse as JSON
          const orderArray = JSON.parse(input.trim());
          if (Array.isArray(orderArray) && orderArray.length > 0) {
            // Valid JSON array, set up batch processing
            const validOrders = orderArray.map(item => String(item).trim()).filter(item => item !== '');
            const uniqueOrders = [...new Set(validOrders)];
            
            // Set up batch processing
            setOrderQueue(uniqueOrders);
            setCurrentOrderIndex(-1);
            setIsBatchProcessing(true);
            setBatchProgress({
              total: uniqueOrders.length,
              completed: 0,
              success: 0,
              failed: 0
            });
            
            // Start processing
            setTimeout(() => processNextOrder(), 100);
            setOrderInput('');
            return;
          }
        } catch (error) {
          // Not valid JSON, continue with single order processing
          console.log('Invalid JSON format, processing as single order:', error);
        }
      }
      
      // Single order processing
      setOrderNumber(input);
      setOrderInput('');
      
      const payload = { 
        Order: input,
        isJsonFormat: true
      };
      
      try {
        setStatus('submitting');
        
        const response = await fetch('https://auto-n8n.9krcxo.easypanel.host/webhook/cbf01aea-9be4-4cba-9b1c-0a0367a6f823', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setResponseData(data);
        setStatus('success');
        setErrorMessage('');
        
        await saveOrder({
          orderNumber: input,
          timestamp: new Date().toISOString(),
          status: 'success',
          responseData: data
        });
        
        setTimeout(() => {
          setStatus('idle');
          setOrderNumber('');
        }, 3000);
        
      } catch (error) {
        console.error('Submission error:', error);
        setStatus('error');
        setErrorMessage('Failed to submit order. Please try again.');
        
        await saveOrder({
          orderNumber: input,
          timestamp: new Date().toISOString(),
          status: 'error'
        });
      }
    }
  };

  // State variables are already declared at the top of the component

  return (
    <div className="space-y-6 max-w-full">
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label 
              htmlFor="orderInput" 
              className="block text-sm font-medium text-gray-700"
            >
              Order Number
            </label>
            <input
              type="text"
              id="orderInput"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="Enter order numbers"
              disabled={isBatchProcessing || status === 'submitting' || showPreview}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none"
              aria-describedby={errorMessage ? "error-message" : undefined}
            />
            {errorMessage && (
              <p id="error-message" className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={14} />
                {errorMessage}
              </p>
            )}
          </div>
          
          {/* JSON Preview Section */}
          {showPreview && (
            <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-medium text-blue-800 mb-2">JSON Preview</h3>
              <p className="text-sm text-blue-700 mb-3">The following orders will be processed:</p>
              <pre className="bg-white p-3 rounded border border-blue-200 text-sm overflow-auto max-h-60 mb-4">
                {JSON.stringify(previewData, null, 2)}
              </pre>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewData([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  onClick={() => {
                    // Start batch processing
                    setShowPreview(false);
                    setOrderQueue(previewData);
                    setCurrentOrderIndex(-1);
                    setIsBatchProcessing(true);
                    setBatchProgress({
                      total: previewData.length,
                      completed: 0,
                      success: 0,
                      failed: 0
                    });
                    setTimeout(() => processNextOrder(), 100);
                  }}
                >
                  Process Orders
                </button>
              </div>
            </div>
          )}
          
          {isBatchProcessing && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-700 mb-2">Batch Processing</h4>
              <div className="flex justify-between text-xs text-blue-600 mb-1">
                <span>Processing order {currentOrderIndex + 1} of {batchProgress.total}</span>
                <span>
                  {batchProgress.completed}/{batchProgress.total} completed 
                  ({batchProgress.success} success, {batchProgress.failed} failed)
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium">Current order: </span>
                {orderNumber || 'Preparing next order...'}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={!orderInput || isBatchProcessing || status === 'submitting' || showPreview}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-medium transition-all duration-300 ${
              status === 'success' 
                ? 'bg-green-500 hover:bg-green-600' 
                : status === 'error'
                ? 'bg-red-500 hover:bg-red-600'
                : status === 'submitting'
                ? 'bg-blue-400 cursor-not-allowed'
                : isBatchProcessing || showPreview
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {status === 'submitting' ? (
              <>
                <Clock className="animate-pulse" size={18} />
                Processing...
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle size={18} />
                Order Submitted
              </>
            ) : status === 'error' ? (
              <>
                <AlertCircle size={18} />
                Try Again
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Order
              </>
            )}
          </button>
        </form>
        
        {status === 'success' && responseData && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 animate-fade-in flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
              <p>
                <span className="font-medium block">Order successfully submitted!</span>
                <span className="text-sm">Order #{orderNumber} has been received.</span>
              </p>
            </div>
            
            <div className="mt-3 pt-3 border-t border-green-200">
              <h3 className="font-medium text-sm mb-2">Order Details:</h3>
              <div className="bg-white p-4 rounded border border-green-200 shadow-sm">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500 font-medium">Order Number</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.order_number || orderNumber)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Order ID</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.order_id || '-')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Customer</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.customer_name || '-')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Phone</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.phone || '-')}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500 font-medium">Address</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.address || '-')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Product</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.product || '-')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Quantity</dt>
                    <dd className="font-semibold text-gray-900">{String(responseData.quantity || '-')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Status</dt>
                    <dd className="font-semibold text-gray-900 capitalize">{String(responseData.status || '-')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Price</dt>
                    <dd className="font-semibold text-gray-900">₹{String(responseData.price || '-')}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>

      {orderHistory.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 w-full overflow-visible">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Selection Controls */}
              <div className="flex items-center mr-2">
                <input
                  type="checkbox"
                  id="select-all-orders"
                  checked={areAllOrdersSelected()}
                  onChange={areAllOrdersSelected() ? clearSelections : selectAllOrders}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  disabled={orderHistory.length === 0}
                />
                <label htmlFor="select-all-orders" className="ml-2 text-sm text-gray-700">
                  Select All
                </label>
              </div>
              
              {/* Action Buttons */}
              {hasSelectedOrders() && (
                <>
                  <button
                    onClick={printSelectedOrders}
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md flex items-center gap-1"
                  >
                    <Printer size={14} />
                    Print Selected
                  </button>
                  <button
                    onClick={clearSelections}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                  >
                    Clear Selection
                  </button>
                </>
              )}
              <button 
                onClick={clearOrderHistory}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <Trash2 size={14} />
                Clear History
              </button>
            </div>
          </div>
          
          {/* Horizontal Card Layout for All Screen Sizes */}
          <div className="space-y-3 w-full">
            {currentOrders.map((order, index) => {
              const data = order.responseData || {};
              return (
                <div key={index} className={`border ${selectedOrders[index.toString()] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 w-full`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`order-select-${index}`}
                        checked={!!selectedOrders[index.toString()]}
                        onChange={() => toggleOrderSelection(index)}
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`order-select-${index}`} className="ml-2 text-sm text-gray-700 cursor-pointer">
                        {order.status === 'success' ? `Order #${data.order_number || order.orderNumber}` : 'Failed Order'}
                      </label>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this order from history?')) {
                          deleteOrder(index);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete this order"
                      aria-label="Delete order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center">
                    {/* Order Header - Always at the top/left */}
                    <div className="md:w-1/4 pr-4">
                      <div className="flex justify-between md:flex-col md:justify-start">
                        <div>
                          <div className="font-medium text-gray-900">Order #{String(data.order_number || order.orderNumber)}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock size={12} />
                            {new Date(order.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs md:mt-2 ${
                          order.status === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {order.status === 'success' ? (
                            <CheckCircle size={12} />
                          ) : (
                            <AlertCircle size={12} />
                          )}
                          {order.status === 'success' ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      
                      <div className="mt-2 md:mt-3">
                        <div className="text-xs text-gray-500 mb-1">Customer</div>
                        <div className="font-medium text-gray-800 text-sm">{String(data.customer_name || '-')}</div>
                      </div>
                    </div>
                    
                    {/* Divider - Vertical for desktop, Horizontal for mobile */}
                    <div className="hidden md:block md:w-px md:bg-gray-200 md:h-full md:mx-3"></div>
                    <div className="md:hidden my-2 border-t border-gray-200"></div>
                    
                    {/* Order Details - Middle section */}
                    <div className="md:flex-1">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="col-span-2 md:col-span-3">
                          <div className="text-xs text-gray-500 mb-1">Product</div>
                          <div className="font-medium text-gray-800 text-sm truncate" title={String(data.product || '-')}>
                            {String(data.product || '-')}
                          </div>
                        </div>
                        
                        <div className="col-span-2 md:col-span-3">
                          <div className="text-xs text-gray-500 mb-1">Address</div>
                          <div className="font-medium text-gray-800 break-words text-sm">{String(data.address || '-')}</div>
                        </div>
                        
                        {data.phone && (
                          <div className="col-span-2 md:col-span-3">
                            <div className="text-xs text-gray-500 mb-1">Phone</div>
                            <div className="font-medium text-gray-800 text-sm">{String(data.phone)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Order Metrics - Right section */}
                    <div className="md:w-1/6 md:pl-3 mt-2 md:mt-0">
                      <div className="flex justify-between md:flex-col md:space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Quantity</div>
                          <div className="font-medium text-gray-800 text-sm">{String(data.quantity || '-')}</div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Price</div>
                          <div className="font-medium text-gray-800 text-sm">{data.price ? `₹${String(data.price)}` : '-'}</div>
                        </div>
                        
                        {/* Print Slip Button */}
                        <div className="mt-3 md:mt-4">
                          <button
                            onClick={() => printShippingSlip(order)}
                            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                            title="Print shipping slip for this order"
                          >
                            <Printer size={16} />
                            Print Slip
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 gap-2">
              <button 
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                <button
                  key={number}
                  onClick={() => paginate(number)}
                  className={`w-8 h-8 rounded-full ${currentPage === number ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {number}
                </button>
              ))}
              
              <button 
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 text-center w-full">
          <div className="flex flex-col items-center justify-center py-8">
            <ClipboardList size={48} className="text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-500 mb-2">No Orders Yet</h3>
            <p className="text-gray-500 max-w-sm">Submit an order number above to see your order history here.</p>
          </div>
        </div>
      )}
    </div>
  );
}