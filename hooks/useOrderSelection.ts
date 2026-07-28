"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'

export interface OrderItem {
  id: string;
  cod_amount?: number;
  deli_fee?: number;
  total_amount?: number;
  [key: string]: any;
}

export function useOrderSelection(orders: OrderItem[]) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  // Mouse Up ဖြစ်သွားပါက Dragging အခြေအနေကို ရပ်တန့်ရန် Window Event နားထောင်ခြင်း
  useEffect(() => {
    const stopDragging = () => setIsDraggingSelection(false);
    window.addEventListener('mouseup', stopDragging);
    return () => window.removeEventListener('mouseup', stopDragging);
  }, []);

  // Checkbox တစ်ခုချင်း Toggle လုပ်ရန်
  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  // Filter ဖြစ်ထားသော အော်ဒါအားလုံး Select လုပ်ရန်
 const selectAllFiltered = useCallback((filteredOrders?: OrderItem[]) => {
  // Argument အဖြစ် Array မပါလာပါက Hook ရဲ့ မူရင်း orders ကို Default အနေနဲ့ သုံးမည်
  const listToSelect = Array.isArray(filteredOrders) ? filteredOrders : orders;
  const filteredIds = new Set(listToSelect.map(o => o.id));
  setSelectedOrders(filteredIds);
}, [orders]);

  // ရွေးချယ်ထားသမျှ အားလုံး ဖြုတ်ရန်
  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set());
  }, []);

  // Mouse Drag Selection စတင်ရန်
const handleRowMouseDown = useCallback((orderId: string, e?: React.MouseEvent) => {
  // 🟢 Checkbox (INPUT) သို့မဟုတ် BUTTON များကို နှိပ်မိပါက Drag Event ကို ရပ်တန့်ရန်
  if (e) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('button') || target.closest('a')) {
      return;
    }
  }

  setIsDraggingSelection(true);
  setSelectedOrders(prev => {
    const next = new Set(prev);
    next.add(orderId);
    return next;
  });
}, []);

  // Mouse Drag လုပ်နေစဉ် ဖြတ်သန်းသွားသော Row များကို Select မှတ်ရန်
  const handleRowMouseEnter = useCallback((orderId: string) => {
    if (!isDraggingSelection) return;
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
  }, [isDraggingSelection]);

  // Selected Data များအတွက် ပေါမိုငွေ ပမာဏများ တွက်ချက်ခြင်း
  const selectedList = useMemo(() => {
    return orders.filter(o => selectedOrders.has(o.id));
  }, [orders, selectedOrders]);

  const selectedCount = selectedList.length;
  const selectedCodTotal = useMemo(() => selectedList.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0), [selectedList]);
  const selectedDeliTotal = useMemo(() => selectedList.reduce((sum, o) => sum + (Number(o.deli_fee) || 0), 0), [selectedList]);
  const selectedGrandTotal = useMemo(() => selectedList.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0), [selectedList]);

  const isAllSelected = useMemo(() => {
    if (orders.length === 0) return false;
    return orders.every(o => selectedOrders.has(o.id));
  }, [orders, selectedOrders]);

  return {
    selectedOrders,
    selectedCount,
    selectedCodTotal,
    selectedDeliTotal,
    selectedGrandTotal,
    isAllSelected,
    isDraggingSelection,
    setIsDraggingSelection,
    toggleOrderSelection,
    selectAllFiltered,
    clearSelection,
    handleRowMouseDown,
    handleRowMouseEnter,
  };
}