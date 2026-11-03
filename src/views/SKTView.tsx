import React, { useState } from 'react';
import {
  CalendarClock,
  Plus,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Edit2,
  Trash2,
  History,
  X,
  ChevronDown,
  Tag,
  Trash,
  Sparkles,
} from 'lucide-react';
import { Product, ProductBatch, BatchStatus, UserProfile, BatchStatusHistory } from '../types';
import {
  getDaysUntilExpiration,
  getExpirationCategory,
  formatTurkishDate,
  getTodayDateString,
} from '../utils/dateValidation';
import {
  saveProduct,
  deleteProduct,
  saveBatch,
  deleteBatch,
  getBatchStatusHistory,
} from '../lib/supabase';

interface SKTViewProps {
  user: UserProfile;
  products: Product[];
  batches: ProductBatch[];
  onDataUpdated: () => void;
}

export const SKTView: React.FC<SKTViewProps> = ({
  user,
  products,
  batches,
  onDataUpdated,
}) => {
  // Tabs: 'all' | 'need_discount' | 'need_disposal' | 'disposed' | 'products'
  const [activeTab, setActiveTab] = useState<'all' | 'need_discount' | 'need_disposal' | 'disposed' | 'products'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedBatchHistory, setSelectedBatchHistory] = useState<BatchStatusHistory[]>([]);
  const [selectedBatchTitle, setSelectedBatchTitle] = useState('');

  // Quick Discount Modal
  const [discountModalBatch, setDiscountModalBatch] = useState<ProductBatch | null>(null);
  const [discountRate, setDiscountRate] = useState<number>(25);

  // Batch Form State
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const [batchProductId, setBatchProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [batchQuantity, setBatchQuantity] = useState('1');
  const [batchExpDate, setBatchExpDate] = useState('');
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('active');
  const [batchNotes, setBatchNotes] = useState('');

  // Product Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productBarcode, setProductBarcode] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDesc, setProductDesc] = useState('');

  const todayStr = getTodayDateString();

  // Categorize batches
  const batchesNeedDiscount = batches.filter((b) => {
    if (b.status === 'disposed' || b.status === 'consumed') return false;
    const { category } = getExpirationCategory(b.expiration_date);
    return category === 'critical' || category === 'warning';
  });

  const batchesNeedDisposal = batches.filter((b) => {
    if (b.status === 'disposed') return false;
    const { category } = getExpirationCategory(b.expiration_date);
    return category === 'expired';
  });

  // Filter batches based on tab and search
  const filteredBatches = batches.filter((b) => {
    // Search match
    const pName = b.product?.name || '';
    const bCode = b.product?.barcode || '';
    const bNum = b.batch_number || '';
    const matchesSearch =
      pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bCode.includes(searchQuery) ||
      bNum.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const { category } = getExpirationCategory(b.expiration_date);

    if (activeTab === 'need_discount') {
      return (category === 'critical' || category === 'warning') && b.status !== 'disposed';
    }
    if (activeTab === 'need_disposal') {
      return category === 'expired' && b.status !== 'disposed';
    }
    if (activeTab === 'disposed') {
      return b.status === 'disposed';
    }
    // 'all' tab shows non-disposed items by default
    return b.status !== 'disposed';
  });

  // Quick Action: Mark Disposed (Topla ve İmha Girişi Yap)
  const handleQuickDispose = async (batch: ProductBatch) => {
    const pName = batch.product?.name || 'Ürün';
    if (
      window.confirm(
        `"${pName}" ürününü reyonlardan toplayıp İMHA girişi yapmak istediğinize emin misiniz?`
      )
    ) {
      const existingNotes = batch.notes ? `${batch.notes} | ` : '';
      const updatedNotes = `${existingNotes}[RAFTAN TOPLANDI & İMHA EDİLDİ - ${formatTurkishDate(todayStr)}]`;

      await saveBatch({
        id: batch.id,
        product_id: batch.product_id,
        user_id: user.id,
        batch_number: batch.batch_number,
        quantity: batch.quantity,
        expiration_date: batch.expiration_date,
        status: 'disposed',
        notes: updatedNotes,
      });

      onDataUpdated();
    }
  };

  // Quick Action: Apply Discount (İndirim Girişi Yap)
  const handleApplyDiscountSubmit = async () => {
    if (!discountModalBatch) return;

    const existingNotes = discountModalBatch.notes ? `${discountModalBatch.notes} | ` : '';
    const updatedNotes = `${existingNotes}[SARI ETİKET %${discountRate} İNDİRİMİ UYGULANDI - ${formatTurkishDate(todayStr)}]`;

    await saveBatch({
      id: discountModalBatch.id,
      product_id: discountModalBatch.product_id,
      user_id: user.id,
      batch_number: discountModalBatch.batch_number,
      quantity: discountModalBatch.quantity,
      expiration_date: discountModalBatch.expiration_date,
      status: discountModalBatch.status,
      notes: updatedNotes,
    });

    setDiscountModalBatch(null);
    onDataUpdated();
  };

  // Open add batch modal
  const handleOpenAddBatch = () => {
    setEditingBatch(null);
    setBatchProductId(products[0]?.id || '');
    setBatchNumber(`PRT-${Date.now().toString().slice(-4)}`);
    setBatchQuantity('1');
    const in14Days = new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
    setBatchExpDate(in14Days);
    setBatchStatus('active');
    setBatchNotes('');
    setBatchModalOpen(true);
  };

  // Open edit batch modal
  const handleOpenEditBatch = (batch: ProductBatch) => {
    setEditingBatch(batch);
    setBatchProductId(batch.product_id);
    setBatchNumber(batch.batch_number || '');
    setBatchQuantity(batch.quantity.toString());
    setBatchExpDate(batch.expiration_date);
    setBatchStatus(batch.status);
    setBatchNotes(batch.notes || '');
    setBatchModalOpen(true);
  };

  // Save batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchProductId || !batchExpDate) return;

    await saveBatch({
      id: editingBatch ? editingBatch.id : undefined,
      product_id: batchProductId,
      user_id: user.id,
      batch_number: batchNumber,
      quantity: parseInt(batchQuantity) || 1,
      expiration_date: batchExpDate,
      status: batchStatus,
      notes: batchNotes,
    });

    setBatchModalOpen(false);
    onDataUpdated();
  };

  // Delete batch
  const handleDeleteBatch = async (id: string) => {
    if (window.confirm('Bu ürün partisini silmek istediğinize emin misiniz?')) {
      await deleteBatch(id, user.id);
      onDataUpdated();
    }
  };

  // View status history
  const handleViewHistory = async (batch: ProductBatch) => {
    const hist = await getBatchStatusHistory(batch.id);
    setSelectedBatchHistory(hist);
    setSelectedBatchTitle(batch.product?.name || 'Parti');
    setHistoryModalOpen(true);
  };

  // Save product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    await saveProduct({
      id: editingProduct ? editingProduct.id : undefined,
      user_id: user.id,
      name: productName.trim(),
      barcode: productBarcode.trim(),
      category: productCategory.trim(),
      description: productDesc.trim(),
    });

    setProductModalOpen(false);
    setProductName('');
    setProductBarcode('');
    setProductCategory('');
    setProductDesc('');
    setEditingProduct(null);
    onDataUpdated();
  };

  // Delete product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (window.confirm(`"${name}" ürününü ve tüm partilerini silmek istediğinize emin misiniz?`)) {
      await deleteProduct(id, user.id);
      onDataUpdated();
    }
  };

  return (
    <div className="space-y-4 pb-28 px-4 max-w-lg mx-auto">
      {/* ===================================================================== */}
      {/* 1. ÖZEL AKSİYON PANOLARI: TARİHİ YAKLAŞAN & TARİHİ GEÇEN ÇAĞRILARI   */}
      {/* ===================================================================== */}

      {/* A. TARİHİ YAKLAŞMIŞ ÜRÜNLER (İNDİRİM GİRİŞİ YAP) */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-4 text-white shadow-lg shadow-amber-900/15">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <Tag className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-md text-amber-100">
                  ⚠️ SKT YAKLAŞAN ({batchesNeedDiscount.length} Ürün)
                </span>
              </div>
              <h3 className="text-sm font-black text-white mt-1 leading-tight">
                Bu ürünlere indirim girişi yap!
              </h3>
              <p className="text-[11px] text-amber-100 mt-1 leading-relaxed">
                Son kullanma tarihine 7 gün ve daha az kalan ürünleri reyondan kontrol edip sarı etiket indirimi (%25 / %50) uygulayın.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('need_discount')}
            className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-all"
          >
            İndirim Bekleyenleri Listele ({batchesNeedDiscount.length})
          </button>
          <span className="text-[11px] text-amber-100 font-semibold">Sarı Etiket İndirimi</span>
        </div>
      </div>

      {/* B. TARİHİ GEÇMİŞ ÜRÜNLER (TOPLA VE İMHA GİRİŞİ YAP) */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 rounded-3xl p-4 text-white shadow-lg shadow-red-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <Trash className="w-5 h-5 text-red-100" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-md text-red-100">
                  🚨 TARİHİ GEÇEN ({batchesNeedDisposal.length} Ürün)
                </span>
              </div>
              <h3 className="text-sm font-black text-white mt-1 leading-tight">
                Topla, imha girişi yap!
              </h3>
              <p className="text-[11px] text-red-100 mt-1 leading-relaxed">
                Tarihi geçmiş ürünlerin satışı yasaktır. Reyonlardan derhal toplayıp sistemden imha/fire çıkışını tamamlayın.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('need_disposal')}
            className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-all"
          >
            İmha Edilecekleri Listele ({batchesNeedDisposal.length})
          </button>
          <span className="text-[11px] text-red-100 font-semibold">Fire / İmha Kaydı</span>
        </div>
      </div>

      {/* Top Action Buttons: Yeni Parti & Ürün Tanımla */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenAddBatch}
          className="flex-1 py-3 px-4 rounded-2xl bg-[#002B70] hover:bg-[#001D4D] text-[#FFE000] font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/15 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Parti Ekle</span>
        </button>

        <button
          onClick={() => {
            setEditingProduct(null);
            setProductName('');
            setProductBarcode('');
            setProductCategory('');
            setProductDesc('');
            setProductModalOpen(true);
          }}
          className="py-3 px-3.5 rounded-2xl bg-white border border-slate-200 text-[#002B70] font-bold text-xs flex items-center gap-1.5 hover:bg-slate-50 active:scale-95 transition-transform"
        >
          <Package className="w-4 h-4" />
          <span>Ürün Tanımla</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ürün adı, barkod veya parti ara..."
          className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0055D4]"
        />
      </div>

      {/* Segmented Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold text-slate-600 no-scrollbar">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'all'
              ? 'bg-[#002B70] text-white shadow-xs'
              : 'bg-white border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tüm Reyon ({batches.filter((b) => b.status !== 'disposed').length})
        </button>

        <button
          onClick={() => setActiveTab('need_discount')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
            activeTab === 'need_discount'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>İndirim Girişi ({batchesNeedDiscount.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('need_disposal')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
            activeTab === 'need_disposal'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-red-50 border border-red-200 text-red-800 hover:bg-red-100'
          }`}
        >
          <Trash className="w-3.5 h-3.5" />
          <span>Topla & İmha ({batchesNeedDisposal.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'products'
              ? 'bg-[#FFE000] text-[#002B70] shadow-xs'
              : 'bg-white border border-slate-200'
          }`}
        >
          Kayıtlı Ürünler ({products.length})
        </button>
      </div>

      {/* Batches View */}
      {activeTab !== 'products' ? (
        <div className="space-y-3">
          {filteredBatches.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 text-xs">
              Bu kriterde ürün partisi bulunmuyor.
            </div>
          ) : (
            filteredBatches.map((batch) => {
              const { category, daysRemaining, label } = getExpirationCategory(batch.expiration_date);
              const isExpired = category === 'expired';
              const isNeedDiscount = category === 'critical' || category === 'warning';
              const hasDiscountNote = batch.notes && batch.notes.includes('İNDİRİM');

              return (
                <div
                  key={batch.id}
                  className={`bg-white rounded-2xl p-4 border shadow-xs space-y-3 transition-colors ${
                    isExpired
                      ? 'border-red-300 ring-1 ring-red-200'
                      : isNeedDiscount
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900 truncate">
                          {batch.product?.name || 'Bilinmeyen Ürün'}
                        </span>
                        {batch.batch_number && (
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            {batch.batch_number}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Adet: <strong className="text-slate-800">{batch.quantity}</strong>
                        {batch.product?.barcode && ` · Barkod: ${batch.product.barcode}`}
                      </p>
                    </div>

                    {/* Expiration badge */}
                    <div
                      className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 flex items-center gap-1 ${
                        isExpired
                          ? 'bg-red-100 text-red-700'
                          : category === 'critical'
                          ? 'bg-red-50 text-red-600 animate-pulse'
                          : category === 'warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isExpired ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <CalendarClock className="w-3.5 h-3.5" />
                      )}
                      <span>{label}</span>
                    </div>
                  </div>

                  {/* Notes / Tag info if any */}
                  {batch.notes && (
                    <p className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 font-medium">
                      {batch.notes}
                    </p>
                  )}

                  {/* ========================================================= */}
                  {/* ÖZEL AKSİYON BUTONLARI (İNDİRİM GİRİŞİ VEYA TOPLA-İMHA ET) */}
                  {/* ========================================================= */}
                  {isExpired && batch.status !== 'disposed' && (
                    <div className="bg-red-50 p-2.5 rounded-xl border border-red-200 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-red-800 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                        <span>Tarihi geçmiş! Raftan topla:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickDispose(batch)}
                        className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-transform flex items-center gap-1 shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>Topla & İmha Et</span>
                      </button>
                    </div>
                  )}

                  {isNeedDiscount && batch.status !== 'disposed' && (
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-amber-900 font-bold flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span>{hasDiscountNote ? 'İndirim uygulandı' : 'SKT yaklaştı!'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountModalBatch(batch);
                          setDiscountRate(25);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-transform flex items-center gap-1 shrink-0"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>İndirim Girişi Yap</span>
                      </button>
                    </div>
                  )}

                  {/* Footer metadata & standard actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      SKT: <strong className="text-slate-700">{formatTurkishDate(batch.expiration_date)}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleViewHistory(batch)}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
                        title="Durum Geçmişi"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditBatch(batch)}
                        className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Products Management List */
        <div className="space-y-2">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{prod.name}</p>
                <p className="text-[11px] text-slate-500">
                  {prod.barcode ? `Barkod: ${prod.barcode}` : 'Barkodsuz'}
                  {prod.category && ` · ${prod.category}`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingProduct(prod);
                    setProductName(prod.name);
                    setProductBarcode(prod.barcode || '');
                    setProductCategory(prod.category || '');
                    setProductDesc(prod.description || '');
                    setProductModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                  title="Ürünü Düzenle"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                  title="Ürünü Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QUICK DISCOUNT MODAL */}
      {discountModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">İndirim Girişi Yap</h3>
              </div>
              <button
                type="button"
                onClick={() => setDiscountModalBatch(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              <strong className="text-slate-900">{discountModalBatch.product?.name}</strong> için sarı etiket indirim oranını seçin:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountRate(25)}
                className={`py-3 px-4 rounded-2xl border text-center transition-all ${
                  discountRate === 25
                    ? 'bg-amber-500 text-white font-black border-amber-600 shadow-md ring-2 ring-amber-200'
                    : 'bg-white text-slate-700 border-slate-200 font-bold hover:bg-slate-50'
                }`}
              >
                <span className="text-lg block">%25</span>
                <span className="text-[10px]">Sarı Etiket</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscountRate(50)}
                className={`py-3 px-4 rounded-2xl border text-center transition-all ${
                  discountRate === 50
                    ? 'bg-amber-600 text-white font-black border-amber-700 shadow-md ring-2 ring-amber-200'
                    : 'bg-white text-slate-700 border-slate-200 font-bold hover:bg-slate-50'
                }`}
              >
                <span className="text-lg block">%50</span>
                <span className="text-[10px]">Sarı Etiket</span>
              </button>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDiscountModalBatch(null)}
                className="w-1/3 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleApplyDiscountSubmit}
                className="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md"
              >
                İndirimi Uygula ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH MODAL (Yeni / Düzenle) */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingBatch ? 'Parti Düzenle' : 'Yeni SKT Partisi Ekle'}
              </h3>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ürün</label>
                <select
                  value={batchProductId}
                  onChange={(e) => setBatchProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `(${p.barcode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parti No</label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="PRT-101"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adet</label>
                  <input
                    type="number"
                    min="1"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Son Kullanma Tarihi (SKT)
                </label>
                <input
                  type="date"
                  value={batchExpDate}
                  onChange={(e) => setBatchExpDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Not / Konum</label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Örn: Süt reyonu ön sıra"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-[#002B70] text-white font-bold text-xs shadow-md"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Tanımla'}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ürün Adı</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Örn: Mis Tam Yağlı Süt 1L"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barkod</label>
                  <input
                    type="text"
                    value={productBarcode}
                    onChange={(e) => setProductBarcode(e.target.value)}
                    placeholder="8690..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    placeholder="Süt & Kahvaltılık"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-[#002B70] text-white font-bold text-xs shadow-md"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {selectedBatchTitle} - Durum Geçmişi
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedBatchHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Kayıtlı geçmiş bulunamadı.</p>
              ) : (
                selectedBatchHistory.map((h) => (
                  <div key={h.id} className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>{h.old_status} ➔ {h.new_status}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {h.changed_at?.slice(0, 10)}
                      </span>
                    </div>
                    {h.notes && <p className="text-[10px] text-slate-500">{h.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
