import React, { useState, useEffect, useRef } from 'react';
import { Clock, Flame } from 'lucide-react';
import { API_BASE_URL } from '../api/api-config';

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [swipeStates, setSwipeStates] = useState({});
  const wsRef = useRef(null);

  useEffect(() => {
    const WS_URL = API_BASE_URL;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'new_order') {
              setOrders(prev => [data.order, ...prev]);
            }
            
            if (data.type === 'update_order') {
              setOrders(prev => prev.map(order => 
                order.id === data.order.id ? data.order : order
              ));
            }
            
            if (data.type === 'remove_order') {
              setOrders(prev => prev.filter(order => order.id !== data.orderId));
            }
          } catch (err) {
            console.error('Error parsing message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          setTimeout(connectWebSocket, 3000);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    const mockOrders = [
      {
        id: '001',
        customerName: 'Bekzod Toshpulatov',
        customerPhoto: 'https://via.placeholder.com/80',
        items: [
          { id: 1, name: 'суп' },
          { id: 2, name: 'плов' }
        ],
        side: 'макароны, рис',
        timestamp: new Date().toISOString()
      },
      {
        id: '002',
        customerName: 'Bekzod Toshpulatov',
        customerPhoto: 'https://via.placeholder.com/80',
        items: [
          { id: 1, name: 'суп' },
          { id: 2, name: 'плов' }
        ],
        side: 'макароны, рис',
        timestamp: new Date(Date.now() - 180000).toISOString()
      },
      {
        id: '003',
        customerName: 'Bekzod Toshpulatov',
        customerPhoto: 'https://via.placeholder.com/80',
        items: [
          { id: 1, name: 'суп' },
          { id: 2, name: 'плов' }
        ],
        side: 'макароны, рис',
        timestamp: new Date(Date.now() - 360000).toISOString()
      },
      {
        id: '004',
        customerName: 'Bekzod Toshpulatov',
        customerPhoto: 'https://via.placeholder.com/80',
        items: [
          { id: 1, name: 'суп' },
          { id: 2, name: 'плов' }
        ],
        side: 'макароны, рис',
        timestamp: new Date(Date.now() - 480000).toISOString()
      }
    ];
    
    setOrders(mockOrders);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleServed = (orderId) => {
    setOrders(prev => prev.filter(order => order.id !== orderId));
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'order_served',
        orderId,
        timestamp: new Date().toISOString()
      }));
    }
  };

  const handleTouchStart = (e, orderId) => {
    setSwipeStates(prev => ({
      ...prev,
      [orderId]: { startX: e.touches[0].clientX, currentX: 0 }
    }));
  };

  const handleTouchMove = (e, orderId) => {
    const startX = swipeStates[orderId]?.startX || 0;
    const currentX = e.touches[0].clientX - startX;
    
    if (currentX > 0) {
      setSwipeStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], currentX }
      }));
    }
  };

  const handleTouchEnd = (orderId) => {
    const swipeDistance = swipeStates[orderId]?.currentX || 0;
    
    if (swipeDistance > 150) {
      handleServed(orderId);
    }
    
    setSwipeStates(prev => ({
      ...prev,
      [orderId]: { startX: 0, currentX: 0 }
    }));
  };

  const getSwipeTransform = (orderId) => {
    const currentX = swipeStates[orderId]?.currentX || 0;
    return currentX > 0 ? `translateX(${currentX}px)` : 'translateX(0)';
  };

  const getSwipeOpacity = (orderId) => {
    const currentX = swipeStates[orderId]?.currentX || 0;
    return Math.max(0.5, 1 - (currentX / 400));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                <Flame className="text-orange-500" size={28} />
                Kitchen Display
              </h1>
              <p className="text-slate-500 text-sm mt-1">{orders.length} active orders</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                <div className="flex items-center gap-2 justify-end">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500' : 
                    connectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500'
                  }`}></div>
                  <span className="text-sm font-medium text-slate-700 capitalize">{connectionStatus}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Time</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {orders.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <p className="text-slate-400 text-lg">No active orders</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="relative">
              <div
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all select-none"
                style={{
                  transform: getSwipeTransform(order.id),
                  opacity: getSwipeOpacity(order.id),
                  transition: swipeStates[order.id]?.currentX > 0 
                    ? 'transform 0.1s ease-out, opacity 0.1s ease-out' 
                    : 'all 0.2s ease-out'
                }}
                onTouchStart={(e) => handleTouchStart(e, order.id)}
                onTouchMove={(e) => handleTouchMove(e, order.id)}
                onTouchEnd={() => handleTouchEnd(order.id)}
              >
                <div className="p-5">
                  <div className="flex gap-4">
                    {/* Customer Photo */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-slate-100 rounded-lg overflow-hidden ring-1 ring-slate-200">
                        <img 
                          src={order.customerPhoto} 
                          alt={order.customerName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 truncate">
                        {order.customerName}
                      </h3>
                      
                      {/* Items */}
                      <div className="space-y-2 mb-3">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-baseline gap-2">
                            <span className="text-base font-medium text-slate-600 tabular-nums">
                              {item.id}.
                            </span>
                            <span className="text-lg font-medium text-slate-900">
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Side Dish */}
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                        <span className="text-sm font-medium text-slate-600">гарнир: </span>
                        <span className="text-base font-medium text-slate-900">{order.side}</span>
                      </div>
                    </div>

                    {/* Order Badge */}
                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
                        <span className="text-base font-semibold">{order.id}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Served Button */}
                <button
                  onClick={() => handleServed(order.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 transition-colors border-t border-emerald-700"
                >
                  Mark as Served
                </button>
              </div>

              {/* Swipe Indicator */}
              {swipeStates[order.id]?.currentX > 30 && (
                <div 
                  className="absolute top-0 left-0 h-full flex items-center pl-6 pointer-events-none"
                  style={{ width: swipeStates[order.id]?.currentX }}
                >
                  <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-semibold">
                    Release to serve →
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KitchenDisplay;