import React, { useState, useEffect, useRef } from 'react';
import { Clock, Flame } from 'lucide-react';
import { API_BASE_URL, HTTP_API_BASE_URL, HTTP_API_B_U} from '../api/api-config';

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [deviceStatus, setDeviceStatus] = useState('disconnected');
  const [swipeStates, setSwipeStates] = useState({});
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const wsRef = useRef(null);
  const notificationTimeoutRef = useRef(null);
  const prevDeviceStatusRef = useRef('disconnected');
  const searchTimeoutRef = useRef(null);

  // Fetch initial orders on component mount
  useEffect(() => {
    const fetchInitialOrders = async () => {
      try {
        const response = await fetch(HTTP_API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });
        
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
          console.log('Initial orders loaded:', data.length);
        }
      } catch (error) {
        console.error('Error fetching initial orders:', error);
      }
    };

    fetchInitialOrders();
  }, []); // Run only once on mount

  useEffect(() => {
    const WS_URL = API_BASE_URL;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          setDeviceStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(data);
            
            if (data.type === 'new_order') {
              // Check if order already exists to avoid duplicates
              setOrders(prev => {
                const exists = prev.some(order => order.id === data.order.id);
                if (exists) {
                  return prev;
                }
                return [data.order, ...prev];
              });
            } else if (data.type === 'device_connected') {
              setDeviceStatus('connected');
              console.log('Face ID device connected:', data.device);
            } else if (data.type === 'device_error') {
              setDeviceStatus('disconnected');
              console.log('Face ID device error:', data.device);
            } else if (data.type === 'order_not_found' || 
                       data.type === 'user_not_found' || 
                       data.type === 'order_menu_not_found') {
              
              console.log('Notification received:', data.type);
              console.log('Notification data:', data.order);
              
              if (notificationTimeoutRef.current) {
                clearTimeout(notificationTimeoutRef.current);
                notificationTimeoutRef.current = null;
              }
              
              setNotification({
                type: data.type,
                data: data.order
              });
              
              console.log('Notification state set - will stay until manually closed');
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
          setDeviceStatus('disconnected');
          setTimeout(connectWebSocket, 3000);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Monitor device status changes
  useEffect(() => {
    if (prevDeviceStatusRef.current === 'connected' && deviceStatus === 'disconnected') {
      alert('⚠️ Устройство Face ID отключено!');
    }
    prevDeviceStatusRef.current = deviceStatus;
  }, [deviceStatus]);

  // Search function with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(HTTP_API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
          });
          
          if (response.ok) {
            const data = await response.json();
            const filtered = data.filter(order => {
              const name = (order.customerName || '').toLowerCase();
              const query = searchQuery.toLowerCase();
              return name.includes(query);
            });
            setSearchResults(filtered);
          }
        } catch (error) {
          console.error('Error searching orders:', error);
        } finally {
          setIsSearching(false);
        }
      }, 300); // 300ms debounce
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleServed = (orderId) => {
    // Remove from local state immediately
    setOrders(prev => prev.filter(order => order.id !== orderId));
    
    // Notify backend via WebSocket
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

  // Show orders from WebSocket if no search, otherwise show search results
  const displayOrders = searchQuery.trim() ? searchResults : orders;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                <Flame className="text-orange-500" size={28} />
                Кухонный Дисплей
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {displayOrders.length} {searchQuery ? 'найдено' : 'активных заказов'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Сокет</p>
                <div className="flex items-center gap-2 justify-end">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500' : 
                    connectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500'
                  }`}></div>
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {connectionStatus === 'connected' ? 'подключен' : 
                     connectionStatus === 'error' ? 'ошибка' : 'отключен'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Устройство</p>
                <div className="flex items-center gap-2 justify-end">
                  <div className={`w-2 h-2 rounded-full ${
                    deviceStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {deviceStatus === 'connected' ? 'подключен' : 'отключен'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Время</p>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
          
          {/* Search Input */}
          <div className="mt-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
            />
            {isSearching && (
              <div className="absolute right-4 top-3.5">
                <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* Notification Card */}
        {notification && (
          <div className="relative animate-pulse">
            <div className="bg-red-50 rounded-xl border-2 border-red-300 shadow-lg">
              <div className="p-5">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-32 h-40 bg-slate-100 rounded-lg overflow-hidden ring-2 ring-red-400">
                      <img 
                        src={`${HTTP_API_B_U + notification.data.customerPhoto}`}
                        alt={notification.data.emp_name || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => e.target.src = 'https://via.placeholder.com/128x160?text=No+Image'}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 truncate">
                      {notification.data.emp_name || 'Неизвестно'}
                    </h3>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-medium text-slate-600">Номер:</span>
                        <span className="text-lg font-medium text-slate-900">
                          {notification.data.emp_no || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-red-100 rounded-lg px-3 py-2 border border-red-300">
                      <span className="text-base font-bold text-red-700">
                        {notification.type === 'order_not_found' || notification.type === 'order_menu_not_found'
                          ? '⚠️ ЗАКАЗ НЕ НАЙДЕН'
                          : '⚠️ ПОЛЬЗОВАТЕЛЬ НЕ НАЙДЕН'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <button
                      onClick={() => {
                        setNotification(null);
                        if (notificationTimeoutRef.current) {
                          clearTimeout(notificationTimeoutRef.current);
                          notificationTimeoutRef.current = null;
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                    >
                      <span className="text-lg font-bold">×</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders */}
        {displayOrders.length === 0 && !notification ? (
          <div className="col-span-full text-center py-20">
            <p className="text-slate-400 text-lg">
              {searchQuery ? 'Ничего не найдено' : 'Нет активных заказов'}
            </p>
          </div>
        ) : (
          displayOrders.map((order) => (
            <div key={order.id} className="relative group">
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
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-slate-100 rounded-lg overflow-hidden ring-1 ring-slate-200">
                        <img 
                          src={`${HTTP_API_B_U + order.customerPhoto}`}
                          alt={order.customerName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 truncate">
                        {order.customerName}
                      </h3>
                      
                      {/* Show items only on hover when searching */}
                      <div className={`space-y-2 mb-3 transition-opacity ${
  searchQuery ? 'opacity-100' : ''
}`}>
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


                      {/* Show garnish only on hover when searching */}
                      <div className={`bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 transition-opacity ${
  searchQuery ? 'opacity-100' : ''
}`}>
  <span className="text-sm font-medium text-slate-600">гарнир: </span>
  <span className="text-base font-medium text-slate-900">{order.side}</span>
</div>

                    </div>

                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center">
                        <span className="text-base font-semibold">{order.id}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleServed(order.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 transition-colors border-t border-emerald-700"
                >
                  Отметить как выданное
                </button>
              </div>

              {swipeStates[order.id]?.currentX > 30 && (
                <div 
                  className="absolute top-0 left-0 h-full flex items-center pl-6 pointer-events-none"
                  style={{ width: swipeStates[order.id]?.currentX }}
                >
                  <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-semibold">
                    Отпустите чтобы выдать →
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