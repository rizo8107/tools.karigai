import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Truck,
  Edit,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus
} from 'lucide-react';
import { Order, OrderStatus, loadOrders, updateOrder, deleteOrder, orderEvents, ORDER_EVENTS } from '../services/orderService';

// Define local interfaces
interface EditValues {
  status?: OrderStatus;
  notes?: string;
  trackingNumber?: string;
}

export default function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingOrder, setEditingOrder] = useState<{[key: string]: boolean}>({});
  const [editValues, setEditValues] = useState<{[key: string]: EditValues}>({});
  const [sortField, setSortField] = useState<keyof Order>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [noteText, setNoteText] = useState('');

  // Load orders from Supabase on component mount
  useEffect(() => {
    // Fetch orders when component mounts
    const fetchOrders = async () => {
      try {
        const ordersData = await loadOrders();
        setOrders(ordersData);
      } catch (error) {
        console.error('Error loading orders:', error);
        showMessage('Failed to load orders', 'error');
      }
    };
    
    fetchOrders();
    
    // Set up event listeners for order updates
    const orderAddedListener = orderEvents.addEventListener(ORDER_EVENTS.ORDER_ADDED, (newOrder: Order) => {
      setOrders(prevOrders => [newOrder, ...prevOrders]);
      showMessage('New order added', 'success');
    });
    
    const orderUpdatedListener = orderEvents.addEventListener(ORDER_EVENTS.ORDER_UPDATED, (updatedOrder: Order) => {
      setOrders(prevOrders => {
        return prevOrders.map(order => order.id === updatedOrder.id ? updatedOrder : order);
      });
    });
    
    const trackingUpdatedListener = orderEvents.addEventListener(ORDER_EVENTS.TRACKING_UPDATED, (updatedOrder: Order) => {
      setOrders(prevOrders => {
        return prevOrders.map(order => order.id === updatedOrder.id ? updatedOrder : order);
      });
      showMessage(`Tracking updated for order ${updatedOrder.orderNumber}`, 'success');
    });
    
    // Clean up listeners on unmount
    return () => {
      orderAddedListener();
      orderUpdatedListener();
      trackingUpdatedListener();
    };
  }, []);

  // Handle sorting
  const handleSort = (field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort orders based on current sort field and direction
  const sortedOrders = [...orders].sort((a, b) => {
    if (a[sortField] < b[sortField]) return sortDirection === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Start editing an order
  const startEditing = (orderId: string, currentStatus: string, currentNotes: string, currentTracking: string = '') => {
    setEditingOrder(prev => ({
      ...prev,
      [orderId]: true
    }));
    setEditValues(prev => ({
      ...prev,
      [orderId]: {
        status: currentStatus,
        notes: currentNotes,
        trackingNumber: currentTracking
      }
    }));
  };

  // Cancel editing
  const cancelEditing = (orderId: string) => {
    setEditingOrder(prev => ({
      ...prev,
      [orderId]: false
    }));
    setEditValues(prev => {
      const newValues = { ...prev };
      delete newValues[orderId];
      return newValues;
    });
  };

  // Show message with auto-hide
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };
  
  // Save edited values
  const saveEdits = async (orderId: string) => {
    const orderToUpdate = orders.find(order => order.id === orderId);
    if (!orderToUpdate) return;
    
    const updatedOrder = {
      ...orderToUpdate,
      status: (editValues[orderId]?.status || orderToUpdate.status),
      notes: (editValues[orderId]?.notes || orderToUpdate.notes),
      trackingNumber: (editValues[orderId]?.trackingNumber || orderToUpdate.trackingNumber)
    };
    
    try {
      const success = await updateOrder(updatedOrder);
      if (success) {
        showMessage('Order updated successfully', 'success');
        setEditingOrder(prev => ({
          ...prev,
          [orderId]: false
        }));
        
        // Refresh orders list
        const ordersData = await loadOrders();
        setOrders(ordersData);
      } else {
        showMessage('Failed to update order', 'error');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      showMessage('Error updating order', 'error');
    }
  };

  // Handle input changes
  const handleInputChange = (
    orderId: string, 
    field: 'status' | 'notes' | 'trackingNumber', 
    value: string
  ) => {
    setEditValues(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
  };
  
  // Open add note modal
  const openAddNoteModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setNoteText('');
    setShowAddNoteModal(true);
  };
  
  // Close add note modal
  const closeAddNoteModal = () => {
    setShowAddNoteModal(false);
    setSelectedOrderId('');
    setNoteText('');
  };
  
  // Add note to order
  const addNoteToOrder = async () => {
    if (!selectedOrderId || !noteText.trim()) return;
    
    const orderToUpdate = orders.find(order => order.id === selectedOrderId);
    if (!orderToUpdate) return;
    
    const timestamp = new Date().toLocaleString();
    const formattedNote = `${timestamp}: ${noteText.trim()}`;
    
    const updatedNotes = orderToUpdate.notes 
      ? `${orderToUpdate.notes}\n\n${formattedNote}` 
      : formattedNote;
    
    try {
      const success = await updateOrder({
        ...orderToUpdate,
        notes: updatedNotes
      });
      
      if (success) {
        showMessage('Note added successfully', 'success');
        // Refresh orders list
        const ordersData = await loadOrders();
        setOrders(ordersData);
        closeAddNoteModal();
      } else {
        showMessage('Failed to add note', 'error');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      showMessage('Error adding note', 'error');
    }
  };
  
  // Remove an order
  const removeOrder = async (orderId: string) => {
    if (window.confirm('Are you sure you want to remove this order?')) {
      try {
        const success = await deleteOrder(orderId);
        if (success) {
          showMessage('Order removed successfully', 'success');
          // Refresh orders list
          const ordersData = await loadOrders();
          setOrders(ordersData);
        } else {
          showMessage('Failed to remove order', 'error');
        }
      } catch (error) {
        console.error('Error removing order:', error);
        showMessage('Error removing order', 'error');
      }
    }
  };

  // Get status icon based on status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock size={18} className="text-blue-500" />;
      case 'in-transit':
        return <Truck size={18} className="text-orange-500" />;
      case 'delivered':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'cancelled':
        return <AlertCircle size={18} className="text-red-500" />;
      default:
        return <Clock size={18} className="text-gray-500" />;
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Order List Management</h2>
        <p className="text-gray-600">View and update all manual orders</p>
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded-md ${
          messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {messageType === 'success' ? <CheckCircle size={18} className="inline mr-2" /> : <AlertCircle size={18} className="inline mr-2" />}
          {message}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No orders found. Create a new order to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer" onClick={() => handleSort('orderNumber')}>
                  <div className="flex items-center">
                    Order ID
                    {sortField === 'orderNumber' && (
                      sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer" onClick={() => handleSort('date')}>
                  <div className="flex items-center">
                    Date
                    {sortField === 'date' && (
                      sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer" onClick={() => handleSort('status')}>
                  <div className="flex items-center">
                    Status
                    {sortField === 'status' && (
                      sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Tracking Number
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Customer Info
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {order.date}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {editingOrder[order.id] ? (
                      <select
                        value={editValues[order.id]?.status || order.status}
                        onChange={(e) => handleInputChange(order.id, 'status', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="processing">Processing</option>
                        <option value="in-transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <div className="flex items-center">
                        {getStatusIcon(order.status)}
                        <span className="ml-2 capitalize">{order.status}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {editingOrder[order.id] ? (
                      <input
                        type="text"
                        value={editValues[order.id]?.trackingNumber || order.trackingNumber || ''}
                        onChange={(e) => handleInputChange(order.id, 'trackingNumber', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter tracking number"
                      />
                    ) : (
                      order.trackingNumber || '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div>
                      <p className="font-medium">{order.address}</p>
                      <p className="text-gray-600">{order.phone}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {editingOrder[order.id] ? (
                      <textarea
                        value={editValues[order.id]?.notes || order.notes}
                        onChange={(e) => handleInputChange(order.id, 'notes', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    ) : (
                      <div className="flex items-center">
                        <div className="max-w-xs truncate whitespace-pre-wrap" title={order.notes}>
                          {order.notes || '-'}
                        </div>
                        <button
                          onClick={() => openAddNoteModal(order.id)}
                          className="ml-2 p-1 text-gray-600 hover:text-blue-600"
                          title="Add Note"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      {editingOrder[order.id] ? (
                        <>
                          <button
                            onClick={() => saveEdits(order.id)}
                            className="p-1 text-green-600 hover:text-green-800"
                            title="Save"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={() => cancelEditing(order.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(order.id, order.status, order.notes, order.trackingNumber)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => openAddNoteModal(order.id)}
                            className="p-1 text-gray-600 hover:text-blue-800"
                            title="Add Note"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => removeOrder(order.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Remove Order"
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Note</h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Enter your note here..."
            />
            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={closeAddNoteModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addNoteToOrder}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!noteText.trim()}
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
