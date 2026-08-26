"use client";

import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/databaseApi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface SenderSummary {
  sender_name: string;
  total_ways: number;
  total_cod: number;
  total_deli: number;
  grand_total: number;
}

export default function PrepaidSenderSummary() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [userBranch, setUserBranch] = useState<string>("");
  const [summaryData, setSummaryData] = useState<SenderSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchSummary = async (branchCode: string) => {
    setLoading(true);

    // Muti-row orders query matching the prepaid rules
    const { data, error } = await apiClient
      .from("orders")
      .select("sender_name, cod_amount, deli_fee, total_amount")
      .eq("is_deleted", false)
      .eq("branch", branchCode)
      .not("cleared_date", "is", null)
      .neq("status", "Delivered")
      .neq("status", "Settled")
      .neq("status", "Returned");

    if (error) {
      console.error("Error fetching summary data:", error);
      setSummaryData([]);
    } else if (data) {
      // Grouping logic by sender_name
      const grouped: Record<string, SenderSummary> = {};

      data.forEach((item: any) => {
        const name = item.sender_name?.trim() || "Unknown Sender";
        if (!grouped[name]) {
          grouped[name] = {
            sender_name: name,
            total_ways: 0,
            total_cod: 0,
            total_deli: 0,
            grand_total: 0,
          };
        }

        grouped[name].total_ways += 1;
        grouped[name].total_cod += Number(item.cod_amount || 0);
        grouped[name].total_deli += Number(item.deli_fee || 0);
        grouped[name].grand_total += Number(item.total_amount || 0);
      });

      // Array အဖြစ်ပြောင်းပြီး COD ပမာဏအများဆုံး အပေါ်ထားရန် Sort စီခြင်း
      const summaryList = Object.values(grouped).sort(
        (a, b) => b.total_cod - a.total_cod
      );
      setSummaryData(summaryList);
    }
    setLoading(false);
  };

  useEffect(() => {
    const storedBranch = localStorage.getItem("user_branch");
    if (!storedBranch) {
      router.push("/login");
    } else {
      setUserBranch(storedBranch);
      fetchSummary(storedBranch);
    }
  }, [router]);

  // Search Filter
  const filteredSummary = useMemo(() => {
    if (!searchQuery.trim()) return summaryData;
    return summaryData.filter((item) =>
      item.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [summaryData, searchQuery]);

  // Overall Totals
  const totals = useMemo(() => {
    return filteredSummary.reduce(
      (acc, item) => {
        acc.ways += item.total_ways;
        acc.cod += item.total_cod;
        acc.deli += item.total_deli;
        acc.grand += item.grand_total;
        return acc;
      },
      { ways: 0, cod: 0, deli: 0, grand: 0 }
    );
  }, [filteredSummary]);

  // Excel Export Function
  const handleExportExcel = () => {
    if (filteredSummary.length === 0) {
      alert("Export ထုတ်ရန် မှတ်တမ်းမရှိပါ။");
      return;
    }

    const excelRows = filteredSummary.map((item, index) => ({
      "စဉ်": index + 1,
      "Sender အမည်": item.sender_name,
      "Way အရေအတွက်": item.total_ways,
      "စုစုပေါင်း COD (Ks)": item.total_cod,
      "စုစုပေါင်း Deli Fee (Ks)": item.total_deli,
      "Grand Total (Ks)": item.grand_total,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prepaid_Summary");

    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Prepaid_Sender_Summary_${todayStr}.xlsx`);
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f3f3f3] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] select-none">
      {/* Top Title Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-gray-900 tracking-wide flex items-center gap-2">
              <span className="uppercase">
                {userBranch === "MDY"
                  ? "Mandalay"
                  : userBranch === "YGN"
                  ? "Yangon"
                  : "Main"}{" "}
                Office | Prepaid Summary
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchSummary(userBranch)}
            className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>

          <button
            onClick={handleExportExcel}
            className="bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Excel Export
          </button>

          <Link
            href="/senders/prepaid/list"
            className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm"
          >
            ဇယားအသေးစိတ်ကြည့်မည် ➔
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Sender အေရေအတွက်
            </span>
            <span className="text-xl font-bold text-gray-900 mt-1 block">
              {filteredSummary.length.toLocaleString()} ဦး
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              စုစုပေါင်း Way
            </span>
            <span className="text-xl font-bold text-blue-600 mt-1 block">
              {totals.ways.toLocaleString()} Ways
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-orange-200 bg-orange-50/30 shadow-sm">
            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider block">
              စုစုပေါင်း COD
            </span>
            <span className="text-xl font-bold text-orange-600 mt-1 block">
              {totals.cod.toLocaleString()} Ks
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Grand Total Net
            </span>
            <span className="text-xl font-bold text-green-600 mt-1 block">
              {totals.grand.toLocaleString()} Ks
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-400 ml-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Sender အမည်ဖြင့် ရှာဖွေရန်..."
            className="w-full bg-transparent text-xs text-gray-700 focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 font-medium">
              Data များ ရယူနေပါသည်...
            </div>
          ) : filteredSummary.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400 font-medium">
              Summary ထုတ်ရန် Data မရှိသေးပါ။
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Sender Name</th>
                    <th className="py-3 px-4 text-center">Total Ways</th>
                    <th className="py-3 px-4 text-right">Total COD (Ks)</th>
                    <th className="py-3 px-4 text-right">Total Deli Fee (Ks)</th>
                    <th className="py-3 px-4 text-right">Grand Total (Ks)</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredSummary.map((item, idx) => (
                    <tr
                      key={item.sender_name}
                      className="hover:bg-orange-50/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-center text-gray-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-800">
                        {item.sender_name}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border border-blue-100">
                          {item.total_ways}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-orange-600">
                        {item.total_cod.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {item.total_deli.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {item.grand_total.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/senders/prepaid/list?sender=${encodeURIComponent(
                            item.sender_name
                          )}`}
                          className="inline-flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-800 font-bold hover:underline"
                        >
                          အသေးစိတ်ကြည့်ရန် ➔
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900">
                    <td colSpan={2} className="py-3 px-4 text-right uppercase">
                      Total Summary:
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-blue-700">
                      {totals.ways.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-orange-600">
                      {totals.cod.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-600">
                      {totals.deli.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-green-700">
                      {totals.grand.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}