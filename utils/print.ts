// utils/print.ts
export const printVoucher = (orderData: any) => {
  if (typeof window !== "undefined") {
    // ၁။ ပါဆယ် Data ကို localStorage ထဲ ယာယီလှမ်းသိမ်းလိုက်ပါမယ်
    localStorage.setItem("print_order_data", JSON.stringify(orderData));
    
    // ၂။ Voucher Template ရှိရာ /voc စာမျက်နှာကို Tab အသစ်ဖြင့် တိုက်ရိုက်ဖွင့်ပါမည်
    window.open("/voc", "_blank");
  }
};