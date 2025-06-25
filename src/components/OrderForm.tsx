import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader, FilePlus2 } from 'lucide-react';

// Define product interface
interface Product {
  name: string;
  price: string;
}

// Define product item structure
interface ProductItem {
  productName: string;
  quantity: number;
  price: number;
}

// Define the structure of the form data
interface OrderFormState {
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  products: ProductItem[];
  trackingNumber: string;
  state: string;
  shippingCost: number;
}

// Define the submission status
type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const initialFormState: OrderFormState = {
  orderNumber: '',
  customerName: '',
  phone: '',
  address: '',
  products: [{ productName: '', quantity: 1, price: 0 }],
  trackingNumber: '',
  state: 'Tamil Nadu',
  shippingCost: 50, // Default shipping cost for Tamil Nadu
};

const OrderForm = () => {
  const [formData, setFormData] = useState<OrderFormState>(initialFormState);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Set the next order number when the component mounts and fetch products
  useEffect(() => {
    // Fetch the latest order from the API to determine the next order number
    const fetchLatestOrderNumber = async () => {
      try {
        const response = await fetch('https://backend-n8n.7za6uc.easypanel.host/webhook/karigai_getorder');
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        const ordersData = Array.isArray(result) ? result : result.data || [];
        
        // Find the highest order number
        let highestOrderNum = 1000; // Default starting point
        
        if (ordersData.length > 0) {
          ordersData.forEach((order: { orderNumber?: string }) => {
            if (order.orderNumber) {
              // Extract the numeric part from formats like "ORD-1009"
              const match = order.orderNumber.match(/\d+/);
              if (match) {
                const orderNum = parseInt(match[0], 10);
                if (orderNum > highestOrderNum) {
                  highestOrderNum = orderNum;
                }
              }
            }
          });
        }
        
        // Use the highest order number + 1 for the next order
        const nextOrderNum = highestOrderNum + 1;
        localStorage.setItem('lastOrderNumber', nextOrderNum.toString());
        setFormData(prev => ({ ...prev, orderNumber: `ORD-${nextOrderNum}` }));
      } catch (error) {
        console.error("Failed to fetch latest order number:", error);
        // Fallback to localStorage if API fails
        const lastOrderNum = parseInt(localStorage.getItem('lastOrderNumber') || '1000', 10);
        const nextOrderNum = lastOrderNum + 1;
        setFormData(prev => ({ ...prev, orderNumber: `ORD-${nextOrderNum}` }));
      }
    };
    
    fetchLatestOrderNumber();
    // Fetch products from Google Sheet
    fetchProducts();
  }, []);
  
  // Function to fetch products from Google Sheet
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSS8MG6q7hcUmTtfhSLbsZsBd8zx_ZrSFr-VCvQ9Mt77QH22SUIuG9f3aPFoBFA7H_qUl9onq6B_NLf/pub?gid=0&single=true&output=csv');
      if (!response.ok) {
        throw new Error('Failed to fetch product data');
      }
      
      const csvText = await response.text();
      const products = parseCSV(csvText);
      setProducts(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      setErrorMessage('Failed to load products. Please try again later.');
    } finally {
      setIsLoadingProducts(false);
    }
  };
  
  // Parse CSV data
  const parseCSV = (csvText: string): Product[] => {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];
    
    // Skip the header row and process the rest
    return lines.slice(1).map(line => {
      const [name, price] = line.split(',');
      return { name: name?.trim() || '', price: price?.trim() || '₹0' };
    }).filter(product => product.name); // Filter out any empty rows
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle product field changes
    if (name.startsWith('products[')) {
      // Extract the index and field name from the input name
      // Format: products[0].productName or products[1].quantity
      const matches = name.match(/products\[(\d+)\]\.(.+)/);
      if (matches && matches.length === 3) {
        const index = parseInt(matches[1], 10);
        const field = matches[2];
        
        setFormData(prev => {
          const updatedProducts = [...prev.products];
          
          // If this is a product selection, update price too
          if (field === 'productName') {
            const selectedProduct = products.find(p => p.name === value);
            if (selectedProduct) {
              // Extract numeric price from string like "₹150.00"
              const numericPrice = parseFloat(selectedProduct.price.replace(/[^0-9.]/g, ''));
              updatedProducts[index] = {
                ...updatedProducts[index],
                productName: value,
                price: numericPrice
              };
            } else {
              updatedProducts[index] = {
                ...updatedProducts[index],
                [field]: value
              };
            }
          } else {
            // For quantity, convert to number
            if (field === 'quantity') {
              updatedProducts[index] = {
                ...updatedProducts[index],
                [field]: parseInt(value, 10) || 1
              };
            } else {
              updatedProducts[index] = {
                ...updatedProducts[index],
                [field]: value
              };
            }
          }
          
          return { ...prev, products: updatedProducts };
        });
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Handle bulk text paste
  const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBulkText(e.target.value);
  };
  
  // Parse and extract information from bulk text
  const extractFormData = () => {
    if (!bulkText.trim()) return;
    
    const extractedData: Partial<OrderFormState> = {};
    const text = bulkText.toLowerCase();
    
    // Try to extract customer name (assumed to be after "name:" or at start of text)
    const nameMatch = text.match(/name\s*:\s*([^\n,]+)/i) || 
                     text.match(/^([^\n,]+)/i);
    if (nameMatch && nameMatch[1]) {
      extractedData.customerName = nameMatch[1].trim();
    }
    
    // Try to extract phone (any sequence of 10-12 digits, possibly with separators)
    const phoneMatch = bulkText.match(/(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g);
    if (phoneMatch && phoneMatch[0]) {
      extractedData.phone = phoneMatch[0].replace(/[^0-9]/g, '');
    }
    
    // Try to extract address (assumed to be after "address:" or containing common address terms)
    const addressRegex = /address\s*:\s*([^\n]+(?:\n[^\n]+)*)/i;
    const addressMatch = text.match(addressRegex);
    if (addressMatch && addressMatch[1]) {
      extractedData.address = addressMatch[1].trim();
    } else {
      // Look for common address patterns if no explicit address label
      const lines = bulkText.split('\n');
      const addressLines = lines.filter(line => {
        const l = line.toLowerCase();
        return (l.includes('street') || l.includes('road') || 
                l.includes('avenue') || l.includes('lane') || 
                l.includes('drive') || l.includes('floor') ||
                /\b\d+[a-z]?\s+[a-z\s]+,\s*[a-z\s]+/.test(l));
      });
      
      if (addressLines.length > 0) {
        extractedData.address = addressLines.join('\n');
      }
    }
    
    // Try to find products and quantities
    const extractedProducts: ProductItem[] = [];
    
    // First, look for product names from our list
    for (const product of products) {
      if (text.includes(product.name.toLowerCase())) {
        // Find quantity near this product mention
        const productIndex = text.toLowerCase().indexOf(product.name.toLowerCase());
        const nearbyText = text.substring(Math.max(0, productIndex - 20), Math.min(text.length, productIndex + product.name.length + 30));
        
        // Try to extract quantity for this specific product
        const qtyMatch = nearbyText.match(/(?:qty|quantity|pcs)\s*:?\s*(\d+)/i) || 
                        nearbyText.match(/\b(\d+)\s+(?:qty|piece|pc|pcs)\b/i) ||
                        nearbyText.match(/\b(\d+)\s*x\b/i);
        
        const qty = qtyMatch && qtyMatch[1] ? parseInt(qtyMatch[1], 10) : 1;
        
        // Extract numeric price from string like "₹150.00"
        const numericPrice = parseFloat(product.price.replace(/[^0-9.]/g, ''));
        
        extractedProducts.push({
          productName: product.name,
          quantity: qty,
          price: numericPrice
        });
      }
    }
    
    // If we found products, add them to extracted data
    if (extractedProducts.length > 0) {
      extractedData.products = extractedProducts;
    }
    
    // Update form data with extracted information
    setFormData(prev => ({
      ...prev,
      ...extractedData
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const now = new Date();
      // Calculate total amount including shipping cost
      const subtotal = formData.products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
      const total = subtotal + formData.shippingCost;
      
      const payload = {
        ...formData,
        orderDate: now.toLocaleDateString('en-CA'), // YYYY-MM-DD
        orderTime: now.toLocaleTimeString('en-GB'), // HH:MM:SS
        subtotal: subtotal,
        total: total,
      };

      const response = await fetch('https://backend-n8n.7za6uc.easypanel.host/webhook/karigai_order_creation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      // On success, save the current order number and prepare the next one
      const submittedOrderNumber = formData.orderNumber.replace('ORD-', '');
      localStorage.setItem('lastOrderNumber', submittedOrderNumber);
      
      setStatus('success');
      setTimeout(() => {
        const nextOrderNum = parseInt(submittedOrderNumber, 10) + 1;
        setStatus('idle');
        setFormData({
          ...initialFormState,
          orderNumber: `ORD-${nextOrderNum}`,
        });
      }, 3000);
    } catch (error) {
      setStatus('error');
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unknown error occurred.');
      }
    }
  };

  return (
    <div className="w-full mx-auto p-2 sm:p-4 lg:p-6">
      <div className="bg-white rounded-lg md:rounded-2xl shadow-lg p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8">
          <div className="bg-indigo-100 text-indigo-600 p-2 md:p-3 rounded-full">
            <FilePlus2 size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Create a New Order</h1>
            <p className="text-sm md:text-base text-gray-500">Fill in the details below to create a new order.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Quick Fill Text Area */}
          <div className="mb-6 md:mb-8 p-3 md:p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-base md:text-lg font-semibold text-blue-800 mb-2 md:mb-4">Quick Fill from Text</h2>
            <p className="text-xs md:text-sm text-blue-600 mb-2 md:mb-3">Paste customer details or order information below for automatic extraction.</p>
            <div className="space-y-3 md:space-y-4">
              <textarea 
                placeholder="Paste order information here (name, phone, address, products, quantities)..."
                className="w-full px-3 py-2 md:px-4 md:py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] md:min-h-[120px] text-sm md:text-base"
                value={bulkText}
                onChange={handleBulkTextChange}
              />
              <button
                type="button"
                onClick={extractFormData}
                className="w-full md:w-auto px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
              >
                Extract Information
              </button>
            </div>
          </div>
          
          <div className="space-y-4 md:space-y-6">
            <div>
              <label htmlFor="orderNumber" className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                id="orderNumber"
                value={formData.orderNumber}
                readOnly
                className="w-full px-3 py-2 md:px-4 md:py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-not-allowed text-sm md:text-base"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-8 md:gap-y-6">
              {/* Customer Details */}
              <div className="space-y-3 md:space-y-4 p-3 md:p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-2 md:mb-4">Customer Shipping Details</h2>
                <div>
                  <label htmlFor="customerName" className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" name="customerName" id="customerName" value={formData.customerName} onChange={handleChange} className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base" required />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base" required />
                </div>
                <div>
                  <label htmlFor="address" className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                  <textarea name="address" id="address" rows={3} value={formData.address} onChange={handleChange} className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base" required></textarea>
                </div>
                <div>
                  <label htmlFor="state" className="block text-xs md:text-sm font-medium text-gray-700 mb-1">State</label>
                  <select
                    name="state"
                    id="state"
                    value={formData.state}
                    onChange={(e) => {
                      const selectedState = e.target.value;
                      const shippingCost = selectedState === 'Tamil Nadu' ? 50 : 60;
                      setFormData(prev => ({ ...prev, state: selectedState, shippingCost }))
                    }}
                    className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base"
                    required
                  >
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Bihar">Bihar</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Assam">Assam</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Product & Tracking Details */}
              <div className="space-y-3 md:space-y-4 p-3 md:p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-2 md:mb-4">Product & Tracking</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-md font-medium text-gray-800">Products</h3>
                    <button 
                      type="button" 
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          products: [...prev.products, { productName: '', quantity: 1, price: 0 }]
                        }));
                      }}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-medium"
                    >
                      + Add Product
                    </button>
                  </div>
                  
                  {formData.products.map((product, index) => (
                    <div key={index} className="p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-center mb-2 md:mb-3">
                        <h4 className="text-sm md:text-base font-medium text-gray-700">Product {index + 1}</h4>
                        {formData.products.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                products: prev.products.filter((_, i) => i !== index)
                              }));
                            }}
                            className="text-red-500 hover:text-red-700 text-xs md:text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label htmlFor={`products[${index}].productName`} className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                          {isLoadingProducts ? (
                            <div className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                              <Loader className="animate-spin h-4 w-4 mr-2 text-indigo-500" />
                              <span className="text-gray-500">Loading products...</span>
                            </div>
                          ) : (
                            <select 
                              name={`products[${index}].productName`}
                              id={`products[${index}].productName`}
                              value={product.productName}
                              onChange={handleChange}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              required
                            >
                              <option value="">Select a product</option>
                              {products.map((p, i) => (
                                <option key={i} value={p.name}>
                                  {p.name} - {p.price}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                          <div>
                            <label htmlFor={`products[${index}].quantity`} className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input 
                              type="number" 
                              name={`products[${index}].quantity`} 
                              id={`products[${index}].quantity`} 
                              min="1" 
                              value={product.quantity} 
                              onChange={handleChange} 
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                              required 
                            />
                          </div>
                          <div>
                            <label htmlFor={`products[${index}].price`} className="block text-sm font-medium text-gray-700 mb-1">Price (per item)</label>
                            <input 
                              type="number" 
                              name={`products[${index}].price`} 
                              id={`products[${index}].price`} 
                              min="0" 
                              step="0.01" 
                              value={product.price} 
                              onChange={handleChange} 
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-100" 
                              readOnly 
                            />
                          </div>
                        </div>
                        <div className="text-right text-sm font-medium text-gray-700">
                          Subtotal: ₹{(product.price * product.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {formData.products.length > 0 && (
                    <div className="flex justify-end pt-2">
                      <div className="text-right">
                        <div className="flex flex-col space-y-1">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500 mr-4">Subtotal:</span>
                            <span className="text-sm font-medium text-gray-700">
                              ₹{formData.products.reduce((sum, product) => sum + (product.price * product.quantity), 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500 mr-4">Shipping ({formData.state === 'Tamil Nadu' ? 'Tamil Nadu' : 'Other States'}):</span>
                            <span className="text-sm font-medium text-gray-700">₹{formData.shippingCost.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-gray-200 pt-1 mt-1">
                            <span className="text-sm font-medium text-gray-500 mr-4">Total Order Value:</span>
                            <p className="text-lg font-bold text-indigo-700">
                              ₹{(formData.products.reduce((sum, product) => sum + (product.price * product.quantity), 0) + formData.shippingCost).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="trackingNumber" className="block text-sm font-medium text-gray-700 mb-1">Tracking Number (Optional)</label>
                  <input type="text" name="trackingNumber" id="trackingNumber" value={formData.trackingNumber} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Submission Button & Status Messages */}
          <div className="mt-6 md:mt-8 pt-4 md:pt-5 border-t border-gray-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
              <div className="w-full md:w-1/2">
                {status === 'success' && (
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-green-800">Order submitted successfully!</p>
                      </div>
                    </div>
                  </div>
                )}
                {status === 'error' && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Submission failed</h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>{errorMessage}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full md:w-auto flex justify-center items-center px-6 md:px-8 py-2 md:py-3 border border-transparent text-sm md:text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-all duration-300"
              >
                {status === 'submitting' ? (
                  <><Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> Submitting...</>
                ) : 'Submit Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderForm;
