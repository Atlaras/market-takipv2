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
  // Tabs: all, critical, warning, expired, products
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'expired' | 'products'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedBatchHistory, setSelectedBatchHistory] = useState<BatchStatusHistory[]>([]);
  const [selectedBatchTitle, setSelectedBatchTitle] = useState('');

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

  // Filter batches
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
    if (activeTab === 'critical') return category === 'critical';
    if (activeTab === 'warning') return category === 'warning';
    if (activeTab === 'expired') return category === 'expired';
    return true;
  });

  // Open add batch modal
  const handleOpenAddBatch = () => {
    setEditingBatch(null);
    setBatchProductId(products[0]?.id || '');
    setBatchNumber(`PRT-${Date.now().toString().slice(-4)}`);
    setBatchQuantity('1');
    // Future date is default and normal!
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
    if (window.confirm(`"${name}" ürününü ve bu ürüne ait tüm partileri silmek istediğinize emin misiniz?`)) {
      await deleteProduct(id, user.id);
      onDataUpdated();
    }
  };

  return (
    <div className="space-y-4 pb-24 px-4">
      {/* Top Action Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenAddBatch}
          className="flex-1 py-3 px-4 rounded-2xl bg-[#002B70] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/15 active:scale-95 transition-transform"
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
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold text-slate-600 no-scrollbar">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'all' ? 'bg-[#002B70] text-white shadow-xs' : 'bg-white border border-slate-200'
          }`}
        >
          Tüm Partiler ({batches.length})
        </button>
        <button
          onClick={() => setActiveTab('critical')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'critical' ? 'bg-red-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-red-600'
          }`}
        >
          Kritik (≤3 Gün)
        </button>
        <button
          onClick={() => setActiveTab('warning')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'warning' ? 'bg-amber-500 text-white shadow-xs' : 'bg-white border border-slate-200 text-amber-600'
          }`}
        >
          Yaklaşan (≤7 Gün)
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'expired' ? 'bg-slate-800 text-white shadow-xs' : 'bg-white border border-slate-200'
          }`}
        >
          Tarihi Geçen
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            activeTab === 'products' ? 'bg-[#FFE000] text-[#002B70] shadow-xs' : 'bg-white border border-slate-200'
          }`}
        >
          Kayıtlı Ürünler ({products.length})
        </button>
      </div>

      {/* Batches View */}
      {activeTab !== 'products' ? (
        <div className="space-y-2.5">
          {filteredBatches.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 text-xs">
              Bu kriterde ürün partisi bulunmuyor.
            </div>
          ) : (
            filteredBatches.map((batch) => {
              const { category, daysRemaining, label } = getExpirationCategory(batch.expiration_date);

              return (
                <div
                  key={batch.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
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
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 ${
                        category === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : category === 'critical'
                          ? 'bg-red-50 text-red-600 animate-pulse'
                          : category === 'warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {category === 'expired' || category === 'critical' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <CalendarClock className="w-3.5 h-3.5" />
                      )}
                      <span>{label}</span>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {batch.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      {batch.notes}
                    </p>
                  )}

                  {/* Footer actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      SKT: <strong className="text-slate-700">{formatTurkishDate(batch.expiration_date)}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewHistory(batch)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded"
                        title="Durum Geçmişi"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditBatch(batch)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded"
                        title="Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded"
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
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Yeni / Düzenle Parti */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#002B70]">
                {editingBatch ? 'Partiyi Düzenle' : 'Yeni SKT Partisi Ekle'}
              </h3>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ürün Seçiniz
                </label>
                <select
                  value={batchProductId}
                  onChange={(e) => setBatchProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parti No / Kodu
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="PRT-01"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Miktar (Adet)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 tabular-nums font-bold"
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  * SKT tarihinin gelecekte olması normaldir.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Parti Durumu
                </label>
                <select
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as BatchStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                >
                  <option value="active">Reyonda / Aktif</option>
                  <option value="warning">Yaklaşan / İndirim Etiketi</option>
                  <option value="expired">Tarihi Geçti (İmha / İade)</option>
                  <option value="consumed">Satıldı / Tükendi</option>
                  <option value="disposed">İmha Edildi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Not / Açıklama
                </label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Örn: Sarı etiket yapıştırıldı"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-[#002B70] text-white text-xs font-bold"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ürün Tanımla */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#002B70]">
                {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Tanımla'}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ürün Adı
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Örn: Mis Süt 1L"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Barkod (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={productBarcode}
                  onChange={(e) => setProductBarcode(e.target.value)}
                  placeholder="8690504..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  placeholder="Örn: Süt & Kahvaltılık, Temel Gıda..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-[#002B70] text-white text-xs font-bold"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Durum Değişiklik Geçmişi */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 text-slate-900 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#002B70]">
                Durum Geçmişi - {selectedBatchTitle}
              </h3>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {selectedBatchHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Kayıtlı durum değişikliği bulunmuyor.
                </p>
              ) : (
                selectedBatchHistory.map((h) => (
                  <div key={h.id} className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>{h.previous_status} ➔ {h.new_status}</span>
                      <span className="text-[10px] text-slate-400">{h.created_at?.slice(0, 16)}</span>
                    </div>
                    {h.notes && <p className="text-slate-500 text-[11px]">{h.notes}</p>}
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
