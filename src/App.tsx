import { useState, useEffect } from 'react';
import OrderForm from './components/OrderForm';
import UpdateTracking from './components/UpdateTracking';
import OrderList from './components/OrderList';
import GstInvoiceGenerator from './components/GstInvoice';
import Auth from './components/Auth';
import { ArrowRight, Package, Truck, History, LogOut, FileSpreadsheet, Menu } from 'lucide-react';


type TabType = 'order' | 'tracking' | 'orderhistory' | 'gstinvoice';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('order');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Check for authentication on component mount
  useEffect(() => {
    const authToken = localStorage.getItem('auth_token');
    if (authToken === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  const navigationItems = [
    { id: 'order', label: 'Order Form', icon: <Package size={20} /> },
    { id: 'tracking', label: 'Update Tracking', icon: <Truck size={20} /> },
    { id: 'orderhistory', label: 'Order History', icon: <History size={20} /> },
    { id: 'gstinvoice', label: 'GST Invoice', icon: <FileSpreadsheet size={20} /> },
  ];

  const pageDescriptions: Record<TabType, string> = {
    order: 'Create a new order by filling out the form below',
    tracking: 'Update tracking information for orders',
    orderhistory: 'View, filter, and print past orders.',
    gstinvoice: 'Generate GST invoices for orders',
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  // If not authenticated, show Auth component
  if (!isAuthenticated) {
    return <Auth onAuthenticated={() => setIsAuthenticated(true)} />;
  }
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Mobile Header */}
      <header className="md:hidden bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">AuraWill Tools</h1>
        <button onClick={toggleMobileMenu} className="p-2 rounded-md hover:bg-gray-700">
          <Menu size={24} />
        </button>
      </header>
      
      {/* Mobile Navigation Menu - Only visible when toggled */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-800 text-white">
          <nav className="px-4 py-2">
            <ul>
              {navigationItems.map((item) => (
                <li key={item.id} className="mb-2">
                  <button
                    onClick={() => {
                      setActiveTab(item.id as TabType);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center py-2 px-3 rounded-md transition-colors duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  >
                    {item.icon}
                    <span className="ml-3 font-medium">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="px-4 py-2 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center py-2 px-3 rounded-md text-red-300 hover:bg-red-700 hover:text-white"
            >
              <LogOut size={20} />
              <span className="ml-3 font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile, visible on md screens and up */}
        <aside className="hidden md:flex w-64 bg-gray-800 text-white p-4 md:p-6 flex-col">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center">
            AuraWill Tools
          </h1>
          <nav className="flex-grow">
            <ul>
              {navigationItems.map((item) => (
                <li key={item.id} className="mb-2">
                  <button
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={`w-full flex items-center py-2 md:py-3 px-3 md:px-4 rounded-lg transition-colors duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  >
                    {item.icon}
                    <span className="ml-3 font-medium">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <button
            onClick={handleLogout}
            className="w-full flex items-center py-2 md:py-3 px-3 md:px-4 rounded-lg transition-colors duration-200 text-red-300 hover:bg-red-700 hover:text-white mt-6"
          >
            <LogOut size={20} />
            <span className="ml-3 font-medium">Logout</span>
          </button>
          <div className="mt-auto text-center text-xs text-gray-400">
            <p>&copy; {new Date().getFullYear()} AuraWill</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="pb-3 md:pb-5 border-b border-gray-200 mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {pageDescriptions[activeTab]}
            </h2>
          </div>
          
          {/* Component Container */}
          <div className="w-full mx-auto" style={{ maxWidth: activeTab === 'order' ? '100%' : activeTab === 'tracking' ? '600px' : '100%' }}>
            {activeTab === 'order' && <OrderForm />}
            {activeTab === 'tracking' && <UpdateTracking />}
            {activeTab === 'orderhistory' && <OrderList />}
            {activeTab === 'gstinvoice' && <GstInvoiceGenerator />}
          </div>
        </main>
      </div>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 p-3 text-center text-xs md:text-sm text-gray-500">
        <div className="flex items-center justify-center gap-1 mb-1">
          <span>Proceed with confidence</span>
          <ArrowRight size={14} />
        </div>
        <p>All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;