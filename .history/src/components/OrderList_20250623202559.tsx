import { useState, useEffect, useRef, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import { ListOrdered, ServerCrash, Loader, Printer, Calendar, FilterX, Grid2X2, Grid, LayoutGrid } from 'lucide-react';

// Define the structure of a single order from the API
export interface Order {
  row_number: number;
  Date: string;
  Time: string;
  orderNumber: string;
  customerName: string;
  phone: number | string;
  address: string;
  productName: string;
  quantity: number;
  price: number;
  trackingNumber: number | string;
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

  // Calculate grid styles based on layout
  const getGridStyles = () => {
    switch (layout) {
      case 1: return '';
      case 2: return 'grid grid-cols-2 gap-8';
      case 4: return 'grid grid-cols-2 grid-rows-2 gap-6';
      case 6: return 'grid grid-cols-3 grid-rows-2 gap-4';
      default: return '';
    }
  };

  // Calculate slip size based on layout
  const getSlipStyles = () => {
    switch (layout) {
      case 1: return 'w-[4in] h-[4.2in] p-4 break-after-page';
      case 2: return 'w-[3.5in] h-[3.7in] p-3';
      case 4: return 'w-[3.3in] h-[3.5in] p-2';
      case 6: return 'w-[2.3in] h-[3.3in] p-1';
      default: return 'w-[4in] h-[6in] p-4';
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
        <div key={pageIndex} className={`${getGridStyles()} page break-after-page mb-8 p-4`}>
          {pageOrders.map((order) => (
            <div key={order.row_number} className={`${getSlipStyles()} border-2 border-black flex flex-col font-sans text-xs overflow-hidden`}>
          
          {/* Top Section: Tracking Info */}
          <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
            <div className="text-left">
              <p className="font-bold text-xs">TRACKING #:</p>
              <p className="text-sm">{order.trackingNumber || 'N/A'}</p>
            </div>
            <div className="text-right">
              {order.trackingNumber ? (
                <Barcode value={String(order.trackingNumber)} height={30} width={1} fontSize={8} />
              ) : (
                <div className="w-[100px] h-[30px] border border-dashed flex items-center justify-center text-gray-400 text-xs">
                  No Tracking
                </div>
              )}
            </div>
          </div>

          {/* Middle Section */}
          <div className="flex-grow flex flex-col">
            {/* To Address */}
            <div className="mb-1">
              <p className="font-bold text-xs">TO:</p>
              <div className="pl-2">
                <p className="font-semibold text-xs">{order.customerName}</p>
                <p className="text-xs leading-tight">{order.address}</p>
                <p className="text-xs">Phone: {order.phone}</p>
              </div>
            </div>

            {/* Product Details */}
            <div className="border-t border-b border-dashed py-1 my-1">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="py-0.5">Product:</td>
                    <td className="py-0.5 text-right font-semibold">{order.productName}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5">Quantity:</td>
                    <td className="py-0.5 text-right">{order.quantity}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 font-bold">Total:</td>
                    <td className="py-0.5 text-right font-bold">₹{Number(order.price) * Number(order.quantity) || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Order ID */}
            <div className="text-center mt-1 mb-1">
              <p className="text-xs font-semibold">ORDER #</p>
              <Barcode value={order.orderNumber} height={30} width={1} fontSize={8} />
            </div>
          </div>

          {/* Bottom Section: From Address */}
          <div className="border-t border-black pt-1 mt-auto text-[0.65rem] text-center">
            <p className="font-bold">FROM: Karigai Shree</p>
            <p className="leading-tight">Old busstand, Salem, Tamil Nadu, India - 636001</p>
            <p className="leading-tight">Ph: +91 9486054899 | Email: karigaishree@gmail.com</p>
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
        const response = await fetch('/webhook/karigai_getorder');
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        // The API might return an object with a 'data' property which is the array
        const ordersData: Order[] = Array.isArray(result) ? result : result.data || [];
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">
              <ListOrdered size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
              <p className="text-gray-500">View, filter, and print past orders.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center mr-2">
              <span className="text-sm text-gray-700 mr-2">Layout:</span>
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
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
            >
              <Printer size={18} className="mr-2" />
              Print {filteredOrders.length > 0 ? `(${filteredOrders.length})` : ''}
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <label className="relative flex items-center">
            <span className="sr-only">Filter by Date</span>
            <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <button
            onClick={() => setFilterDate('')}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <FilterX size={18} className="mr-2" />
            Clear Filter
          </button>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Order #', 'Date', 'Customer', 'Product', 'Total', 'Actions'].map(header => (
                  <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <tr key={order.row_number}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.Date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{((order.quantity || 0) * (order.price || 0)).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No orders found for the selected date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
