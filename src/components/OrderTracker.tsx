import React, { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Order } from '../types';

interface OrderTrackerProps {
  localOrderIds: string[];
}

export default function OrderTracker({ localOrderIds }: OrderTrackerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [trackedOrders, setTrackedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Load orders stored in localStorage on initial paint
  const loadLocalOrders = async () => {
    if (localOrderIds.length === 0) return;
    setLoading(true);
    setErrorStatus(null);
    const loaded: Order[] = [];
    try {
      for (const id of localOrderIds) {
        try {
          const docRef = doc(db, 'orders', id);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            const data = snapshot.data();
            loaded.push({
              id: snapshot.id,
              customerName: data.customerName,
              customerPhone: data.customerPhone,
              items: data.items,
              totalAmount: data.totalAmount,
              status: data.status,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
            } as Order);
          }
        } catch (docErr) {
          console.warn(`Failed loading cached order ${id}:`, docErr);
        }
      }
      // Sort loaded orders by date newest first
      loaded.sort((a, b) => {
        const da = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dbTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return dbTime - da;
      });
      setTrackedOrders(loaded);
    } catch (err) {
      console.error(err);
      setErrorStatus('無法自動載入歷史訂單，請手動查詢。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalOrders();
  }, [localOrderIds]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setErrorStatus(null);
    const results: Order[] = [];

    try {
      const qClean = searchQuery.trim();
      
      // 1. Try to search by exact Document ID (only if the query has a plausible alphanumeric/hyphen ID format)
      const isPlausibleId = /^[a-zA-Z0-9_\-]+$/.test(qClean) && qClean.length <= 100;
      let snapshotExists = false;
      let snapshotData: any = null;

      if (isPlausibleId) {
        try {
          const docRef = doc(db, 'orders', qClean);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            snapshotExists = true;
            snapshotData = snapshot.data();
          }
        } catch (getDocErr) {
          console.warn("Direct document lookup skipped or restricted, falling back to name/phone search:", getDocErr);
        }
      }

      if (snapshotExists && snapshotData) {
        results.push({
          id: qClean,
          customerName: snapshotData.customerName,
          customerPhone: snapshotData.customerPhone,
          items: snapshotData.items,
          totalAmount: snapshotData.totalAmount,
          status: snapshotData.status,
          createdAt: snapshotData.createdAt?.toDate ? snapshotData.createdAt.toDate() : new Date(snapshotData.createdAt)
        } as Order);
      } else {
        // 2. Try to search by Customer Phone exact match in Firestore
        const ordersRef = collection(db, 'orders');
        const qPhone = query(ordersRef, where('customerPhone', '==', qClean));
        const qSnap = await getDocs(qPhone);
        qSnap.forEach((docSnap) => {
          const d = docSnap.data();
          results.push({
            id: docSnap.id,
            customerName: d.customerName,
            customerPhone: d.customerPhone,
            items: d.items,
            totalAmount: d.totalAmount,
            status: d.status,
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt)
          } as Order);
        });

        // 3. Try to search by Customer Name exact match in Firestore
        if (results.length === 0) {
          const qName = query(ordersRef, where('customerName', '==', qClean));
          const qNameSnap = await getDocs(qName);
          qNameSnap.forEach((docSnap) => {
            const d = docSnap.data();
            results.push({
              id: docSnap.id,
              customerName: d.customerName,
              customerPhone: d.customerPhone,
              items: d.items,
              totalAmount: d.totalAmount,
              status: d.status,
              createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt)
            } as Order);
          });
        }
      }

      if (results.length === 0) {
        setErrorStatus('找不到符合的訂單編號、姓名或聯絡電話。');
      } else {
        // Sort newest first
        results.sort((a, b) => {
          const da = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const dbTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return dbTime - da;
        });
        setTrackedOrders(results);
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.GET, 'orders');
      setErrorStatus('查詢出錯，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-[#D4A373]/10 px-3 py-1 text-xs font-bold text-[#D4A373] border border-[#D4A373]/20">
            <Clock className="h-3 w-3 animate-spin duration-3000" />
            <span>排單中 (Pending)</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-[#8DA080]/15 px-3 py-1 text-xs font-bold text-[#8DA080] border border-[#8DA080]/20 animate-pulse">
            <Clock className="h-3 w-3" />
            <span>製作中 (Processing)</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-500 border border-stone-200/50">
            <CheckCircle2 className="h-3 w-3" />
            <span>已完成 (Completed)</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200/50">
            <AlertCircle className="h-3 w-3" />
            <span>已取消 (Cancelled)</span>
          </span>
        );
      default:
        return null;
    }
  };

  const formatOrderTime = (dateTime: any) => {
    if (!dateTime) return '—';
    const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search Bar section */}
      <div className="card-soft p-6 mb-8 bg-white/70 border border-[#E5E0D8]/60 shadow-sm">
        <h2 className="text-lg font-bold text-stone-850 mb-1.5 serif">手動查詢訂單 (Search)</h2>
        <p className="text-xs text-stone-500 mb-4 font-light">
          請輸入您的 <strong className="font-semibold text-stone-800">點單取餐號碼</strong>、<strong className="font-semibold text-stone-800">登記姓名</strong> 或 <strong className="font-semibold text-stone-800">聯絡電話</strong> 以搜尋您的新鮮茶品實時進度：
        </p>
        
        <form onSubmit={handleSearch} className="flex gap-2" id="order-search-form">
          <div className="relative flex-1">
            <Search className="absolute top-3.5 left-4.5 h-4.5 w-4.5 text-stone-400" />
            <input
              type="text"
              id="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="輸入取餐碼、姓名或手機..."
              className="w-full rounded-2xl border border-[#E5E0D8] bg-white py-3 pr-4 pl-12 text-xs placeholder-stone-400 focus:border-[#D4A373] focus:outline-none focus:ring-1 focus:ring-[#D4A373] transition-all"
            />
          </div>
          <button
            type="submit"
            id="search-submit-btn"
            disabled={loading}
            className="rounded-2xl bg-[#8DA080] px-6 text-xs font-bold text-white shadow-xs hover:bg-[#7A8D6E] disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? '連線中...' : '即時搜尋'}
          </button>
        </form>

        {errorStatus && (
          <div className="mt-3.5 flex items-center space-x-2 text-xs text-rose-600 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100" id="search-error-msg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorStatus}</span>
          </div>
        )}
      </div>

      {/* Orders List displaying tracked results */}
      <h3 className="mt-8 text-base font-bold text-stone-800 mb-5 flex items-center space-x-2">
        <span className="serif">即時追蹤茶飲 ({trackedOrders.length})</span>
        <span className="h-2 w-2 rounded-full bg-[#8DA080] animate-ping"></span>
      </h3>

      {loading && trackedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8DA080] border-t-transparent"></div>
          <p className="text-xs text-stone-500 font-medium">現調茶飲總控雲端資料確認同步中...</p>
        </div>
      ) : trackedOrders.length === 0 ? (
        <div className="rounded-3xl border border-[#E5E0D8] bg-white/40 p-14 text-center shadow-xs">
          <ShoppingBag className="mx-auto h-8 w-8 text-stone-300 mb-2.5" />
          <p className="text-sm font-semibold text-stone-700 serif">此裝置目前無手調訂單進行中</p>
          <p className="text-xs text-stone-400 mt-1 font-light">您可以随时返回前台選購，點單送出後將在此頁即時追蹤進度。</p>
        </div>
      ) : (
        <div className="space-y-4" id="order-track-list">
          {trackedOrders.map((order) => (
            <div
              key={order.id}
              className="overflow-hidden rounded-3xl border border-[#E5E0D8]/60 bg-white shadow-xs transition-shadow duration-250 hover:shadow-md"
            >
              {/* Card top */}
              <div className="flex flex-wrap items-center justify-between border-b border-[#E5E0D8]/40 bg-[#E5E0D8]/10 px-5 py-3.5">
                <div className="space-y-1">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-[#D4A373]">取餐代碼 (Tracking ID)</span>
                  <span className="text-md font-bold text-stone-850 select-all font-mono serif">{order.id}</span>
                </div>
                <div className="flex items-center space-x-3.5">
                  <span className="text-xs text-stone-400 font-medium">
                    {formatOrderTime(order.createdAt)}
                  </span>
                  {getStatusBadge(order.status)}
                </div>
              </div>

              {/* Card Mid Body */}
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">取餐人姓名</span>
                  <span className="font-bold text-stone-800 serif text-sm">{order.customerName}</span>
                </div>
                
                {order.customerPhone && (
                  <div className="flex justify-between items-center text-xs border-t border-dashed border-[#E5E0D8]/60 pt-2.5">
                    <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">登記電話</span>
                    <span className="text-stone-700 font-medium font-sans">{order.customerPhone}</span>
                  </div>
                )}

                {/* Items detail list */}
                <div className="border-t border-[#E5E0D8]/60 pt-4 space-y-3">
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest">已選茶飲品項</span>
                  <div className="space-y-2">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-stone-700">
                        <div>
                          <strong className="font-bold text-stone-850 serif">{it.name}</strong>
                          <span className="ml-2 text-[9px] font-semibold text-[#D4A373] bg-[#D4A373]/10 px-2 py-0.5 rounded-full uppercase">
                            {it.size}杯 · {it.iceLevel} · {it.sweetnessLevel}
                          </span>
                        </div>
                        <span className="font-medium text-stone-500">
                          x{it.quantity} 杯 · <strong className="font-bold text-stone-800">${it.price * it.quantity}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E5E0D8] pt-4.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">結帳金額 sum</span>
                  <span className="text-lg font-bold text-[#D4A373] serif">${order.totalAmount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
