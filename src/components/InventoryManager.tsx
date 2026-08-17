import React, { useState, useMemo } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  Printer, 
  Share2, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Tag, 
  Barcode, 
  User as UserIcon, 
  CreditCard, 
  Smartphone, 
  Sparkles, 
  ChevronRight, 
  X, 
  Boxes, 
  Check,
  Minus,
  RotateCcw,
  Clock,
  ArrowRight,
  BarChart,
  ShoppingBag,
  Users,
  Shield,
  Camera,
  ImagePlus
} from 'lucide-react';
import { InventoryItem, InventorySale, InventoryCartItem, User, AppSettings, Supplier, SecurityEvent, SecurityEventType } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { formatNaira } from '../utils';

interface InventoryManagerProps {
  inventoryItems?: InventoryItem[];
  items?: InventoryItem[];
  inventorySales?: InventorySale[];
  sales?: InventorySale[];
  suppliers?: Supplier[];
  securityEvents?: SecurityEvent[];
  registeredUsers?: User[];
  currentUser: User;
  settings?: AppSettings;
  onSaveItem: (item: Partial<InventoryItem> & { id?: string }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onRestockItem: (itemId: string, additionalQuantity: number, reason: string) => Promise<void>;
  onCompleteSale: (sale: Omit<InventorySale, 'id' | 'createdAt'>) => Promise<InventorySale | null>;
  onSeedDemoData?: () => Promise<void>;
  onSeedDemo?: () => Promise<void>;
  onSaveSupplier: (supplier: Partial<Supplier> & { id?: string }) => Promise<void>;
  onDeleteSupplier: (supplierId: string) => Promise<void>;
  onLogSecurityEvent?: (type: SecurityEventType, description: string, metadata?: any) => Promise<void>;
  activeSubscription?: any;
}

export const InventoryManager: React.FC<InventoryManagerProps> = (props) => {
  const currentUser = props.currentUser;
  const isManager = currentUser.role === 'Manager';
  const onSeedDemoData = props.onSeedDemoData || props.onSeedDemo || (async () => {});
  const settings = props.settings;
  const onSaveItem = props.onSaveItem;
  const onDeleteItem = props.onDeleteItem;
  const onRestockItem = props.onRestockItem;
  const onCompleteSale = props.onCompleteSale;
  const onSaveSupplier = props.onSaveSupplier;
  const onDeleteSupplier = props.onDeleteSupplier;
  const onLogSecurityEvent = props.onLogSecurityEvent;
  const activeSubscription = props.activeSubscription;

  const rawItems = (props.inventoryItems && props.inventoryItems.length > 0) ? props.inventoryItems : (props.items || []);
  const rawSales = (props.inventorySales && props.inventorySales.length > 0) ? props.inventorySales : (props.sales || []);

  const inventoryItems = isManager 
    ? rawItems 
    : rawItems.filter(i => i.assignedCashierId === currentUser.id || (i.assignedCashierName && i.assignedCashierName.toLowerCase() === currentUser.name.toLowerCase()) || i.createdBy === currentUser.id);

  const inventorySales = isManager
    ? rawSales
    : rawSales.filter(s => s.cashierId === currentUser.id || s.employeeId === currentUser.id || s.createdBy === currentUser.id);

  const finalItems = inventoryItems;
  const finalSales = inventorySales;

  const suppliers = props.suppliers || [];
  const securityEvents = props.securityEvents || [];
  const registeredUsers = isManager 
    ? (props.registeredUsers || []) 
    : (props.registeredUsers || []).filter(u => u.id === currentUser.id);

  // Barcode Scanning Logic
  const handleBarcodeScan = (code: string) => {
    if (scannerTarget === 'pos') {
      const item = inventoryItems.find(i => 
        (i.sku && i.sku.toLowerCase() === code.toLowerCase()) || 
        (i.barcode && i.barcode.toLowerCase() === code.toLowerCase())
      );
      if (item) {
        if (item.quantity > 0) {
          addToCart(item);
        } else {
          alert(`Product found: ${item.name}, but it is out of stock!`);
        }
      } else {
        alert(`No product found with barcode/SKU: ${code}`);
      }
    } else if (scannerTarget === 'catalog') {
      setCatalogSearch(code);
    } else if (scannerTarget === 'item') {
      setFormData(prev => ({ ...prev, sku: code, barcode: code }));
    }
    setIsScannerOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024; // High definition for maximum clarity
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // Maximum quality for clarity
          setFormData(prev => ({ ...prev, image: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Active subtab inside Inventory tab
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'pos' | 'catalog' | 'sales' | 'reports' | 'suppliers' | 'security' | 'cashier_assignment'>('overview');
  const [reportTimeframe, setReportTimeframe] = useState<'Today' | 'This Week' | 'This Month' | 'This Year'>('This Month');
  const [securityFilter, setSecurityFilter] = useState<SecurityEventType | 'All'>('All');

  // Cashier Assignment state
  const [isCashierAssignModalOpen, setIsCashierAssignModalOpen] = useState(false);
  const [assigningItem, setAssigningItem] = useState<InventoryItem | null>(null);
  const [assignForm, setAssignForm] = useState({
    cashierId: '',
    cashierName: '',
    allocatedQuantity: '1'
  });

  const handleSaveCashierAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningItem) return;
    const selectedCashier = registeredUsers.find(u => u.id === assignForm.cashierId);
    const cName = selectedCashier ? selectedCashier.name : assignForm.cashierName;
    const qty = parseInt(assignForm.allocatedQuantity) || 0;

    await onSaveItem({
      ...assigningItem,
      assignedCashierId: assignForm.cashierId || undefined,
      assignedCashierName: cName || undefined,
      allocatedQuantity: qty > 0 ? qty : undefined,
      updatedAt: new Date().toISOString()
    });

    if (onLogSecurityEvent) {
      await onLogSecurityEvent('Assignment', `Assigned product "${assigningItem.name}" (${qty} units) to cashier ${cName || 'Cashier'}`, { itemId: assigningItem.id, cashierId: assignForm.cashierId });
    }

    setIsCashierAssignModalOpen(false);
    setAssigningItem(null);
  };

  // POS Checkout state
  const [cart, setCart] = useState<InventoryCartItem[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'POS Card' | 'Bank Transfer' | 'Unpaid Debt'>('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<InventorySale | null>(null);

  // Catalog state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('ALL');
  const [catalogStockFilter, setCatalogStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  
  // Barcode Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'pos' | 'catalog' | 'item'>('pos');

  const handleTryOpenScanner = (target: 'pos' | 'catalog' | 'item') => {
    const isSuperAdminUser = currentUser?.phone === '08141106560' || (currentUser as any)?.phoneNumber === '08141106560' || currentUser?.id === '08141106560';
    if (!isSuperAdminUser && activeSubscription?.status === 'Active') {
      const activePlan = activeSubscription?.plan || 'Starter';
      if (activePlan === 'Starter') {
        alert('Plan Limitation: Barcode Scanner integration is exclusive to Professional (₦5,000/mo) or Business (₦10,000/mo) plans. Please upgrade your subscription to unlock barcodes.');
        return;
      }
    }
    setScannerTarget(target);
    setIsScannerOpen(true);
  };
  
  // Item Add/Edit Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'General Goods',
    costPrice: '',
    sellingPrice: '',
    wholesalePrice: '',
    quantity: '',
    reorderLevel: '10',
    minimumStock: '5',
    unit: 'pcs',
    expiryDate: '',
    batchNumber: '',
    brand: '',
    supplier: '',
    notes: ''
  });

  // Supplier state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Restock Modal state
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockReason, setRestockReason] = useState('New Stock Arrival');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Sales History filter
  const [salesSearch, setSalesSearch] = useState('');
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<InventorySale | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>(['POS Accessories', 'Recharge Cards', 'Electronics', 'Stationeries', 'General Goods']);
    inventoryItems.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [inventoryItems]);

  // Metrics computation
  const metrics = useMemo(() => {
    const totalItemsCount = inventoryItems.length;
    let totalStockValueCost = 0;
    let totalStockValueRetail = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockQuantity = 0;

    inventoryItems.forEach(item => {
      const qty = item.quantity || 0;
      totalStockValueCost += (item.costPrice || 0) * qty;
      totalStockValueRetail += (item.sellingPrice || 0) * qty;
      totalStockQuantity += qty;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= (item.reorderLevel || 5)) {
        lowStockCount++;
      }
    });

    const potentialGrossProfit = totalStockValueRetail - totalStockValueCost;

    let totalSalesRevenue = 0;
    let totalSalesProfit = 0;
    let totalItemsSold = 0;

    inventorySales.forEach(sale => {
      totalSalesRevenue += sale.totalAmount || 0;
      totalSalesProfit += sale.totalProfit || 0;
      totalItemsSold += sale.totalQuantity || 0;
    });

    return {
      totalItemsCount,
      totalStockValueCost,
      totalStockValueRetail,
      potentialGrossProfit,
      lowStockCount,
      outOfStockCount,
      totalStockQuantity,
      totalSalesRevenue,
      totalSalesProfit,
      totalItemsSold
    };
  }, [inventoryItems, inventorySales]);

  // Filtered POS Items
  const filteredPosItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(posSearch.toLowerCase()) || 
                          (item.sku && item.sku.toLowerCase().includes(posSearch.toLowerCase()));
      const matchCategory = posCategory === 'ALL' || item.category === posCategory;
      return matchSearch && matchCategory;
    });
  }, [inventoryItems, posSearch, posCategory]);

  // Filtered Catalog Items
  const filteredCatalogItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                          (item.sku && item.sku.toLowerCase().includes(catalogSearch.toLowerCase()));
      const matchCategory = catalogCategory === 'ALL' || item.category === catalogCategory;
      
      let matchStock = true;
      if (catalogStockFilter === 'LOW_STOCK') {
        matchStock = item.quantity > 0 && item.quantity <= (item.reorderLevel || 5);
      } else if (catalogStockFilter === 'OUT_OF_STOCK') {
        matchStock = item.quantity <= 0;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [inventoryItems, catalogSearch, catalogCategory, catalogStockFilter]);

  // Filtered Sales History
  const filteredSales = useMemo(() => {
    return inventorySales.filter(sale => {
      const matchSearch = sale.saleNumber.toLowerCase().includes(salesSearch.toLowerCase()) ||
                          (sale.customerName && sale.customerName.toLowerCase().includes(salesSearch.toLowerCase())) ||
                          (sale.cashierName && sale.cashierName.toLowerCase().includes(salesSearch.toLowerCase()));
      return matchSearch;
    });
  }, [inventorySales, salesSearch]);

  // Cart operations
  const addToCart = (item: InventoryItem) => {
    if (item.quantity <= 0) return;
    setCart(prev => {
      const existingIndex = prev.findIndex(c => c.item.id === item.id);
      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        if (existing.quantity >= item.quantity) {
          alert(`Cannot add more than available stock (${item.quantity} ${item.unit || 'pcs'}).`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
        return updated;
      }
      return [...prev, { item, quantity: 1, discount: 0 }];
    });
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.item.id === itemId) {
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.item.quantity) {
            alert(`Maximum available stock reached (${c.item.quantity} ${c.item.unit || 'pcs'}).`);
            return c;
          }
          return { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as InventoryCartItem[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setOrderDiscount(0);
    setCustomerName('');
    setCustomerPhone('');
    setSaleNotes('');
  };

  // Cart Totals
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, c) => sum + (c.item.sellingPrice * c.quantity), 0);
  }, [cart]);

  const cartTotalCost = useMemo(() => {
    return cart.reduce((sum, c) => sum + (c.item.costPrice * c.quantity), 0);
  }, [cart]);

  const cartTotalAmount = Math.max(0, cartSubtotal - orderDiscount);
  const cartTotalProfit = cartTotalAmount - cartTotalCost;

  // Checkout Handler
  const handleProcessCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'Unpaid Debt' && (!customerName.trim() || !customerPhone.trim())) {
      alert('Customer Name and Phone Number are required when processing sales as Unpaid Debt!');
      return;
    }

    setIsProcessingSale(true);
    try {
      const saleItems = cart.map(c => ({
        itemId: c.item.id,
        itemName: c.item.name,
        sku: c.item.sku || '',
        quantity: c.quantity,
        costPrice: c.item.costPrice,
        sellingPrice: c.item.sellingPrice,
        totalAmount: (c.item.sellingPrice * c.quantity) - c.discount,
        totalProfit: ((c.item.sellingPrice * c.quantity) - c.discount) - (c.item.costPrice * c.quantity)
      }));

      const salePayload: Omit<InventorySale, 'id' | 'createdAt'> = {
        saleNumber: `INV-${Date.now().toString().slice(-6)}`,
        items: saleItems,
        totalQuantity: cart.reduce((sum, c) => sum + c.quantity, 0),
        subtotal: cartSubtotal,
        discount: orderDiscount,
        totalAmount: cartTotalAmount,
        totalCost: cartTotalCost,
        totalProfit: cartTotalProfit,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        cashierId: currentUser.id,
        cashierName: currentUser.name || currentUser.username || 'Cashier',
        notes: saleNotes.trim() || undefined
      };

      const createdSale = await onCompleteSale(salePayload);
      if (createdSale) {
        setCompletedReceipt(createdSale);
        clearCart();
      }
    } catch (err: any) {
      console.error('Sale error:', err);
      alert('Failed to complete sale: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Item Modal Handlers
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode: '',
      category: 'General Goods',
      costPrice: '',
      sellingPrice: '',
      wholesalePrice: '',
      quantity: '',
      reorderLevel: '10',
      minimumStock: '5',
      unit: 'pcs',
      expiryDate: '',
      batchNumber: '',
      brand: '',
      supplier: '',
      notes: '',
      image: ''
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku || '',
      barcode: item.barcode || '',
      category: item.category || 'General Goods',
      costPrice: item.costPrice ? String(item.costPrice) : '',
      sellingPrice: item.sellingPrice ? String(item.sellingPrice) : '',
      wholesalePrice: item.wholesalePrice ? String(item.wholesalePrice) : '',
      quantity: item.quantity ? String(item.quantity) : '0',
      reorderLevel: item.reorderLevel ? String(item.reorderLevel) : '10',
      minimumStock: item.minimumStock ? String(item.minimumStock) : '5',
      unit: item.unit || 'pcs',
      expiryDate: item.expiryDate || '',
      batchNumber: item.batchNumber || '',
      brand: item.brand || '',
      supplier: item.supplier || '',
      notes: item.notes || '',
      image: item.image || ''
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Product name is required!');
      return;
    }
    const cost = parseFloat(formData.costPrice) || 0;
    const price = parseFloat(formData.sellingPrice) || 0;
    const wholesale = parseFloat(formData.wholesalePrice) || 0;
    const qty = parseInt(formData.quantity, 10) || 0;
    const reorder = parseInt(formData.reorderLevel, 10) || 10;
    const minStock = parseInt(formData.minimumStock, 10) || 5;

    setIsSubmittingItem(true);
    try {
      await onSaveItem({
        id: editingItem?.id,
        name: formData.name.trim(),
        sku: formData.sku.trim() || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
        barcode: formData.barcode.trim() || undefined,
        category: formData.category,
        costPrice: cost,
        sellingPrice: price,
        wholesalePrice: wholesale || undefined,
        quantity: qty,
        reorderLevel: reorder,
        minimumStock: minStock,
        unit: formData.unit.trim() || 'pcs',
        expiryDate: formData.expiryDate || undefined,
        batchNumber: formData.batchNumber.trim() || undefined,
        brand: formData.brand.trim() || undefined,
        supplier: formData.supplier.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        image: formData.image || undefined
      });
      
      if (onLogSecurityEvent) {
        onLogSecurityEvent(
          editingItem ? 'Other' : 'Product Added', 
          `${editingItem ? 'Updated' : 'Added'} product: ${formData.name.trim()} (SKU: ${formData.sku.trim()})`,
          { itemId: editingItem?.id, sku: formData.sku.trim() }
        );
      }
      
      setIsItemModalOpen(false);
    } catch (err: any) {
      alert('Failed to save item: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Restock Submit
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    const addQty = parseInt(restockQty, 10);
    if (isNaN(addQty) || addQty === 0) {
      alert('Please enter a valid stock quantity adjustment (positive or negative).');
      return;
    }
    setIsSubmittingRestock(true);
    try {
      await onRestockItem(restockItem.id, addQty, restockReason);
      
      if (onLogSecurityEvent) {
        onLogSecurityEvent(
          'Other', 
          `Adjusted stock for ${restockItem.name}: ${addQty > 0 ? '+' : ''}${addQty} units. Reason: ${restockReason || 'N/A'}`,
          { itemId: restockItem.id, qty: addQty, reason: restockReason }
        );
      }

      setRestockItem(null);
      setRestockQty('');
    } catch (err: any) {
      alert('Restock failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  // Profit Margin calculation display
  // Supplier Modal Handlers
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierFormData({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim()) {
      alert('Supplier name is required!');
      return;
    }
    setIsSubmittingSupplier(true);
    try {
      await onSaveSupplier({
        id: editingSupplier?.id,
        name: supplierFormData.name.trim(),
        phone: supplierFormData.phone.trim(),
        email: supplierFormData.email.trim() || undefined,
        address: supplierFormData.address.trim() || undefined,
        notes: supplierFormData.notes.trim() || undefined
      });
      
      if (onLogSecurityEvent) {
        onLogSecurityEvent(
          'Other', 
          `${editingSupplier ? 'Updated' : 'Added'} supplier: ${supplierFormData.name.trim()}`,
          { supplierId: editingSupplier?.id }
        );
      }

      setIsSupplierModalOpen(false);
    } catch (err: any) {
      alert('Failed to save supplier: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const calculatedMargin = useMemo(() => {
    const cost = parseFloat(formData.costPrice) || 0;
    const price = parseFloat(formData.sellingPrice) || 0;
    if (price <= 0 || cost <= 0) return null;
    const profit = price - cost;
    const marginPct = (profit / price) * 100;
    return { profit, marginPct };
  }, [formData.costPrice, formData.sellingPrice]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP HEADER & METRICS BANNER */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                  Inventory & Sales
                </h2>
              </div>
              <p className="text-xs text-neutral-500 font-bold">
                {inventoryItems.length} products · {inventorySales.length} sales
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSeedDemoData && inventoryItems.length === 0 && (
              <button
                type="button"
                onClick={onSeedDemoData}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Seed Demo Stock</span>
              </button>
            )}

            {isManager && (
              <button
                type="button"
                onClick={handleOpenAddItem}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </div>

        {/* METRICS CARDS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Card 1: Total Products */}
          <div className="bg-neutral-50 border border-neutral-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Total Products
              </span>
              <Package className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-neutral-900 font-mono">
                {metrics.totalItemsCount}
              </span>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5 flex items-center gap-1">
                <span>{metrics.lowStockCount > 0 ? `${metrics.lowStockCount} low stock` : 'Stock healthy'}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Inventory Cost & Retail Value */}
          <div className="bg-neutral-50 border border-neutral-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Retail Value
              </span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                ₦{metrics.totalStockValueRetail.toLocaleString('en-NG')}
              </span>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5">
                Cost: ₦{metrics.totalStockValueCost.toLocaleString('en-NG')}
              </div>
            </div>
          </div>

          {/* Card 3: Goods Sales Revenue */}
          <div className="bg-neutral-50 border border-neutral-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Total Sales Revenue
              </span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-blue-600 font-mono">
                ₦{metrics.totalSalesRevenue.toLocaleString('en-NG')}
              </span>
              <div className="text-[11px] font-medium text-neutral-500 mt-0.5">
                {metrics.totalItemsSold} items sold total
              </div>
            </div>
          </div>

          {/* Card 4: Net Realized Profit from Sales */}
          <div className="bg-neutral-50 border border-neutral-200/80 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Realized Goods Profit
              </span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-purple-600 font-mono">
                ₦{metrics.totalSalesProfit.toLocaleString('en-NG')}
              </span>
              <div className="text-[11px] font-medium text-purple-700 mt-0.5">
                Potential margin: +₦{metrics.potentialGrossProfit.toLocaleString('en-NG')}
              </div>
            </div>
          </div>
        </div>

        {/* LOW STOCK ALERT NOTIFICATION BANNER */}
        {(metrics.lowStockCount > 0 || metrics.outOfStockCount > 0) && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between gap-3 text-amber-900 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Attention: <strong>{metrics.outOfStockCount} items</strong> are out of stock, and <strong>{metrics.lowStockCount} items</strong> are approaching low stock thresholds!
              </span>
            </div>
            <button
              onClick={() => {
                setActiveSubTab('catalog');
                setCatalogStockFilter('LOW_STOCK');
              }}
              className="text-[11px] font-bold underline hover:text-amber-950 shrink-0 cursor-pointer"
            >
              View Low Stock
            </button>
          </div>
        )}

        {/* SUBTABS NAVIGATION */}
        <div className="flex items-center gap-2 border-t border-neutral-100 pt-3 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: Package },
            { id: 'pos', label: 'POS', icon: ShoppingCart },
            { id: 'catalog', label: 'Products', icon: Tag },
            { id: 'sales', label: 'Sales', icon: FileText },
            { id: 'reports', label: 'Reports', icon: BarChart },
            { id: 'cashier_assignment', label: 'Cashier Assignment', icon: Users },
            { id: 'suppliers', label: 'Suppliers', icon: UserIcon },
            { id: 'security', label: 'Security', icon: AlertTriangle },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. SUBTAB CONTENT: CONDITIONAL RENDERING BASED ON ACTIVE SUBTAB */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Package className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Total Products</span>
              </div>
              <p className="text-2xl font-black text-neutral-900 font-mono">{metrics.totalItemsCount}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Boxes className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Stock</span>
              </div>
              <p className="text-2xl font-black text-neutral-900 font-mono">{metrics.totalStockQuantity}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Low Stock</span>
              </div>
              <p className="text-2xl font-black text-amber-600 font-mono">{metrics.lowStockCount}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Boxes className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Out of Stock</span>
              </div>
              <p className="text-2xl font-black text-rose-600 font-mono">{metrics.outOfStockCount}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><ShoppingCart className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Today's Sales</span>
              </div>
              <p className="text-2xl font-black text-neutral-900 font-mono">₦{metrics.totalSalesRevenue.toLocaleString('en-NG')}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Today's Profit</span>
              </div>
              <p className="text-2xl font-black text-neutral-900 font-mono">₦{metrics.totalSalesProfit.toLocaleString('en-NG')}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><BarChart className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Revenue</span>
              </div>
              <p className="text-2xl font-black text-neutral-900 font-mono">₦{metrics.totalSalesRevenue.toLocaleString('en-NG')}</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><DollarSign className="w-5 h-5"/></div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Inventory Value</span>
              </div>
              <p className="text-2xl font-black text-neutral-900 font-mono">₦{metrics.totalStockValueRetail.toLocaleString('en-NG')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <button
              onClick={() => setActiveSubTab('pos')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-6 rounded-3xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 group"
            >
              <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="text-lg font-black tracking-tight">New Sale</span>
            </button>
            <button
              onClick={() => setActiveSubTab('catalog')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-3xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 group"
            >
              <Package className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="text-lg font-black tracking-tight">Products</span>
            </button>
          </div>
          
          {finalItems.length === 0 && (
            <div className="col-span-2 bg-white border border-neutral-200 rounded-3xl p-8 text-center space-y-3">
              <Package className="w-12 h-12 text-neutral-300 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-700">No inventory yet.</h3>
              <button
                onClick={handleOpenAddItem}
                className="mt-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Add Product
              </button>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Product Selection Grid */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Search & Category Filter */}
            <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search item name, SKU, barcode..."
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {posSearch && (
                    <button
                      onClick={() => setPosSearch('')}
                      className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    handleTryOpenScanner('pos');
                  }}
                  className="bg-neutral-900 text-white p-2.5 rounded-xl hover:bg-neutral-800 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5 min-w-[40px]"
                  title="Scan Barcode"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">Scan</span>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  onClick={() => setPosCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    posCategory === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  All Items ({inventoryItems.length})
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPosCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      posCategory === cat
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Cards Grid */}
            {filteredPosItems.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-3xl p-12 text-center space-y-3">
                <Package className="w-12 h-12 text-neutral-300 mx-auto" />
                <p className="text-sm font-bold text-neutral-700">No inventory products found</p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  {inventoryItems.length === 0
                    ? 'Your stock catalog is currently empty. Add products to start selling or click Seed Demo Stock above!'
                    : 'No items match your current search or category filter.'}
                </p>
                {isManager && inventoryItems.length === 0 && (
                  <button
                    onClick={handleOpenAddItem}
                    className="mt-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" /> Add First Product
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPosItems.map(item => {
                  const isOutOfStock = item.quantity <= 0;
                  const isLowStock = item.quantity > 0 && item.quantity <= (item.reorderLevel || 5);
                  const inCartItem = cart.find(c => c.item.id === item.id);

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border p-4 rounded-[28px] flex flex-col justify-between transition-all duration-200 relative ${
                        isOutOfStock
                          ? 'border-neutral-200 opacity-60 bg-neutral-50'
                          : inCartItem
                          ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg'
                          : isLowStock
                          ? 'border-amber-300 bg-amber-50/20 shadow-sm hover:border-amber-400'
                          : 'border-neutral-100 shadow-sm hover:border-neutral-300 hover:shadow-md'
                      }`}
                    >
                      {/* In cart badge count */}
                      {inCartItem && (
                        <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-[11px] font-black w-7 h-7 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10">
                          {inCartItem.quantity}
                        </span>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.15em] block truncate">
                            {item.category || 'General Goods'}
                          </span>
                          <span
                            className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                              isOutOfStock
                                ? 'bg-rose-50 text-rose-700 border-rose-100'
                                : isLowStock
                                ? 'bg-amber-50 text-amber-800 border-amber-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                            }`}
                          >
                            {isOutOfStock ? 'OUT OF STOCK' : `${item.quantity} ${item.unit || 'pcs'}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Card-Style Product Image - High Visibility */}
                          <div className={`w-20 h-20 rounded-2xl flex-shrink-0 border-4 border-white shadow-xl ring-2 ring-neutral-50 overflow-hidden bg-neutral-100 flex items-center justify-center ${isOutOfStock ? 'grayscale opacity-80' : ''}`}>
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-10 h-10 text-neutral-300" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-black text-neutral-900 leading-tight mb-1">
                              {item.name}
                            </h4>
                            {item.sku && (
                              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                <Barcode className="w-3.5 h-3.5 text-neutral-300" />
                                <span>{item.sku}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-50 flex items-center justify-between gap-1">
                        <span className="text-[15px] font-black text-neutral-900 font-mono tracking-tighter">
                          ₦{item.sellingPrice.toLocaleString('en-NG')}
                        </span>

                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => addToCart(item)}
                          className={`text-[11px] font-black px-4 py-1.5 rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                            isOutOfStock
                              ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[4]" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Checkout Shopping Cart Drawer */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-4 sticky top-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black text-neutral-900">Current Cart</h3>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              {cart.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <ShoppingCart className="w-10 h-10 text-neutral-200 mx-auto" />
                  <p className="text-xs font-bold text-neutral-500">Your cart is empty</p>
                  <p className="text-[11px] text-neutral-400">Click "+ Add" on any product to start building a sale order.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {cart.map(c => (
                    <div
                      key={c.item.id}
                      className="bg-neutral-50 border border-neutral-200/80 p-2.5 rounded-2xl flex items-center justify-between gap-3"
                    >
                      {/* Card Thumbnail */}
                      <div className="w-12 h-12 rounded-xl border-2 border-white overflow-hidden bg-white flex-shrink-0 flex items-center justify-center shadow-md">
                        {c.item.image ? (
                          <img src={c.item.image} alt={c.item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-neutral-200" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-black text-neutral-900 truncate">{c.item.name}</h5>
                        <div className="text-[11px] text-neutral-500 font-bold font-mono">
                          ₦{c.item.sellingPrice.toLocaleString('en-NG')} x {c.quantity} = <strong className="text-neutral-900">₦{(c.item.sellingPrice * c.quantity).toLocaleString('en-NG')}</strong>
                        </div>
                      </div>

                      {/* Quantity Control Buttons */}
                      <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-xl p-0.5">
                        <button
                          onClick={() => updateCartQuantity(c.item.id, -1)}
                          className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 font-bold active:scale-95"
                        >
                          <Minus className="w-3 h-3 stroke-[3]" />
                        </button>
                        <span className="w-6 text-center text-xs font-black font-mono">{c.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(c.item.id, 1)}
                          className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 font-bold active:scale-95"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-neutral-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Checkout Form & Controls */}
              {cart.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-neutral-100">
                  {/* Discount */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-600">Discount (₦):</span>
                    <input
                      type="number"
                      min="0"
                      value={orderDiscount || ''}
                      onChange={(e) => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-24 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-right text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">
                      Payment Method *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['Cash', 'POS Card', 'Bank Transfer', 'Unpaid Debt'] as const).map(pm => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPaymentMethod(pm)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all border text-center cursor-pointer ${
                            paymentMethod === pm
                              ? pm === 'Unpaid Debt'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer Info (Mandatory for Unpaid Debt) */}
                  <div className="space-y-2 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/70">
                    <div className="text-[11px] font-bold text-neutral-700 flex items-center justify-between">
                      <span>Customer Details {paymentMethod === 'Unpaid Debt' ? '(Required)' : '(Optional)'}</span>
                      {paymentMethod === 'Unpaid Debt' && (
                        <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">Debt Sync</span>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Customer Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                    <input
                      type="tel"
                      placeholder="Customer Phone Number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Totals Summary */}
                  <div className="bg-neutral-900 text-white p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between text-xs text-neutral-400">
                      <span>Subtotal:</span>
                      <span className="font-mono">₦{cartSubtotal.toLocaleString('en-NG')}</span>
                    </div>
                    {orderDiscount > 0 && (
                      <div className="flex justify-between text-xs text-amber-400">
                        <span>Discount:</span>
                        <span className="font-mono">-₦{orderDiscount.toLocaleString('en-NG')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black border-t border-neutral-800 pt-2 text-emerald-400">
                      <span>Total Payable:</span>
                      <span className="font-mono text-base">₦{cartTotalAmount.toLocaleString('en-NG')}</span>
                    </div>
                    {isManager && (
                      <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                        <span>Est. Profit:</span>
                        <span className="text-purple-300">+₦{cartTotalProfit.toLocaleString('en-NG')}</span>
                      </div>
                    )}
                  </div>

                  {/* Complete Checkout Button */}
                  <button
                    type="button"
                    disabled={isProcessingSale}
                    onClick={handleProcessCheckout}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isProcessingSale ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Sale...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Complete Sale & Print Receipt</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SUBTAB CONTENT 2: STOCK CATALOG & PRODUCT MANAGEMENT */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => {
                  handleTryOpenScanner('catalog');
                }}
                className="bg-neutral-100 text-neutral-600 p-2.5 rounded-xl hover:bg-neutral-200 transition-all active:scale-95 shadow-sm"
                title="Scan Barcode"
              >
                <Camera className="w-4 h-4" />
              </button>

              {/* Category selector */}
              <select
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Stock status filter buttons */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setCatalogStockFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                  catalogStockFilter === 'ALL' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                All Stock
              </button>
              <button
                onClick={() => setCatalogStockFilter('LOW_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                  catalogStockFilter === 'LOW_STOCK' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800'
                }`}
              >
                Low Stock
              </button>
              <button
                onClick={() => setCatalogStockFilter('OUT_OF_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                  catalogStockFilter === 'OUT_OF_STOCK' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
                }`}
              >
                Out of Stock
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Unit Margin</th>
                    <th className="py-3 px-4 text-center">Stock Level</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isManager && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredCatalogItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        No catalog items found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalogItems.map(item => {
                      const cost = item.costPrice || 0;
                      const price = item.sellingPrice || 0;
                      const profit = price - cost;
                      const isOutOfStock = item.quantity <= 0;
                      const isLowStock = item.quantity > 0 && item.quantity <= (item.reorderLevel || 5);

                      return (
                        <tr 
                          key={item.id} 
                          className={`transition-colors border-b border-neutral-100 ${
                            isOutOfStock 
                              ? 'bg-rose-50/30 hover:bg-rose-50/50 text-neutral-700' 
                              : isLowStock 
                              ? 'bg-amber-50/40 hover:bg-amber-50/60 text-neutral-800' 
                              : 'hover:bg-neutral-50/80'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-14 h-14 rounded-xl border-2 border-white overflow-hidden bg-neutral-100 flex-shrink-0 flex items-center justify-center shadow-md ${isOutOfStock ? 'grayscale opacity-70' : ''}`}>
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-7 h-7 text-neutral-300" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-neutral-900 flex items-center gap-2">
                                  <span>{item.name}</span>
                              {isOutOfStock && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" /> Out of Stock
                                </span>
                              )}
                              {isLowStock && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Low Stock
                                </span>
                              )}
                                </div>
                                {item.sku && (
                                  <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1 mt-0.5">
                                    <Barcode className="w-3 h-3 text-neutral-300" /> {item.sku}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-600">
                            {item.category || 'General'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-neutral-600">
                            ₦{cost.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                            ₦{price.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">
                            +₦{profit.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-sm">
                            {item.quantity} <span className="text-[10px] font-normal text-neutral-400">{item.unit || 'pcs'}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>

                          {isManager && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  title="Restock / Adjust Stock"
                                  onClick={() => {
                                    setRestockItem(item);
                                    setRestockQty('');
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  title="Edit Product Details"
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete Product"
                                  onClick={() => {
                                    onDeleteItem(item.id);
                                    if (onLogSecurityEvent) {
                                      onLogSecurityEvent(
                                        'Product Deleted', 
                                        `Permanently deleted product: ${item.name} (SKU: ${item.sku})`,
                                        { itemId: item.id, sku: item.sku }
                                      );
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUBTAB CONTENT 3: SALES HISTORY & LOGS */}
      {activeSubTab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
              <input
                type="text"
                placeholder="Search sale reference ID, customer, cashier..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="text-xs text-neutral-500 font-semibold">
              Showing <strong>{filteredSales.length}</strong> sales receipts
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">Sale Ref / Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-center">Items Qty</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-right">Profit</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        No sales records recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(sale => {
                      const dateStr = new Date(sale.createdAt).toLocaleString('en-NG', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      });

                      return (
                        <tr key={sale.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-neutral-900">{sale.saleNumber}</div>
                            <div className="text-[10px] text-neutral-400 font-medium">{dateStr}</div>
                          </td>
                          <td className="py-3 px-4">
                            {sale.customerName ? (
                              <div>
                                <div className="font-bold text-neutral-800">{sale.customerName}</div>
                                {sale.customerPhone && (
                                  <div className="text-[10px] font-mono text-neutral-400">{sale.customerPhone}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic">Walk-in Customer</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {sale.totalQuantity}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block text-[10px] font-black px-2 py-0.5 rounded ${
                                sale.paymentMethod === 'Unpaid Debt'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-neutral-900 text-sm">
                            ₦{sale.totalAmount.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-purple-600">
                            +₦{sale.totalProfit.toLocaleString('en-NG')}
                          </td>
                          <td className="py-3 px-4 font-medium text-neutral-600">
                            {sale.cashierName}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSaleForModal(sale)}
                              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" /> Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD / EDIT PRODUCT MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-xl font-black text-neutral-900 tracking-tight">
                {editingItem ? 'Edit Product' : 'Add Product'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="bg-neutral-100 text-neutral-500 hover:text-neutral-700 p-2 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemSubmit} className="space-y-5">
              {/* Image Upload */}
              <div className="flex flex-col items-center justify-center space-y-3 pb-2">
                <div className="relative">
                  <label className="block relative cursor-pointer group active:scale-95 transition-all">
                    <div className={`w-40 h-40 rounded-[28px] border-4 border-white shadow-2xl overflow-hidden bg-neutral-100 flex items-center justify-center transition-all ${!formData.image ? 'border-neutral-100' : 'border-emerald-100'}`}>
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-14 h-14 text-neutral-300" />
                      )}
                      <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity ${formData.image ? 'opacity-0 group-hover:opacity-100' : 'opacity-10'}`}>
                        <Camera className="w-10 h-10 text-white" />
                      </div>
                    </div>
                    
                    {!formData.image && (
                      <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-2.5 rounded-2xl shadow-lg ring-4 ring-white">
                        <Plus className="w-5 h-5 stroke-[4]" />
                      </div>
                    )}

                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                    />
                  </label>

                  {formData.image && (
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFormData({...formData, image: ''});
                      }}
                      className="absolute top-0 right-0 bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-all active:scale-90 z-20 ring-4 ring-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Tap to Take Product Picture</p>
              </div>

              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">PRODUCT NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indomie Noodles"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">SKU</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Auto-generated"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-4 pr-12 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleTryOpenScanner('item');
                      }}
                      className="absolute right-2 top-1.5 bg-neutral-900 text-white p-2 rounded-xl hover:bg-neutral-800 transition-all"
                      title="Scan Barcode"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">BARCODE</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">CATEGORY</label>
                  <div className="relative">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="General">General</option>
                      <option value="Food & Drinks">Food & Drinks</option>
                      <option value="POS Accessories">POS Accessories</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Stationeries">Stationeries</option>
                      {categories.filter(c => !['General', 'Food & Drinks', 'POS Accessories', 'Electronics', 'Stationeries'].includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">UNIT</label>
                  <div className="relative">
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      <option value="Piece">Piece</option>
                      <option value="Pack">Pack</option>
                      <option value="Carton">Carton</option>
                      <option value="Kilogram">Kilogram</option>
                      <option value="Litre">Litre</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Price & Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">COST PRICE (₦) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">SELLING PRICE (₦) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Wholesale Price & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">WHOLESALE PRICE (₦)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.wholesalePrice}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">QUANTITY</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Reorder Level & Minimum Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">REORDER LEVEL</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">MINIMUM STOCK</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="5"
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Expiry Date & Batch Number */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">EXPIRY DATE</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">BATCH NUMBER</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Brand & Supplier */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">BRAND</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">SUPPLIER</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">DESCRIPTION</label>
                <textarea
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="w-full py-4 rounded-2xl text-sm font-black text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 transition-all active:scale-95 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="w-full py-4 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingItem ? 'Saving...' : editingItem ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. RESTOCK / ADJUSTMENT MODAL */}
      {restockItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-black text-neutral-900">Restock Product</h3>
                <p className="text-xs text-neutral-500 font-medium">{restockItem.name}</p>
              </div>
              <button onClick={() => setRestockItem(null)} className="text-neutral-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4 text-xs">
              <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200 text-neutral-700 font-medium space-y-1">
                <div className="flex justify-between">
                  <span>Current Available Stock:</span>
                  <strong className="font-mono text-neutral-900">{restockItem.quantity} {restockItem.unit || 'pcs'}</strong>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  Additional Quantity (+ to add stock, - to reduce) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 50"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-medium focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 font-bold text-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRestock}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl"
                >
                  {isSubmittingRestock ? 'Updating...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. PRINTABLE RECEIPT MODAL (COMPLETED OR SELECTED) */}
      {(completedReceipt || selectedSaleForModal) && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-neutral-200">
            {(() => {
              const sale = completedReceipt || selectedSaleForModal!;
              return (
                <>
                  <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center font-black">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-black text-neutral-900 uppercase tracking-tight">
                      {settings?.businessName || 'DAN GODAL AGENT POS'}
                    </h3>
                    <p className="text-[10px] text-neutral-500">Official Sales & Inventory Receipt</p>
                    <div className="text-[10px] font-mono font-bold text-neutral-700 pt-1">
                      Ref: {sale.saleNumber}
                    </div>
                  </div>

                  {/* Receipt Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Date & Time:</span>
                      <span className="font-mono text-neutral-800">
                        {new Date(sale.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Cashier:</span>
                      <span className="font-medium text-neutral-800">{sale.cashierName}</span>
                    </div>

                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span>Payment Method:</span>
                      <span className="font-bold text-emerald-700">{sale.paymentMethod}</span>
                    </div>

                    {sale.customerName && (
                      <div className="flex justify-between text-[11px] text-neutral-500">
                        <span>Customer:</span>
                        <span className="font-bold text-neutral-800">{sale.customerName} ({sale.customerPhone || 'N/A'})</span>
                      </div>
                    )}

                    {/* Items table */}
                    <div className="border-t border-b border-neutral-200 py-2 my-2 space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Purchased Goods</span>
                      {sale.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <div>
                            <div className="font-bold text-neutral-800">{it.itemName}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">
                              ₦{it.sellingPrice.toLocaleString('en-NG')} x {it.quantity}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-neutral-900">
                            ₦{it.totalAmount.toLocaleString('en-NG')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Receipt Totals */}
                    <div className="space-y-1 font-mono pt-1">
                      <div className="flex justify-between text-xs text-neutral-600">
                        <span>Subtotal:</span>
                        <span>₦{sale.subtotal.toLocaleString('en-NG')}</span>
                      </div>
                      {sale.discount > 0 && (
                        <div className="flex justify-between text-xs text-rose-600">
                          <span>Discount:</span>
                          <span>-₦{sale.discount.toLocaleString('en-NG')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-neutral-900 border-t border-neutral-300 pt-1">
                        <span>TOTAL PAID:</span>
                        <span className="text-emerald-600">₦{sale.totalAmount.toLocaleString('en-NG')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 bg-neutral-900 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCompletedReceipt(null);
                        setSelectedSaleForModal(null);
                      }}
                      className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {activeSubTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-neutral-900">Sales History</h3>
            <span className="text-xs font-bold text-neutral-500">{finalSales.length} Transactions</span>
          </div>
          
          <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-3">
            {finalSales.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-xs">No sales recorded yet.</div>
            ) : (
              finalSales.map(sale => (
                <div key={sale.id} className="border border-neutral-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-900">{sale.saleNumber}</p>
                      <p className="text-[10px] text-neutral-500">{new Date(sale.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-neutral-900 font-mono">₦{sale.totalAmount.toLocaleString('en-NG')}</p>
                    <p className="text-[10px] text-emerald-600 font-bold">{sale.paymentMethod}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {activeSubTab === 'reports' && (
        <div className="space-y-6">
          {/* Timeframe Toggles */}
          <div className="flex items-center justify-between bg-neutral-100 p-1 rounded-2xl">
            {['Today', 'This Week', 'This Month', 'This Year'].map((t) => (
              <button
                key={t}
                onClick={() => setReportTimeframe(t as any)}
                className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-black transition-all ${
                  reportTimeframe === t
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-100 rounded-[24px] p-5 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-neutral-900 font-mono">₦{metrics.totalSalesRevenue.toLocaleString('en-NG')}</p>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Revenue</p>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 rounded-[24px] p-5 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-neutral-900 font-mono">₦{metrics.totalSalesProfit.toLocaleString('en-NG')}</p>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Profit</p>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 rounded-[24px] p-5 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-neutral-900 font-mono">{metrics.totalItemsSold}</p>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Sales</p>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 rounded-[24px] p-5 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500 flex items-center justify-center text-white">
                <BarChart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-neutral-900 font-mono">
                  {metrics.totalSalesRevenue > 0 
                    ? ((metrics.totalSalesProfit / metrics.totalSalesRevenue) * 100).toFixed(0)
                    : '0'}%
                </p>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Profit Margin</p>
              </div>
            </div>
          </div>

          {/* Stock Health */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest pl-1">Stock Health</h3>
            <div className="bg-white border border-neutral-100 rounded-[24px] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold text-neutral-700">In Stock</span>
                </div>
                <span className="text-sm font-black text-neutral-900">{inventoryItems.filter(i => i.quantity > (i.reorderLevel || 10)).length} products</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm font-bold text-neutral-700">Low Stock</span>
                </div>
                <span className="text-sm font-black text-neutral-900">{metrics.lowStockCount} products</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-sm font-bold text-neutral-700">Out of Stock</span>
                </div>
                <span className="text-sm font-black text-neutral-900">{metrics.outOfStockCount} products</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-sm font-bold text-neutral-700">Expiry Alerts</span>
                </div>
                <span className="text-sm font-black text-neutral-900">0 products</span>
              </div>
            </div>
          </div>

          {/* Inventory Value Footer */}
          <div className="flex items-center justify-between bg-neutral-50 p-6 rounded-[24px] border border-neutral-100">
            <span className="text-sm font-bold text-neutral-600">Inventory Value</span>
            <span className="text-xl font-black text-indigo-600 font-mono">₦{metrics.totalStockValueRetail.toLocaleString('en-NG')}</span>
          </div>
        </div>
      )}

      {activeSubTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-neutral-900">Registered Suppliers</h3>
            <button
              onClick={handleOpenAddSupplier}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3" />
              Add Supplier
            </button>
          </div>
          
          <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-3">
            {suppliers.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Users className="w-12 h-12 text-neutral-200 mx-auto" />
                <p className="text-xs text-neutral-400 font-bold">No suppliers registered yet.</p>
              </div>
            ) : (
              suppliers.map(sup => (
                <div key={sup.id} className="border border-neutral-100 p-4 rounded-2xl flex items-center justify-between gap-4 group hover:border-emerald-100 hover:bg-emerald-50/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-neutral-900">{sup.name}</p>
                      <p className="text-[10px] text-neutral-500 font-bold">{sup.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditSupplier(sup)}
                      className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onDeleteSupplier(sup.id);
                        if (onLogSecurityEvent) {
                          onLogSecurityEvent(
                            'Other', 
                            `Deleted supplier: ${sup.name}`,
                            { supplierId: sup.id }
                          );
                        }
                      }}
                      className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'cashier_assignment' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-neutral-900 to-slate-900 text-white rounded-[28px] p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">Cashier Product & Stock Allocation</h3>
                <p className="text-xs text-neutral-300 font-medium mt-1">
                  Assign inventory products and allocate stock quantities to your cashiers for professional counter sales tracking and accountability.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="px-4 py-2 rounded-xl bg-white/10 text-emerald-300 text-xs font-mono font-bold border border-white/10">
                {registeredUsers.filter(u => ['Employee', 'Cashier', 'employee', 'cashier'].includes(u.role)).length} Active Cashiers
              </span>
            </div>
          </div>

          {/* Cashier Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {registeredUsers
              .filter(u => ['Employee', 'Cashier', 'employee', 'cashier'].includes(u.role))
              .map((cashier) => {
                const assignedItems = inventoryItems.filter(i => i.assignedCashierId === cashier.id || (i.assignedCashierName && i.assignedCashierName.toLowerCase() === cashier.name.toLowerCase()));
                const totalAssignedQty = assignedItems.reduce((sum, i) => sum + (i.allocatedQuantity || i.quantity || 0), 0);
                const totalAssignedValue = assignedItems.reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.allocatedQuantity || i.quantity || 0)), 0);

                return (
                  <div key={cashier.id} className="bg-white border border-neutral-200 rounded-[24px] p-6 shadow-sm space-y-4 hover:border-emerald-300 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 font-black text-base flex items-center justify-center border border-emerald-100">
                          {cashier.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-base font-black text-neutral-900 group-hover:text-emerald-600 transition-colors">{cashier.name}</h4>
                          <p className="text-[11px] font-bold text-neutral-400">{cashier.email || cashier.phone || 'Cashier Terminal'}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {cashier.role}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-100">
                      <div className="bg-neutral-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black uppercase text-neutral-400">Assigned Items</p>
                        <p className="text-lg font-black text-neutral-900 font-mono mt-0.5">{assignedItems.length}</p>
                      </div>
                      <div className="bg-neutral-50 p-3 rounded-xl">
                        <p className="text-[10px] font-black uppercase text-neutral-400">Allocated Value</p>
                        <p className="text-sm font-black text-emerald-600 font-mono mt-0.5">{formatNaira(totalAssignedValue)}</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningItem(inventoryItems[0] || null);
                          setAssignForm({ cashierId: cashier.id, cashierName: cashier.name, allocatedQuantity: '5' });
                          setIsCashierAssignModalOpen(true);
                        }}
                        className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-emerald-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Assign Product to {cashier.name.split(' ')[0]}
                      </button>
                    </div>
                  </div>
                );
            })}
            {registeredUsers.filter(u => ['Employee', 'Cashier', 'employee', 'cashier'].includes(u.role)).length === 0 && (
              <div className="col-span-full bg-white border border-dashed border-neutral-200 rounded-[24px] p-12 text-center space-y-3">
                <Users className="w-10 h-10 text-neutral-300 mx-auto" />
                <p className="text-sm font-bold text-neutral-600">No cashiers registered yet under your manager account.</p>
                <p className="text-xs text-neutral-400">Add cashiers in Staff Profile / Team oversight to start allocating products.</p>
              </div>
            )}
          </div>

          {/* Assigned Inventory Table */}
          <div className="bg-white border border-neutral-200 rounded-[28px] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h4 className="text-base font-black text-neutral-900 tracking-tight">Active Product Allocations</h4>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">Overview of all products assigned across your cashiers</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-[10px] font-black uppercase text-neutral-500 tracking-wider border-b border-neutral-200">
                    <th className="p-4">Product Name & SKU</th>
                    <th className="p-4">Assigned Cashier</th>
                    <th className="p-4">Allocated Qty</th>
                    <th className="p-4">Selling Price</th>
                    <th className="p-4">Total Value</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-bold text-neutral-800">
                  {inventoryItems.filter(i => i.assignedCashierId || i.assignedCashierName).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-neutral-400 font-medium">
                        No products have been assigned to cashiers yet. Click "Assign Product" on any cashier card above.
                      </td>
                    </tr>
                  ) : (
                    inventoryItems
                      .filter(i => i.assignedCashierId || i.assignedCashierName)
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover border border-neutral-200" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                                  {item.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-black text-neutral-900 text-sm">{item.name}</p>
                                <p className="text-[10px] font-mono text-neutral-400">SKU: {item.sku || 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-100">
                              {item.assignedCashierName || 'Assigned Cashier'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-black text-neutral-900">
                            {item.allocatedQuantity || item.quantity} {item.unit || 'pcs'}
                          </td>
                          <td className="p-4 font-mono font-bold text-neutral-700">
                            {formatNaira(item.sellingPrice)}
                          </td>
                          <td className="p-4 font-mono font-black text-emerald-600">
                            {formatNaira(item.sellingPrice * (item.allocatedQuantity || item.quantity || 0))}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningItem(item);
                                  setAssignForm({
                                    cashierId: item.assignedCashierId || '',
                                    cashierName: item.assignedCashierName || '',
                                    allocatedQuantity: (item.allocatedQuantity || item.quantity || 1).toString()
                                  });
                                  setIsCashierAssignModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs transition-all cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await onSaveItem({
                                    ...item,
                                    assignedCashierId: undefined,
                                    assignedCashierName: undefined,
                                    allocatedQuantity: undefined,
                                    updatedAt: new Date().toISOString()
                                  });
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-all cursor-pointer"
                              >
                                Unassign
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Assignment Modal */}
      {isCashierAssignModalOpen && assigningItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-neutral-900 tracking-tight">Assign Product to Cashier</h3>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">{assigningItem.name} (SKU: {assigningItem.sku})</p>
              </div>
              <button
                onClick={() => setIsCashierAssignModalOpen(false)}
                className="bg-neutral-100 text-neutral-500 hover:text-neutral-700 p-2 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCashierAssignment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">SELECT PRODUCT</label>
                <select
                  value={assigningItem.id}
                  onChange={(e) => {
                    const found = inventoryItems.find(i => i.id === e.target.value);
                    if (found) setAssigningItem(found);
                  }}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Stock: {item.quantity} {item.unit || 'pcs'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">SELECT CASHIER *</label>
                <select
                  required
                  value={assignForm.cashierId}
                  onChange={(e) => {
                    const c = registeredUsers.find(u => u.id === e.target.value);
                    setAssignForm({
                      ...assignForm,
                      cashierId: e.target.value,
                      cashierName: c ? c.name : ''
                    });
                  }}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="">-- Choose Cashier --</option>
                  {registeredUsers
                    .filter(u => ['Employee', 'Cashier', 'employee', 'cashier'].includes(u.role))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">ALLOCATED QUANTITY *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={assigningItem.quantity}
                  value={assignForm.allocatedQuantity}
                  onChange={(e) => setAssignForm({ ...assignForm, allocatedQuantity: e.target.value })}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <p className="text-[10px] text-neutral-400 font-medium">Available warehouse stock: {assigningItem.quantity} {assigningItem.unit || 'pcs'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCashierAssignModalOpen(false)}
                  className="w-full py-4 rounded-2xl text-sm font-black text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="space-y-6">
          {/* Audit Log Header */}
          <div className="bg-neutral-900 text-white rounded-[24px] p-6 shadow-lg flex items-center gap-4 border border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Security Audit Log</h3>
              <p className="text-[11px] text-neutral-400 font-bold">
                All security events for your team. Only visible to managers.
              </p>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['All', 'Login', 'Logout', 'Assignment', 'Sale', 'Product Added', 'Product Deleted', 'Unauthorized', 'Denied'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSecurityFilter(filter as any)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${
                  securityFilter === filter
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-white text-neutral-500 border-neutral-100 hover:bg-neutral-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Audit Events List */}
          <div className="space-y-3">
            {!securityEvents || securityEvents.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="relative inline-block">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="mt-4 text-xs font-black text-neutral-400 uppercase tracking-widest">Loading...</p>
                </div>
              </div>
            ) : (
              securityEvents
                .filter(e => securityFilter === 'All' || e.type === securityFilter)
                .map((event) => (
                  <div key={event.id} className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between gap-4 group hover:border-emerald-100 hover:bg-emerald-50/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        ['Unauthorized', 'Denied'].includes(event.type) ? 'bg-rose-50 text-rose-500' :
                        ['Sale', 'Product Added'].includes(event.type) ? 'bg-emerald-50 text-emerald-500' :
                        'bg-neutral-50 text-neutral-500'
                      }`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                            ['Unauthorized', 'Denied'].includes(event.type) ? 'bg-rose-100 text-rose-700' :
                            ['Sale', 'Product Added'].includes(event.type) ? 'bg-emerald-100 text-emerald-700' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                            {event.type}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {new Date(event.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm font-black text-neutral-800 mt-0.5">{event.description}</p>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">By: {event.userName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-neutral-400 font-bold">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
      {/* 8. ADD / EDIT SUPPLIER MODAL */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-xl font-black text-neutral-900 tracking-tight">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="bg-neutral-100 text-neutral-500 hover:text-neutral-700 p-2 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">SUPPLIER *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Distributors"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">PHONE</label>
                  <input
                    type="tel"
                    required
                    placeholder="080..."
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">EMAIL</label>
                  <input
                    type="email"
                    placeholder="Optional"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">ADDRESS</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">NOTES</label>
                <textarea
                  placeholder="Optional"
                  value={supplierFormData.notes}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="w-full py-4 rounded-2xl text-sm font-black text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 transition-all active:scale-95 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplier}
                  className="w-full py-4 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingSupplier ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Item Modal Integration */}
      {/* Search for SKU field in Modal later, adding the scanner call here first */}

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleBarcodeScan}
          onClose={() => setIsScannerOpen(false)}
          title={
            scannerTarget === 'pos' ? 'Scan Product for Cart' : 
            scannerTarget === 'catalog' ? 'Scan to Search Product' : 
            'Scan Product Barcode'
          }
        />
      )}
    </div>
  );
};
