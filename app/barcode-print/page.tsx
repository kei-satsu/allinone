'use client';

import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const BarcodePrinterPage = () => {
  // --- States ---
  const [printMode, setPrintMode] = useState<'thermal' | 'a4'>('thermal');
  const [labelSize, setLabelSize] = useState({ w: 50, h: 30 }); // Default 50x30mm
  const [printCount, setPrintCount] = useState<number>(10);
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // 🌟 ပြင်ဆင်ချက် ၁: ကုတ်ကို တိုတိုကျစ်ကျစ်နှင့် လုံးဝမထပ်အောင် ဖန်တီးခြင်း
  const generateBulkUniqueIDs = (count: number) => {
    const idList: string[] = [];
    const now = new Date();
    
    // 💡 အချိန်ကို Base36 (အက္ခရာ+ဂဏန်း) အဖြစ်ပြောင်းလိုက်သဖြင့် ကုတ်အရမ်းတိုသွားပါမည်
    // ဥပမာ - "18F4A2" ပုံစံမျိုး ထွက်လာမည်
    const shortTimestamp = Math.floor(now.getTime() / 1000).toString(36).toUpperCase(); 

    for (let i = 0; i < count; i++) {
      // အလှည့်စဉ်ကို 2 လုံး (သို့) 3 လုံးသာ ထားမည်
      const serialNumber = i.toString().padStart(2, '0'); 
      // PKG + အချိန်ကုတ် + အစဉ်လိုက်နံပါတ် (စုစုပေါင်း ၉-၁၀ လုံးခန့်သာ ရှိပါတော့မည်)
      idList.push(`PK${shortTimestamp}${serialNumber}`);
    }
    return idList;
  };

  // 🔄 Generate ခလုတ် နှိပ်သောအခါ
  const handleGenerate = () => {
    if (printCount <= 0 || printCount > 500) {
      alert('၁ လုံး မှ ၅၀၀ အတွင်းသာ ထုတ်နိုင်ပါသည်။');
      return;
    }
    setIsGenerating(true);
    const barcodes = generateBulkUniqueIDs(printCount);
    setGeneratedList(barcodes);
    setIsGenerating(false);
  };

  // 🖼️ 🌟 ပြင်ဆင်ချက် ၂: Barcode SVG ပုံထွက်ကို Label Size အလိုက် အချိုးကျအောင် ချိန်ညှိခြင်း
  useEffect(() => {
    if (generatedList.length > 0) {
      generatedList.forEach((id) => {
        const svgElement = document.getElementById(`barcode-${id}`);
        if (svgElement) {
          // Label အကျယ် (w) ပေါ်မူတည်၍ Barcode မျဉ်းအထူ (width) ကို ချိန်ညှိမည်
          let barcodeWidth = 1.8; 
          if (labelSize.w <= 40) barcodeWidth = 1.3;
          else if (labelSize.w >= 60) barcodeWidth = 2.2;

          JsBarcode(svgElement, id, {
            format: 'CODE128',
            width: barcodeWidth, // 👈 မျဉ်းအထူကို လိုက်ဖက်အောင်ထားမည်
            height: labelSize.h * 1.5, // 👈 အပေါ်အောက် အပြည့်နီးပါး ဖြစ်အောင် မြှင့်ပေးထားသည်
            displayValue: true,
            fontSize: labelSize.w <= 40 ? 11 : 14, // စာလုံးဆိုဒ်
            textMargin: 4,
            margin: 5
          });
        }
      });
    }
  }, [generatedList, labelSize]);

  // 🖨️ 1. PC ဖြင့် ပရင့်ထုတ်ခြင်း (Thermal နှင့် A4 နှစ်မျိုးလုံး အလုပ်လုပ်သည်)
  const handlePCPrint = () => {
    if (generatedList.length === 0) return alert('ကျေးဇူးပြု၍ Barcode များ အရင် Generate လုပ်ပါ။');

    const printContent = previewRef.current?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (printWindow) {
      const printCSS = printMode === 'thermal' 
        ? `
          @page { size: ${labelSize.w}mm ${labelSize.h}mm; margin: 0; }
          body { margin: 0; padding: 0; background: white; }
          .grid-container { display: block; }
          .label-box { width: ${labelSize.w}mm; height: ${labelSize.h}mm; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-after: always; overflow: hidden; }
        `
        : `
          @page { size: A4; margin: 10mm; }
          body { margin: 0; background: white; }
          .grid-container { display: flex; flex-wrap: wrap; gap: 2mm; justify-content: flex-start; }
          .label-box { width: ${labelSize.w}mm; height: ${labelSize.h}mm; border: 1px dashed #ccc; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; }
        `;

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Barcodes</title>
            <style>
              ${printCSS}
              /* 🌟 ပြင်ဆင်ချက် ၃: ပရင့်ထုတ်ရာတွင်ပါ စာသားနှင့် ပုံ အချိုးကျအောင် ပြင်ဆင်ခြင်း */
              .title { font-size: ${labelSize.w <= 40 ? '9px' : '11px'}; font-weight: bold; font-family: sans-serif; text-transform: uppercase; margin-bottom: 2px; }
              svg { max-width: 95%; max-height: 75%; object-fit: contain; }
            </style>
          </head>
          <body>
            <div class="grid-container">
              ${generatedList.map(id => `
                <div class="label-box">
                  <div class="title">ALL IN ONE Express</div>
                  ${document.getElementById(`barcode-${id}`)?.outerHTML || ''}
                </div>
              `).join('')}
            </div>
            <script>
              window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // 📱 2. Mobile ဖုန်းဖြင့် ပရင့်ထုတ်ခြင်း (GP Printer Thermal အတွက်သာ)
  const handleMobileThermalPrint = () => {
    if (generatedList.length === 0) return alert('ကျေးဇူးပြု၍ Barcode များ အရင် Generate လုပ်ပါ။');
    
    let masterTsplCommand = '';
    generatedList.forEach((id) => {
      // 🌟 ပြင်ဆင်ချက် ၄: TSPL Command တွင် Barcode အမြင့်ကို ချိန်ညှိခြင်း
      const tsplBarcodeHeight = Math.floor(labelSize.h * 2.5); // အပေါ်အောက် ပိုပြည့်အောင် ဆွဲဆန့်သည်
      
      masterTsplCommand += 
        `SIZE ${labelSize.w} mm, ${labelSize.h} mm\r\n` +
        `GAP 2 mm\r\n` +
        `CLS\r\n` +
        `TEXT 30,10,"2",0,1,1,"ALL IN ONE DELI"\r\n` + 
        `BARCODE 15,45,"128",${tsplBarcodeHeight},1,0,2,2,"${id}"\r\n` +
        `PRINT 1\r\n`;
    });

    try {
      const base64Command = btoa(masterTsplCommand);
      window.location.href = `rawbt://base64/${base64Command}`;
    } catch (error) {
      alert('ဖုန်းဖြင့် ပရင့်ထုတ်ရန် အခက်အခဲရှိနေပါသည်။ (RawBT App လိုအပ်ပါသည်)');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* 🎛️ ဘယ်ဘက်ခြမ်း - Settings & Controls */}
        <div className="w-full md:w-1/3 bg-slate-800 p-6 text-white flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-orange-500 uppercase tracking-wide">Print Center</h1>
          
          {/* Printer Mode Selection */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Printer အမျိုးအစား ရွေးပါ</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setPrintMode('thermal')}
                className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${printMode === 'thermal' ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
              >
                🖨️ Thermal Sticker
              </button>
              <button 
                onClick={() => setPrintMode('a4')}
                className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${printMode === 'a4' ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}
              >
                📄 Standard A4
              </button>
            </div>
          </div>

          {/* Label Size Selection */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Label Size (စတစ်ကာဆိုဒ်)</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-orange-500"
              value={`${labelSize.w}x${labelSize.h}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setLabelSize({ w, h });
              }}
            >
              <option value="40x30">40mm x 30mm (အသေးစား)</option>
              <option value="50x30">50mm x 30mm (စံသတ်မှတ်ချက်)</option>
              <option value="60x40">60mm x 40mm (အလတ်စား)</option>
              <option value="100x150">100mm x 150mm (A6 စာရွက်ကြီး)</option>
            </select>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">ထုတ်မည့် အရေအတွက်</label>
            <input 
              type="number" 
              value={printCount}
              onChange={(e) => setPrintCount(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-orange-500 font-bold"
            />
          </div>

          <button onClick={handleGenerate} className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold active:scale-95 transition-transform shadow-lg">
            🔄 Generate Barcodes
          </button>
          
          <hr className="border-slate-700 my-2" />

          {/* Print Actions */}
          <div className="flex flex-col gap-3">
            <button onClick={handlePCPrint} className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform flex justify-center items-center gap-2">
              💻 <span>Print from PC</span>
            </button>
            
            <button 
              onClick={handleMobileThermalPrint}
              disabled={printMode === 'a4'}
              className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold active:scale-95 transition-transform flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title={printMode === 'a4' ? "ဖုန်းဖြင့်ထုတ်ရန် Thermal Sticker Mode ပြောင်းပေးပါ" : "ဖုန်းဖြင့် တိုက်ရိုက်ထုတ်ရန်"}
            >
              📱 <span>Print via Phone (RawBT)</span>
            </button>
          </div>
        </div>

        {/* 👁️ ညာဘက်ခြမ်း - Preview & Instructions */}
        <div className="w-full md:w-2/3 p-6 bg-slate-50 flex flex-col h-[85vh]">
          
          {/* Instructions Box */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4 flex-shrink-0">
            <h3 className="text-blue-800 font-bold mb-2">📌 အသုံးပြုနည်းလမ်းညွှန်</h3>
            <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
              <li><b>PC Thermal ဖြင့်ထုတ်ရန်:</b> "Thermal Sticker" ရွေးပါ။ Print နှိပ်လျှင် Printer Settings တွင် Label Size အတိအကျနှင့် Margins: None ရွေးပေးပါ။</li>
              <li><b>PC ရိုးရိုး Printer ဖြင့်ထုတ်ရန် (A4):</b> "Standard A4" ရွေးပါ။ A4 စာရွက်ပေါ်တွင် Label များ အံဝင်ခွင်ကျ အလိုအလျောက် စီသွားပါမည်။</li>
              <li><b>ဖုန်းဖြင့်ထုတ်ရန်:</b> ဖုန်းထဲတွင် <a href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" className="underline font-bold text-orange-600">RawBT App</a> ဒေါင်းလုဒ်ဆွဲထားပါ။ OTG/Bluetooth ဖြင့် ပရင်တာချိတ်ထားပြီး "Print via Phone" ကိုနှိပ်ပါ။</li>
            </ul>
          </div>

          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Live Preview (နမူနာမြင်ကွင်း)</h2>
          
          {/* Grid Preview Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl p-4 shadow-inner">
            {generatedList.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Generate ခလုတ်ကို အရင်နှိပ်ပေးပါဗျာ...</div>
            ) : (
              <div 
                ref={previewRef} 
                className={`flex flex-wrap gap-2 ${printMode === 'thermal' ? 'flex-col items-center' : 'justify-start'}`}
              >
                {generatedList.map((id) => (
                  <div 
                    key={id} 
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-white"
                    style={{ width: `${labelSize.w}mm`, height: `${labelSize.h}mm` }} // Preview တွင် အပြင်ဆိုဒ်အတိုင်း ပြသမည်
                  >
                    <span className="text-[10px] font-bold uppercase mb-1">ALL IN ONE Express</span>
                    <svg id={`barcode-${id}`} className="max-w-full h-auto"></svg>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default BarcodePrinterPage;