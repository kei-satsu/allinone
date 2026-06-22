import React from 'react';

export default function VoucherTemplate() {
  return (
    // 'page-wrapper' class added for strict print targeting
    <div className="page-wrapper min-h-screen bg-gray-900 py-10 flex flex-col items-center justify-center font-sans antialiased">
      
      {/* Screen Only Label - Completely hidden on print via 'screen-only' */}
      <div className="screen-only mb-4 text-gray-400 text-sm flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        4x6 Thermal Paper Print Preview (Press Ctrl + P to test print)
      </div>

      {/* Printable Voucher Container */}
      <div 
        style={{ width: '4in', height: '6in' }} 
        className="printable-voucher bg-white text-black p-3 flex flex-col justify-between select-none box-border relative shadow-2xl"
      >
        {/* Strict Print Area Controls */}
        <style dangerouslySetInnerHTML={{__html: `
          @page { 
            size: 4in 6in; 
            margin: 0; 
          }
          @media print {
            /* 1. Hide everything inside the body */
            body * {
              visibility: hidden;
            }
            /* 2. Unhide ONLY the voucher and its child elements */
            .printable-voucher, .printable-voucher * {
              visibility: visible;
            }
            /* 3. Force the voucher to mount exactly at the top-left of the print page */
            .printable-voucher {
              position: absolute;
              left: 0;
              top: 0;
              width: 4in !important;
              height: 6in !important;
              box-shadow: none !important;
              padding: 12px !important; /* matches p-3 */
            }
            /* 4. Fix background color printing for lines/tables */
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background: transparent;
            }
          }
        `}} />

        <div>
          {/* HEADER SECTION: Logo & Brand */}
          <div className="flex items-center gap-2 border-b border-black pb-1.5">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-full border-2 border-black font-black italic text-base">
              A
              <div className="absolute inset-[1px] rounded-full border border-black opacity-40"></div>
            </div>
            <h1 className="text-xl font-black tracking-tight font-sans">ALL IN ONE EXPRESS</h1>
          </div>

          {/* DATE & ITEM ID ROW */}
          <div className="flex justify-between items-baseline mt-1.5 text-[11px]">
            <div>
              <span className="font-bold">Date:</span> <span className="font-mono text-xs">{'{receive_date}'}</span>
            </div>
            <div className="text-sm font-black font-mono tracking-tight">
              {'{item_id}'}
            </div>
          </div>

          {/* OFFICE ADDRESSES & QR CODE */}
          <div className="flex justify-between gap-1 items-start mt-1.5 text-[10px] leading-tight">
            <div className="flex flex-1">
              {/* Left Column Labels */}
              <div className="w-[62px] font-bold shrink-0 flex flex-col gap-1">
                <div>MDY Office:</div>
                <div className="mt-1">YGN Office:</div>
              </div>
              
              {/* Vertical Divider Line */}
              <div className="w-[1px] bg-black mx-1 self-stretch"></div>
              
              {/* Right Column Content */}
              <div className="flex flex-col gap-1.5 pl-0.5 pr-1">
                <div>No.Nga-6/93, 62A, between 109 & 109B, Mandalay.09-889988856</div>
                <div>No.280,Corner of Du Yar St.& Ba La Min Htin St., 50 ward, North Dagon, Yangon.</div>
              </div>
            </div>

            {/* Simulated Clean Mockup QR Code */}
            <div className="w-16 h-16 border border-black p-0.5 shrink-0 flex flex-wrap content-between justify-between">
              <div className="w-4 h-4 border-2 border-black"></div>
              <div className="w-4 h-4 bg-black"></div>
              <div className="w-4 h-4 border-2 border-black"></div>
              <div className="w-full h-1 bg-black my-0.5"></div>
              <div className="w-2 h-2 bg-black"></div>
              <div className="w-5 h-2 border border-black flex flex-wrap"><div className="w-1 h-1 bg-black"></div></div>
              <div className="w-4 h-4 border-2 border-black"></div>
              <div className="w-2 h-2 bg-black"></div>
              <div className="w-4 h-4 border-2 border-black"></div>
            </div>
          </div>

          {/* SENDER SECTION */}
          <div className="mt-2.5">
            <div className="text-center font-bold text-xs tracking-wider border-y border-black py-[2px] bg-gray-50 uppercase">
              Sender
            </div>
            <div className="px-1 py-1.5 text-[11px] space-y-1">
              <div className="flex">
                <span className="w-14 font-bold shrink-0">Name:</span>
                <span className="font-medium text-gray-700">{'{sender_name}'}</span>
              </div>
              <div className="flex">
                <span className="w-14 font-bold shrink-0">Address:</span>
                <span className="font-medium text-gray-700">{'{sender_loc}'}</span>
              </div>
            </div>
          </div>

          {/* RECEIVER SECTION */}
          <div className="mt-1">
            <div className="text-center font-bold text-xs tracking-wider border-y border-black py-[2px] bg-gray-50 uppercase">
              Receiver
            </div>
            <div className="px-1 py-1.5 text-[11px] space-y-1.5">
              <div className="flex">
                <span className="w-14 font-bold shrink-0">Name:</span>
                <span className="font-medium text-gray-700">{'{receiver_name}'}</span>
              </div>
              <div className="flex">
                <span className="w-14 font-bold shrink-0">Phone:</span>
                <span className="font-mono text-gray-700 font-semibold">{'{receiver_phone}'}</span>
              </div>
              <div className="flex">
                <span className="w-14 font-bold shrink-0">Address:</span>
                <span className="font-medium text-gray-700 leading-normal">{'{receiver_address}'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM FINANCIALS & NOTES SECTION */}
        <div className="mt-auto">
          {/* Financial Breakdown Table */}
          <div className="border-t-2 border-black text-xs">
            {/* COD Row */}
            <div className="flex items-center">
              <div className="w-16 font-black py-1.5 px-1 tracking-wider text-right pr-3 shrink-0">COD:</div>
              <div className="w-[1px] bg-black self-stretch"></div>
              <div className="pl-3 font-mono font-bold text-sm">{'{cod_amount}'}</div>
            </div>
            
            {/* Dashed Line */}
            <div className="border-t border-dashed border-black w-full"></div>
            
            {/* Deli Fee Row */}
            <div className="flex justify-between items-center py-1.5 px-1">
              <div className="flex items-center">
                <span className="w-16 font-bold tracking-tight text-right pr-3 shrink-0">Deli Fee:</span>
                <span className="font-mono ml-3 font-semibold">{'{deli_fee}'}</span>
              </div>
              <div className="font-mono font-bold text-right pr-1">{'{Pay_type}'}</div>
            </div>
            
            {/* Thick Total Row */}
            <div className="border-t-2 border-black flex items-center py-2 px-1 bg-gray-50">
              <div className="w-16 font-black text-sm tracking-wider text-right pr-3 shrink-0">Total:</div>
              <div className="pl-3 font-mono font-black text-base">{'{total_amount}'}</div>
            </div>
          </div>

          {/* Double Horizontal Line Rule */}
          <div className="border-t-4 border-double border-black w-full mt-0.5"></div>

          {/* Notes (မှတ်ချက်) Block */}
          <div className="mt-1.5 px-1 flex flex-col justify-between min-h-[55px]">
            <div className="text-center font-bold text-xs" style={{ fontFamily: 'Pyidaungsu, sans-serif' }}>
              မှတ်ချက်
            </div>
            <div className="border-b border-dotted border-black w-full mt-1.5"></div>
            <div className="flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
}