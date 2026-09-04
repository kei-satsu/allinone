// utils/print.ts
export const printVoucher = (orderData: any) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("voc_print_data", JSON.stringify(orderData));
    window.open("/voc?print=1", "_blank");
  }
};