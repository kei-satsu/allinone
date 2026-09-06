"use client";

import { useState, useEffect, useRef } from "react";

const initialForm = {
  received_date: new Date().toISOString().split("T")[0],
  sender_name: "",
  sender_phone: "",
  sender_loc: "",
  receiver_name: "",
  receiver_phone: "",
  receiver_address: "",
  cod_amount: "0",
  deli_fee: "0",
  fee_type: "Deli",
  total_amount: "0",
  note: "",
  remark_font_size: "normal",
  remark_bold: false,
  remark_italic: false,
};

const remarkPresetValues = {
  small: 12,
  normal: 18,
  medium: 26,
  large: 36,
} as const;

type RemarkPreset = keyof typeof remarkPresetValues;

const normalizeRemarkPreset = (value: unknown): RemarkPreset => {
  if (typeof value === "string" && value in remarkPresetValues) {
    return value as RemarkPreset;
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return (Object.entries(remarkPresetValues).reduce((closest, current) =>
      Math.abs(current[1] - numericValue) < Math.abs(closest[1] - numericValue)
        ? current
        : closest
    )[0] as RemarkPreset);
  }

  return "normal";
};

// Field များ၏ Enter Navigation အစီအစဉ်
const fieldOrder = [
  "sender_name",
  "sender_phone",
  "sender_loc",
  "receiver_name",
  "receiver_phone",
  "receiver_address",
  "cod_amount",
  "deli_fee",
  "fee_type",
  "note",
];

