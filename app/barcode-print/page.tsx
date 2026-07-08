'use client';

import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const BarcodePrinterPage = () => {
  // --- States ---
  // Default ကို User လိုချင်တဲ့ 100x150mm (A6 စာရွက်ကြီး) အဖြစ် တိုက်ရိုက် သတ်မှတ်ပေးထားပါတယ်
  const [printMode, setPrintMode] = useState<'thermal' | 'a4'>('thermal');
  const [labelSize, setLabelSize] = useState({ w: 100, h: 150 }); 
  const [printCount, setPrintCount] = useState<number>(16); // စမ်းသပ်ရလွယ်အောင် ၂ ရွက်စာ (၁၆ ခု) Default ထားပါတယ်
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // 🌟 A6 2-Column စနစ် ဟုတ်မဟုတ် စစ်ဆေးခြင်း
  const isA6Grid = labelSize.w === 100 && labelSize.h === 150;

  // 💡 Array ကို အုပ်စုအလိုက် (Chunk) ခွဲပေးမည့် Helper Function (တစ်ရွက်စာ ၈ ခုစီ ခွဲရန်)
  const chunkArray = (arr: string[], size: number) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  // Unique ID Generator (Base36 ကုတ်တို)
  const generateBulkUniqueIDs = (count: number) => {
    const idList: string[] = [];
    const now = new Date();
    const shortTimestamp = Math.floor(now.getTime() / 1000).toString(36).toUpperCase(); 

    for (let i = 0; i < count; i++) {
      const serialNumber = i.toString().padStart(3, '0'); 
      idList.push(`PK${shortTimestamp}${serialNumber}`);
    }
    return idList;
  };

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

  // 🖼️ Barcode SVG များကို Size အလိုက် Render လုပ်ပေးခြင်း
  useEffect(() => {
    if (generatedList.length > 0) {
      generatedList.forEach((id) => {
        const svgElement = document.getElementById(`barcode-${id}`);
        if (svgElement) {
          let barcodeWidth = 1.8; 
          let barcodeHeight = labelSize.h * 1.5;
          let fontSize = 14;

          // 🌟 100x150mm 2-Column အတွက် Barcode ကို အချိုးကျအောင် ချိန်ညှိခြင်း
          if (isA6Grid) {
            barcodeWidth = 2.0;   // မျဉ်းအထူ စကန်ဖတ်ရလွယ်စေရန်
            barcodeHeight = 60;   // 31.3mm အမြင့်ကွက်ထဲ ဆံ့စေရန် Pixel အမြင့်
            fontSize = 12;
          } else {
            if (labelSize.w <= 40) barcodeWidth = 1.3;
            else if (labelSize.w >= 60) barcodeWidth = 2.2;
            if (labelSize.w <= 40) fontSize = 11;
          }

          JsBarcode(svgElement, id, {
            format: 'CODE128',
            width: barcodeWidth,
            height: barcodeHeight,
            displayValue: true,
            fontSize: fontSize,
            textMargin: 4,
            margin: 5
          });
        }
      });
    }
  }, [generatedList, labelSize, isA6Grid]);

  // 🖨️ 1. PC ဖြင့် ပရင့်ထုတ်ခြင်း
  const handlePCPrint = () => {
    if (generatedList.length === 0) return alert('ကျေးဇူးပြု၍ Barcode များ အရင် Generate လုပ်ပါ။');

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;

    let printHTML = '';

    if (isA6Grid) {
      // 🌟 100x150mm အတွက် တစ်ရွက်ကို ၈ ခုစီ (2 Columns x 4 Rows) အုပ်စုခွဲ၍ စီပေးခြင်း
      const pages = chunkArray(generatedList, 8);
      
      printHTML = pages.map(pageElements => `
        <div class="page-sheet-a6">
          ${pageElements.map(id => `
            <div class="label-box-64">
              <div class="title">ALL IN ONE Express</div>
              ${document.getElementById(`barcode-${id}`)?.outerHTML || ''}
            </div>
          `).join('')}
        </div>
      `).join('');
    } else {
      // ရိုးရိုး Single Label သို့မဟုတ် A4 Mode
      printHTML = `
        <div class="grid-container">
          ${generatedList.map(id => `
            <div class="label-box">
              <div class="title">ALL IN ONE Express</div>
              ${document.getElementById(`barcode-${id}`)?.outerHTML || ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    const printCSS = isA6Grid 
      ? `
        @page { size: 100mm 150mm; margin: 0; }
        body { margin: 0; padding: 0; background: white; font-family: sans-serif; }
        .page-sheet-a6 { 
          width: 100mm; 
          height: 150mm; 
          display: grid; 
          grid-template-columns: repeat(2, 1fr); 
          gap: 2mm; 
          padding: 2mm; 
          box-sizing: border-box; 
          page-break-after: always;
          align-content: start;
        }
        .label-box-64 { 
          width: 47mm; 
          height: 31.3mm; /* 🌟 6:4 Ratio အကျဆုံး စကေး */
          border: 1px dashed #bbb; 
          display: flex; 
          flex-direction: column; 
          justify-content: center; 
          align-items: center; 
          box-sizing: border-box; 
          overflow: hidden;
          background: white;
        }
        .title { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; }
        svg { max-width: 95%; max-height: 70%; object-fit: contain; }
      `
      : `
        @page { size: ${printMode === 'thermal' ? `${labelSize.w}mm ${labelSize.h}mm` : 'A4'}; margin: ${printMode === 'thermal' ? '0' : '10mm'}; }
        body { margin: 0; background: white; font-family: sans-serif; }
        .grid-container { display: flex; flex-wrap: wrap; gap: 2mm; justify-content: flex-start; }
        .label-box { width: ${labelSize.w}mm; height: ${labelSize.h}mm; border: ${printMode === 'a4' ? '1px dashed #ccc' : 'none'}; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; ${printMode === 'thermal' ? 'page-break-after: always;' : ''} overflow: hidden; }
        .title { font-size: ${labelSize.w <= 40 ? '9px' : '11px'}; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
        svg { max-width: 95%; max-height: 75%; object-fit: contain; }
      `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcodes</title>
          <style>${printCSS}</style>
        </head>
        <body>
          ${printHTML}
          <script>
            window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 📱 2. Mobile ဖုန်းဖြင့် ပရင့်ထုတ်ခြင်း (TSPL Command - 2 Column စနစ်တွက်ချက်မှု)
  const handleMobileThermalPrint = () => {
    if (generatedList.length === 0) return alert('ကျေးဇူးပြု၍ Barcode များ အရင် Generate လုပ်ပါ။');
    
    let masterTsplCommand = '';

    if (isA6Grid) {
      // 🌟 A6 စာရွက်ကြီးတစ်ခုထဲမှာ Barcode ၈ ခုကို 2 Columns နေရာချပေးခြင်း (Dots ဖြင့် တွက်ချက်သည် - 1mm = 8 dots)
      const pages = chunkArray(generatedList, 8);

      pages.forEach((pageItems) => {
        masterTsplCommand += 
          `SIZE 100 mm, 150 mm\r\n` +
          `GAP 2 mm\r\n` +
          `CLS\r\n`;

        pageItems.forEach((id, index) => {
          const col = index % 2;        // 0 သို့မဟုတ် 1 (ဘယ်/ညာ ကော်လံ)
          const row = Math.floor(index / 2); // 0, 1, 2, 3 (အတန်းအလှည့်)

          // ကော်လံအလိုက် X နေရာချခြင်း (ဘယ်ဘက် = အနားသတ် 32 dots၊ ညာဘက် = အနားသတ် 424 dots)
          const x = col === 0 ? 32 : 424;
          // အတန်းအလိုက် Y နေရာချခြင်း (တစ်တန်းလျှင် 280 dots စီ ကွာဝေးစေမည်)
          const y = 40 + (row * 280);

          masterTsplCommand += 
            `TEXT ${x + 40},${y},"2",0,1,1,"ALL IN ONE DELI"\r\n` + 
            `BARCODE ${x},${y + 35},"128",90,1,0,2,2,"${id}"\r\n`;
        });

        masterTsplCommand += `PRINT 1\r\n`;
      });
    } else {
      // ရိုးရိုး Single Label ပုံစံအတိုင်း ထုတ်ခြင်း
      generatedList.forEach((id) => {
        const tsplBarcodeHeight = Math.floor(labelSize.h * 2.5);
        masterTsplCommand += 
          `SIZE ${labelSize.w} mm, ${labelSize.h} mm\r\n` +
          `GAP 2 mm\r\n` +
          `CLS\r\n` +
          `TEXT 30,10,"2",0,1,1,"ALL IN ONE DELI"\r\n` + 
          `BARCODE 15,45,"128",${tsplBarcodeHeight},1,0,2,2,"${id}"\r\n` +
          `PRINT 1\r\n`;
      });
    }

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
              <option value="100x150">100mm x 150mm (A6 စာရွက်ကြီး - 2 Column Grid)</option>
              <option value="50x30">50mm x 30mm (စံသတ်မှတ်ချက်)</option>
              <option value="40x30">40mm x 30mm (အသေးစား)</option>
              <option value="60x40">60mm x 40mm (အလတ်စား)</option>
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
            <h3 className="text-blue-800 font-bold mb-1">📌 {isA6Grid ? 'A6 (2-Column) Layout စနစ် ဖွင့်ထားပါသည်' : 'အသုံးပြုနည်းလမ်းညွှန်'}</h3>
            <p className="text-xs text-blue-700 mb-2">
              {isA6Grid 
                ? '၁၀၀x၁၅၀mm စာရွက်ကြီးပေါ်တွင် တစ်ရွက်လျှင် ဘားကုဒ် ၈ ခုစီ (6:4 Ratio အကြီးဆုံးဆိုဒ်) အလိုအလျောက် ခွဲပေးသွားပါမည်။'
                : 'ရွေးချယ်ထားသော Label Size အတိုင်း ပရင့်ထုတ်ပေးပါမည်။'}
            </p>
            <ul className="text-xs text-blue-600 space-y-1 ml-4 list-disc">
              <li><b>PC Print အကြံပြုချက်:</b> ပရင့်ဆွဲတင်သည့်အခါ ဆက်တင်ထဲတွင် <b>Margins: None</b> ထားပေးရန် မမေ့ပါနှင့်။</li>
              <li><b>ဖုန်းဖြင့်ထုတ်ရန်:</b> ဖုန်းထဲတွင် RawBT App ရှိရပါမည်။</li>
            </ul>
          </div>

          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Live Preview (နမူနာမြင်ကွင်း)</h2>
          
          {/* Grid Preview Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto bg-slate-200 border border-slate-300 rounded-xl p-4 shadow-inner flex justify-center">
            {generatedList.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Generate ခလုတ်ကို အရင်နှိပ်ပေးပါဗျာ...</div>
            ) : isA6Grid ? (
              /* 🌟 100x150mm စနစ်အတွက် Preview ကို တစ်ရွက်ချင်းစီ Grid ကွက်တိပုံစံ ပြသခြင်း */
              <div ref={previewRef} className="flex flex-col gap-6 items-center w-full">
                {chunkArray(generatedList, 8).map((pageItems, pIdx) => (
                  <div 
                    key={pIdx}
                    className="bg-white shadow-md border border-neutral-400 relative grid grid-cols-2 gap-[2mm] p-[2mm] content-start"
                    style={{ width: '100mm', height: '150mm', minHeight: '150mm' }}
                  >
                    {pageItems.map((id) => (
                      <div 
                        key={id}
                        className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white overflow-hidden"
                        style={{ width: '47mm', height: '31.3mm' }} // 6:4 Ratio ကွက်တိ
                      >
                        <span className="text-[9px] font-bold uppercase mb-0.5 text-neutral-700">ALL IN ONE Express</span>
                        <svg id={`barcode-${id}`} className="max-w-full h-auto"></svg>
                      </div>
                    ))}
                    <div className="absolute bottom-1 right-2 text-[9px] text-gray-400 font-mono">Page {pIdx + 1}</div>
                  </div>
                ))}
              </div>
            ) : (
              /* ရိုးရိုး Single Label သို့မဟုတ် A4 ပုံမှန် Preview */
              <div 
                ref={previewRef} 
                className={`flex flex-wrap gap-2 w-full ${printMode === 'thermal' ? 'flex-col items-center' : 'justify-start'}`}
              >
                {generatedList.map((id) => (
                  <div 
                    key={id} 
                    className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white"
                    style={{ width: `${labelSize.w}mm`, height: `${labelSize.h}mm` }}
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
