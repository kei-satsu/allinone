'use client';

import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const BarcodePrinterPage = () => {
  // --- States ---
  const [printMode, setPrintMode] = useState<'thermal' | 'a4'>('thermal');
  const [labelSize, setLabelSize] = useState({ w: 100, h: 150 }); 
  const [printCount, setPrintCount] = useState<number>(20); // ၁၀ ခုစီ ၂ ရွက်စာ ကွက်တိစမ်းသပ်ရန် Default ၂၀ ထားပါတယ်
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // 🌟 A6 2-Column (၁ ရွက်လျှင် ၁၀ ခုဆန့်) စနစ် ဟုတ်မဟုတ် စစ်ဆေးခြင်း
  const isA6Grid = labelSize.w === 100 && labelSize.h === 150;

  // 💡 တစ်ရွက်စာ ၁၀ ခုစီ (2 Columns x 5 Rows) ခွဲပေးမည့် Helper Function
  const chunkArray = (arr: string[], size: number) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  // 💡 Pure Numeric Unique ID Generator (၁၃ လုံးတွဲ)
  const generateBulkUniqueIDs = (count: number) => {
    const idList: string[] = [];
    const now = new Date();
    const epochSeconds = 1767225600; 
    const currentSeconds = Math.floor(now.getTime() / 1000);
    const relativeSeconds = (currentSeconds - epochSeconds).toString().padStart(8, '0');

    for (let i = 0; i < count; i++) {
      const serialNumber = i.toString().padStart(3, '0'); 
      idList.push(`88${relativeSeconds}${serialNumber}`);
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

  // 🖼️ Barcode SVG Rendering (နေရာလွတ် အနည်းဆုံးဖြစ်အောင် ချိန်ညှိထားပါသည်)
  useEffect(() => {
    if (generatedList.length > 0) {
      generatedList.forEach((id) => {
        const svgElement = document.getElementById(`barcode-${id}`);
        if (svgElement) {
          let barcodeWidth = 2.0; 
          let barcodeHeight = labelSize.h * 1.5;
          let fontSize = 18;

          // 🌟 ၁၀ ခုဆန့် Grid အတွက် Barcode ကို အကျဆုံးဖြစ်အောင် ချိန်ညှိခြင်း (အမြင့်ကို ၄၈ ထားပြီး လိုင်းအထူကို မလျှော့ထားပါ)
          if (isA6Grid) {
            barcodeWidth = 2.0;   // စကန်ဖတ်ရ ကောင်းမွန်စေရန် အထူကို ထိန်းထားပါသည်
            barcodeHeight = 48;   // အပေါ်အောက် နေရာလွတ် သက်သာစေရန် အမြင့် Pixels
            fontSize = 18;
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
            textMargin: 1, // စာသားနှင့် ဘားကုတ်ကြား ကပ်ပေးထားခြင်း
            margin: 2     // ဘေးပတ်လည် နေရာလွတ် အနည်းဆုံး ပြုလုပ်ခြင်း
          });
        }
      });
    }
  }, [generatedList, labelSize, isA6Grid]);

  // 🖨️ 1. PC Print Logic (2 Columns x 5 Rows Layout)
  const handlePCPrint = () => {
    if (generatedList.length === 0) return alert('ကျေးဇူးပြု၍ Barcode များ အရင် Generate လုပ်ပါ။');

    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) return;

    let printHTML = '';

    if (isA6Grid) {
      // 🌟 ၁၀၀x၁၅၀mm အတွက် တစ်ရွက်ကို ၁၀ ခုစီ အုပ်စုခွဲ၍ စီပေးခြင်း
      const pages = chunkArray(generatedList, 10);
      
      printHTML = pages.map(pageElements => `
        <div class="page-sheet-a6">
          ${pageElements.map(id => `
            <div class="label-box-a6-10">
              
              <div class="title" style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 2px;">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 97" width="12" height="12" style="display: inline-block; flex-shrink: 0;">
                  <path d="M0 0 C0.7115625 0.4125 1.423125 0.825 2.15625 1.25 C8.90248597 5.68036392 12.38401096 12.03348145 15.375 19.375 C17.62714732 32.43745446 14.92613228 44.52594513 7.78515625 55.703125 C4.35570844 60.11563115 0.04297912 64.47851044 -5 67 C-9.31900368 67.49834658 -11.43437514 67.34381119 -15.1875 65.0625 C-18.74861701 61.75915822 -20.341415 57.47817951 -22 53 C-24.83279698 52.94334406 -26.43208763 52.93348801 -29 54 C-30.79849033 56.13570727 -32.16491932 58.37847193 -33.609375 60.765625 C-35.4119185 63.66184658 -36.99681144 65.35539674 -40 67 C-44.20816696 67.73857624 -47.16819288 67.41590356 -51 65.5 C-51.66 65.005 -52.32 64.51 -53 64 C-47.87452211 71.04753209 -41.55616536 74.28876693 -33 76 C-19.42371674 77.11185078 -6.023309 73.47229141 4.6875 64.83203125 C6.23686772 63.42915824 7.76354665 62.00048734 9.2578125 60.5390625 C11 59 11 59 13 59 C11.43755834 67.67155122 2.73212214 74.95366295 -4 80 C-14.99508697 86.82214845 -25.25284667 88.01744261 -38 86 C-44.01401408 84.26470635 -49.6283132 82.60312905 -54 78 C-54.99 77.67 -55.98 77.34 -57 77 C-62.80363087 70.57695609 -65.89611027 63.30183516 -68 55 C-68.18691406 54.28585938 -68.37382813 53.57171875 -68.56640625 52.8359375 C-70.73162941 41.02977331 -66.46989646 26.77516966 -60 17 C-46.52797327 -0.53858295 -21.1050023 -12.98769372 0 0 Z M-49.375 18.8125 C-55.80631071 27.42655859 -58.17895941 35.30175027 -58.1875 45.875 C-58.19974609 46.66519531 -58.21199219 47.45539062 -58.22460938 48.26953125 C-58.2362095 52.91731548 -57.77874711 56.62695373 -56 61 C-55.67 61 -55.34 61 -55 61 C-54.67 58.36 -54.34 55.72 -54 53 C-51.525 52.505 -51.525 52.505 -49 52 C-48.34 53.32 -47.68 54.64 -47 56 C-46.608125 55.443125 -46.21625 54.88625 -45.8125 54.3125 C-43.20347238 50.98374063 -40.21108022 48.09316572 -37.07421875 45.26171875 C-34.57701395 42.53877792 -32.96505303 39.55044691 -31.25 36.3125 C-26.29502861 27.35373476 -20.49929645 19.47621432 -11 15 C-8 14.1875 -8 14.1875 -6 14 C-7.81074217 19.67914589 -9.84612672 25.17539157 -12.23046875 30.640625 C-13.07176113 33.2200189 -13.13860585 35.30435528 -13 38 C-11.06201737 35.22739701 -11.06201737 35.22739701 -10 33 C-8.35 33.33 -6.7 33.66 -5 34 C-4.33035714 41.76785714 -4.33035714 41.76785714 -7.3125 45.375 C-10 48 -10 48 -13 50 C-11.45575673 55.02915051 -11.45575673 55.02915051 -7.625 58.25 C-4.82785364 58.20934381 -4.82785364 58.20934381 -2.4375 56.125 C5.28488428 46.22450734 7.13257438 34.27194516 6 22 C4.36780581 15.82307349 0.39607582 11.31193181 -5 8 C-20.60825465 1.0484244 -38.50290939 5.84652528 -49.375 18.8125 Z M-23 36 C-23.66 37.11375 -24.32 38.2275 -25 39.375 C-25.37125 40.00148438 -25.7425 40.62796875 -26.125 41.2734375 C-27.15068348 42.97472667 -27.15068348 42.97472667 -27 45 C-25.02 44.67 -23.04 44.34 -21 44 C-21.33 41.36 -21.66 38.72 -22 36 C-22.33 36 -22.66 36 -23 36 Z" fill="#000000" transform="translate(73,7)"/>
                </svg>
                <span>ALL IN ONE Express</span>
              </div>
              
              ${document.getElementById(`barcode-${id}`)?.outerHTML || ''}
            </div>
          `).join('')}
        </div>
      `).join('');
    } else {
      printHTML = `
        <div class="grid-container">
          ${generatedList.map(id => `
            <div class="label-box">
              
              <div class="title" style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 2px;">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 97" width="12" height="12" style="display: inline-block; flex-shrink: 0;">
                  <path d="M0 0 C0.7115625 0.4125 1.423125 0.825 2.15625 1.25 C8.90248597 5.68036392 12.38401096 12.03348145 15.375 19.375 C17.62714732 32.43745446 14.92613228 44.52594513 7.78515625 55.703125 C4.35570844 60.11563115 0.04297912 64.47851044 -5 67 C-9.31900368 67.49834658 -11.43437514 67.34381119 -15.1875 65.0625 C-18.74861701 61.75915822 -20.341415 57.47817951 -22 53 C-24.83279698 52.94334406 -26.43208763 52.93348801 -29 54 C-30.79849033 56.13570727 -32.16491932 58.37847193 -33.609375 60.765625 C-35.4119185 63.66184658 -36.99681144 65.35539674 -40 67 C-44.20816696 67.73857624 -47.16819288 67.41590356 -51 65.5 C-51.66 65.005 -52.32 64.51 -53 64 C-47.87452211 71.04753209 -41.55616536 74.28876693 -33 76 C-19.42371674 77.11185078 -6.023309 73.47229141 4.6875 64.83203125 C6.23686772 63.42915824 7.76354665 62.00048734 9.2578125 60.5390625 C11 59 11 59 13 59 C11.43755834 67.67155122 2.73212214 74.95366295 -4 80 C-14.99508697 86.82214845 -25.25284667 88.01744261 -38 86 C-44.01401408 84.26470635 -49.6283132 82.60312905 -54 78 C-54.99 77.67 -55.98 77.34 -57 77 C-62.80363087 70.57695609 -65.89611027 63.30183516 -68 55 C-68.18691406 54.28585938 -68.37382813 53.57171875 -68.56640625 52.8359375 C-70.73162941 41.02977331 -66.46989646 26.77516966 -60 17 C-46.52797327 -0.53858295 -21.1050023 -12.98769372 0 0 Z M-49.375 18.8125 C-55.80631071 27.42655859 -58.17895941 35.30175027 -58.1875 45.875 C-58.19974609 46.66519531 -58.21199219 47.45539062 -58.22460938 48.26953125 C-58.2362095 52.91731548 -57.77874711 56.62695373 -56 61 C-55.67 61 -55.34 61 -55 61 C-54.67 58.36 -54.34 55.72 -54 53 C-51.525 52.505 -51.525 52.505 -49 52 C-48.34 53.32 -47.68 54.64 -47 56 C-46.608125 55.443125 -46.21625 54.88625 -45.8125 54.3125 C-43.20347238 50.98374063 -40.21108022 48.09316572 -37.07421875 45.26171875 C-34.57701395 42.53877792 -32.96505303 39.55044691 -31.25 36.3125 C-26.29502861 27.35373476 -20.49929645 19.47621432 -11 15 C-8 14.1875 -8 14.1875 -6 14 C-7.81074217 19.67914589 -9.84612672 25.17539157 -12.23046875 30.640625 C-13.07176113 33.2200189 -13.13860585 35.30435528 -13 38 C-11.06201737 35.22739701 -11.06201737 35.22739701 -10 33 C-8.35 33.33 -6.7 33.66 -5 34 C-4.33035714 41.76785714 -4.33035714 41.76785714 -7.3125 45.375 C-10 48 -10 48 -13 50 C-11.45575673 55.02915051 -11.45575673 55.02915051 -7.625 58.25 C-4.82785364 58.20934381 -4.82785364 58.20934381 -2.4375 56.125 C5.28488428 46.22450734 7.13257438 34.27194516 6 22 C4.36780581 15.82307349 0.39607582 11.31193181 -5 8 C-20.60825465 1.0484244 -38.50290939 5.84652528 -49.375 18.8125 Z M-23 36 C-23.66 37.11375 -24.32 38.2275 -25 39.375 C-25.37125 40.00148438 -25.7425 40.62796875 -26.125 41.2734375 C-27.15068348 42.97472667 -27.15068348 42.97472667 -27 45 C-25.02 44.67 -23.04 44.34 -21 44 C-21.33 41.36 -21.66 38.72 -22 36 C-22.33 36 -22.66 36 -23 36 Z" fill="#000000" transform="translate(73,7)"/>
                </svg>
                <span>ALL IN ONE Express</span>
              </div>
              
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
          grid-template-rows: repeat(5, 1fr);
          column-gap: 4mm;    /* 🌟 ဘယ်/ညာ ကောလံကြားကို 4mm အထိ ပြန်ချဲ့လိုက်ခြင်း */
          row-gap: 2mm;       /* 🌟 အတန်းတစ်ခုချင်းစီကြားကို 2mm အကွာအဝေး ထားခြင်း */
          padding: 3mm 2mm;   /* 🌟 စာရွက် ဘေးပတ်လည် နေရာလွတ် သတ်မှတ်ချက် */
          box-sizing: border-box; 
          page-break-after: always;
          align-content: start;
        }
        .label-box-a6-10 { 
          width: 46mm;        /* 🌟 အလျား ပိုရှည်သွားစေရန် Width ကို 46mm သို့ ညှိခြင်း */
          height: 27.2mm;     /* 🌟 အပေါ်အောက် လွတ်နေတာ ပျောက်ဖို့ Height ကို 27.2mm သို့ လျှော့ချခြင်း */
          border: 1px dashed #94a3b8; 
          display: flex; 
          flex-direction: column; 
          justify-content: center; 
          align-items: center; 
          box-sizing: border-box; 
          overflow: hidden;
          background: white;
          position: relative;
          padding: 1px 4px;   /* 🌟 ကတ်အတွင်း အပေါ်အောက် လွတ်နေသော Padding ကို လျှော့ချခြင်း */
        }
        
        .title { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 0px; letter-spacing: 0.5px; }
        svg { max-width: 98%; max-height: 82%; object-fit: contain; }
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
          <title>Print Barcodes (10 Labels/Sheet)</title>
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

  // 📱 2. Mobile Thermal Print Logic (TSPL 10-Label Grid Coordinates)
  const handleMobileThermalPrint = () => {
    if (generatedList.length === 0) return alert('ကျေးဇူးပြု၍ Barcode များ အရင် Generate လုပ်ပါ။');
    
    let masterTsplCommand = '';

    if (isA6Grid) {
      // 🌟 တစ်ရွက်လျှင် ၁၀ ခုစီအတွက် ကွက်တိ နေရာချခြင်း (5 Rows x 2 Columns)
      // 1mm = 8 dots ဖြစ်လို့ အမြင့် 28.4mm = ~227 dots စီ ခြားပေးထားပါတယ်
      const pages = chunkArray(generatedList, 10);

      pages.forEach((pageItems) => {
        masterTsplCommand += 
          `SIZE 100 mm, 150 mm\r\n` +
          `GAP 2 mm\r\n` +
          `CLS\r\n`;

        pageItems.forEach((id, index) => {
          const col = index % 2;        
          const row = Math.floor(index / 2); 

          const x = col === 0 ? 16 : 416; // 🌟 Left padding 2mm = 16 dots စတင်ခြင်း
          const y = 24 + (row * 234);    // 🌟 Row Step အမြင့်ကို 234 dots (27.2mm + 2mm) သို့ ချိန်ညှိခြင်း

          masterTsplCommand += 
            `TEXT ${x + 40},${y},"2",0,1,1,"ALL IN ONE DELI"\r\n` + 
            `BARCODE ${x + 10},${y + 22},"128",48,1,0,2,2,"${id}"\r\n`;
        });

        masterTsplCommand += `PRINT 1\r\n`;
      });
    } else {
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
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-900 text-slate-100 font-sans antialiased selection:bg-orange-500 selection:text-white">
      
      {/* 🎛️ Sidebar Control Panel - Full height on desktop, top bar on mobile */}
      <div className="w-full lg:w-80 xl:w-96 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 p-6 flex flex-col justify-between flex-shrink-0">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg shadow-orange-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">PRINT CENTER</h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">All In One Express</p>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Controls Form */}
          <div className="flex flex-col gap-5">
            {/* Printer Mode */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Printer အမျိုးအစား</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setPrintMode('thermal')}
                  className={`flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all ${printMode === 'thermal' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5V4.5a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v3m-12 0h13.5A2.25 2.25 0 0121 9.75v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15.75v-6A2.25 2.25 0 015.25 7.5z" />
                  </svg>
                  Thermal
                </button>
                <button 
                  onClick={() => setPrintMode('a4')}
                  className={`flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all ${printMode === 'a4' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Standard A4
                </button>
              </div>
            </div>

            {/* Label Size */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Label Size (စတစ်ကာဆိုဒ်)</label>
              <div className="relative">
                <select 
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl p-3 text-sm outline-none focus:border-orange-500 transition-all appearance-none cursor-pointer font-medium"
                  value={`${labelSize.w}x${labelSize.h}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    setLabelSize({ w, h });
                  }}
                >
                  <option value="100x150">100mm x 150mm (A6 စာရွက်ကြီး - 10 Labels)</option>
                  <option value="50x30">50mm x 30mm (စံသတ်မှတ်ချက်)</option>
                  <option value="40x30">40mm x 30mm (အသေးစား)</option>
                  <option value="60x40">60mm x 40mm (အလတ်စား)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Print Count */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">ထုတ်မည့် အရေအတွက်</label>
              <div className="relative flex items-center">
                <input 
                  type="number" 
                  value={printCount}
                  onChange={(e) => setPrintCount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 text-white font-bold rounded-xl p-3 text-sm outline-none focus:border-orange-500 transition-all pl-10"
                  min={1}
                  max={500}
                />
                <div className="absolute left-3 text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="w-full py-3.5 bg-white hover:bg-slate-100 text-slate-950 rounded-xl font-bold active:scale-[0.98] transition-all shadow-lg text-sm flex items-center justify-center gap-2 mt-2"
            >
              <svg className={`w-4 h-4 text-slate-900 ${isGenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>{isGenerating ? 'Generating...' : 'Generate Barcodes'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions Block */}
        <div className="flex flex-col gap-2.5 mt-6 lg:mt-0">
          <button 
            onClick={handlePCPrint} 
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-orange-500/10 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15.75V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
            </svg>
            Print from PC
          </button>
          
          <button 
            onClick={handleMobileThermalPrint}
            disabled={printMode === 'a4'}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/50"
            title={printMode === 'a4' ? "ဖုန်းဖြင့်ထုတ်ရန် Thermal Sticker Mode ပြောင်းပေးပါ" : "ဖုန်းဖြင့် တိုက်ရိုက်ထုတ်ရန်"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            Print via Phone (RawBT)
          </button>
        </div>
      </div>

      {/* 👁️ Right Side Workspace Canvas - Full Screen View */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-900">
        
        {/* Workspace Sub-header */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Live Preview Canvas</span>
            {isA6Grid && <span className="ml-2 bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-semibold">10 Labels / Sheet Mode ဖွင့်ထားသည်</span>}
          </div>
          
          <div className="flex items-center gap-2 text-[11px] bg-slate-900 px-3 py-1.5 rounded-lg text-slate-400 border border-slate-800">
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>PC Print ထုတ်လျှင် Margins ကို <b>None</b> ထားပေးပါ။</span>
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start bg-slate-900 custom-scrollbar">
          {generatedList.length === 0 ? (
            <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500 gap-3 border-2 border-dashed border-slate-800 rounded-2xl p-8">
              <svg className="w-12 h-12 text-slate-700 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM16.875 14.625a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM16.875 19.875a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM13.5 17.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM18.75 17.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" />
              </svg>
              <p className="text-sm font-medium tracking-wide">ဘားကုဒ်များ စတင်ကြည့်ရှုရန် ဘယ်ဘက်ခြမ်းရှိ Generate ခလုတ်ကို နှိပ်ပါဗျာ...</p>
            </div>
          ) : isA6Grid ? (
            /* 🌟 ၁၀၀x၁၅၀mm (10 Labels per sheet) Live Preview အသစ် */
            <div ref={previewRef} className="flex flex-col gap-8 items-center w-full py-4">
              {chunkArray(generatedList, 10).map((pageItems, pIdx) => (
                <div 
                  key={pIdx}
                  className="bg-white shadow-2xl border-4 border-slate-950 relative grid grid-cols-2 grid-rows-5 rounded-xs select-none"
                  style={{ 
                    width: '100mm', 
                    height: '150mm', 
                    minHeight: '150mm',
                    columnGap: '4mm',   /* 🌟 Screen Preview ပေါ်မှာပါ ကောလံကြား ချဲ့ပေးခြင်း */
                    rowGap: '2mm',
                    padding: '3mm 2mm' 
                  }}
                >
                  {pageItems.map((id) => (
                    <div 
                      key={id}
                      className="flex flex-col items-center justify-center border border-dashed border-slate-400 bg-white overflow-hidden relative"
                      style={{ width: '46mm', height: '27.2mm', padding: '1px 4px' }} /* 🌟 ကတ်တစ်ခုချင်းစီ၏ အချိုးအစားသစ် */
                    >
                      
                      
                      {/* 🌟 A6 Grid အတွက် Logo နှင့် စာသားတွဲလျက် Block */}
                      <div className="flex items-center justify-center gap-1 mb-0.5 text-neutral-800 font-bold uppercase tracking-wider">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 97" width="11" height="11" className="inline-block shrink-0">
                          <path d="M0 0 C0.7115625 0.4125 1.423125 0.825 2.15625 1.25 C8.90248597 5.68036392 12.38401096 12.03348145 15.375 19.375 C17.62714732 32.43745446 14.92613228 44.52594513 7.78515625 55.703125 C4.35570844 60.11563115 0.04297912 64.47851044 -5 67 C-9.31900368 67.49834658 -11.43437514 67.34381119 -15.1875 65.0625 C-18.74861701 61.75915822 -20.341415 57.47817951 -22 53 C-24.83279698 52.94334406 -26.43208763 52.93348801 -29 54 C-30.79849033 56.13570727 -32.16491932 58.37847193 -33.609375 60.765625 C-35.4119185 63.66184658 -36.99681144 65.35539674 -40 67 C-44.20816696 67.73857624 -47.16819288 67.41590356 -51 65.5 C-51.66 65.005 -52.32 64.51 -53 64 C-47.87452211 71.04753209 -41.55616536 74.28876693 -33 76 C-19.42371674 77.11185078 -6.023309 73.47229141 4.6875 64.83203125 C6.23686772 63.42915824 7.76354665 62.00048734 9.2578125 60.5390625 C11 59 11 59 13 59 C11.43755834 67.67155122 2.73212214 74.95366295 -4 80 C-14.99508697 86.82214845 -25.25284667 88.01744261 -38 86 C-44.01401408 84.26470635 -49.6283132 82.60312905 -54 78 C-54.99 77.67 -55.98 77.34 -57 77 C-62.80363087 70.57695609 -65.89611027 63.30183516 -68 55 C-68.18691406 54.28585938 -68.37382813 53.57171875 -68.56640625 52.8359375 C-70.73162941 41.02977331 -66.46989646 26.77516966 -60 17 C-46.52797327 -0.53858295 -21.1050023 -12.98769372 0 0 Z M-49.375 18.8125 C-55.80631071 27.42655859 -58.17895941 35.30175027 -58.1875 45.875 C-58.19974609 46.66519531 -58.21199219 47.45539062 -58.22460938 48.26953125 C-58.2362095 52.91731548 -57.77874711 56.62695373 -56 61 C-55.67 61 -55.34 61 -55 61 C-54.67 58.36 -54.34 55.72 -54 53 C-51.525 52.505 -51.525 52.505 -49 52 C-48.34 53.32 -47.68 54.64 -47 56 C-46.608125 55.443125 -46.21625 54.88625 -45.8125 54.3125 C-43.20347238 50.98374063 -40.21108022 48.09316572 -37.07421875 45.26171875 C-34.57701395 42.53877792 -32.96505303 39.55044691 -31.25 36.3125 C-26.29502861 27.35373476 -20.49929645 19.47621432 -11 15 C-8 14.1875 -8 14.1875 -6 14 C-7.81074217 19.67914589 -9.84612672 25.17539157 -12.23046875 30.640625 C-13.07176113 33.2200189 -13.13860585 35.30435528 -13 38 C-11.06201737 35.22739701 -11.06201737 35.22739701 -10 33 C-8.35 33.33 -6.7 33.66 -5 34 C-4.33035714 41.76785714 -4.33035714 41.76785714 -7.3125 45.375 C-10 48 -10 48 -13 50 C-11.45575673 55.02915051 -11.45575673 55.02915051 -7.625 58.25 C-4.82785364 58.20934381 -4.82785364 58.20934381 -2.4375 56.125 C5.28488428 46.22450734 7.13257438 34.27194516 6 22 C4.36780581 15.82307349 0.39607582 11.31193181 -5 8 C-20.60825465 1.0484244 -38.50290939 5.84652528 -49.375 18.8125 Z M-23 36 C-23.66 37.11375 -24.32 38.2275 -25 39.375 C-25.37125 40.00148438 -25.7425 40.62796875 -26.125 41.2734375 C-27.15068348 42.97472667 -27.15068348 42.97472667 -27 45 C-25.02 44.67 -23.04 44.34 -21 44 C-21.33 41.36 -21.66 38.72 -22 36 C-22.33 36 -22.66 36 -23 36 Z" fill="#000000" transform="translate(73,7)"/>
                        </svg>
                        <span className="text-[9px]">ALL IN ONE Express</span>
                      </div>

                      <svg id={`barcode-${id}`} className="max-w-full h-auto"></svg>
                    </div>
                  ))}
                  <div className="absolute -bottom-5 right-1 text-[11px] text-slate-400 font-mono font-bold">Sheet {pIdx + 1}</div>
                </div>
              ))}
            </div>
          ) : (
            /* ရိုးရိုး Single Label သို့မဟုတ် A4 ပုံမှန် Preview */
            <div 
              ref={previewRef} 
              className={`flex flex-wrap gap-3 w-full justify-center ${printMode === 'thermal' ? 'flex-col items-center' : 'justify-start'}`}
            >
              {generatedList.map((id) => (
                <div 
                  key={id} 
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-white p-2 rounded"
                  style={{ width: `${labelSize.w}mm`, height: `${labelSize.h}mm` }}
                >
                  {/* 🌟 Regular Label Preview အတွက် Logo နှင့် စာသားတွဲလျက် Block */}
                  <div className="flex items-center justify-center gap-1 mb-1 text-neutral-900 font-bold uppercase">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 97" width="12" height="12" className="inline-block shrink-0">
                      <path d="M0 0 C0.7115625 0.4125 1.423125 0.825 2.15625 1.25 C8.90248597 5.68036392 12.38401096 12.03348145 15.375 19.375 C17.62714732 32.43745446 14.92613228 44.52594513 7.78515625 55.703125 C4.35570844 60.11563115 0.04297912 64.47851044 -5 67 C-9.31900368 67.49834658 -11.43437514 67.34381119 -15.1875 65.0625 C-18.74861701 61.75915822 -20.341415 57.47817951 -22 53 C-24.83279698 52.94334406 -26.43208763 52.93348801 -29 54 C-30.79849033 56.13570727 -32.16491932 58.37847193 -33.609375 60.765625 C-35.4119185 63.66184658 -36.99681144 65.35539674 -40 67 C-44.20816696 67.73857624 -47.16819288 67.41590356 -51 65.5 C-51.66 65.005 -52.32 64.51 -53 64 C-47.87452211 71.04753209 -41.55616536 74.28876693 -33 76 C-19.42371674 77.11185078 -6.023309 73.47229141 4.6875 64.83203125 C6.23686772 63.42915824 7.76354665 62.00048734 9.2578125 60.5390625 C11 59 11 59 13 59 C11.43755834 67.67155122 2.73212214 74.95366295 -4 80 C-14.99508697 86.82214845 -25.25284667 88.01744261 -38 86 C-44.01401408 84.26470635 -49.6283132 82.60312905 -54 78 C-54.99 77.67 -55.98 77.34 -57 77 C-62.80363087 70.57695609 -65.89611027 63.30183516 -68 55 C-68.18691406 54.28585938 -68.37382813 53.57171875 -68.56640625 52.8359375 C-70.73162941 41.02977331 -66.46989646 26.77516966 -60 17 C-46.52797327 -0.53858295 -21.1050023 -12.98769372 0 0 Z M-49.375 18.8125 C-55.80631071 27.42655859 -58.17895941 35.30175027 -58.1875 45.875 C-58.19974609 46.66519531 -58.21199219 47.45539062 -58.22460938 48.26953125 C-58.2362095 52.91731548 -57.77874711 56.62695373 -56 61 C-55.67 61 -55.34 61 -55 61 C-54.67 58.36 -54.34 55.72 -54 53 C-51.525 52.505 -51.525 52.505 -49 52 C-48.34 53.32 -47.68 54.64 -47 56 C-46.608125 55.443125 -46.21625 54.88625 -45.8125 54.3125 C-43.20347238 50.98374063 -40.21108022 48.09316572 -37.07421875 45.26171875 C-34.57701395 42.53877792 -32.96505303 39.55044691 -31.25 36.3125 C-26.29502861 27.35373476 -20.49929645 19.47621432 -11 15 C-8 14.1875 -8 14.1875 -6 14 C-7.81074217 19.67914589 -9.84612672 25.17539157 -12.23046875 30.640625 C-13.07176113 33.2200189 -13.13860585 35.30435528 -13 38 C-11.06201737 35.22739701 -11.06201737 35.22739701 -10 33 C-8.35 33.33 -6.7 33.66 -5 34 C-4.33035714 41.76785714 -4.33035714 41.76785714 -7.3125 45.375 C-10 48 -10 48 -13 50 C-11.45575673 55.02915051 -11.45575673 55.02915051 -7.625 58.25 C-4.82785364 58.20934381 -4.82785364 58.20934381 -2.4375 56.125 C5.28488428 46.22450734 7.13257438 34.27194516 6 22 C4.36780581 15.82307349 0.39607582 11.31193181 -5 8 C-20.60825465 1.0484244 -38.50290939 5.84652528 -49.375 18.8125 Z M-23 36 C-23.66 37.11375 -24.32 38.2275 -25 39.375 C-25.37125 40.00148438 -25.7425 40.62796875 -26.125 41.2734375 C-27.15068348 42.97472667 -27.15068348 42.97472667 -27 45 C-25.02 44.67 -23.04 44.34 -21 44 C-21.33 41.36 -21.66 38.72 -22 36 C-22.33 36 -22.66 36 -23 36 Z" fill="#000000" transform="translate(73,7)"/>
                    </svg>
                    <span className="text-[10px]">ALL IN ONE Express</span>
                  </div>

                  <svg id={`barcode-${id}`} className="max-w-full h-auto"></svg>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default BarcodePrinterPage;