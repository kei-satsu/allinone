"use client"

import React, { forwardRef } from 'react'
import MultiSelectFilter from '@/components/MultiSelectFilter'

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

interface OrderTableProps {
  orders: any[];
  columnDefs: ColumnDef[];
  visibleCols: Record<string, boolean>;
  showFilterBar: boolean;
  colFilters: Record<string, any>;
  onFilterChange: (colKey: string, val: any) => void;
  riders: any[];
  locationOptions: string[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  
  // Selection Props
  selectedOrders: Set<string>;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleOrderSelection: (id: string) => void;
  onRowMouseDown: (id: string) => void;
  onRowMouseEnter: (id: string) => void;
  onStopDragging: () => void;

  // Event Callbacks
  onRowClick: (order: any) => void;
  onRowContextMenu: (e: React.MouseEvent, order: any) => void;
  onPreviewImage: (url: string) => void;
}

// forwardRef ဖြင့် Component ကို ပတ်ပေးပါ
const OrderTable = forwardRef<HTMLDivElement, OrderTableProps>(({
  orders,
  columnDefs,
  visibleCols,
  showFilterBar,
  colFilters,
  onFilterChange,
  riders,
  locationOptions,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  selectedOrders,
  isAllSelected,
  onToggleSelectAll,
  onToggleOrderSelection,
  onRowMouseDown,
  onRowMouseEnter,
  onStopDragging,
  onRowClick,
  onRowContextMenu,
  onPreviewImage,
}, ref) => {

  const dynamicStatusOptions = Array.from(
    new Set(orders.map((o) => o.status).filter(Boolean))
  ).map((status) => ({
    label: String(status),
    value: String(status),
  }));

  const filterInputCls = "w-full bg-transparent border-b border-gray-300 focus:border-orange-500 focus:outline-none py-1 text-[11px] text-gray-700 placeholder:text-gray-400 font-medium transition-colors";

  // Table Cell တစ်ခုချင်းစီ၏ Render Logic
  const renderCell = (o: any, key: string) => {
    if (key === 'branch') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
        o.branch === 'MDY' 
          ? 'bg-orange-50 text-orange-700 border-orange-200' 
          : o.branch === 'YGN' 
          ? 'bg-purple-50 text-purple-700 border-purple-200' 
          : 'bg-gray-50 text-gray-600 border-gray-200'
      }`}>
        {o.branch === 'MDY' ? 'MANDALAY' : o.branch === 'YGN' ? 'YANGON' : o.branch}
      </span>
    );
    if (key === 'status') return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
        o.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
        o.status === 'Settled' ? 'bg-green-700 text-white border border-white' : 
        o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
        o.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}>{o.status}</span>
    );
    if (key === 'image_url') return (
      <div className="flex items-center justify-center">
        {o.image_url ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPreviewImage(o.image_url); }}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            title="ပုံကြည့်ရန် နှိပ်ပါ"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        ) : (
          <span className="p-1 text-gray-300" title="ပုံမရှိပါ">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>
    );
    if (['cod_amount', 'deli_fee', 'total_amount'].includes(key)) return (
      <span className={key === 'total_amount' ? 'font-bold text-gray-900' : ''}>
        {o[key]?.toLocaleString() || '-'}
      </span>
    );
    if (key === 'fee_type') return <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 border border-gray-200">{o[key] || '-'}</span>;
    if (key === 'pickup_rider') return <span className="text-gray-600">{o.pickup_rider?.name || '-'}</span>;
    if (key === 'deliver_rider') return <span className="text-gray-600">{o.deliver_rider?.name || '-'}</span>;
    if (key === 'created_at') return <span className="text-gray-500">{new Date(o.created_at).toLocaleDateString()}</span>;
    return o[key] || '-';
  };

  return (
    // Parent မှ ရောက်လာသော ref ကို ဒီနေရာတွင် တပ်ဆင်ပေးပါ
    <div ref={ref} className="flex-1 overflow-auto bg-white sm:mx-5 sm:my-3 sm:rounded-lg sm:border sm:border-gray-200 sm:shadow-sm">
      
      {/* 💻 Desktop Table View */}
      <div className="hidden sm:block min-w-[800px] lg:min-w-0">
        <table className="w-full text-left whitespace-nowrap text-[12px]">
          <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgba(229,231,235,1)]">
            <tr className="text-gray-400 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-2 text-center w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-orange-500 rounded border-gray-300 accent-orange-500 cursor-pointer"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                />
              </th>
              {columnDefs.map(col => visibleCols[col.key] && (
                <th key={col.key} className={`py-2.5 px-3 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''} ${col.key === 'image_url' ? 'text-center' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>

            {showFilterBar && (
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="w-10 px-2 py-1.5" />
                {columnDefs.map(col => visibleCols[col.key] && (
                  <th key={`filter-${col.key}`} className="px-2 py-1.5 font-normal">
                    {col.key === 'image_url' ? (
                      <div className="h-5" />
                    ) : ['branch', 'status', 'fee_type', 'pickup_rider', 'deliver_rider', 'sender_loc', 'receiver_loc'].includes(col.key) ? (
                      <MultiSelectFilter
                        label={col.label}
                        options={
                          col.key === 'branch'
                            ? [{ label: 'MDY', value: 'MDY' }, { label: 'YGN', value: 'YGN' }]
                            : col.key === 'status'
                              ? dynamicStatusOptions
                              : col.key === 'fee_type'
                                ? [
                                    { label: 'Deli', value: 'Deli' },
                                    { label: 'Kpay', value: 'Kpay' },
                                    { label: 'Cash', value: 'Cash' },
                                    { label: 'Bill', value: 'Bill' },
                                  ]
                                : col.key === 'pickup_rider' || col.key === 'deliver_rider'
                                  ? riders.map(r => ({ label: r.name, value: r.name }))
                                  : locationOptions.map(loc => ({ label: loc, value: loc }))
                        }
                        selectedValues={Array.isArray(colFilters[col.key]) ? colFilters[col.key] : []}
                        onChange={(values) => onFilterChange(col.key, values)}
                      />
                    ) : ['received_date', 'deliver_date', 'cleared_date', 'created_at', 'transit_date','arrival_date'].includes(col.key) ? (
                      <input
                        type="date"
                        className={filterInputCls}
                        value={typeof colFilters[col.key] === 'string' ? colFilters[col.key] : ''}
                        onChange={(e) => onFilterChange(col.key, e.target.value)}
                      />
                    ) : (
                      <input 
                        className={filterInputCls}
                        placeholder="Filter..." 
                        value={typeof colFilters[col.key] === 'string' ? colFilters[col.key] : ''}
                        onChange={e => onFilterChange(col.key, e.target.value)} 
                      />
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columnDefs.length + 1} className="p-20 text-center">
                  <div className="inline-flex items-center gap-3 text-gray-400 font-medium text-sm">
                    <span className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    Loading Records...
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {orders.map((o) => (
                  <tr 
                    key={o.id} 
                    onClick={() => onRowClick(o)}
                    onContextMenu={(e) => onRowContextMenu(e, o)} 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onRowMouseDown(o.id);
                    }}
                    onMouseEnter={() => onRowMouseEnter(o.id)}
                    onMouseUp={onStopDragging}
                    className="hover:bg-gray-50/80 transition-colors cursor-context-menu select-none"
                  >
                    <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-orange-500 rounded border-gray-300 accent-orange-500 cursor-pointer"
                        checked={selectedOrders.has(o.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={() => onToggleOrderSelection(o.id)}
                      />
                    </td>
                    {columnDefs.map(col => visibleCols[col.key] && (
                      <td key={`${o.id}-${col.key}`} className={`py-2.5 px-3 text-gray-700 ${['cod_amount', 'deli_fee', 'total_amount'].includes(col.key) ? 'text-right' : ''}`}>
                        {renderCell(o, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {hasMore && (
                  <tr>
                    <td colSpan={columnDefs.filter(col => visibleCols[col.key]).length + 1} className="px-3 py-3">
                      <button
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-700 transition-all hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingMore ? 'Loading...' : 'Load More'}
                      </button>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 Mobile Optimized Card List */}
      <div className="sm:hidden flex flex-col divide-y divide-gray-100 h-full overflow-y-auto bg-gray-50 pb-20">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2 justify-center">
            <span className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            Loading Records...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs font-medium">
            မှတ်တမ်းများ မရှိသေးပါ (သို့) ရှာဖွေမှု မတွေ့ရှိပါ။
          </div>
        ) : (
          <>
            {orders.map((o) => (
              <div 
                key={o.id} 
                onClick={() => onRowClick(o)}
                className="bg-white p-3.5 flex flex-col gap-2.5 shadow-sm border-b border-gray-100 active:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-orange-500 rounded border-gray-300 accent-orange-500 cursor-pointer"
                      checked={selectedOrders.has(o.id)}
                      onChange={() => onToggleOrderSelection(o.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="font-mono font-bold text-gray-900 text-sm">{o.item_id}</span>
                    {renderCell(o, 'branch')}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {renderCell(o, 'status')}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRowContextMenu(e, o); }}
                      className="p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-500 active:bg-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-gray-50 py-2 bg-gray-50/40 rounded-md px-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Sender</span>
                    <span className="font-medium text-gray-800 truncate block">{o.sender_name || '-'} ({o.sender_loc || '-'})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Receiver</span>
                    <span className="font-medium text-gray-800 truncate block">{o.receiver_name || '-'} ({o.receiver_loc || '-'})</span>
                  </div>
                  {o.receiver_phone && (
                    <div className="col-span-2 pt-0.5">
                      <a 
                        href={`tel:${o.receiver_phone}`} 
                        className="text-orange-600 font-semibold inline-flex items-center gap-1 hover:underline text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 {o.receiver_phone} (နှိပ်၍ ဖုန်းခေါ်ရန်)
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex gap-4 text-gray-500 text-[11px]">
                    <span>COD: <strong className="text-gray-700">{o.cod_amount?.toLocaleString() || 0} Ks</strong></span>
                    <span>Deli: <strong className="text-gray-700">{o.deli_fee?.toLocaleString() || 0} Ks</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-bold text-xs">Total: {o.total_amount?.toLocaleString() || 0} Ks</span>
                    {o.image_url ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPreviewImage(o.image_url); }}
                        className="p-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    ) : (
                      <span className="p-1 text-gray-300 bg-gray-50 rounded-md">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))}
            {hasMore && (
              <div className="border-t border-gray-100 bg-white p-3">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-700 transition-all hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!loading && orders.length === 0 && (
        <div className="hidden sm:block p-16 text-center text-gray-400 font-medium">
          မှတ်တမ်းများ မရှိသေးပါ (သို့) ရှာဖွေမှု မတွေ့ရှိပါ။
        </div>
      )}
    </div>
  );
});

OrderTable.displayName = 'OrderTable';

export default OrderTable;