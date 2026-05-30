export interface TeaItem {
  id: string;
  name: string;
  category: string;
  priceM?: number | null;
  priceL: number;
  available: boolean;
  image?: string;
  description?: string;
}

export interface OrderItem {
  itemId: string;
  name: string;
  size: 'M' | 'L';
  price: number;
  quantity: number;
  iceLevel: string;
  sweetnessLevel: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: any;
  updatedAt?: any;
}

export interface AdminConfig {
  passwordHash: string;
  updatedAt?: any;
}
