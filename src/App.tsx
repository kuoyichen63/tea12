import React, { useState, useEffect } from 'react';
import { 
  Plus, Coffee, ShoppingBag, Eye, HelpCircle, AlertCircle, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { TeaItem, OrderItem } from './types';
import { DEFAULT_TEA_ITEMS } from './data/defaultMenu';

// Modular component imports
import Navbar from './components/Navbar';
import OrderModal from './components/OrderModal';
import CartDrawer from './components/CartDrawer';
import OrderTracker from './components/OrderTracker';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'shop' | 'tracker' | 'admin'>('shop');
  const [teaItems, setTeaItems] = useState<TeaItem[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedItemForOrder, setSelectedItemForOrder] = useState<TeaItem | null>(null);
  
  // Track order IDs placed by this user locally
  const [localOrderIds, setLocalOrderIds] = useState<string[]>([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // 1. Initial configuration loading and cached order tracking ids
  useEffect(() => {
    const cached = localStorage.getItem('jiushi_local_orders');
    if (cached) {
      try {
        setLocalOrderIds(JSON.parse(cached));
      } catch (err) {
        console.error('Failed to parse cached local order codes.', err);
      }
    }

    // Check optional admin local active session
    const adminSession = sessionStorage.getItem('jiushi_admin_auth');
    if (adminSession === 'true') {
      setIsAdminAuthenticated(true);
    }
  }, []);

  // 2. Real-time synchronization for Tea Items menu from Firestore
  useEffect(() => {
    setLoadingMenu(true);
    const colRef = collection(db, 'tea_items');

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        // If database holds no beverages, trigger safe seeding automatically
        console.log("Database initialized (No menu items found). Seeding custom default beverages...");
        seedDefaultBeverages();
      } else {
        const items: TeaItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          items.push({
            id: docSnap.id,
            name: d.name,
            category: d.category,
            priceM: d.priceM !== undefined ? d.priceM : null,
            priceL: d.priceL,
            available: d.available !== undefined ? d.available : true,
            description: d.description || ''
          } as TeaItem);
        });
        
        // Sort items by ID or alphabetical for stable shop rendering
        items.sort((a, b) => a.id.localeCompare(b.id));
        setTeaItems(items);
        setLoadingMenu(false);
      }
    }, (error) => {
      console.error(error);
      handleFirestoreError(error, OperationType.GET, 'tea_items');
      setLoadingMenu(false);
    });

    return () => unsubscribe();
  }, []);

  // Safe Seeder tool
  const seedDefaultBeverages = async () => {
    try {
      for (const item of DEFAULT_TEA_ITEMS) {
        await setDoc(doc(db, 'tea_items', item.id), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      console.log("Beverages seeded successfully!");
    } catch (err) {
      console.error("Failed to seed default menu.", err);
    }
  };

  // Cart Management
  const handleAddToCart = (orderItem: OrderItem) => {
    // Check if the exact same tea, size, ice, and sweet levels are already in cart
    const existingIndex = cart.findIndex(
      it => 
        it.itemId === orderItem.itemId && 
        it.size === orderItem.size && 
        it.iceLevel === orderItem.iceLevel && 
        it.sweetnessLevel === orderItem.sweetnessLevel
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += orderItem.quantity;
      setCart(updated);
    } else {
      setCart([...cart, orderItem]);
    }
    setSelectedItemForOrder(null);
    setIsCartOpen(true); // Open the cart view to showcase addition
  };

  const handleRemoveCartItem = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderPlaced = (orderId: string) => {
    const updatedIds = [orderId, ...localOrderIds];
    setLocalOrderIds(updatedIds);
    localStorage.setItem('jiushi_local_orders', JSON.stringify(updatedIds));
    
    // Auto redirect to tracker so guest reviews live updates
    setCurrentTab('tracker');
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('jiushi_admin_auth');
  };

  const handleAdminLoginSuccess = (val: boolean) => {
    setIsAdminAuthenticated(val);
    if (val) {
      sessionStorage.setItem('jiushi_admin_auth', 'true');
    }
  };

  // Group client tea items into their respective category lists
  const categories = Array.from(new Set(teaItems.map(it => it.category)));

  return (
    <div className="min-h-screen bg-[#F8F5F1] flex flex-col font-sans text-[#4A453E] selection:bg-[#E5E0D8]">
      
      {/* Navigation section */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        openCart={() => setIsCartOpen(true)}
        isAdminAuthenticated={isAdminAuthenticated}
        onAdminLogout={handleAdminLogout}
      />

      <main className="flex-grow">
        {/* SHOP FRONT TAB */}
        {currentTab === 'shop' && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="client-shop-tab">
            {/* Visual Hero section with Natural Tones sand elements */}
            <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,_#D4A373_0%,_#C59464_100%)] border border-white/20 py-12 px-6 sm:px-10 text-white shadow-md shadow-[#D4A373]/10 mb-10">
              <div className="relative z-10 max-w-lg space-y-3">
                <span className="inline-block rounded-full bg-[#8DA080] text-white px-3 py-1 text-xs font-semibold tracking-wider shadow-xs">
                  🍃 盛夏著時 · 自然手調
                </span>
                <h2 className="text-2xl font-bold tracking-wide sm:text-4xl serif">
                  引領茶香本質，回歸自然著時
                </h2>
                <p className="text-xs sm:text-sm text-stone-100 font-light leading-relaxed">
                  嚴選台灣高山原葉茶基與在地現摘季節熟成鮮果，由職人悉心現榨調和，呈現原汁原味的山林厚禮。
                </p>
              </div>

              {/* Decorative design details */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 hidden h-64 w-64 rounded-full bg-white/10 sm:block"></div>
              <div className="absolute bottom-0 right-10 -mb-20 hidden h-48 w-48 rounded-full bg-white/15 sm:block"></div>
            </div>

            {/* Menu catalog renderer */}
            {loadingMenu ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#8DA080] border-t-transparent mb-3"></div>
                <p className="text-xs text-stone-500 font-medium font-sans">茶鋪客製菜單同步載入中...</p>
              </div>
            ) : teaItems.length === 0 ? (
              <div className="text-center py-16 bg-white/80 rounded-2xl border border-[#E5E0D8] p-8">
                <AlertCircle className="mx-auto h-8 w-8 text-[#D4A373] mb-2" />
                <p className="text-sm font-semibold text-stone-700">目前茶鋪菜單為空</p>
                <p className="text-xs text-stone-400 mt-1">請切換至「管理後台」以初始化、或添加全新茶飲品項</p>
              </div>
            ) : (
              <div className="space-y-14">
                {categories.map((category) => {
                  const filtered = teaItems.filter(p => p.category === category);
                  if (filtered.length === 0) return null;

                  return (
                    <div key={category} className="space-y-8">
                      
                      {/* Serif Natural Tones Header */}
                      <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
                        <div className="flex items-center space-x-3 mt-1">
                          <h3 
                            className="bg-[#8DA080] text-white serif font-bold px-6 py-2.5 rounded-r-2xl rounded-tl-2xl text-lg tracking-wider shadow-sm"
                            id={`category-banner-${category}`}
                          >
                            {category}
                          </h3>
                          <span className="text-xs text-[#D4A373] font-bold tracking-widest bg-[#D4A373]/10 px-3 py-1 rounded-full uppercase">
                            Premium Selection
                          </span>
                        </div>
                        <span className="text-xs text-stone-500 font-semibold">共 {filtered.length} 款現調茶品</span>
                      </div>

                      {/* Card grid layout */}
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" id={`drink-grid-${category}`}>
                        {filtered.map((item) => (
                          <div
                            key={item.id}
                            id={`drink-card-${item.id}`}
                            className={`group relative overflow-hidden card-soft p-6 transition-all hover:-translate-y-1.5 hover:shadow-lg ${
                              !item.available ? 'opacity-55' : ''
                            }`}
                          >
                            {/* Card Header Content */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1.5 pr-4">
                                <h4 className="text-base font-bold text-stone-850 group-hover:text-[#D4A373] transition-colors serif">
                                  {item.name}
                                </h4>
                                {item.description && (
                                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed h-8 font-light">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              
                              <span className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-semibold bg-[#D4A373]/10 text-[#D4A373] uppercase tracking-wider serif shrink-0">
                                熟成
                              </span>
                            </div>

                            {/* Price labels and action button */}
                            <div className="mt-5 flex items-center justify-between border-t border-[#E5E0D8] pt-4">
                              <div className="space-y-0.5">
                                <span className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider">規格售價</span>
                                <div className="flex items-baseline space-x-2">
                                  {item.priceM && (
                                    <span className="text-xs text-stone-500 font-medium">M: ${item.priceM}</span>
                                  )}
                                  <span className="text-sm font-bold text-stone-800 serif">
                                    {item.priceM ? 'L: ' : ''}${item.priceL}
                                  </span>
                                </div>
                              </div>

                              {item.available ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedItemForOrder(item)}
                                  id={`add-btn-${item.id}`}
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8DA080] text-white shadow-xs hover:bg-[#7A8D6E] hover:scale-105 active:scale-95 transition-all duration-200"
                                  aria-label={`選購 ${item.name}`}
                                >
                                  <Plus className="h-5 w-5" />
                                </button>
                              ) : (
                                <span className="rounded-full bg-[#E5E0D8]/45 text-stone-500 border border-[#E5E0D8] px-3 py-1 text-[10px] font-bold">
                                  已售罄
                                </span>
                              )}
                            </div>

                            {/* Sold out visual sheet */}
                            {!item.available && (
                              <div className="absolute inset-0 bg-stone-900/5 backdrop-grayscale-[30%] cursor-not-allowed max-h-full"></div>
                            )}
                          </div>
                        ))}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ORDER TRACKER TAB */}
        {currentTab === 'tracker' && (
          <OrderTracker localOrderIds={localOrderIds} />
        )}

        {/* ADMIN MANAGING PANEL TAB */}
        {currentTab === 'admin' && (
          <AdminPanel
            isAdminAuthenticated={isAdminAuthenticated}
            setIsAdminAuthenticated={handleAdminLoginSuccess}
            teaItems={teaItems}
            setTeaItems={setTeaItems}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-stone-900 text-stone-400 py-10 mt-16 border-t border-stone-800">
        <div className="mx-auto max-w-7xl px-4 text-center space-y-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center space-x-2">
            <div className="h-7 w-7 rounded-full bg-[#D4A373] flex items-center justify-center text-white serif text-sm font-bold">
              著
            </div>
            <span className="font-bold text-white text-sm select-none serif tracking-wider">著時鮮茶 (Jiū Shí Premium)</span>
          </div>
          <p className="text-[11px] font-mono leading-relaxed max-w-md mx-auto text-stone-500">
            本茶鋪客製系統採用實時雲端 Firestore 資料同步儲存所有飲品菜單及顧客點餐。感謝您的光臨，祝您茶飲體驗舒心悠美！
          </p>
          <div className="text-[10px] text-stone-600">
            © 2026 著時鮮茶 版權所有. Licensed under Apache-2.0.
          </div>
        </div>
      </footer>

      {/* ITEM SPECIFICATIONS ORDER MODAL OVERLAY */}
      {selectedItemForOrder && (
        <OrderModal
          item={selectedItemForOrder}
          onClose={() => setSelectedItemForOrder(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* SLIDEOUT CART DRAWER */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onOrderPlaced={handleOrderPlaced}
      />
    </div>
  );
}
