"use client"

import React, { useState, useRef, useEffect } from 'react'

export interface Option {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
}

export default function MultiSelectFilter({
  label,
  options,
  selectedValues = [],
  onChange,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown ပြင်ပသို့ Click နှိပ်ပါက Dropdown ပိတ်သွားစေရန်
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border-b border-gray-300 py-1 text-left text-[11px] font-medium text-gray-700 flex items-center justify-between focus:outline-none focus:border-orange-500"
      >
        <span className="truncate">
          {selectedValues.length > 0 
            ? `${selectedValues.length} ရွေးထားသည်` 
            : label}
        </span>
        <svg 
          className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-44 max-h-56 overflow-y-auto rounded-md bg-white p-1.5 shadow-lg ring-1 ring-black ring-opacity-5 z-50 text-[11px]">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-100 px-1">
            <button
              type="button"
              onClick={() => onChange(options.map(o => o.value))}
              className="text-[10px] text-orange-600 hover:underline font-semibold"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-gray-400 hover:underline"
            >
              Clear
            </button>
          </div>

          {options.length === 0 ? (
            <div className="p-2 text-center text-gray-400">Option မရှိပါ။</div>
          ) : (
            options.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-1.5 py-1 hover:bg-gray-50 rounded cursor-pointer text-gray-700 select-none"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                  className="w-3.5 h-3.5 text-orange-500 rounded border-gray-300 accent-orange-500"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}