// src/utils/print.ts

/**
 * စနစ်အတွင်းရှိ မည်သည့်စာမျက်နှာမှမဆို Voucher လှမ်းထုတ်ရန် သုံးသော Utility Function
 * @param orderData - ပုံနှိပ်မည့် ပါဆယ်ထုပ် အချက်အလက် Object
 */
export const printVoucher = (orderData: any) => {
  if (typeof window !== "undefined") {
    // Custom Event တစ်ခုဆောက်ပြီး Data ထည့်ပေးလိုက်ခြင်းဖြစ်သည်
    const event = new CustomEvent("app:print-voucher", { detail: orderData });
    window.dispatchEvent(event);
  }
};