import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { TeaItem, OrderItem } from '../types';

interface OrderModalProps {
  item: TeaItem | null;
  onClose: () => void;
  onAddToCart: (orderItem: OrderItem) => void;
}

const ICE_LEVELS = ['正常冰', '少冰', '微冰', '去冰', '溫熱'];
const SWEETNESS_LEVELS = ['正常甜', '少糖 (7分)', '半糖 (5分)', '微糖 (3分)', '無糖'];

export default function OrderModal({ item, onClose, onAddToCart }: OrderModalProps) {
  if (!item) return null;

  const hasSizeM = item.priceM !== null && item.priceM !== undefined;
  const [selectedSize, setSelectedSize] = useState<'M' | 'L'>(hasSizeM ? 'M' : 'L');
  const [iceLevel, setIceLevel] = useState('正常冰');
  const [sweetnessLevel, setSweetnessLevel] = useState('正常甜');
  const [quantity, setQuantity] = useState(1);

  // Auto Reset state when item changes
  useEffect(() => {
    setSelectedSize(hasSizeM ? 'M' : 'L');
    setIceLevel('正常冰');
    setSweetnessLevel('正常甜');
    setQuantity(1);
  }, [item, hasSizeM]);

  const currentPrice = selectedSize === 'M' ? (item.priceM ?? item.priceL) : item.priceL;
  const totalPrice = currentPrice * quantity;

  const handleConfirm = () => {
    const orderItem: OrderItem = {
      itemId: item.id,
      name: item.name,
      size: selectedSize,
      price: currentPrice,
      quantity,
      iceLevel,
      sweetnessLevel
    };
    onAddToCart(orderItem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
      <div 
        id="order-customization-modal"
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-[#F8F5F1] border border-[#E5E0D8] shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header banner */}
        <div className="relative bg-[linear-gradient(135deg,_#D4A373_0%,_#C59464_100%)] py-6 px-6 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-1.5 transition hover:bg-white/30"
            id="close-modal-btn"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase mb-1.5 border border-white/10">
            {item.category}
          </span>
          <h3 className="text-xl font-bold tracking-wide serif">{item.name}</h3>
          {item.description && (
            <p className="mt-1.5 text-xs text-stone-100 font-light leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Content options */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Size Choice */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 flex items-center justify-between">
              <span>選擇規格 (Size)</span>
              {!hasSizeM && (
                <span className="text-[10px] font-semibold text-[#D4A373] bg-[#D4A373]/10 px-2.5 py-0.5 rounded-full lowercase">
                  此品項僅提供大杯 (L)
                </span>
              )}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!hasSizeM}
                onClick={() => setSelectedSize('M')}
                className={`relative flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                  !hasSizeM
                    ? 'border-stone-200/50 bg-stone-100/50 text-stone-300 cursor-not-allowed'
                    : selectedSize === 'M'
                    ? 'border-[#D4A373] bg-[#D4A373]/10 text-stone-900 font-semibold ring-1 ring-[#D4A373]'
                    : 'border-[#E5E0D8] bg-white hover:border-[#D4A373] text-stone-700'
                }`}
              >
                <div>
                  <span className="block text-[10px] text-stone-400 font-bold tracking-widest uppercase">中杯 M</span>
                  <span className="text-sm serif font-bold">{hasSizeM ? `$${item.priceM}` : '—'}</span>
                </div>
                {selectedSize === 'M' && hasSizeM && <Check className="h-4 w-4 text-[#D4A373]" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedSize('L')}
                className={`relative flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                  selectedSize === 'L'
                    ? 'border-[#D4A373] bg-[#D4A373]/10 text-stone-900 font-semibold ring-1 ring-[#D4A373]'
                    : 'border-[#E5E0D8] bg-white hover:border-[#D4A373] text-stone-700'
                }`}
              >
                <div>
                  <span className="block text-[10px] text-stone-400 font-bold tracking-widest uppercase">大杯 L</span>
                  <span className="text-sm serif font-bold">${item.priceL}</span>
                </div>
                {selectedSize === 'L' && <Check className="h-4 w-4 text-[#D4A373]" />}
              </button>
            </div>
          </div>

          {/* Ice Choice */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">溫度冰量 (Ice Level)</h4>
            <div className="flex flex-wrap gap-2">
              {ICE_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setIceLevel(lvl)}
                  className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 ${
                    iceLevel === lvl
                      ? 'bg-[#8DA080] text-white shadow-xs'
                      : 'border border-[#E5E0D8] bg-white text-stone-600 hover:bg-[#F8F5F1] hover:text-stone-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Sweetness Choice */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">糖度選擇 (Sweetness)</h4>
            <div className="flex flex-wrap gap-2">
              {SWEETNESS_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSweetnessLevel(lvl)}
                  className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 ${
                    sweetnessLevel === lvl
                      ? 'bg-[#8DA080] text-white shadow-xs'
                      : 'border border-[#E5E0D8] bg-white text-stone-600 hover:bg-[#F8F5F1] hover:text-stone-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity choice */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E0D8]">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">購買數量</span>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E0D8] bg-white text-stone-600 hover:bg-[#F8F5F1] transition"
              >
                —
              </button>
              <span className="w-12 text-center text-sm font-bold text-stone-800">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E0D8] bg-white text-stone-600 hover:bg-[#F8F5F1] transition"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-[#E5E0D8]/20 p-6 flex items-center justify-between border-t border-[#E5E0D8]">
          <div>
            <span className="block text-[10px] text-stone-400 font-bold tracking-widest uppercase">應付小計</span>
            <span className="text-xl font-bold text-stone-850 serif">${totalPrice}</span>
          </div>
          <button
            type="button"
            id="modal-add-to-cart-btn"
            onClick={handleConfirm}
            className="rounded-full bg-[#8DA080] px-7 py-3 text-sm font-bold text-white shadow-xs hover:bg-[#7A8D6E] active:scale-95 transition-all duration-200"
          >
            確認加入購物車
          </button>
        </div>
      </div>
    </div>
  );
}
