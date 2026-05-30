import React, { useState } from 'react';
import { X, ShoppingBag, Trash2, CheckCircle2, Copy } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { OrderItem, Order } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: OrderItem[];
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderPlaced: (orderId: string) => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onRemoveItem,
  onClearCart,
  onOrderPlaced
}: CartDrawerProps) {
  if (!isOpen) return null;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const totalAmount = cartItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const generateSimpleId = () => {
    // Generates a short recognizable order ID: e.g. T-8531
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `T-${rand}`;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (!customerName.trim()) {
      alert('請填寫取餐姓名以利餐點製作識別！');
      return;
    }

    setLoading(true);
    const orderId = generateSimpleId();

    const orderData = {
      id: orderId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      items: cartItems.map(item => ({
        itemId: item.itemId,
        name: item.name,
        size: item.size,
        price: item.price,
        quantity: item.quantity,
        iceLevel: item.iceLevel,
        sweetnessLevel: item.sweetnessLevel
      })),
      totalAmount,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      // Save directly with simple custom alphanumeric id
      await setDoc(doc(db, 'orders', orderId), orderData);
      setSuccessOrder(orderId);
      onOrderPlaced(orderId);
      onClearCart();
      setCustomerName('');
      setCustomerPhone('');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!successOrder) return;
    navigator.clipboard.writeText(successOrder);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/40 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10" id="cart-drawer-container">
        <div className="w-screen max-w-md bg-[#F8F5F1] border-l border-[#E5E0D8] flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-250">
          
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E0D8]/70 bg-[#E5E0D8]/10">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="h-5 w-5 text-[#D4A373]" />
              <h2 className="text-base font-bold text-stone-850 serif tracking-wide">您的選購購物車</h2>
            </div>
            <button
              onClick={onClose}
              id="close-cart-btn"
              className="rounded-full bg-white border border-[#E5E0D8] p-1.5 text-stone-400 hover:text-stone-900 transition hover:bg-[#F8F5F1]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Core Body Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {successOrder ? (
              /* Success Checkout View */
              <div className="flex flex-col items-center justify-center py-12 text-center" id="checkout-success-view">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4 animate-bounce border border-emerald-100">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold text-stone-850 serif">點單已成功送出！</h3>
                <p className="mt-1.5 text-xs text-stone-500 leading-relaxed px-4 font-light">
                  茶飲鋪已即時收到您的製作需求，請記下以下號碼，可切換至「訂單查詢」觀看即時進度。
                </p>

                {/* Id Display Box */}
                <div className="mt-6 flex flex-col items-center rounded-3xl bg-white border border-[#E5E0D8] p-5 w-full shadow-xs">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">取餐編號 / Tracking ID</span>
                  <span className="text-3xl font-bold font-mono text-[#D4A373] serif select-all mt-1">{successOrder}</span>
                  
                  <button
                    onClick={copyToClipboard}
                    className="mt-3.5 flex items-center space-x-1.5 text-xs text-white bg-[#8DA080] px-4 py-2 rounded-full hover:bg-[#7A8D6E] shadow-xs transition"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copied ? '已複製！' : '複製取餐碼'}</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSuccessOrder(null);
                    onClose();
                  }}
                  id="success-tracker-btn"
                  className="mt-8 w-full rounded-full bg-stone-800 py-3 text-sm font-bold text-white hover:bg-stone-900 transition shadow-xs"
                >
                  確認並關閉
                </button>
              </div>
            ) : cartItems.length === 0 ? (
              /* Empty Cart state */
              <div className="flex flex-col items-center justify-center py-20 text-center" id="empty-cart-view">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white border border-[#E5E0D8]">
                  <ShoppingBag className="h-6 w-6 text-stone-300" />
                </div>
                <h3 className="text-sm font-bold text-stone-700 serif">您的購物車仍為真空狀態</h3>
                <p className="mt-1 text-xs text-stone-400 font-light">點擊茶單挑選幾杯手調好茶品嚐吧！</p>
              </div>
            ) : (
              /* Loaded Cart Panel */
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">點購品項 ({cartItems.length})</span>
                    <button
                      onClick={onClearCart}
                      className="text-xs font-bold text-rose-500 hover:text-rose-700 transition"
                    >
                      清空全部
                    </button>
                  </div>

                  <div className="divide-y divide-[#E5E0D8]" id="cart-item-list">
                    {cartItems.map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between py-4 first:pt-0 last:pb-0">
                        <div className="space-y-1.5">
                          <h4 className="text-sm font-bold text-stone-850 serif">{item.name}</h4>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className="rounded-full bg-[#D4A373]/10 text-[#D4A373] px-2.5 py-0.5 font-bold tracking-wider uppercase">
                              {item.size}杯
                            </span>
                            <span className="rounded bg-stone-200/50 text-stone-600 px-2 py-0.5 font-medium">
                              {item.iceLevel}
                            </span>
                            <span className="rounded bg-stone-200/50 text-stone-600 px-2 py-0.5 font-medium">
                              {item.sweetnessLevel}
                            </span>
                          </div>
                          <span className="block text-xs font-medium text-stone-400">
                            ${item.price} × {item.quantity}
                          </span>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-2">
                          <span className="text-xs font-bold text-stone-800 serif">
                            ${item.price * item.quantity}
                          </span>
                          <button
                            onClick={() => onRemoveItem(idx)}
                            className="rounded-full p-1 text-stone-300 hover:text-rose-500 transition hover:bg-rose-50"
                            aria-label="刪除品項"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checkout Fields form */}
                <form onSubmit={handleCheckout} className="border-t border-[#E5E0D8] pt-5 space-y-4" id="checkout-form">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">取餐者聯絡資訊</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="client-name" className="block text-xs font-bold text-stone-600 mb-1">
                        取餐人姓名 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="client-name"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="請輸入取餐大名 (例: 王小姐)"
                        className="w-full rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2.5 text-xs placeholder-stone-400 focus:border-[#D4A373] focus:outline-none focus:ring-1 focus:ring-[#D4A373]"
                      />
                    </div>

                    <div>
                      <label htmlFor="client-phone" className="block text-xs font-bold text-stone-600 mb-1">
                        聯絡電話 (選填，便於取餐進度搜尋)
                      </label>
                      <input
                        type="tel"
                        id="client-phone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="請輸入手機號碼 (例: 0912345678)"
                        className="w-full rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2.5 text-xs placeholder-stone-400 focus:border-[#D4A373] focus:outline-none focus:ring-1 focus:ring-[#D4A373]"
                      />
                    </div>
                  </div>

                  {/* Summary cost */}
                  <div className="rounded-2xl bg-white border border-[#E5E0D8]/60 p-4 space-y-2 shadow-xs">
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>茶飲小計</span>
                      <span>${totalAmount}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>職人手調服務費</span>
                      <span className="text-[#8DA080] font-semibold">免費 $0</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-stone-800 pt-2 border-t border-stone-100">
                      <span>總點餐金額 (Total)</span>
                      <span className="text-base text-[#D4A373] serif font-bold">${totalAmount}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="checkout-submit-btn"
                    disabled={loading}
                    className="w-full rounded-full bg-[#8DA080] py-3.5 text-sm font-bold text-white shadow-xs hover:bg-[#7A8D6E] disabled:opacity-50 transition active:scale-95"
                  >
                    {loading ? '正在建立實時訂單...' : `送出點單 · 現結 $${totalAmount}`}
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
