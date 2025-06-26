import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import { ListOrdered, ServerCrash, Loader, Printer, Calendar, FilterX, Grid2X2, Grid, LayoutGrid } from 'lucide-react';

// Define product item structure
interface ProductItem {
  productName: string;
  quantity: number;
  price: number;
}

// Define the structure of a single order from the API
export interface Order {
  row_number: number;
  Date: string;
  Time: string;
  orderNumber: string;
  customerName: string;
  phone: number | string;
  address: string;
  productName?: string; // Legacy field, may still exist in older orders
  quantity?: number;     // Legacy field, may still exist in older orders
  price?: number;        // Legacy field, may still exist in older orders
  products?: ProductItem[] | string; // Can be array of products or JSON string
  product?: string; // New field from API response
  trackingNumber: number | string;
  state?: string;
  shippingCost?: number;
  shipping_cost?: number; // API field for shipping cost
  subtotal?: number;
  total?: number;
}

// Layout options for printing
type LayoutOption = 1 | 2 | 4 | 6;

// 1. Printable Slip Component
// This component is what will actually be printed.
// It's designed to be roughly 4x4 inches.
const PrintableSlip = forwardRef<HTMLDivElement, { orders: Order[], layout: LayoutOption }>(({ orders, layout }, ref) => {
  if (!orders || orders.length === 0) {
    return null;
  }

  // Define grid layout based on number of slips per page
  const getGridStyles = () => {
    switch (layout) {
      case 2: return 'grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8';
      case 4: return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 sm:gap-6';
      case 6: return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4';
      default: return '';
    }
  };

  // Calculate slip size based on layout
  const getSlipStyles = () => {
    switch (layout) {
      case 1: return 'w-full sm:w-[4in] min-h-[6in] p-2 sm:p-4 break-after-page';
      case 2: return 'w-full sm:w-[3.5in] min-h-[4in] p-2 sm:p-3';
      case 4: return 'w-full sm:w-[3.3in] min-h-[3.8in] p-1 sm:p-2';
      case 6: return 'w-full sm:w-[2.3in] min-h-[3.5in] p-1';
      default: return 'w-full sm:w-[4in] min-h-[6in] p-2 sm:p-4';
    }
  };

  // Group orders by page based on layout
  const groupOrdersByPage = () => {
    const groupedOrders = [];
    for (let i = 0; i < orders.length; i += layout) {
      groupedOrders.push(orders.slice(i, i + layout));
    }
    return groupedOrders;
  };

  const groupedOrders = layout === 1 ? [[...orders]] : groupOrdersByPage();
  
  return (
    <div ref={ref} className="printable-area">
      {groupedOrders.map((pageOrders, pageIndex) => (
        <div key={pageIndex} className={`${getGridStyles()} page break-after-page mb-10 p-2 sm:p-4 print:p-4`}>
          {pageOrders.map((order) => (
            <div key={order.row_number} className={`${getSlipStyles()} border-2 border-black flex flex-col font-sans text-xs overflow-hidden mb-6 sm:mb-0 mx-auto`}>
          
          {/* Top Section: Tracking Info */}
          <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
            <div className="text-left">
              <p className="font-bold text-xs">KARIGAI TRACKING #:</p>
              <p className="text-sm font-bold">{order.trackingNumber || 'N/A'}</p>
            </div>
            <div className="text-right">
              {order.trackingNumber ? (
                <Barcode value={String(order.trackingNumber)} height={35} width={1.2} fontSize={9} />
              ) : (
                <div className="w-[100px] h-[35px] border border-dashed flex items-center justify-center text-gray-400 text-xs">
                  No Tracking
                </div>
              )}
            </div>
          </div>

          {/* Middle Section */}
          <div className="flex-grow flex flex-col">
            {/* To Address */}
            <div className="mb-1">
              <p className="font-bold text-xs md:text-sm">TO:</p>
              <div className="pl-2">
                <p className="font-semibold text-xs md:text-sm">{order.customerName}</p>
                <p className="text-xs md:text-sm leading-tight">{order.address}</p>
                <p className="text-xs md:text-sm">Phone: {order.phone}</p>
              </div>
            </div>

            {/* Product Details */}
            <div className="border-t border-b border-dashed py-1 my-1">
              <table className="w-full text-xs md:text-sm">
                <tbody>
                  {/* Parse products if they exist, otherwise fall back to legacy fields */}
                  {(() => {
                    let productItems: ProductItem[] = [];
                    let subtotal = 0;
                    
                    // Handle different product data formats
                    if (order.products) {
                      try {
                        if (typeof order.products === 'string') {
                          productItems = JSON.parse(order.products);
                        } else {
                          productItems = order.products as ProductItem[];
                        }
                      } catch (e) {
                        console.error('Error parsing products:', e);
                      }
                    } else if (order.product) {
                      try {
                        // Try parsing as array first
                        if (order.product.trim().startsWith('[')) {
                          productItems = JSON.parse(order.product);
                        } else {
                          // Try parsing as single product object
                          const singleProduct = JSON.parse(order.product);
                          productItems = [singleProduct];
                        }
                      } catch (e) {
                        console.error('Error parsing product:', e);
                      }
                    } else if (order.productName) {
                      // Legacy format
                      productItems = [{
                        productName: order.productName,
                        quantity: order.quantity || 1,
                        price: order.price || 0
                      }];
                    }
                    
                    // Calculate subtotal
                    subtotal = productItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    
                    return (
                      <>
                        {/* Product list */}
                        {productItems.map((item, index) => (
                          <React.Fragment key={index}>
                            <tr>
                              <td className="py-0.5 md:py-1" colSpan={2}>
                                <span className="font-semibold">{item.productName}</span>
                                <span className="text-gray-600"> × {item.quantity}</span>
                              </td>
                            </tr>
                            <tr className="border-b border-dotted">
                              <td></td>
                              <td className="py-0.5 md:py-1 text-right">₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                        
                        {/* Summary */}
                        <tr>
                          <td className="py-0.5 md:py-1">Subtotal:</td>
                          <td className="py-0.5 md:py-1 text-right">₹{order.subtotal || subtotal}</td>
                        </tr>
                        <tr>
                          <td className="py-0.5 md:py-1">Shipping:</td>
                          <td className="py-0.5 md:py-1 text-right">₹{order.shipping_cost || order.shippingCost || 0}</td>
                        </tr>
                        <tr>
                          <td className="py-0.5 md:py-1 font-bold">Total:</td>
                          <td className="py-0.5 md:py-1 text-right font-bold">₹{order.total || ((order.subtotal || subtotal) + (order.shipping_cost || order.shippingCost || 0))}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Order ID */}
            <div className="text-center mt-1 mb-1 flex flex-col items-center justify-center">
              <p className="text-xs md:text-sm font-semibold">ORDER #</p>
              <div className="flex justify-center w-full">
                <Barcode value={order.orderNumber} height={30} width={1} fontSize={8} />
              </div>
            </div>
          </div>

          {/* Bottom Section: From Address */}
          <div className="border-t border-black pt-1 mt-auto text-[0.65rem] md:text-xs text-center">
            <p className="font-bold pb-0.5 md:pb-1">FROM: Karigai Shree</p>
            <p className="leading-tight pb-0.5 md:pb-1">Old busstand, Salem, Tamil Nadu, India - 636001</p>
            <p className="leading-tight pb-0.5 md:pb-1">Ph: +91 9486054899 | Email: karigaishree@gmail.com</p>
          </div>
        </div>
        ))}
      </div>
      ))}
    </div>
  );
});

// 2. Main Order List Component
const OrderList = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [filterDate, setFilterDate] = useState<string>('');
  const [ordersToPrint, setOrdersToPrint] = useState<Order[]>([]);
  const [printLayout, setPrintLayout] = useState<LayoutOption>(1);

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch orders from the API
  useEffect(() => {
    const fetchOrders = async () => {
      setStatus('loading');
      try {
        const response = await fetch('https://backend-n8n.7za6uc.easypanel.host/webhook/karigai_getorder');
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        // The API might return an object with a 'data' property which is the array
        const ordersData: Order[] = Array.isArray(result) ? result : result.data || [];
        
        // Log the first order to debug
        if (ordersData.length > 0) {
          console.log('First order data:', ordersData[0]);
          console.log('Product data type:', typeof ordersData[0].product);
          if (ordersData[0].product) {
            try {
              console.log('Parsed product:', JSON.parse(ordersData[0].product));
            } catch (e) {
              console.log('Could not parse product:', e);
            }
          }
        }
        
        const sortedOrders = ordersData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
        setOrders(sortedOrders);
        setFilteredOrders(sortedOrders);
        setStatus('success');
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        setStatus('error');
      }
    };
    fetchOrders();
  }, []);

  // Apply date filter
  useEffect(() => {
    if (!filterDate) {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.Date === filterDate));
    }
  }, [filterDate, orders]);

  // Hook for printing
  const handlePrint = useReactToPrint({
    documentTitle: 'Order-Slips',
    pageStyle: `@media print {
      .break-after-page {
        page-break-after: always;
      }
      @page {
        size: auto;
        margin: 0.8cm;
      }
      .printable-area {
        width: 100%;
        height: 100%;
      }
      .page {
        margin-bottom: 1cm;
      }
      /* Prevent text overflow */
      p, td {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* Scale barcodes appropriately */
      svg {
        max-width: 100%;
      }
    }`
  });

  const triggerPrint = (selectedOrders: Order[]) => {
    if (selectedOrders.length === 0) return;
    setOrdersToPrint(selectedOrders);
    // This timeout ensures the state is updated before printing
        setTimeout(() => {
      if (printRef.current) {
        handlePrint(() => printRef.current);
      } else {
        console.error('Printable content not found.');
      }
    }, 100);
  };

  if (status === 'loading') {
    return <div className="flex justify-center items-center p-8"><Loader className="animate-spin mr-2" /> Loading orders...</div>;
  }

  if (status === 'error') {
    return <div className="flex justify-center items-center p-8 text-red-500"><ServerCrash className="mr-2" /> Failed to load orders. Please check the console for details.</div>;
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="bg-white rounded-lg md:rounded-2xl shadow-lg p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="bg-indigo-100 text-indigo-600 p-2 md:p-3 rounded-full">
              <ListOrdered size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Order History</h1>
              <p className="text-sm md:text-base text-gray-500">View, filter, and print past orders.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
            <div className="flex items-center mr-1 md:mr-2">
              <span className="text-xs md:text-sm text-gray-700 mr-1 md:mr-2">Layout:</span>
              <div className="flex items-center bg-gray-100 rounded-lg">
                <button
                  onClick={() => setPrintLayout(1)}
                  className={`flex items-center justify-center p-2 ${printLayout === 1 ? 'bg-indigo-600 text-white' : 'text-gray-700'} rounded-l-lg`}
                  title="1 per page"
                >
                  <Printer size={18} />
                </button>
                <button
                  onClick={() => setPrintLayout(2)}
                  className={`flex items-center justify-center p-2 ${printLayout === 2 ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}
                  title="2 per page"
                >
                  <Grid2X2 size={18} />
                </button>
                <button
                  onClick={() => setPrintLayout(4)}
                  className={`flex items-center justify-center p-2 ${printLayout === 4 ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}
                  title="4 per page"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setPrintLayout(6)}
                  className={`flex items-center justify-center p-2 ${printLayout === 6 ? 'bg-indigo-600 text-white' : 'text-gray-700'} rounded-r-lg`}
                  title="6 per page"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
            <button
              onClick={() => triggerPrint(filteredOrders)}
              disabled={filteredOrders.length === 0}
              className="flex items-center px-3 py-2 md:px-4 md:py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors text-xs md:text-sm w-full md:w-auto justify-center md:justify-start"
            >
              <Printer size={16} className="mr-1 md:mr-2 md:w-[18px] md:h-[18px]" />
              Print {filteredOrders.length > 0 ? `(${filteredOrders.length})` : ''}
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-4 p-3 md:p-4 bg-gray-50 rounded-lg">
          <label className="relative flex items-center">
            <span className="sr-only">Filter by Date</span>
            <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-10 pr-2 md:pr-4 py-1 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm w-full sm:w-auto"
            />
          </label>
          <button
            onClick={() => setFilterDate('')}
            className="flex items-center px-3 py-1 md:px-4 md:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs md:text-sm w-full sm:w-auto justify-center"
          >
            <FilterX size={16} className="mr-1 md:mr-2 md:w-[18px] md:h-[18px]" />
            Clear Filter
          </button>
        </div>

        {/* Orders Table - Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full bg-white divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Order #', 'Date', 'Customer', 'Product', 'Total', 'Actions'].map(header => (
                  <th key={header} className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <tr key={order.row_number}>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">{order.Date}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">{order.customerName}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                      {(() => {
                        let productItems: ProductItem[] = [];
                        
                        // Handle different product data formats
                        if (order.products) {
                          try {
                            if (typeof order.products === 'string') {
                              productItems = JSON.parse(order.products);
                            } else {
                              productItems = order.products as ProductItem[];
                            }
                            return productItems.length > 1 
                              ? `${productItems[0].productName} +${productItems.length - 1} more` 
                              : productItems[0]?.productName || 'N/A';
                          } catch (e) {
                            return order.productName || 'Error parsing products';
                          }
                        } else if (order.product) {
                          try {
                            // Try parsing as array first
                            if (order.product.trim().startsWith('[')) {
                              const items = JSON.parse(order.product);
                              return items.length > 1
                                ? `${items[0].productName} +${items.length - 1} more`
                                : items[0]?.productName || 'N/A';
                            } else {
                              // Try parsing as single product object
                              const singleProduct = JSON.parse(order.product);
                              return singleProduct.productName || 'N/A';
                            }
                          } catch (e) {
                            return 'Error parsing product';
                          }
                        } else {
                          return order.productName || 'N/A';
                        }
                      })()}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                      ₹{(() => {
                        // Calculate total from products if available
                        if (order.total) return order.total.toFixed(2);
                        
                        let subtotal = 0;
                        if (order.products) {
                          try {
                            let productItems: ProductItem[];
                            if (typeof order.products === 'string') {
                              productItems = JSON.parse(order.products);
                            } else {
                              productItems = order.products as ProductItem[];
                            }
                            subtotal = productItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                          } catch (e) {
                            subtotal = (order.quantity || 0) * (order.price || 0);
                          }
                        } else if (order.product) {
                          try {
                            // Try parsing as array first
                            if (order.product.trim().startsWith('[')) {
                              const items: ProductItem[] = JSON.parse(order.product);
                              subtotal = items.reduce((sum: number, item: ProductItem) => sum + (item.quantity * item.price), 0);
                            } else {
                              // Try parsing as single product object
                              const singleProduct = JSON.parse(order.product);
                              subtotal = singleProduct.quantity * singleProduct.price;
                            }
                          } catch (e) {
                            subtotal = (order.quantity || 0) * (order.price || 0);
                          }
                        } else {
                          subtotal = (order.quantity || 0) * (order.price || 0);
                        }
                        
                        const shippingCost = order.shipping_cost || order.shippingCost || 0;
                        return (subtotal + shippingCost).toFixed(2);
                      })()}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                      <button 
                        onClick={() => triggerPrint([order])}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Print Slip
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 md:px-6 py-3 md:py-4 text-center text-xs md:text-sm text-gray-500">No orders found for the selected date.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Orders Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map(order => (
              <div key={order.row_number} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Order #</p>
                    <p className="text-sm font-bold">{order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500">Date</p>
                    <p className="text-sm">{order.Date}</p>
                  </div>
                </div>
                
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-500">Customer</p>
                  <p className="text-sm">{order.customerName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Product</p>
                    <p className="text-sm">
                      {(() => {
                        // Use the same product display logic as desktop view
                        if (order.product) {
                          try {
                            // Try parsing as array first
                            const productData = typeof order.product === 'string' ? JSON.parse(order.product) : order.product;
                            
                            if (Array.isArray(productData)) {
                              return productData.length > 1
                                ? `${productData[0]?.productName || productData[0]?.name || 'N/A'} +${productData.length - 1} more`
                                : productData[0]?.productName || productData[0]?.name || 'N/A';
                            } else {
                              // Single product object
                              return productData.productName || productData.name || 'N/A';
                            }
                          } catch (e) {
                            // Fallback to legacy field
                            return order.productName || 'N/A';
                          }
                        } else if (order.products) {
                          try {
                            const productsData = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
                            
                            if (Array.isArray(productsData)) {
                              return productsData.length > 1
                                ? `${productsData[0]?.productName || productsData[0]?.name || 'N/A'} +${productsData.length - 1} more`
                                : productsData[0]?.productName || productsData[0]?.name || 'N/A';
                            } else {
                              return productsData.productName || productsData.name || 'N/A';
                            }
                          } catch (e) {
                            return order.productName || 'N/A';
                          }
                        } else {
                          return order.productName || 'N/A';
                        }
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Total</p>
                    <p className="text-sm font-medium">₹{(() => {
                      // Use the same total calculation logic as desktop view
                      if (order.total) {
                        return parseFloat(order.total).toFixed(2);
                      }
                      
                      let subtotal = 0;
                      
                      // Try to calculate from product data
                      if (order.product) {
                        try {
                          const productData = typeof order.product === 'string' ? JSON.parse(order.product) : order.product;
                          
                          if (Array.isArray(productData)) {
                            subtotal = productData.reduce((sum, item) => sum + ((item.quantity || 1) * (item.price || 0)), 0);
                          } else if (productData) {
                            subtotal = (productData.quantity || 1) * (productData.price || 0);
                          }
                        } catch (e) {
                          // Fallback to legacy calculation
                          subtotal = (order.quantity || 0) * (order.price || 0);
                        }
                      } else if (order.products) {
                        try {
                          const productsData = typeof order.products === 'string' ? JSON.parse(order.products) : order.products;
                          
                          if (Array.isArray(productsData)) {
                            subtotal = productsData.reduce((sum, item) => sum + ((item.quantity || 1) * (item.price || 0)), 0);
                          } else if (productsData) {
                            subtotal = (productsData.quantity || 1) * (productsData.price || 0);
                          }
                        } catch (e) {
                          subtotal = (order.quantity || 0) * (order.price || 0);
                        }
                      } else {
                        subtotal = (order.quantity || 0) * (order.price || 0);
                      }
                      
                      // Add shipping cost
                      const shippingCost = parseFloat(order.shipping_cost) || parseFloat(order.shippingCost) || 0;
                      return (subtotal + shippingCost).toFixed(2);
                    })()}</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => triggerPrint([order])}
                  className="w-full text-center py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
                >
                  Print Slip
                </button>
              </div>
            ))
          ) : (
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">No orders found for the selected date.</p>
            </div>
          )}
        </div>

        {/* Hidden component for printing */}
        <div className="hidden">
          <PrintableSlip ref={printRef} orders={ordersToPrint} layout={printLayout} />
        </div>
      </div>
    </div>
  );
};

export default OrderList;
