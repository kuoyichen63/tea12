import React, { useState, useEffect } from 'react';
import { 
  Lock, KeyRound, Clock, CheckCircle2, XCircle, RefreshCw, 
  Plus, Edit, Trash2, Eye, EyeOff, Check, X, Filter 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  onSnapshot, serverTimestamp, query, orderBy 
} from 'firebase/firestore';
import { sha256 } from '../utils/crypto';
import { Order, TeaItem, AdminConfig } from '../types';
import { DEFAULT_TEA_ITEMS } from '../data/defaultMenu';

interface AdminPanelProps {
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (val: boolean) => void;
  teaItems: TeaItem[];
  setTeaItems: (items: TeaItem[]) => void;
}

export default function AdminPanel({
  isAdminAuthenticated,
  setIsAdminAuthenticated,
  teaItems,
  setTeaItems
}: AdminPanelProps) {
  // Authentication check states
  const [hasPasswordSet, setHasPasswordSet] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Active dashboard tabs: 'orders' | 'menu'
  const [adminTab, setAdminTab] = useState<'orders' | 'menu'>('orders');

  // Real-time orders states
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Product editing form states
  const [editingItem, setEditingItem] = useState<TeaItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form input fields for add/edit product
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('著時必喝');
  const [formPriceM, setFormPriceM] = useState<string>('');
  const [formPriceL, setFormPriceL] = useState<string>('');
  const [formAvailable, setFormAvailable] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // 1. Check if administrative password existed inside Firestore
  const checkAdminSetup = async () => {
    setCheckingSetup(true);
    try {
      const configDoc = await getDoc(doc(db, 'admin_configs', 'config'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        if (data && data.passwordHash) {
          setHasPasswordSet(true);
        } else {
          setHasPasswordSet(false);
        }
      } else {
        setHasPasswordSet(false);
      }
    } catch (err) {
      console.error(err);
      // If it fails because of permissions or lack of data, assume first setup or unconfigured
      setHasPasswordSet(false);
    } finally {
      setCheckingSetup(false);
    }
  };

  useEffect(() => {
    checkAdminSetup();
  }, [isAdminAuthenticated]);

  // 2. Real-time synchronizer for Customer Orders
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    setLoadingOrders(true);
    const ordersRef = collection(db, 'orders');
    // Listen to all orders sorted by createdAt descending
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Order[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        fetched.push({
          id: docSnap.id,
          customerName: d.customerName,
          customerPhone: d.customerPhone || '',
          items: d.items || [],
          totalAmount: d.totalAmount || 0,
          status: d.status || 'pending',
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt)
        } as Order);
      });
      setOrders(fetched);
      setLoadingOrders(false);
    }, (error) => {
      console.error(error);
      handleFirestoreError(error, OperationType.GET, 'orders');
      setLoadingOrders(false);
    });

    return () => unsubscribe();
  }, [isAdminAuthenticated]);

  // Handle password submission (Setup or Login)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanPassword = passwordInput.trim();
    if (!cleanPassword) {
      setAuthError('密碼欄位不得為空！');
      return;
    }

    if (!hasPasswordSet) {
      // First Time Setup Password
      const cleanConfirm = confirmPasswordInput.trim();
      if (cleanPassword !== cleanConfirm) {
        setAuthError('兩次輸入的密碼不一致！');
        return;
      }
      if (cleanPassword.length < 4) {
        setAuthError('為了管理安全性，管理者密碼需至少為 4 個字元以上！');
        return;
      }

      try {
        const hash = await sha256(cleanPassword);
        await setDoc(doc(db, 'admin_configs', 'config'), {
          passwordHash: hash,
          updatedAt: serverTimestamp()
        });
        setHasPasswordSet(true);
        setIsAdminAuthenticated(true);
        setPasswordInput('');
        setConfirmPasswordInput('');
      } catch (err) {
        console.error(err);
        setAuthError('密碼儲存失敗，請重試。');
      }
    } else {
      // Standard Verification
      try {
        const hashToCheck = await sha256(cleanPassword);
        const configDoc = await getDoc(doc(db, 'admin_configs', 'config'));
        
        if (configDoc.exists()) {
          const storedHash = configDoc.data()?.passwordHash;
          if (hashToCheck === storedHash) {
            setIsAdminAuthenticated(true);
            setPasswordInput('');
          } else {
            setAuthError('管理者驗證密碼不正確，請重新輸入！');
          }
        } else {
          setAuthError('後台設定遺失，請重新設定。');
          setHasPasswordSet(false);
        }
      } catch (err) {
        console.error(err);
        setAuthError('密碼驗證過程發生不預期錯誤。');
      }
    }
  };

  // Change order processing status in real-time
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Delete an order permanently (clean list queue)
  const deleteOrderPermanently = async (orderId: string) => {
    if (!window.confirm(`確認要永久刪除此訂單 (${orderId}) 嗎？此操作不可還原。`)) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  // Toggle availability of a drink item in custom Firestore list
  const toggleItemAvailability = async (itemId: string, currentAvailable: boolean) => {
    try {
      await updateDoc(doc(db, 'tea_items', itemId), {
        available: !currentAvailable,
        updatedAt: serverTimestamp()
      });
      // Update local state is in sync
      setTeaItems(teaItems.map(item => item.id === itemId ? { ...item, available: !currentAvailable } : item));
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `tea_items/${itemId}`);
    }
  };

  // Load a products values to fill formulation state
  const loadItemForEdit = (item: TeaItem) => {
    setEditingItem(item);
    setIsAddingNew(false);
    setFormId(item.id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormPriceM(item.priceM !== null && item.priceM !== undefined ? String(item.priceM) : '');
    setFormPriceL(String(item.priceL));
    setFormAvailable(item.available);
    setFormDescription(item.description || '');
  };

  const loadEmptyForm = () => {
    setEditingItem(null);
    setIsAddingNew(true);
    // Create pre-filled id
    setFormId('tea-' + Math.floor(100 + Math.random() * 900));
    setFormName('');
    setFormCategory('著時必喝');
    setFormPriceM('');
    setFormPriceL('');
    setFormAvailable(true);
    setFormDescription('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPriceL) {
      alert('請務必填寫飲品名稱與大杯 (L) 價錢！');
      return;
    }

    const priceMVal = formPriceM.trim() ? parseFloat(formPriceM) : null;
    const priceLVal = parseFloat(formPriceL);

    if (isNaN(priceLVal) || (priceMVal !== null && isNaN(priceMVal))) {
      alert('茶飲價格必須為有效數字！');
      return;
    }

    const payload = {
      id: formId,
      name: formName.trim(),
      category: formCategory.trim(),
      priceM: priceMVal,
      priceL: priceLVal,
      available: formAvailable,
      description: formDescription.trim() || null,
      updatedAt: serverTimestamp()
    };

    try {
      if (isAddingNew) {
        // Create full record with custom alphanumeric ID
        await setDoc(doc(db, 'tea_items', formId), {
          ...payload,
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'tea_items', formId), payload);
      }

      // Close formulation drawer
      setIsAddingNew(false);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, `tea_items/${formId}`);
    }
  };

  const handleDeleteProduct = async (itemId: string, name: string) => {
    if (!window.confirm(`確認要永久刪除此品項「${name}」嗎？此操作不可還原。`)) return;
    try {
      await deleteDoc(doc(db, 'tea_items', itemId));
      setTeaItems(teaItems.filter(p => p.id !== itemId));
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, `tea_items/${itemId}`);
    }
  };

  // Seeding tool if list is ever fully wiped out
  const handleSeedDefaults = async () => {
    if (!window.confirm('確認要將原始菜單中的 8 款經典著時茶品重新匯入 Firestore 資料庫嗎？')) return;
    try {
      for (const item of DEFAULT_TEA_ITEMS) {
        await setDoc(doc(db, 'tea_items', item.id), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      alert('經典著時茶飲品項已成功初始化匯入完畢！');
    } catch (err) {
      console.error(err);
      alert('資料初始化失敗：' + String(err));
    }
  };

  // Unauthenticated setup gates
  if (checkingSetup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#8DA080] border-t-transparent mb-3"></div>
        <p className="text-sm text-stone-500 font-medium">正在載入後台安全模組...</p>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div id="admin-auth-card" className="card-soft bg-white/95 p-8 border border-[#E5E0D8]/60 shadow-xl ring-1 ring-black/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E5E0D8]/40 text-[#D4A373] mb-4.5 mx-auto">
            <Lock className="h-5 w-5" />
          </div>
          
          <h2 className="text-center text-xl font-bold text-stone-850 serif">
            {!hasPasswordSet ? '安全密碼初始化' : '茶飲總店密碼驗證'}
          </h2>
          <p className="text-center text-xs text-stone-400 mt-1.5 mb-6 px-3 leading-relaxed font-light">
            {!hasPasswordSet 
              ? '這是您首次登陸，請設定管理者密碼以保護後台點單與餐鋪數據。' 
              : '此處為餐鋪後端管理、品項設定之高密級區塊，請驗證管理者核密。'}
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-4" id="admin-auth-form">
            <div>
              <label htmlFor="auth-pwd" className="block text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                {!hasPasswordSet ? '建立管理者密碼' : '後端安全核密'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="auth-pwd"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="請輸入密碼..."
                  className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2.5 pr-10 pl-3.5 text-xs placeholder-stone-400 focus:border-[#D4A373] focus:outline-none focus:ring-1 focus:ring-[#D4A373]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!hasPasswordSet && (
              <div>
                <label htmlFor="auth-pwd-confirm" className="block text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                  重複核算密碼
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="auth-pwd-confirm"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="請再次輸入密碼..."
                  className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2.5 px-3.5 text-xs placeholder-stone-400 focus:border-[#D4A373] focus:outline-none"
                />
              </div>
            )}

            {authError && (
              <div className="flex items-center space-x-1.5 text-xs text-rose-600" id="auth-err-msg">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit-btn"
              className="w-full rounded-full bg-[#8DA080] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#7A8D6E] transition-all tracking-widest uppercase mt-2"
            >
              {!hasPasswordSet ? '確認設定、安全進入' : '核算核密碼進駐控台'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtered orders queue
  const filteredOrders = orders.filter(ord => statusFilter === 'all' ? true : ord.status === statusFilter);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Admin Panel Header */}
      <div className="flex flex-col gap-4 border-b border-[#E5E0D8] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#D4A373] bg-[#D4A373]/10 px-3 py-1 rounded-full border border-[#D4A373]/10">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8DA080] animate-pulse"></span>
            <span>管理者登入完成 · 著時管理系統</span>
          </span>
          <h2 className="mt-2 text-2xl font-bold text-stone-850 tracking-wide serif">著時鮮茶 (Jiū Shí) · 即時後台控台</h2>
        </div>

        {/* Tab Selector controls */}
        <div className="flex space-x-2">
          <button
            onClick={() => { setAdminTab('orders'); setIsAddingNew(false); setEditingItem(null); }}
            className={`rounded-xl px-4.5 py-2.5 text-xs font-bold transition-all duration-200 shadow-xs ${
              adminTab === 'orders'
                ? 'bg-[#8DA080] text-white shadow-sm'
                : 'bg-white border border-[#E5E0D8] text-stone-600 hover:bg-[#F8F5F1]'
            }`}
          >
            即時點單管理 ({orders.length})
          </button>
          <button
            onClick={() => { setAdminTab('menu'); setIsAddingNew(false); setEditingItem(null); }}
            className={`rounded-xl px-4.5 py-2.5 text-xs font-bold transition-all duration-200 shadow-xs ${
              adminTab === 'menu'
                ? 'bg-[#8DA080] text-white shadow-sm'
                : 'bg-white border border-[#E5E0D8] text-stone-600 hover:bg-[#F8F5F1]'
            }`}
          >
            菜單品項管理 ({teaItems.length})
          </button>
        </div>
      </div>

      {/* ADMIN TAB 1: Real-time Order Queue */}
      {adminTab === 'orders' && (
        <div className="space-y-6 pt-6" id="admin-orders-tab">
          {/* Filters shelf */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E0D8]/60 bg-white/70 p-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-stone-400 tracking-wider uppercase">
              <Filter className="h-4 w-4 text-[#D4A373]" />
              <span>點單排產專注 (Filter Focus)：</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: '全部點單', color: 'bg-gray-200 text-gray-700' },
                { key: 'pending', label: '待接單排產', color: 'bg-[#D4A373]/10 text-[#D4A373]' },
                { key: 'processing', label: '現磨調製中', color: 'bg-[#8DA080]/15 text-[#8DA080]' },
                { key: 'completed', label: '已取餐結案', color: 'bg-stone-100 text-stone-500' },
                { key: 'cancelled', label: '已取消', color: 'bg-rose-50 text-rose-800' }
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setStatusFilter(btn.key)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                    statusFilter === btn.key
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'bg-white border border-[#E5E0D8] text-stone-600 hover:bg-[#F8F5F1]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Queue display list */}
          {loadingOrders ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8DA080] border-t-transparent mb-2"></div>
              <p className="text-xs text-stone-400">正在與雲端實時點單數據庫建立雙向連線...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#E5E0D8] bg-white/40 p-16 text-center">
              <Clock className="mx-auto h-8 w-8 text-stone-300 mb-2" />
              <p className="text-sm font-semibold text-stone-700 serif">無任何符合此分類之茶鋪訂單</p>
              <p className="text-xs text-stone-400 mt-1 font-light">
                全店雙向雲端排產累積：{orders.length} 筆
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" id="admin-orders-grid">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className={`overflow-hidden rounded-3xl border bg-white shadow-xs transition-all duration-250 hover:shadow-md ${
                    order.status === 'pending' ? 'border-[#D4A373] ring-1 ring-[#D4A373]/10' : 
                    order.status === 'processing' ? 'border-[#8DA080] ring-1 ring-[#8DA080]/15' : 'border-[#E5E0D8]/60'
                  }`}
                >
                  {/* Card top bar */}
                  <div className="flex items-center justify-between border-b border-[#E5E0D8]/40 px-4.5 py-3.5 bg-[#E5E0D8]/10">
                    <div>
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-stone-400">點單取餐碼</span>
                      <span className="text-sm font-bold font-mono text-stone-800 select-all serif">{order.id}</span>
                    </div>
                    <div>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                        order.status === 'pending' ? 'bg-[#D4A373]/10 text-[#D4A373]' :
                        order.status === 'processing' ? 'bg-[#8DA080]/15 text-[#8DA080]' :
                        order.status === 'completed' ? 'bg-stone-55 bg-stone-100 text-stone-500' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {order.status === 'pending' ? '等待接單' :
                         order.status === 'processing' ? '現磨調製中' :
                         order.status === 'completed' ? '已取餐' : '已取消'}
                      </span>
                    </div>
                  </div>

                  {/* Customer Details info */}
                  <div className="p-4.5 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="block text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-0.5">取餐人</span>
                        <span className="font-bold text-stone-850 serif text-sm">{order.customerName}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-0.5">聯絡電話</span>
                        <span className="text-stone-700 font-medium">{order.customerPhone || '留空'}</span>
                      </div>
                    </div>

                    {/* Ordered drinks summary */}
                    <div className="space-y-2 border-t border-[#E5E0D8]/40 pt-3 text-xs">
                      <span className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest">茶鋪點單茶品 ({order.items.length})</span>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {order.items.map((it, i) => (
                          <div key={i} className="flex justify-between text-stone-700">
                            <div>
                              <strong className="font-bold text-stone-800 serif">{it.name}</strong>
                              <span className="text-[9px] font-semibold text-[#D4A373] bg-[#D4A373]/10 px-1.5 py-0.2 rounded ml-1.5">
                                {it.size} · {it.iceLevel} · {it.sweetnessLevel}
                              </span>
                            </div>
                            <span className="font-medium text-stone-500">x{it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-[#E5E0D8]/60">
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">結算金額</span>
                      <span className="text-base font-bold text-[#D4A373] serif">${order.totalAmount}</span>
                    </div>

                    {/* Operational administrative modifiers */}
                    <div className="pt-3 border-t border-[#E5E0D8]/50 space-y-2">
                      <span className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest">控台排產營運指令</span>
                      
                      <div className="grid grid-cols-2 gap-1.5">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'processing')}
                            className="flex items-center justify-center space-x-1.5 rounded-full bg-[#8DA080] px-3 py-2 text-xs font-bold text-white hover:bg-[#7A8D6E] transition shadow-xs"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>接單調調</span>
                          </button>
                        )}

                        {order.status === 'processing' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                            className="flex items-center justify-center space-x-1.5 rounded-full bg-[#8DA080] col-span-2 px-3 py-2 text-xs font-bold text-white hover:bg-[#7A8D6E] transition shadow-xs"
                          >
                            <CheckCircle2 className="h-4 w-4 animate-bounce" />
                            <span>製作完成(通知取餐)</span>
                          </button>
                        )}

                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="flex items-center justify-center space-x-1 rounded-full border border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-100/50 px-3 py-2 text-xs font-bold transition"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>取消點單</span>
                          </button>
                        )}

                        {/* Complete deletion gate */}
                        <button
                          onClick={() => deleteOrderPermanently(order.id)}
                          className="flex items-center justify-center space-x-1 rounded-full border border-stone-200 text-stone-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50/20 px-3 py-2 text-xs font-medium transition"
                          title="永久刪除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>永久刪除</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIN TAB 2: Beverage Menu Catalog Manager */}
      {adminTab === 'menu' && (
        <div className="grid gap-8 lg:grid-cols-3 pt-6" id="admin-menu-tab">
          {/* Products Table Catalog List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-base font-bold text-stone-850 serif">
                茶鋪現行茶飲名錄 ({teaItems.length} 款手調)
              </h3>
              
              <div className="flex space-x-2">
                <button
                  onClick={loadEmptyForm}
                  className="inline-flex items-center space-x-1.5 rounded-full bg-[#8DA080] px-4.5 py-2 text-xs font-bold text-white hover:bg-[#7A8D6E] shadow-sm transition"
                  id="admin-add-item-btn"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>添加全新茶飲</span>
                </button>
                
                <button
                  onClick={handleSeedDefaults}
                  className="rounded-full border border-[#E5E0D8] bg-white px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-50 transition"
                  title="重新匯入經典菜單"
                >
                  重設菜單
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-[#E5E0D8]/60 bg-white shadow-xs">
              <table className="w-full text-left text-xs" id="tea-items-table">
                <thead className="bg-[#E5E0D8]/20 border-b border-[#E5E0D8]/55 font-bold text-stone-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">品名 / 風味分類</th>
                    <th className="px-3 py-3.5">價格 (M / L)</th>
                    <th className="px-3 py-3.5">供應狀態</th>
                    <th className="px-5 py-3.5 text-right">控台操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8]/50 overflow-y-auto" id="tea-items-list-body">
                  {teaItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition duration-150">
                      <td className="px-5 py-4">
                        <span className="block font-bold text-stone-850 text-sm serif select-all">{item.name}</span>
                        <span className="inline-block rounded-full bg-[#D4A373]/10 px-2.5 py-0.5 text-[9px] font-semibold text-[#D4A373] mt-1.5 tracking-wider uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-3 py-4 font-medium text-stone-600">
                        <span className="block font-sans">M 中杯: {item.priceM !== null ? `$${item.priceM}` : '—'}</span>
                        <span className="block font-sans">L 大杯: ${item.priceL}</span>
                      </td>
                      <td className="px-3 py-4">
                        <button
                          type="button"
                          onClick={() => toggleItemAvailability(item.id, item.available)}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold shadow-xs cursor-pointer transition-all duration-200 ${
                            item.available
                              ? 'bg-[#8DA080]/10 text-[#8DA080] border border-[#8DA080]/10'
                              : 'bg-stone-100 text-stone-400 border border-stone-200/60'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${item.available ? 'bg-[#8DA080]' : 'bg-stone-400'}`}></span>
                          <span>{item.available ? '熱銷供應中' : '今日下架售罄'}</span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right space-x-2 shrink-0">
                        <button
                          onClick={() => loadItemForEdit(item)}
                          className="rounded-full p-2 text-stone-400 hover:text-[#D4A373] hover:bg-[#D4A373]/10 transition-colors"
                          title="修改編輯"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(item.id, item.name)}
                          className="rounded-full p-2 text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="刪除品項"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ADD / EDIT Product parameters Side shelf Form */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-3xl border border-[#E5E0D8]/60 bg-white shadow-xs p-5">
              <h3 className="text-base font-bold text-stone-850 mb-4 pb-2 border-b border-[#E5E0D8] serif">
                {isAddingNew ? '➕ 添加全新茶飲品項' : editingItem ? '📝 編輯茶飲品項屬性' : '💡 風味茶飲修改指標'}
              </h3>

              {!isAddingNew && !editingItem ? (
                <div className="text-xs text-stone-400 py-12 text-center font-light leading-relaxed px-2" id="menu-help-info">
                  <KeyRound className="mx-auto h-7 w-7 text-stone-300 mb-2.5" />
                  <p>請在左側茶單名錄中點擊「修改編輯」圖標，或按上方「添加新茶飲」按鈕開始調整或擴增菜單細目。</p>
                </div>
              ) : (
                <form onSubmit={handleSaveProduct} className="space-y-3.5" id="tea-item-form">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">茶飲編碼 Unique ID *</label>
                    <input
                      type="text"
                      disabled={!isAddingNew}
                      required
                      value={formId}
                      onChange={(e) => setFormId(e.target.value)}
                      placeholder="例如: roasted-oolong-honey"
                      className="w-full rounded-xl border border-[#E5E0D8] bg-stone-100/50 py-2 px-3 text-xs focus:ring-1 focus:ring-[#D4A373] disabled:opacity-50 text-stone-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 font-sans">茶飲名稱 Name *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="例如: 著時秘珍珠仙桔青"
                      className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2 px-3.5 text-xs focus:border-[#D4A373] focus:outline-none focus:ring-1 focus:ring-[#D4A373]/20 text-stone-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">分類類別 Category *</label>
                    <input
                      type="text"
                      required
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="例如: 著時果茶"
                      className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2 px-3.5 text-xs focus:border-[#D4A373] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">中杯 M 售價</label>
                      <input
                        type="number"
                        value={formPriceM}
                        onChange={(e) => setFormPriceM(e.target.value)}
                        placeholder="無則不填"
                        className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2 px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">大杯 L 售價 *</label>
                      <input
                        type="number"
                        required
                        value={formPriceL}
                        onChange={(e) => setFormPriceL(e.target.value)}
                        placeholder="例如: 65"
                        className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2 px-3 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">上架狀態 Status</label>
                    <div className="flex items-center space-x-2 mt-1.5">
                      <input
                        type="checkbox"
                        id="item-available-chk"
                        checked={formAvailable}
                        onChange={(e) => setFormAvailable(e.target.checked)}
                        className="h-4.5 w-4.5 rounded border-[#E5E0D8] text-[#8DA080] focus:ring-[#8DA080]"
                      />
                      <label htmlFor="item-available-chk" className="text-xs font-semibold text-stone-600 cursor-pointer">
                        開放前台點購此茶飲
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">風味描述 Description</label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="簡要描述這款手調茶的神氣與精隨配方..."
                      className="w-full rounded-xl border border-[#E5E0D8] bg-white py-2 px-3.5 text-xs"
                    />
                  </div>

                  <div className="flex space-x-2 pt-3">
                    <button
                      type="submit"
                      id="item-save-btn"
                      className="flex-1 rounded-full bg-[#8DA080] py-2.5 text-xs font-bold text-white hover:bg-[#7A8D6E] transition shadow-xs"
                    >
                      儲存變更
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                      className="rounded-full border border-stone-200 px-4.5 py-2.5 text-xs font-bold text-stone-550 text-stone-500 hover:bg-stone-50 transition"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
