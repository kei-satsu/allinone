"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/databaseApi";
import { getSenders } from "@/lib/sendersApi";
import SenderModal from "@/components/SenderModal";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Link from "next/link";

// These helpers match the sender table column names. The fallback keys keep
// the UI compatible with rows returned by older API versions.
const getSenderAddress = (sender: any) =>
  sender?.Address ?? sender?.address ?? sender?.ADDRESS ?? "";

const getSenderKpayNo = (sender: any) =>
  sender?.["kpay-no"] ?? sender?.kpay_no ?? sender?.kpayNo ?? "";

const getSenderKpayName = (sender: any) =>
  sender?.["kpay-name"] ?? sender?.kpay_name ?? sender?.kpayName ?? "";

const getSenderPhone = (sender: any) =>
  sender?.phone === "EMPTY" || !sender?.phone ? "" : String(sender.phone);

export default function SendersDashboard() {
  // ─── States ───
  const [senders, setSenders] = useState<any[]>([]);
  const [filteredSenders, setFilteredSenders] = useState<any[]>([]);
  const [selectedSender, setSelectedSender] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [realBranch, setRealBranch] = useState<string | null>(null);

  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState({
    wayId: "",
    receivedDate: "",
    receiverName: "",
    phone: "",
    address: "",
    cod: "",
    deliFee: "",
    feeType: "",
    total: "",
    deliverDate: "",
    status: "",
    clearedDate: "",
    refundDate: "",
  });
  const [filterFeeType, setFilterFeeType] = useState("All");
  const [filterLoc, setFilterLoc] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [receivedStartDate, setReceivedStartDate] = useState("");
  const [receivedEndDate, setReceivedEndDate] = useState("");
  const [clearedFilterDate, setClearedFilterDate] = useState("");
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [activeBranch, setActiveBranch] = useState("MDY");
  const [activeTab, setActiveTab] = useState<
    "all" | "uncleared" | "cleared" | "not_delivered" | "returned"
  >("uncleared");
  const [hideClearedInAll, setHideClearedInAll] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");

  // Multiple Ways Selection & Clearing Date States
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Drag state ကို render တစ်ကြိမ်နဲ့တစ်ကြိမ်ကြား မလွဲစေရန် ref သုံးထားသည်။
  const isDraggingSelectionRef = useRef(false);

  // Mouse လွှတ်လိုက်သည်နှင့် drag selection ကို ရပ်ပါ။
  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingSelectionRef.current = false;
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const [clearedDateInput, setClearedDateInput] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    orderSearchTerm,
    filterFeeType,
    filterLoc,
    startDate,
    endDate,
    receivedStartDate,
    receivedEndDate,
    clearedFilterDate,
    columnFilters,
    selectedSender,
    itemsPerPage,
  ]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, activeBranch, selectedSender, hideClearedInAll]);

  useEffect(() => {
    const checkUserRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.user_metadata) {
        setRealBranch(session.user.user_metadata.branch || "MDY");
      }
    };
    checkUserRole();
  }, []);

  const fetchSenders = async (selectedIdOverride?: string | null) => {
    setLoadingSenders(true);
    const { data } = await getSenders({ LOC: activeBranch });
    let senderRows = data || [];

    // Some sender API versions return only the old columns. Read the new
    // contact columns directly as well, then merge them into each sender row
    // so the list and edit modal always receive the latest saved values.
    if (senderRows.length > 0) {
      const senderIds = senderRows
        .map((sender: any) => sender.id)
        .filter(Boolean);
      const { data: contactRows, error: contactError } = await apiClient
        .from("senders")
        .select('id, "Address", "kpay-no", "kpay-name"')
        .in("id", senderIds);

      if (!contactError && contactRows) {
        const contactsById = new Map(
          contactRows.map((sender: any) => [sender.id, sender]),
        );
        senderRows = senderRows.map((sender: any) => ({
          ...sender,
          ...(contactsById.get(sender.id) || {}),
        }));
      }
    }

    let processedSenders: any[] = [];

    if (senderRows.length > 0) {
      processedSenders = senderRows.map((sender: any) => {
        const unclearedCount =
          sender.orders?.filter(
            (o: any) =>
              (o.status === "Delivered" || o.status === "Settled") &&
              !o.cleared_date,
          ).length || 0;

        const notDeliveredCount =
          sender.orders?.filter(
            (o: any) =>
              o.status !== "Delivered" &&
              o.status !== "Settled" &&
              o.status !== "Returned",
          ).length || 0;

        return {
          ...sender,
          unclearedCount,
          notDeliveredCount,
          hasUncleared: unclearedCount > 0,
        };
      });

      processedSenders.sort((a: any, b: any) => {
        if (a.hasUncleared && !b.hasUncleared) return -1;
        if (!a.hasUncleared && b.hasUncleared) return 1;
        return (a.name || "").localeCompare(b.name || "", "my");
      });

      setSenders(processedSenders);
      setFilteredSenders(processedSenders);

      const selectedId = selectedIdOverride ?? selectedSender?.id;
      if (selectedId) {
        const updated = processedSenders.find((s: any) => s.id === selectedId);
        if (updated) setSelectedSender(updated);
      }
    }
    setLoadingSenders(false);
    return processedSenders;
  };

  useEffect(() => {
    fetchSenders();
  }, [activeBranch]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (!searchTerm.trim()) {
        setFilteredSenders(senders);
      } else {
        const lower = searchTerm.toLowerCase();
        const filtered = senders.filter(
          (s) =>
            s.name?.toLowerCase().includes(lower) ||
            s.phone?.toLowerCase().includes(lower) ||
            getSenderAddress(s).toLowerCase().includes(lower) ||
            String(getSenderKpayNo(s)).toLowerCase().includes(lower) ||
            String(getSenderKpayName(s)).toLowerCase().includes(lower),
        );
        setFilteredSenders(filtered);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, senders]);

  const handleSenderClick = async (sender: any) => {
    setSelectedSender(sender);
    setLoadingOrders(true);
    setOrders([]);
    setSelectedOrderIds([]);
    setOrderSearchTerm("");
    setColumnFilters({
      wayId: "",
      receivedDate: "",
      receiverName: "",
      phone: "",
      address: "",
      cod: "",
      deliFee: "",
      feeType: "",
      total: "",
      deliverDate: "",
      status: "",
      clearedDate: "",
      refundDate: "",
    });
    setFilterFeeType("All");
    setFilterLoc("All");
    setStartDate("");
    setEndDate("");
    setReceivedStartDate("");
    setReceivedEndDate("");
    setClearedFilterDate("");

    let allSenderOrders: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    // Data ၁၀၀၀ ထက်ပိုပါက Loop တ်ုင်း ဆွဲယူခြင်းဖြင့် 1000 Limit ကျော်လွန်စေသည်
    while (hasMore) {
      const { data, error } = await apiClient
        .from("orders")
        .select("*")
        .eq("sender_id", sender.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(from, from + step - 1);

      if (error) {
        console.error("Error fetching orders:", error);
        break;
      }

      if (data && data.length > 0) {
        allSenderOrders = [...allSenderOrders, ...data];
        if (data.length < step) hasMore = false;
        else from += step;
      } else {
        hasMore = false;
      }
    }

    setOrders(allSenderOrders);
  };

  const filteredOrders = orders.filter((order) => {
    const searchLower = orderSearchTerm.toLowerCase();
    const matchesSearch =
      !orderSearchTerm.trim() ||
      (order.item_id || "").toLowerCase().includes(searchLower) ||
      (order.id || "").toLowerCase().includes(searchLower) ||
      (order.receiver_name || "").toLowerCase().includes(searchLower) ||
      (order.receiver_phone || "").toLowerCase().includes(searchLower) ||
      (order.receiver_loc || "").toLowerCase().includes(searchLower) ||
      (order.receiver_address || "").toLowerCase().includes(searchLower);

    const matchesFeeType =
      filterFeeType === "All" || order.fee_type === filterFeeType;
    const matchesLoc = filterLoc === "All" || order.receiver_loc === filterLoc;

    const orderDate =
      order.deliver_date ||
      (order.created_at ? order.created_at.split("T")[0] : "");
    const receivedDate = order.received_date
      ? String(order.received_date).split("T")[0]
      : "";
    const clearedDateVal = order.cleared_date
      ? String(order.cleared_date).split("T")[0]
      : "";
    const matchesClearedFilterDate =
      !clearedFilterDate || clearedDateVal === clearedFilterDate;
    const matchesStartDate = !startDate || orderDate >= startDate;
    const matchesEndDate = !endDate || orderDate <= endDate;
    const matchesReceivedStartDate =
      !receivedStartDate || receivedDate >= receivedStartDate;
    const matchesReceivedEndDate =
      !receivedEndDate || receivedDate <= receivedEndDate;
    const columnValues = {
      wayId: order.item_id || order.id,
      receivedDate,
      receiverName: order.receiver_name,
      phone: order.receiver_phone,
      address: order.receiver_address,
      cod: order.cod_amount,
      deliFee: order.deli_fee,
      feeType: order.fee_type,
      total: order.total_amount,
      deliverDate: order.deliver_date || orderDate,
      status: order.status,
      clearedDate: clearedDateVal,
      refundDate: order.refund_date,
    };
    const matchesColumnFilters = Object.entries(columnFilters).every(
      ([key, value]) =>
        !value ||
        String(columnValues[key as keyof typeof columnValues] ?? "")
          .toLowerCase()
          .includes(value.toLowerCase()),
    );

    return (
      matchesSearch &&
      matchesFeeType &&
      matchesLoc &&
      matchesStartDate &&
      matchesEndDate &&
      matchesReceivedStartDate &&
      matchesReceivedEndDate &&
      matchesClearedFilterDate &&
      matchesColumnFilters
    );
  });

  const updateColumnFilter = (
    key: keyof typeof columnFilters,
    value: string,
  ) => {
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };

  const unclearedOrders = filteredOrders.filter(
    (o) =>
      (o.status === "Delivered" || o.status === "Settled") && !o.cleared_date,
  );
  const clearedOrders = filteredOrders.filter((o) => o.cleared_date);
  const returnedOrders = filteredOrders.filter((o) => o.status === "Returned");
  const notDeliveredOrders = filteredOrders.filter(
    (o) =>
      o.status !== "Delivered" &&
      o.status !== "Settled" &&
      o.status !== "Returned",
  );
  const allOrders = hideClearedInAll
    ? filteredOrders.filter((o) => !o.cleared_date)
    : filteredOrders;

  // Select လုပ်ထားသော Way များ၏ အချက်အလက်နှင့် ငွေပမာဏ တွက်ချက်မှုများ
  const selectedOrdersList = orders.filter((o) =>
    selectedOrderIds.includes(o.id),
  );
  const normalOrders = selectedOrdersList.filter(
    (o) => o.status !== "Returned",
  );
  const returnedOrdersList = selectedOrdersList.filter(
    (o) => o.status === "Returned",
  );

  const normalCodTotal = normalOrders.reduce(
    (sum, o) => sum + (Number(o.cod_amount) || 0),
    0,
  );
  const returnedCodTotal = returnedOrdersList.reduce(
    (sum, o) => sum + (Number(o.cod_amount) || 0),
    0,
  );
  const netPayableAmount = normalCodTotal - returnedCodTotal; // OS သို့ ရှင်းရမည့် ငွေ

  // ၁။ "Clear Selected" Button နိပ်လျှင် Modal ကို မူလအတိုင်း တန်းမရှင်းဘဲ Pop-up ဖွင့်ပေးမည်
  const handleOpenSummaryModal = () => {
    if (selectedOrderIds.length === 0) return;
    if (!clearedDateInput) {
      alert("ကျေးဇူးပြု၍ ရက်စွဲရွေးချယ်ပေးပါရန်။");
      return;
    }
    setIsSummaryModalOpen(true);
  };

  // ၂။ Pop-up Modal ထဲမှ "အတည်ပြုပြီး စာရင်းရှင်းမည်" ကို နိပ်မှ Database ထဲ အချက်အလက် သွားသိမ်းမည်
  const executeBulkClear = async () => {
    setClearing(true);

    const returnedIds = returnedOrdersList.map((o) => o.id);
    const otherIds = normalOrders.map((o) => o.id);

    let updateError: any = null;

    if (otherIds.length > 0) {
      const { error } = await apiClient
        .from("orders")
        .update({ cleared_date: clearedDateInput })
        .in("id", otherIds);
      if (error) updateError = error;
    }

    if (returnedIds.length > 0) {
      const { error } = await apiClient
        .from("orders")
        .update({ refund_date: clearedDateInput })
        .in("id", returnedIds);
      if (error) updateError = error;
    }

    setClearing(false);

    if (updateError) {
      console.error("Error clearing orders:", updateError);
      alert("စာရင်းရှင်းရာတွင် အမှားအယွင်းရှိခဲ့ပါသည်: " + updateError.message);
    } else {
      setSelectedOrderIds([]);
      setIsSummaryModalOpen(false);
      await fetchSenders();
      if (selectedSender) {
        handleSenderClick(selectedSender);
      }
    }
  };

  // Cleared ဖြစ်ပြီးသား Way များကို Uncleared သို့ ပြန်ပြောင်းမည့် Function
  const executeBulkUnclear = async () => {
    if (selectedOrderIds.length === 0) return;
    if (
      !confirm(
        "ရွေးချယ်ထားသော Way များကို Uncleared သို့ ပြန်ပြောင်းမှာ သေချာပါသလား။",
      )
    )
      return;

    setClearing(true);

    const { error } = await apiClient
      .from("orders")
      .update({ cleared_date: null })
      .in("id", selectedOrderIds);

    setClearing(false);

    if (error) {
      console.error("Error unclearing orders:", error);
      alert("Uncleared ပြုလုပ်ရာတွင် အမှားအယွင်းရှိခဲ့ပါသည်: " + error.message);
    } else {
      setSelectedOrderIds([]);
      await fetchSenders();
      if (selectedSender) {
        handleSenderClick(selectedSender);
      }
    }
  };

  // ၃။ Pop-up ထဲမှ "Excel ထုတ်မည်" ခလုတ်အတွက် Excel Export Function (Styled Version)
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Statement Summary");

    // Excel Gridlines များကို ပိတ်ထားခြင်း
    worksheet.views = [{ showGridLines: false }];

    // Color & Style Palette သတ်မှတ်ခြင်း (ARGB Color Code)
    const colors = {
      titleBg: "1E293B", // Dark Slate Blue
      headerBg: "1E40AF", // Primary Blue
      retHeaderBg: "991B1B", // Deep Red for Returned Table
      sectionBg: "E2E8F0", // Light Gray Slate
      retSectionBg: "FFE4E6", // Light Pink/Rose
      accentGreen: "DCFCE7", // Light Emerald for Net Payable
      totalBg: "F1F5F9", // Light Slate for Total Row
      border: "CBD5E1", // Slate Border Color
    };

    const fontTitle = {
      name: "Calibri",
      size: 12,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    const fontHeader = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    const fontSection = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "0F172A" },
    };
    const fontBold = { name: "Calibri", size: 11, bold: true };
    const fontNormal = { name: "Calibri", size: 11 };

    const thinBorder = {
      top: { style: "thin" as const, color: { argb: colors.border } },
      left: { style: "thin" as const, color: { argb: colors.border } },
      bottom: { style: "thin" as const, color: { argb: colors.border } },
      right: { style: "thin" as const, color: { argb: colors.border } },
    };

    // ─── Header Section (Title & Date) ───
    const titleRow = worksheet.addRow([
      `All In One Express ငွေရှင်းစာရင်း - ${selectedSender?.name || ""}`,
    ]);
    worksheet.mergeCells("A1:J1"); // Column 10 ခုဖြစ်၍ J1 ထိ Merge ထားပါသည်
    titleRow.getCell(1).font = fontTitle;
    titleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colors.titleBg },
    };
    titleRow.getCell(1).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    const subTitleRow = worksheet.addRow([`Date: ${clearedDateInput}`]);
    subTitleRow.getCell(1).font = fontBold;
    worksheet.addRow([]);

    // ─── Helper Function: Render Dynamic Tables with Custom Colors ───
    const renderTable = (
      sectionTitle: string,
      ordersList: any[],
      isReturned = false,
    ) => {
      const sortedOrders = [...ordersList].sort((a, b) => {
        const dateA = a.received_date
          ? String(a.received_date).split("T")[0]
          : "";
        const dateB = b.received_date
          ? String(b.received_date).split("T")[0]
          : "";

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
      });

      // Section Title Banner
      const secRow = worksheet.addRow([sectionTitle]);
      worksheet.mergeCells(`A${secRow.number}:J${secRow.number}`);
      secRow.getCell(1).font = fontSection;
      secRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isReturned ? colors.retSectionBg : colors.sectionBg },
      };

      // Table Header (Column 10 ခု - Row Number + Way Data)
      const headRow = worksheet.addRow([
        "No.",
        "Way ID",
        "Date",
        "Receiver Name",
        "Phone",
        "LOC",
        "Address",
        "COD (Ks)",
        "Deli Fee",
        "Total",
      ]);
      headRow.eachCell((cell) => {
        cell.font = fontHeader;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isReturned ? colors.retHeaderBg : colors.headerBg },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = thinBorder;
      });

      // Table Data Rows
      sortedOrders.forEach((o, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          o.item_id || o.id,
          o.received_date ? String(o.received_date).split("T")[0] : "",
          o.receiver_name || "",
          o.receiver_phone || "",
          o.receiver_loc || "",
          o.receiver_address || "",
          Number(o.cod_amount) || 0,
          Number(o.deli_fee) || 0,
          Number(o.total_amount) || 0,
        ]);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = fontNormal;
          cell.border = thinBorder;

          if (idx % 2 === 1) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F8FAFC" },
            };
          }

          if (colNumber >= 8) {
            cell.numFmt = "#,##0";
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else if (colNumber === 1 || colNumber === 3 || colNumber === 5) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      // 🟢 ─── TOTAL ROW သတ်မှတ်ခြင်း ───
      const totalCod = ordersList.reduce(
        (sum, o) => sum + (Number(o.cod_amount) || 0),
        0,
      );

      const totalRow = worksheet.addRow([
        "",
        "စုစုပေါင်း (Total)",
        "",
        "",
        "",
        "",
        "",
        totalCod,
        "",
        "",
      ]);

      totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = fontBold;
        cell.border = thinBorder;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colors.totalBg },
        };

        if (colNumber >= 8) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (colNumber === 1) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      worksheet.addRow([]);
    };

    // Render Both Tables
    renderTable(
      `ရိုးရိုး Way များ (${normalOrders.length} ခု)`,
      normalOrders,
      false,
    );
    renderTable(
      `Returned Way များ (${returnedOrdersList.length} ခု)`,
      returnedOrdersList,
      true,
    );

    // ─── Row Height အားလုံး 20 သို့ သတ်မှတ်ခြင်း ───
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.height = 20;
    });

    // ─── Column Widths (10 ခု) သတ်မှတ်ခြင်း ───
    const columnWidths = [6, 16, 14, 18, 15, 5, 26, 15, 14, 15];

    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    // Download Output File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(
      blob,
      `Statement_${selectedSender?.name || "Sender"}_${clearedDateInput}.xlsx`,
    );
  };

  const getDisplayOrders = () => {
    if (activeTab === "all") return allOrders;
    if (activeTab === "uncleared") return unclearedOrders;
    if (activeTab === "cleared") return clearedOrders;
    if (activeTab === "returned") return returnedOrders;
    return notDeliveredOrders;
  };

  const selectableOrders =
    activeTab === "cleared"
      ? clearedOrders
      : getDisplayOrders().filter(
          (o) => !o.cleared_date || o.status === "Returned",
        );

  const canSelectOrders = true;

  const totalDisplayOrders = getDisplayOrders();
  const hasActiveColumnFilter = Object.values(columnFilters).some(Boolean);
  const totalPages = Math.ceil(totalDisplayOrders.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Row ပေါ်မှာ ဘယ်ဘက် Mouse ခလုတ် စဖိချိန်
  const handleRowMouseDown = (
    event: React.MouseEvent<HTMLTableRowElement>,
    id: string,
    isSelectable: boolean,
  ) => {
    // Right-click / middle-click နဲ့ row selection မစတင်စေရန်
    if (!isSelectable || event.button !== 0) return;

    isDraggingSelectionRef.current = true;

    // Row တစ်ကြိမ်နှိပ်ရုံဖြင့် select / deselect toggle လုပ်မည်။
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Mouse ဖိထားရင်း အခြား Row များပေါ်သို့ ဖြတ်သွားချိန် (Drag)
  const handleRowMouseEnter = (id: string, isSelectable: boolean) => {
    if (isDraggingSelectionRef.current && isSelectable) {
      setSelectedOrderIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  };

  const currentPaginatedOrders = totalDisplayOrders.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );

  // ရွေးချယ်ထားသော အော်ဒါများ၏ COD စုစုပေါင်း (Returned ပါပါက Minus အနေဖြင့် တွက်မည်)
  const totalSelectedCod = getDisplayOrders()
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => {
      const amount = Number(o.cod_amount) || 0;
      return o.status === "Returned" ? sum - amount : sum + amount;
    }, 0);

  const handleModalSuccess = async (savedData?: any) => {
    setIsModalOpen(false);

    // createSender/updateSender may return either one row or a one-row array.
    // Merge it first so the UI reflects the save immediately, then refetch the
    // sender list and use the fresh row when reloading the selected sender.
    const savedSender = Array.isArray(savedData) ? savedData[0] : savedData;
    const selectedId = savedSender?.id ?? selectedSender?.id ?? null;

    if (savedSender?.id) {
      setSenders((current) =>
        current.map((sender) =>
          sender.id === savedSender.id ? { ...sender, ...savedSender } : sender,
        ),
      );
      setFilteredSenders((current) =>
        current.map((sender) =>
          sender.id === savedSender.id ? { ...sender, ...savedSender } : sender,
        ),
      );
      setSelectedSender((current: any | null) =>
        current?.id === savedSender.id
          ? { ...current, ...savedSender }
          : current,
      );
    }

    const refreshedSenders = await fetchSenders(selectedId);
    if (selectedId) {
      const refreshedSelected = refreshedSenders.find(
        (sender: any) => sender.id === selectedId,
      );
      if (refreshedSelected) {
        await handleSenderClick(refreshedSelected);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const isCompleted = status === "Delivered" || status === "Settled";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${
          isCompleted
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCompleted ? "bg-emerald-500" : "bg-amber-500"
          }`}
        ></span>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4 font-sans w-full">
      <div className="w-full max-w-[1800px] mx-auto space-y-3">
        {/* ─── COMPACT TOP BAR ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800">
                  Senders Finance
                </h1>
                <p className="text-xs text-slate-400">
                  စာရင်းရှင်းလင်းမှု စီမံခန့်ခွဲရန်
                </p>
              </div>
            </div>
            <Link
              href="/senders/pickup-list"
              className="shrink-0 text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-colors border border-orange-200"
            >
              Pickup Report →
            </Link>
          </div>

          {/* Branch Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-center shrink-0">
            <button
              onClick={() => {
                setActiveBranch("MDY");
                setSelectedSender(null);
                setOrders([]);
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeBranch === "MDY"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              MDY
            </button>
            <button
              onClick={() => {
                setActiveBranch("YGN");
                setSelectedSender(null);
                setOrders([]);
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeBranch === "YGN"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              YGN
            </button>
          </div>
        </div>

        {/* ─── MAIN GRID (WIDTH ADJUSTED) ─── */}
        {/* Changed from xl:grid-cols-4 to xl:grid-cols-12 to give more width to the table */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
          {/* ─── LEFT: SENDERS LIST (NOW NARROWER) ─── */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[65vh] xl:h-[calc(100vh-120px)]">
            {/* Sender List Header */}
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeBranch === "MDY" ? "bg-orange-500" : "bg-purple-500"
                    }`}
                  ></span>
                  Senders
                  <span className="text-xs font-normal text-slate-400">
                    ({filteredSenders.length})
                  </span>
                </h2>
                <button
                  onClick={() => {
                    setModalMode("add");
                    setIsModalOpen(true);
                  }}
                  className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-[10px] font-semibold shadow-sm transition-colors"
                >
                  + Add
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 placeholder:text-slate-300"
                />
                <svg
                  className="w-3.5 h-3.5 text-slate-300 absolute left-2 top-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Sender Cards */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {loadingSenders ? (
                <div className="text-center py-8 text-slate-400 text-xs animate-pulse">
                  Loading...
                </div>
              ) : filteredSenders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No senders found.
                </div>
              ) : (
                filteredSenders.map((sender) => (
                  <button
                    key={sender.id}
                    onClick={() => handleSenderClick(sender)}
                    className={`w-full text-left p-2 rounded-lg transition-all border group ${
                      selectedSender?.id === sender.id
                        ? "bg-orange-50 border-orange-300 ring-1 ring-orange-400/30"
                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-slate-800 text-sm truncate">
                        {sender.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {sender.notDeliveredCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold border border-amber-200">
                            {sender.notDeliveredCount} 📦
                          </span>
                        )}
                        {sender.hasUncleared ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold border border-rose-200">
                            {sender.unclearedCount} 💰
                          </span>
                        ) : (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                            title="All Cleared"
                          ></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span className="shrink-0">
                        📞 {getSenderPhone(sender) || "—"}
                      </span>
                      <span className="shrink-0">📍 {sender.LOC || "—"}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ─── RIGHT: ORDERS TABLE (NOW WIDER) ─── */}
          <div className="xl:col-span-10 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-[65vh] xl:h-[calc(100vh-120px)]">
            {selectedSender ? (
              <>
                {/* Selected Sender Info Bar */}
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-800 truncate">
                      👤 {selectedSender.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {getSenderPhone(selectedSender) || "No Phone"}
                    </span>
                    <span
                      className="text-xs text-slate-400 truncate max-w-[260px]"
                      title={getSenderAddress(selectedSender)}
                    >
                      | 🏠 {getSenderAddress(selectedSender) || "No Address"}
                    </span>
                    <span className="text-xs text-blue-700 font-mono bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      KPay No: {getSenderKpayNo(selectedSender) || "—"}
                    </span>
                    <span
                      className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded truncate max-w-[180px]"
                      title={String(getSenderKpayName(selectedSender) || "")}
                    >
                      KPay Name: {getSenderKpayName(selectedSender) || "—"}
                    </span>
                    <span className="text-xs text-slate-400">
                      | {selectedSender.LOC || "—"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setModalMode("edit");
                      setIsModalOpen(true);
                    }}
                    className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors border border-slate-200"
                  >
                    ✏️ Edit
                  </button>
                </div>

                {/* Tabs + Filters */}
                <div className="border-b border-slate-100 bg-white">
                  {/* Tabs Row */}
                  <div className="flex items-center overflow-x-auto px-3 gap-0.5">
                    {[
                      {
                        key: "all",
                        label: "All",
                        count: allOrders.length,
                        color: "slate",
                      },
                      {
                        key: "uncleared",
                        label: "Uncleared",
                        count: unclearedOrders.length,
                        color: "orange",
                      },
                      {
                        key: "cleared",
                        label: "Cleared",
                        count: clearedOrders.length,
                        color: "emerald",
                      },
                      {
                        key: "returned",
                        label: "Returned",
                        count: returnedOrders.length,
                        color: "rose",
                      },
                      {
                        key: "not_delivered",
                        label: "Not Delivered",
                        count: notDeliveredOrders.length,
                        color: "amber",
                      },
                    ].map((tab) => {
                      const isActive = activeTab === tab.key;
                      const colorMap: Record<string, string> = {
                        slate: isActive
                          ? "border-slate-700 text-slate-800 bg-slate-50"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                        orange: isActive
                          ? "border-orange-500 text-orange-600 bg-orange-50/50"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                        emerald: isActive
                          ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                        rose: isActive
                          ? "border-rose-500 text-rose-600 bg-rose-50/50"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                        amber: isActive
                          ? "border-amber-500 text-amber-600 bg-amber-50/50"
                          : "border-transparent text-slate-500 hover:text-slate-700",
                      };
                      const badgeColorMap: Record<string, string> = {
                        slate: isActive
                          ? "bg-slate-200 text-slate-700"
                          : "bg-slate-100 text-slate-500",
                        orange: isActive
                          ? "bg-orange-100 text-orange-600"
                          : "bg-slate-100 text-slate-500",
                        emerald: isActive
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-slate-100 text-slate-500",
                        rose: isActive
                          ? "bg-rose-100 text-rose-600"
                          : "bg-slate-100 text-slate-500",
                        amber: isActive
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-500",
                      };
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key as any)}
                          className={`py-2 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${colorMap[tab.color]}`}
                        >
                          {tab.label}
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${badgeColorMap[tab.color]}`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Filters Row */}
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-t border-slate-50">
                    {activeTab === "all" && (
                      <label className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 font-semibold cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={hideClearedInAll}
                          onChange={(e) =>
                            setHideClearedInAll(e.target.checked)
                          }
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                        />
                        Hide Cleared
                      </label>
                    )}

                    <div className="relative flex-1 min-w-[180px] max-w-[260px]">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={orderSearchTerm}
                        onChange={(e) => setOrderSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-orange-300 text-slate-700 placeholder:text-slate-300"
                      />
                      <svg
                        className="w-3.5 h-3.5 text-slate-300 absolute left-2 top-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    <select
                      value={filterFeeType}
                      onChange={(e) => setFilterFeeType(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 font-medium focus:outline-none focus:ring-1 focus:ring-orange-300"
                    >
                      <option value="All">Fee: All</option>
                      <option value="Deli">Deli</option>
                      <option value="Kpay">Kpay</option>
                      <option value="Cash">Cash</option>
                      <option value="Bill">Bill</option>
                    </select>

                    <select
                      value={filterLoc}
                      onChange={(e) => setFilterLoc(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 font-medium focus:outline-none focus:ring-1 focus:ring-orange-300"
                    >
                      <option value="All">Loc: All</option>
                      {Array.from(
                        new Set(
                          orders.map((o) => o.receiver_loc).filter(Boolean),
                        ),
                      ).map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>

                    {/* Deli Date Filter */}
                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 border border-slate-200 rounded-md">
                      <span className="font-semibold text-slate-400">Deli</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="Start"
                      />
                      <span className="text-slate-300">—</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="End"
                      />
                      {(startDate || endDate) && (
                        <button
                          onClick={() => {
                            setStartDate("");
                            setEndDate("");
                          }}
                          className="text-rose-400 hover:text-rose-600 font-bold text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Rcvd Date Filter */}
                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 border border-slate-200 rounded-md">
                      <span className="font-semibold text-slate-400">Rcvd</span>
                      <input
                        type="date"
                        value={receivedStartDate}
                        onChange={(e) => setReceivedStartDate(e.target.value)}
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="Start"
                      />
                      <span className="text-slate-300">—</span>
                      <input
                        type="date"
                        value={receivedEndDate}
                        onChange={(e) => setReceivedEndDate(e.target.value)}
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="End"
                      />
                      {(receivedStartDate || receivedEndDate) && (
                        <button
                          onClick={() => {
                            setReceivedStartDate("");
                            setReceivedEndDate("");
                          }}
                          className="text-rose-400 hover:text-rose-600 font-bold text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Cleared Date Filter (ActiveTab standard စစ်ဆေးချက်ဖြင့် သို့မဟုတ် အမြဲပြသရန်) */}
                    {activeTab === "cleared" && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 border border-slate-200 rounded-md">
                        <span className="font-semibold text-emerald-600">
                          Cleared
                        </span>
                        <input
                          type="date"
                          value={clearedFilterDate}
                          onChange={(e) => setClearedFilterDate(e.target.value)}
                          className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                          title="Cleared Date"
                        />
                        {clearedFilterDate && (
                          <button
                            onClick={() => setClearedFilterDate("")}
                            className="text-rose-400 hover:text-rose-600 font-bold text-sm"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bulk Clear / Unclear Action Bar */}
                {canSelectOrders && selectedOrderIds.length > 0 && (
                  <div className="bg-orange-50/80 border-b border-orange-100 px-3 py-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 animate-fadeIn">
                    <div className="text-sm font-semibold text-orange-800">
                      <span className="font-mono bg-orange-200/60 px-1.5 py-0.5 rounded text-orange-700 font-bold">
                        {selectedOrderIds.length}
                      </span>{" "}
                      selected · COD Total:{" "}
                      <span className="font-mono text-orange-600 font-bold">
                        {totalSelectedCod.toLocaleString()} Ks
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeTab === "cleared" ? (
                        <button
                          onClick={executeBulkUnclear}
                          disabled={clearing}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-md text-sm font-bold transition-all shadow-sm"
                        >
                          {clearing ? "လုပ်ဆောင်နေသည်..." : "Uncleared"}
                        </button>
                      ) : (
                        <>
                          <input
                            type="date"
                            value={clearedDateInput}
                            onChange={(e) =>
                              setClearedDateInput(e.target.value)
                            }
                            className="px-2 py-1 bg-white border border-orange-200 rounded-md text-sm font-semibold text-slate-800 focus:outline-none"
                          />
                          <button
                            onClick={handleOpenSummaryModal}
                            className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold transition-all shadow-sm"
                          >
                            Clear Selected
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── EXCEL-STYLE TABLE ─── */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                  {getDisplayOrders().length > 0 || hasActiveColumnFilter ? (
                    <>
                      <table className="min-w-[1180px] w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100 sticky top-0 z-10">
                            {canSelectOrders && (
                              <th className="px-2 py-2 text-center border-b-2 border-slate-300 w-8">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectableOrders.length > 0 &&
                                    selectableOrders.every((o) =>
                                      selectedOrderIds.includes(o.id),
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setSelectedOrderIds(
                                        selectableOrders.map((o) => o.id),
                                      );
                                    else setSelectedOrderIds([]);
                                  }}
                                  className="rounded border-slate-400 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                                />
                              </th>
                            )}
                            <th className="sticky left-0 bg-slate-100 px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Way ID
                            </th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Rcvd Date
                            </th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Receiver Name
                            </th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Phone
                            </th>

                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Address
                            </th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              COD (Ks)
                            </th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Deli Fee
                            </th>
                            <th className="px-3 py-2 text-center font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Fee Type
                            </th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Total
                            </th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Deli Date
                            </th>
                            <th className="px-3 py-2 text-center font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                              Status
                            </th>
                            {(activeTab === "cleared" ||
                              activeTab === "all") && (
                              <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300">
                                Cleared Date
                              </th>
                            )}
                            {activeTab === "returned" && (
                              <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300">
                                Refund Date
                              </th>
                            )}
                          </tr>
                          <tr className="bg-white border-b border-slate-200">
                            {canSelectOrders && (
                              <th className="px-2 py-1 border-r border-slate-100" />
                            )}
                            {(
                              [
                                ["wayId", "Way ID"],
                                ["receivedDate", "Rcvd date"],
                                ["receiverName", "Receiver"],
                                ["phone", "Phone"],
                                ["address", "Address"],
                                ["cod", "COD"],
                                ["deliFee", "Deli fee"],
                                ["feeType", "Fee type"],
                                ["total", "Total"],
                                ["deliverDate", "Deli date"],
                                ["status", "Status"],
                              ] as const
                            ).map(([key, placeholder]) => (
                              <th
                                key={key}
                                className="px-1 py-1 border-r border-slate-100"
                              >
                                <input
                                  type="text"
                                  value={columnFilters[key]}
                                  onChange={(event) =>
                                    updateColumnFilter(key, event.target.value)
                                  }
                                  placeholder={placeholder}
                                  aria-label={`Filter ${placeholder}`}
                                  className="w-full min-w-[74px] px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-normal text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
                                />
                              </th>
                            ))}
                            {(activeTab === "cleared" ||
                              activeTab === "all") && (
                              <th className="px-1 py-1">
                                <input
                                  type="text"
                                  value={columnFilters.clearedDate}
                                  onChange={(event) =>
                                    updateColumnFilter(
                                      "clearedDate",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Cleared date"
                                  aria-label="Filter Cleared Date"
                                  className="w-full min-w-[86px] px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-normal text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
                                />
                              </th>
                            )}
                            {activeTab === "returned" && (
                              <th className="px-1 py-1">
                                <input
                                  type="text"
                                  value={columnFilters.refundDate}
                                  onChange={(event) =>
                                    updateColumnFilter(
                                      "refundDate",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Refund date"
                                  aria-label="Filter Refund Date"
                                  className="w-full min-w-[86px] px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-normal text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
                                />
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {currentPaginatedOrders.map((order, index) => {
                            // Select လုပ်လို့ရသော Way ဟုတ်/မဟုတ် စစ်ဆေးခြင်း
                            const isSelectable =
                              activeTab === "cleared" ||
                              !order.cleared_date ||
                              order.status === "Returned";
                            const isSelected = selectedOrderIds.includes(
                              order.id,
                            );

                            return (
                              <tr
                                key={order.id || index}
                                onMouseDown={(event) =>
                                  handleRowMouseDown(
                                    event,
                                    order.id,
                                    isSelectable,
                                  )
                                }
                                onMouseEnter={() =>
                                  handleRowMouseEnter(order.id, isSelectable)
                                }
                                onDragStart={(event) => event.preventDefault()}
                                className={`select-none transition-colors cursor-pointer ${
                                  isSelected
                                    ? "bg-orange-100/70"
                                    : index % 2 === 0
                                      ? "bg-white"
                                      : "bg-slate-50/50"
                                } hover:bg-blue-50/60`}
                              >
                                {canSelectOrders && (
                                  <td className="px-2 py-2 text-center border-b border-slate-200 border-r border-slate-100">
                                    {isSelectable && (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        // Checkbox ကိုနှိပ်သောအခါ row ရဲ့ drag/toggle handler မဝင်စေရန်
                                        onMouseDown={(event) => {
                                          event.stopPropagation();
                                          isDraggingSelectionRef.current = false;
                                        }}
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onChange={() => {
                                          // Functional update သုံးထားသဖြင့် stale state ကြောင့် ပြန် select မဖြစ်ပါ။
                                          setSelectedOrderIds((prev) =>
                                            prev.includes(order.id)
                                              ? prev.filter(
                                                  (id) => id !== order.id,
                                                )
                                              : [...prev, order.id],
                                          );
                                        }}
                                        className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                                      />
                                    )}
                                  </td>
                                )}
                                <td className="sticky left-0 bg-inherit px-3 py-2 font-mono font-bold text-slate-800 border-b border-slate-200 border-r border-slate-100 text-sm">
                                  {order.item_id || order.id}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                                  {order.received_date
                                    ? String(order.received_date).split("T")[0]
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 border-r border-slate-100 text-sm">
                                  {order.receiver_name || "Unknown"}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                                  {order.receiver_phone || "—"}
                                </td>
                                <td
                                  className="px-3 py-2 text-slate-600 border-b border-slate-200 border-r border-slate-100 text-sm max-w-[200px] truncate"
                                  title={order.receiver_address || ""}
                                >
                                  {order.receiver_address || "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700 border-b border-slate-200 border-r border-slate-100">
                                  {order.cod_amount
                                    ? Number(order.cod_amount).toLocaleString()
                                    : "0"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100">
                                  {order.deli_fee
                                    ? Number(order.deli_fee).toLocaleString()
                                    : "0"}
                                </td>
                                <td className="px-3 py-2 text-center border-b border-slate-200 border-r border-slate-100">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">
                                    {order.fee_type || "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 border-b border-slate-200 border-r border-slate-100">
                                  {order.total_amount
                                    ? Number(
                                        order.total_amount,
                                      ).toLocaleString()
                                    : "0"}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                                  {order.deliver_date ||
                                    new Date(
                                      order.created_at,
                                    ).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-center border-b border-slate-200 border-r border-slate-100">
                                  {getStatusBadge(order.status)}
                                </td>
                                {(activeTab === "cleared" ||
                                  activeTab === "all") && (
                                  <td className="px-3 py-2 font-mono text-emerald-600 font-semibold border-b border-slate-200 text-sm">
                                    {order.cleared_date
                                      ? `📅 ${new Date(order.cleared_date).toLocaleDateString()}`
                                      : "—"}
                                  </td>
                                )}
                                {activeTab === "returned" && (
                                  <td className="px-3 py-2 font-mono text-rose-600 font-semibold border-b border-slate-200 text-sm">
                                    {order.refund_date
                                      ? `📅 ${new Date(order.refund_date).toLocaleDateString()}`
                                      : "—"}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* ─── PAGINATION CONTROLS ─── */}
                      {getDisplayOrders().length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>Show:</span>
                            <select
                              value={itemsPerPage}
                              onChange={(e) =>
                                setItemsPerPage(Number(e.target.value))
                              }
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                            >
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value={200}>200</option>
                              <option value={500}>500</option>
                              <option value={1000}>1000</option>
                            </select>
                            <span>
                              Showing {indexOfFirstItem + 1} -{" "}
                              {Math.min(
                                indexOfLastItem,
                                getDisplayOrders().length,
                              )}{" "}
                              of {getDisplayOrders().length} items
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setCurrentPage((prev) => Math.max(prev - 1, 1))
                              }
                              disabled={currentPage === 1}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                            >
                              ← Prev
                            </button>
                            <span className="text-xs font-semibold text-slate-700 px-2">
                              Page {currentPage} of {totalPages}
                            </span>
                            <button
                              onClick={() =>
                                setCurrentPage((prev) =>
                                  Math.min(prev + 1, totalPages),
                                )
                              }
                              disabled={currentPage === totalPages}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 space-y-2">
                      <svg
                        className="w-8 h-8 text-slate-200"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-sm font-medium">
                        No orders in this tab.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <svg
                  className="w-10 h-10 text-slate-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
                <p className="text-sm font-medium">
                  Select a sender from the left panel to view orders.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SenderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode={modalMode}
        editData={modalMode === "edit" ? selectedSender : null}
        activeBranch={activeBranch}
      />

      {/* ─── SUMMARY & EXPORT POP-UP MODAL ─── */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  ငွေရှင်းစရင်း -- ({selectedSender?.name})
                </h3>
                <p className="text-xs text-slate-500">
                  ရက်စွဲ: {clearedDateInput}
                </p>
              </div>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* KPay details for the selected sender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                  KPay No
                </p>
                <p className="mt-1 text-lg font-mono font-bold text-blue-900 break-all">
                  {getSenderKpayNo(selectedSender) || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                  KPay Name
                </p>
                <p className="mt-1 text-lg font-bold text-blue-900 break-words">
                  {getSenderKpayName(selectedSender) || "—"}
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <p className="text-xs font-semibold text-emerald-600">
                  ရိုးရိုး Way COD ({normalOrders.length} ခု)
                </p>
                <p className="text-lg font-mono font-bold text-emerald-700">
                  +{normalCodTotal.toLocaleString()} Ks
                </p>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                <p className="text-xs font-semibold text-rose-600">
                  Returned Way COD ({returnedOrdersList.length} ခု)
                </p>
                <p className="text-lg font-mono font-bold text-rose-700">
                  -{returnedCodTotal.toLocaleString()} Ks
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
                <p className="text-xs font-semibold text-orange-600">
                  OS သို့ ရှင်းပေးရန် ငွေ
                </p>
                <p className="text-xl font-mono font-bold text-orange-700">
                  {netPayableAmount.toLocaleString()} Ks
                </p>
              </div>
            </div>

            {/* Item List Preview */}
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-1">
                  📦 ရိုးရိုး Way များ ({normalOrders.length})
                </h4>
                <div className="max-h-32 overflow-y-auto border rounded-lg bg-slate-50 p-2 text-xs space-y-1 custom-scrollbar">
                  {normalOrders.length > 0 ? (
                    normalOrders.map((o) => (
                      <div
                        key={o.id}
                        className="flex justify-between font-mono text-slate-600"
                      >
                        <span>
                          {o.item_id || o.id} ({o.receiver_name})
                        </span>
                        <span>
                          {Number(o.cod_amount || 0).toLocaleString()} Ks
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">ရိုးရိုး Way မရှိပါ</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-rose-700 mb-1">
                  ↩️ Returned Way များ ({returnedOrdersList.length})
                </h4>
                <div className="max-h-32 overflow-y-auto border border-rose-100 rounded-lg bg-rose-50/30 p-2 text-xs space-y-1 custom-scrollbar">
                  {returnedOrdersList.length > 0 ? (
                    returnedOrdersList.map((o) => (
                      <div
                        key={o.id}
                        className="flex justify-between font-mono text-rose-600"
                      >
                        <span>
                          {o.item_id || o.id} ({o.receiver_name})
                        </span>
                        <span>
                          -{Number(o.cod_amount || 0).toLocaleString()} Ks
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">Returned Way မရှိပါ</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t pt-4">
              <button
                onClick={handleExportExcel}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                📊 Excel ထုတ်ယူမည်
              </button>

              <button
                onClick={executeBulkClear}
                disabled={clearing}
                className="w-full sm:w-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                {clearing ? "သိမ်းဆည်းနေသည်..." : "အတည်ပြုပြီး စာရင်းရှင်းမည်"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
