"use client"

import React from 'react'

interface SelectionSummaryBarProps {
  selectedCount: number;
  selectedCodTotal: number;
  selectedDeliTotal: number;
  selectedGrandTotal: number;
  onClear: () => void;
}

export default function SelectionSummaryBar({
  selectedCount,
  selectedCodTotal,
  selectedDeliTotal,
  selectedGrandTotal,
  onClear,
}: SelectionSummaryBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="ml-2 flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 shadow-sm animate-in fade-in duration-200">
      <span className="text-sm font-bold text-orange-800 whitespace-nowrap">
        Selected: <span className="ml-1 rounded-full bg-orange-500 px-2 py-0.5 text-white">{selectedCount}</span>
      </span>
      <span className="text-[11px] font-semibold text-gray-700">
        COD: <span className="text-orange-700">{selectedCodTotal.toLocaleString()} Ks</span>
      </span>
      <span className="text-[11px] font-semibold text-gray-700">
        Deli: <span className="text-orange-700">{selectedDeliTotal.toLocaleString()} Ks</span>
      </span>
      <span className="text-[11px] font-semibold text-gray-700">
        Total: <span className="text-orange-700">{selectedGrandTotal.toLocaleString()} Ks</span>
      </span>
      <button 
        onClick={onClear}
        className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-100"
      >
        ဖြုတ်မည်
      </button>
    </div>
  );
}