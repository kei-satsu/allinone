import React from 'react';
import { printVoucher } from '@/utils/print';

// Order Data Type Definition
export interface ParcelOrder {
  id?: string | number;
  item_id: string;
  branch?: 'MDY' | 'YGN' | string;
  status?: 'Delivered' | 'Pending' | 'In-Transit' | string;
  sender_name?: string;
  sender_loc?: string;
  receiver_name?: string;
  receiver_loc?: string;
  receiver_phone?: string;
  receiver_address?: string;
  transit_to?: string;
  transit_date?: string | Date;
  fee_type?: string;
  cod_amount?: number;
  deli_fee?: number;
  agent_fee?: number;
  total_amount?: number;
  pickup_rider?: { name: string };
  deliver_rider?: { name: string };
  received_date?: string;
  deliver_date?: string;
  cleard_date?: string;
  created_at?: string | Date;
  image_url?: string;
  note?: string;
  remark?: string;
}

interface ParcelDetailModalProps {
  order: ParcelOrder | null;
  onClose: () => void;
  onEdit?: (order: ParcelOrder) => void;
  onPreviewImage?: (imageUrl: string) => void;
}

export const ParcelDetailModal: React.FC<ParcelDetailModalProps> = ({
  order,
  onClose,
  onEdit,
  onPreviewImage,
}) => {
  // Modal မဖွင့်ထားရင် သို့မဟုတ် Order ရွေးမထားရင် Component ကို မပြပါ
  if (!order) return null;

  const handleEdit = () => {
    if (onEdit) {
      onEdit(order);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-end sm:items-center justify-center p-0 sm:p-4 z-61 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Responsive Modal Container */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl lg:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex justify-between items-center shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider">
                Parcel Details
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
                order.branch === 'MDY' 
                  ? 'bg-orange-50 text-orange-700 border-orange-200' 
                  : order.branch === 'YGN' 
                  ? 'bg-purple-50 text-purple-700 border-purple-200' 
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                {order.branch === 'MDY' ? 'MANDALAY' : order.branch === 'YGN' ? 'YANGON' : order.branch || '-'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                order.status === 'Delivered' ? 'bg-green-50 text-green-700 border border-green-200' : 
                order.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                order.status === 'In-Transit' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>{order.status || 'At Office'}</span>
            </div>
            <h3 className="text-base font-mono font-bold text-gray-900 mt-1 break-words">ID: {order.item_id}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200/70 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors ml-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-6 text-sm flex-1 overflow-y-auto bg-white">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* 📦 LEFT COLUMN: Route & Logistics Info */}
            <div className="flex flex-col gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">📍 Route Information</h4>
              
              <div className="space-y-1">
                <span className="text-gray-400 text-xs block">Sender (ပို့သူ)</span>
                <div className="text-gray-900 font-semibold text-sm break-words">
                  {order.sender_name || '-'} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-1">({order.sender_loc || '-'})</span>
                </div>
              </div>
              
              <div className="space-y-1 pt-1">
                <span className="text-gray-400 text-xs block">Receiver (ယူသူ)</span>
                <div className="text-gray-900 font-semibold text-sm break-words">
                  {order.receiver_name || '-'} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-1">({order.receiver_loc || '-'})</span>
                </div>
              </div>

              {order.receiver_phone && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex justify-between items-center gap-4 mt-1">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-orange-400 uppercase block mb-0.5">Phone Number</span>
                    <span className="font-mono font-bold text-orange-800 text-base block break-words">{order.receiver_phone}</span>
                  </div>
                  <a href={`tel:${order.receiver_phone}`} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm text-xs shrink-0 transition-colors">ခေါ်ဆိုရန်</a>
                </div>
              )}

              {order.receiver_address && (
                <div className="space-y-1 pt-1">
                  <span className="text-gray-400 text-xs block">Full Address</span>
                  <p className="text-gray-800 font-medium leading-relaxed break-words whitespace-pre-wrap bg-white p-3 rounded-xl border border-gray-100">
                    {order.receiver_address}
                  </p>
                </div>
              )}

              {/* Transit Block */}
              {(order.transit_to || order.transit_date) && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 mt-1">
                  <div>
                    <span className="text-gray-400 text-xs block">Transit To</span>
                    <span className="font-semibold text-gray-800 break-words">{order.transit_to || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Transit Date</span>
                    <span className="font-semibold text-gray-800 font-mono break-words">
                      {order.transit_date ? new Date(order.transit_date).toLocaleDateString() : '-'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 💵 RIGHT COLUMN: Financials & Riders */}
            <div className="flex flex-col gap-5">
              
              {/* Financial Details Box */}
              <div className="flex flex-col gap-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">💵 Financials</h4>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Payment Type</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-semibold text-gray-600 border border-gray-200">{order.fee_type || '-'}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">COD Amount</span>
                  <span className="font-semibold text-gray-900 font-mono">{order.cod_amount?.toLocaleString() || 0} Ks</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span className="font-semibold text-gray-900 font-mono">{order.deli_fee?.toLocaleString() || 0} Ks</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Agent Fee</span>
                  <span className="font-semibold text-gray-900 font-mono">{order.agent_fee?.toLocaleString() || 0} Ks</span>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-200 mt-1">
                  <span className="text-gray-900 font-bold">Total Net Amount</span>
                  <span className="text-base font-mono font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
                    {order.total_amount?.toLocaleString() || 0} Ks
                  </span>
                </div>
              </div>

              {/* Riders Allocation */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[11px] text-gray-400 font-bold uppercase block mb-1">Pickup Rider</span>
                  <span className="font-semibold text-gray-800 break-words">{order.pickup_rider?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 font-bold uppercase block mb-1">Delivery Rider</span>
                  <span className="font-semibold text-gray-800 break-words">{order.deliver_rider?.name || '-'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* ⏱️ System Lifecycle Dates Grid */}
          <div className="bg-gray-50/30 border border-gray-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Received Date</span>
              <span className="font-medium text-gray-700 font-mono break-words">{order.received_date || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Deliver Date</span>
              <span className="font-medium text-gray-700 font-mono break-words">{order.deliver_date || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Cleared Date</span>
              <span className="font-medium text-gray-700 font-mono break-words">{order.cleard_date || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">Created At</span>
              <span className="font-medium text-gray-700 font-mono break-words">
                {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>

          {/* Attached Photo Details */}
          {order.image_url && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-gray-400 font-bold uppercase">Attached Photo</span>
              <div 
                onClick={() => onPreviewImage && onPreviewImage(order.image_url!)}
                className="relative rounded-xl overflow-hidden border border-gray-200 max-h-52 bg-gray-50 flex items-center justify-center cursor-zoom-in group shadow-sm"
              >
                <img src={order.image_url} alt="Parcel Attachment" className="max-w-full max-h-52 object-contain transition-transform duration-200 group-hover:scale-[1.02]" />
                <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 text-[10px] text-white rounded-md backdrop-blur-[2px]">Zoom Image</div>
              </div>
            </div>
          )}

          {/* Special Notes & Custom Warning Blocks */}
          {order.note && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl font-medium break-words leading-relaxed">
              ⚠️ <strong>Note:</strong> {order.note === 'RT' ? 'Return Item (ပစ္စည်းပြန်အပ်ငွေ)' : order.note}
            </div>
          )}

          {/* 📝 Remark Column Section */}
          {order.remark && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3.5 rounded-xl font-medium break-words leading-relaxed">
              📝 <strong>Remark:</strong> {order.remark}
            </div>
          )}

        </div>
        
        {/* Modal Footer Actions */}
<div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3 shrink-0">
  
  {/* 🖨️ Print Voucher Button */}
  <button 
    onClick={() => printVoucher(order.item_id)}
    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-center shadow-md transition-colors text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m11.32-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231a1.125 1.125 0 01-1.12-1.227L6.34 18m11.32 0H6.34M16.5 6h-9A1.5 1.5 0 006 7.5v3A1.5 1.5 0 007.5 12h9a1.5 1.5 0 001.5-1.5v-3A1.5 1.5 0 0016.5 6z" />
    </svg>
    Print Voucher
  </button>

  {/* ✏️ Edit Order Button 
    <button 
      onClick={handleEdit}
      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl text-center shadow-md transition-colors text-sm"
    >
      Edit Order
    </button>
 */}

  <button 
    onClick={onClose}
    className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors text-sm"
  >
    Close
  </button>
</div>

      </div>
    </div>
  );
};

