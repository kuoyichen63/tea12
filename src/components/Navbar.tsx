import React from 'react';
import { Coffee, Settings, Clock, ShoppingBag } from 'lucide-react';

interface NavbarProps {
  currentTab: 'shop' | 'tracker' | 'admin';
  setCurrentTab: (tab: 'shop' | 'tracker' | 'admin') => void;
  cartCount: number;
  openCart: () => void;
  isAdminAuthenticated: boolean;
  onAdminLogout: () => void;
}

export default function Navbar({
  currentTab,
  setCurrentTab,
  cartCount,
  openCart,
  isAdminAuthenticated,
  onAdminLogout
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E0D8] bg-[#F8F5F1]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo and Title */}
        <div 
          className="flex cursor-pointer items-center space-x-3 transition hover:opacity-90"
          onClick={() => setCurrentTab('shop')}
          id="navbar-brand-logo"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D4A373] text-white shadow-sm serif text-xl font-bold tracking-tight">
            著
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-stone-850 sm:text-xl serif">
              著時鮮茶 <span className="text-[#D4A373]">Jiū Shí</span>
            </h1>
            <p className="hidden text-[10px] font-semibold tracking-widest text-[#8DA080] uppercase sm:block">
              Premium Taiwan Natural Tea
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            id="nav-tab-shop"
            onClick={() => setCurrentTab('shop')}
            className={`flex items-center space-x-1.5 rounded-full px-4.5 py-2 text-xs font-semibold transition-all duration-200 ${
              currentTab === 'shop'
                ? 'bg-[#8DA080] text-white shadow-sm shadow-emerald-800/10'
                : 'text-stone-600 hover:bg-white hover:text-stone-900 border border-transparent hover:border-stone-200/60'
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            <span>茶飲點單</span>
          </button>

          <button
            id="nav-tab-tracker"
            onClick={() => setCurrentTab('tracker')}
            className={`flex items-center space-x-1.5 rounded-full px-4.5 py-2 text-xs font-semibold transition-all duration-200 ${
              currentTab === 'tracker'
                ? 'bg-[#8DA080] text-white shadow-sm shadow-emerald-800/10'
                : 'text-stone-600 hover:bg-white hover:text-stone-900 border border-transparent hover:border-stone-200/60'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>訂單查詢</span>
          </button>

          <button
            id="nav-tab-admin"
            onClick={() => setCurrentTab('admin')}
            className={`flex items-center space-x-1.5 rounded-full px-4.5 py-2 text-xs font-semibold transition-all duration-200 ${
              currentTab === 'admin'
                ? 'bg-[#8DA080] text-white shadow-sm shadow-emerald-800/10'
                : 'text-stone-600 hover:bg-white hover:text-stone-900 border border-transparent hover:border-stone-200/60'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{isAdminAuthenticated ? '管理後台' : '管理者登入'}</span>
          </button>
        </nav>

        {/* Floating Right Controls */}
        <div className="flex items-center space-x-3">
          <button
            id="nav-cart-btn"
            onClick={openCart}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E0D8] bg-white text-stone-700 transition hover:bg-[#F8F5F1] hover:text-stone-950 shadow-xs"
            aria-label="打開購物車"
          >
            <ShoppingBag className="h-4.5 w-4.5 text-[#D4A373]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#8DA080] text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                {cartCount}
              </span>
            )}
          </button>

          {isAdminAuthenticated && currentTab === 'admin' && (
            <button
              id="nav-logout-btn"
              onClick={onAdminLogout}
              className="hidden rounded-full bg-red-50/70 border border-red-100 hover:border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 sm:block transition"
            >
              登出
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
