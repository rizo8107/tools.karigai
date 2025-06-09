import { supabase } from './supabaseClient';

// Order status types
export type OrderStatus = 'processing' | 'in-transit' | 'delivered' | 'cancelled';

// Order interface for the shared order data
export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  date: string;
  quantity: number;
  shipping: string;
  address: string;
  phone: string;
  customerName: string;
  notes: string;
  trackingNumber: string;
}

// Event names for order updates
export const ORDER_EVENTS = {
  ORDER_ADDED: 'order_added',
  ORDER_UPDATED: 'order_updated',
  ORDER_DELETED: 'order_deleted',
  TRACKING_UPDATED: 'tracking_updated',
};

// Custom event for order updates
class OrderEventEmitter {
  private listeners: { [key: string]: Array<(data: Order) => void> } = {};

  addEventListener(event: string, callback: (data: Order) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.removeEventListener(event, callback);
  }

  removeEventListener(event: string, callback: (data: Order) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  dispatchEvent(event: string, data: Order) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
}

// Create a singleton instance
export const orderEvents = new OrderEventEmitter();

// Order data from API or form
interface OrderData {
  order_number?: string;
  orderNumber?: string;
  quantity?: number;
  address?: string;
  phone?: string;
  customer_name?: string;
}

// Load orders from Supabase (both regular and manual orders)
export const loadOrders = async (): Promise<Order[]> => {
  try {
    // Get orders from the main orders table
    const { data: regularOrdersRaw, error: regularError } = await supabase
      .from('orders')
      .select('*')
      .order('date', { ascending: false });
      
    // Convert regular orders from lowercase to camelCase
    const regularOrders = regularOrdersRaw?.map(order => ({
      id: order.id,
      orderNumber: order.ordernumber,
      status: order.status,
      date: order.date,
      quantity: order.quantity,
      shipping: order.shipping,
      address: order.address,
      phone: order.phone,
      customerName: order.customername,
      notes: order.notes,
      trackingNumber: order.trackingnumber
    })) || [];
    
    if (regularError) {
      console.error('Error loading regular orders from Supabase:', regularError);
    }
    
    // Get orders from the manual_orders table
    const { data: manualOrdersRaw, error: manualError } = await supabase
      .from('manual_orders')
      .select('*')
      .order('date', { ascending: false });
    
    if (manualError) {
      console.error('Error loading manual orders from Supabase:', manualError);
    }
    
    // Convert manual orders from lowercase to camelCase
    const manualOrders = manualOrdersRaw?.map(order => ({
      id: order.id,
      orderNumber: order.ordernumber,
      status: order.status,
      date: order.date,
      quantity: order.quantity,
      shipping: order.shipping,
      address: order.address,
      phone: order.phone,
      customerName: order.customername,
      notes: order.notes,
      trackingNumber: order.trackingnumber
    })) || [];
    
    // Combine and sort all orders by date
    const allOrders = [...regularOrders, ...manualOrders];
    allOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return allOrders;
  } catch (error) {
    console.error('Error loading orders from Supabase:', error);
    return [];
  }
};

// Add a new order (to manual_orders table for orders from OrderForm)
export const addOrder = async (orderData: OrderData): Promise<Order | null> => {
  try {
    // Generate a unique ID
    const id = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Extract data from the API response or use defaults
    const newOrder: Order = {
      id,
      orderNumber: orderData.order_number || orderData.orderNumber || '',
      status: 'processing',
      date: new Date().toISOString(),
      quantity: orderData.quantity || 1,
      shipping: 'Manual',
      address: orderData.address || '',
      phone: orderData.phone || '',
      customerName: orderData.customer_name || '',
      notes: '',
      trackingNumber: ''
    };
    
    // Convert to lowercase for Supabase
    const dbOrder = {
      id: newOrder.id,
      ordernumber: newOrder.orderNumber,
      status: newOrder.status,
      date: newOrder.date,
      quantity: newOrder.quantity,
      shipping: newOrder.shipping,
      address: newOrder.address,
      phone: newOrder.phone,
      customername: newOrder.customerName,
      notes: newOrder.notes,
      trackingnumber: newOrder.trackingNumber
    };
    
    // Insert into manual_orders table
    const { error } = await supabase
      .from('manual_orders')
      .insert(dbOrder);
    
    if (error) {
      console.error('Error adding manual order to Supabase:', error);
      return null;
    }
    
    // Dispatch event
    orderEvents.dispatchEvent(ORDER_EVENTS.ORDER_ADDED, newOrder);
    
    return newOrder;
  } catch (error) {
    console.error('Error adding manual order:', error);
    return null;
  }
};

// Update an existing order (in either orders or manual_orders table)
export const updateOrder = async (updatedOrder: Order): Promise<boolean> => {
  try {
    // Determine which table to update based on the ID prefix
    const tableName = updatedOrder.id.startsWith('manual_') ? 'manual_orders' : 'orders';
    
    let dataToUpdate;
    
    if (tableName === 'manual_orders') {
      // Convert to lowercase for manual_orders table
      dataToUpdate = {
        id: updatedOrder.id,
        ordernumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        date: updatedOrder.date,
        quantity: updatedOrder.quantity,
        shipping: updatedOrder.shipping,
        address: updatedOrder.address,
        phone: updatedOrder.phone,
        customername: updatedOrder.customerName,
        notes: updatedOrder.notes,
        trackingnumber: updatedOrder.trackingNumber
      };
    } else {
      // Use as is for orders table
      dataToUpdate = updatedOrder;
    }
    
    const { error } = await supabase
      .from(tableName)
      .update(dataToUpdate)
      .eq('id', updatedOrder.id);
    
    if (error) {
      console.error(`Error updating order in ${tableName}:`, error);
      return false;
    }
    
    // Dispatch event
    orderEvents.dispatchEvent(ORDER_EVENTS.ORDER_UPDATED, updatedOrder);
    return true;
  } catch (error) {
    console.error('Error updating order:', error);
    return false;
  }
};

// Delete an order (from either orders or manual_orders table)
export const deleteOrder = async (orderId: string): Promise<boolean> => {
  try {
    // Determine which table to delete from based on the ID prefix
    const tableName = orderId.startsWith('manual_') ? 'manual_orders' : 'orders';
    
    // First get the order to dispatch event later
    const { data: rawData, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'not found' errors
      console.error(`Error fetching order for deletion from ${tableName}:`, fetchError);
      return false;
    }
    
    // Store order data for event dispatch before deletion
    let orderData = null;
    if (rawData) {
      if (tableName === 'manual_orders') {
        // Convert from lowercase to camelCase
        orderData = {
          id: rawData.id,
          orderNumber: rawData.ordernumber,
          status: rawData.status,
          date: rawData.date,
          quantity: rawData.quantity,
          shipping: rawData.shipping,
          address: rawData.address,
          phone: rawData.phone,
          customerName: rawData.customername,
          notes: rawData.notes,
          trackingNumber: rawData.trackingnumber
        };
      } else {
        orderData = rawData;
      }
    }
    
    // Delete the order
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', orderId);
    
    if (deleteError) {
      console.error(`Error deleting order from ${tableName}:`, deleteError);
      return false;
    }
    
    // Dispatch event if we had order data
    if (orderData) {
      orderEvents.dispatchEvent(ORDER_EVENTS.ORDER_DELETED, orderData as Order);
    } else {
      // If we couldn't fetch the order but deletion succeeded, still dispatch an event with minimal data
      orderEvents.dispatchEvent(ORDER_EVENTS.ORDER_DELETED, { id: orderId } as Order);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting order:', error);
    return false;
  }
};

// Update order tracking (in either orders or manual_orders table)
export const updateOrderTracking = async (orderNumber: string, trackingNumber: string): Promise<boolean> => {
  try {
    // Try to find the order in the regular orders table first
    const { data: regularDataRaw, error: regularFetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('ordernumber', orderNumber);
      
    // Convert from lowercase to camelCase
    const regularData = regularDataRaw?.map(order => ({
      id: order.id,
      orderNumber: order.ordernumber,
      status: order.status,
      date: order.date,
      quantity: order.quantity,
      shipping: order.shipping,
      address: order.address,
      phone: order.phone,
      customerName: order.customername,
      notes: order.notes,
      trackingNumber: order.trackingnumber
    })) || [];
    
    // If not found in regular orders, try manual_orders
    if (!regularData || regularData.length === 0) {
      const { data: manualDataRaw, error: manualFetchError } = await supabase
        .from('manual_orders')
        .select('*')
        .eq('ordernumber', orderNumber);  // Use lowercase column name
      
      if (manualFetchError || !manualDataRaw || manualDataRaw.length === 0) {
        console.error('Error fetching order for tracking update:', 
          regularFetchError || manualFetchError || 'Order not found in either table');
        return false;
      }
      
      // Convert from lowercase to camelCase
      const manualData = manualDataRaw.map(order => ({
        id: order.id,
        orderNumber: order.ordernumber,
        status: order.status,
        date: order.date,
        quantity: order.quantity,
        shipping: order.shipping,
        address: order.address,
        phone: order.phone,
        customerName: order.customername,
        notes: order.notes,
        trackingNumber: order.trackingnumber
      }));
      
      // Found in manual_orders
      const order = manualData[0] as Order;
      
      // Update the order in manual_orders (using lowercase)
      const { error: updateError } = await supabase
        .from('manual_orders')
        .update({
          trackingnumber: trackingNumber,
          status: 'in-transit'
        })
        .eq('id', order.id);
      
      if (updateError) {
        console.error('Error updating order tracking in manual_orders:', updateError);
        return false;
      }
      
      // Create updated order for event dispatch
      const updatedOrder = {
        ...order,
        trackingNumber,
        status: 'in-transit' as OrderStatus
      };
      
      // Dispatch event
      orderEvents.dispatchEvent(ORDER_EVENTS.TRACKING_UPDATED, updatedOrder);
      return true;
    }
    
    // Found in regular orders
    const order = regularData[0] as Order;
    const updatedOrder = {
      ...order,
      trackingNumber,
      status: 'in-transit' as OrderStatus
    };
    
    // Convert to lowercase for orders table
    const dbOrder = {
      id: updatedOrder.id,
      ordernumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      date: updatedOrder.date,
      quantity: updatedOrder.quantity,
      shipping: updatedOrder.shipping,
      address: updatedOrder.address,
      phone: updatedOrder.phone,
      customername: updatedOrder.customerName,
      notes: updatedOrder.notes,
      trackingnumber: updatedOrder.trackingNumber
    };
    
    // Update the order in orders table
    const { error: updateError } = await supabase
      .from('orders')
      .update(dbOrder)
      .eq('id', order.id);
    
    if (updateError) {
      console.error('Error updating order tracking in orders:', updateError);
      return false;
    }
    
    // Dispatch event
    orderEvents.dispatchEvent(ORDER_EVENTS.TRACKING_UPDATED, updatedOrder);
    
    return true;
  } catch (error) {
    console.error('Error updating order tracking:', error);
    return false;
  }
};

// For backward compatibility
export const saveOrders = async (): Promise<void> => {
  console.warn('saveOrders is deprecated with Supabase integration');
  // No implementation needed as we're using Supabase for persistence
};