export default function VoucherFormPage() {
  const [formData, setFormData] = useState(initialForm);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = event.target;
    const nextValue =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : value;
    setFormData((current) => {
      const next = { ...current, [name]: nextValue };
      if (
        name === "cod_amount" ||
        name === "deli_fee" ||
        name === "fee_type"
      ) {
        const cod = Number(next.cod_amount) || 0;
        const fee = Number(next.deli_fee) || 0;
        next.total_amount = String(
          next.fee_type === "Deli" ? cod + fee : cod
        );
      }
      return next;
    });
  };

  // Enter နှိပ်လျှင် နောက် Field သို့ ရွှေ့ပေးမည့် Function
  const focusNextField = (currentName: string) => {
    const currentIndex = fieldOrder.indexOf(currentName);
    if (currentIndex !== -1 && currentIndex < fieldOrder.length - 1) {
      const nextName = fieldOrder[currentIndex + 1];
      const nextElement = formRef.current?.querySelector<HTMLElement>(
        `[name="${nextName}"]`
      );
      if (nextElement) {
        nextElement.focus();
        // Input ဖြစ်လျှင် select လုပ်ပေးမည် (အထူးသဖြင့် number fields)
        if (
          nextElement instanceof HTMLInputElement ||
          nextElement instanceof HTMLTextAreaElement
        ) {
          nextElement.select?.();
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter ဖြင့် Print
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      executePrint();
      return;
    }

    // Enter နှိပ်လျှင် နောက် Field သို့ (textarea မဟုတ်လျှင်)
    if (
      e.key === "Enter" &&
      e.target instanceof HTMLElement &&
      e.target.tagName !== "TEXTAREA" &&
      e.target.tagName !== "BUTTON"
    ) {
      e.preventDefault();
      const currentName = (e.target as HTMLInputElement).name;
      focusNextField(currentName);
    }
  };

  const executePrint = () => {
    if (
      !formData.sender_name ||
      !formData.sender_phone ||
      !formData.receiver_name ||
      !formData.receiver_phone
    ) {
      alert("Sender နှင့် Receiver အချက်အလက်များကို ပြည့်စုံစွာ ဖြည့်စွက်ပါ။");
      return;
    }

    localStorage.setItem(
      "voc_print_data",
      JSON.stringify({
        ...formData,
        remark_font_size: normalizeRemarkPreset(formData.remark_font_size),
        remark_bold: Boolean(formData.remark_bold),
        remark_italic: Boolean(formData.remark_italic),
        item_id: `66${Date.now().toString().slice(-11)}`,
      })
    );
    window.open("/voc?print=1", "_blank");
  };

  const handleReset = () => {
    setFormData({
      ...initialForm,
      received_date: formData.received_date,
    });
    firstInputRef.current?.focus();
  };

  // Input CSS (ပိုမိုကြည်လင်ပြီး ကြီးမားသော Font)
  const fieldInput =
    "w-full h-12 rounded-lg border-2 border-slate-700 bg-slate-950 px-4 text-base font-medium text-slate-100 placeholder-slate-500 transition-all focus:border-orange-500 focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-orange-500/25 hover:border-slate-600";

  const fieldLabel =
    "block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5";

  return (
    <div
      className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4 lg:p-6 font-sans antialiased"
      onKeyDown={handleKeyDown}
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          executePrint();
        }}
        className="w-full max-w-7xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5"
      >
        {/* Top Header & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 font-bold text-xl">
              ⌨️
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Voucher Entry Portal
                <span className="text-[10px] bg-orange-500/20 text-orange-400 font-semibold px-2 py-0.5 rounded border border-orange-500/30">
                  Fast Typing Mode
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                [Enter] နှိပ်ပြီး နောက် Field သွားနိုင်သည်။ [Ctrl+Enter] ဖြင့် Print ထုတ်နိုင်သည်။
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase">
                Date:
              </span>
              <input
                name="received_date"
                type="date"
                value={formData.received_date}
                onChange={handleChange}
                className="bg-transparent text-sm font-mono font-bold text-orange-400 focus:outline-none cursor-pointer"
                required
              />
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold py-2 px-3 rounded-lg border border-slate-700 transition-all cursor-pointer"
              title="Clear form for next voucher"
            >
              🔄 Reset Form
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="space-y-5">
          {/* Row 1: Sender & Receiver Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Sender Section */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  1. Sender Information
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>
                    Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    name="sender_name"
                    value={formData.sender_name}
                    onChange={handleChange}
                    placeholder="အမည်"
                    className={fieldInput}
                    required
                  />
                </div>
                <div>
                  <label className={fieldLabel}>
                    Phone <span className="text-orange-500">*</span>
                  </label>
                  <input
                    name="sender_phone"
                    value={formData.sender_phone}
                    onChange={handleChange}
                    placeholder="09xxxxxxxxx"
                    className={`${fieldInput} font-mono`}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className={fieldLabel}>
                    City / Address <span className="text-orange-500">*</span>
                  </label>
                  <input
                    name="sender_loc"
                    value={formData.sender_loc}
                    onChange={handleChange}
                    placeholder="မြို့ / လိပ်စာ"
                    className={fieldInput}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Receiver Section */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  2. Receiver Information
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>
                    Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    name="receiver_name"
                    value={formData.receiver_name}
                    onChange={handleChange}
                    placeholder="အမည်"
                    className={fieldInput}
                    required
                  />
                </div>
                <div>
                  <label className={fieldLabel}>
                    Phone <span className="text-orange-500">*</span>
                  </label>
                  <input
                    name="receiver_phone"
                    value={formData.receiver_phone}
                    onChange={handleChange}
                    placeholder="09xxxxxxxxx"
                    className={`${fieldInput} font-mono`}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className={fieldLabel}>
                    Full Address <span className="text-orange-500">*</span>
                  </label>
                  <textarea
                    name="receiver_address"
                    value={formData.receiver_address}
                    onChange={handleChange}
                    rows={2}
                    placeholder="မြို့၊ ရပ်ကွက်၊ လမ်း၊ အိမ်အမှတ် အသေးစိတ်..."
                    className="w-full rounded-lg border-2 border-slate-700 bg-slate-950 p-3 text-base font-medium text-slate-100 placeholder-slate-500 transition-all focus:border-orange-500 focus:bg-slate-950 focus:outline-none focus:ring-4 focus:ring-orange-500/25 hover:border-slate-600 resize-none"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Payment & Remark Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Payment Section */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 block">
                3. Payment & Calculation
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={fieldLabel}>COD (Ks)</label>
                  <input
                    name="cod_amount"
                    type="number"
                    min="0"
                    value={formData.cod_amount}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${fieldInput} font-mono font-bold text-white text-base`}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Deli Fee (Ks)</label>
                  <input
                    name="deli_fee"
                    type="number"
                    min="0"
                    value={formData.deli_fee}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    className={`${fieldInput} font-mono text-orange-400 font-bold text-base`}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Payment Type</label>
                  <select
                    name="fee_type"
                    value={formData.fee_type}
                    onChange={handleChange}
                    className={`${fieldInput} cursor-pointer font-semibold`}
                  >
                    <option value="Deli">Receiver Pay</option>
                    <option value="Cash">Cash (Prepaid)</option>
                    <option value="Kpay">Kpay (Prepaid)</option>
                    <option value="Bill">Bill</option>
                  </select>
                </div>
              </div>

              {/* Total Display */}
              <div className="bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border-2 border-orange-500/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-orange-400 block">
                    Total Amount To Collect
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formData.fee_type === "Deli" ? "(COD + Deli Fee)" : "(COD Only)"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-black text-orange-400 tracking-tight">
                    {Number(formData.total_amount).toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-orange-300">Ks</span>
                </div>
              </div>
            </div>

            {/* Remark Section */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <label className={fieldLabel}>Remark (မှတ်ချက်)</label>
                <input
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  placeholder="မှတ်ချက်များ ရေးရန် (ဥပမာ - ပစ္စည်းခွဲပို့ရန်၊ ဂိတ်ချပေးရန်)..."
                  className={fieldInput}
                />
                <div
                  className="mt-3 flex flex-wrap items-center text-sm text-slate-300"
                  style={{ columnGap: "18px", rowGap: "8px" }}
                >
                  <label htmlFor="remark_font_size" className="text-xs font-bold text-slate-400 whitespace-nowrap">
                    Remark Size
                  </label>
                  <select
                    id="remark_font_size"
                    name="remark_font_size"
                    value={normalizeRemarkPreset(formData.remark_font_size)}
                    onChange={handleChange}
                    className="h-9 rounded-lg border-2 border-slate-700 bg-slate-950 px-2 text-sm font-bold text-orange-400 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/25"
                    aria-label="Remark font size preset"
                  >
                    <option value="normal">Normal</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                  <label className="flex items-center cursor-pointer" style={{ gap: "8px" }}>
                    <input
                      type="checkbox"
                      name="remark_bold"
                      checked={Boolean(formData.remark_bold)}
                      onChange={handleChange}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <span className="font-bold">Bold</span>
                  </label>
                  <label className="flex items-center cursor-pointer" style={{ gap: "8px" }}>
                    <input
                      type="checkbox"
                      name="remark_italic"
                      checked={Boolean(formData.remark_italic)}
                      onChange={handleChange}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <span className="italic">Italic</span>
                  </label>
                </div>
              </div>
              {/* Shortcut Hint */}
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded-lg p-3">
                <span className="font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">Enter</span>
                <span>နောက် Field သို့</span>
                <span className="font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">Ctrl+Enter</span>
                <span>Print ထုတ်ရန်</span>
              </div>
            </div>
          </div>

          {/* Print Button Full Width */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black py-4 px-6 rounded-xl shadow-lg shadow-orange-500/25 active:scale-[0.99] transition-all flex items-center justify-between text-base cursor-pointer border border-orange-400/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🖨️</span>
              <span>PRINT VOUCHER</span>
            </div>
            <span className="text-xs bg-slate-950/40 px-2.5 py-1 rounded-md text-orange-100 font-mono font-normal">
              Ctrl + Enter
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}