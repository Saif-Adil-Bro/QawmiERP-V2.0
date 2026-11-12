"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  GripVertical,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Sparkles,
  Layers,
  Search,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  SlidersHorizontal,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronUp,
} from "lucide-react";
import {
  INITIAL_NAV_GROUPS,
  SerializedNavGroup,
  SerializedNavItem,
} from "./defaultNavData";
import { getIconComponent, ICON_MAP } from "./iconRegistry";
import { useAppMode } from "./ModeContext";

interface AdvancedMenuCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_GROUP_ICONS = [
  "FolderOpen",
  "Users",
  "BookOpen",
  "CheckSquare",
  "Wallet",
  "Utensils",
  "Library",
  "CalendarDays",
  "Award",
  "IdCard",
  "GraduationCap",
  "Boxes",
  "Scale",
  "FileText",
  "Settings",
  "Sparkles",
];

export function AdvancedMenuCustomizerModal({
  isOpen,
  onClose,
}: AdvancedMenuCustomizerModalProps) {
  const { customNavGroups, saveCustomNavGroups, resetCustomNavGroups } =
    useAppMode();

  // Local state initialized with custom groups or default groups
  const [groups, setGroups] = useState<SerializedNavGroup[]>(() => {
    return customNavGroups && customNavGroups.length > 0
      ? JSON.parse(JSON.stringify(customNavGroups))
      : JSON.parse(JSON.stringify(INITIAL_NAV_GROUPS));
  });

  const [activeTab, setActiveTab] = useState<"organize" | "preview">("organize");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (customNavGroups || INITIAL_NAV_GROUPS).forEach((g: SerializedNavGroup) => {
      initial[g.id] = true;
    });
    return initial;
  });

  // New Group Form state
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("FolderOpen");

  // Editing Group Title state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState("");

  // Drag states
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    groupIndex: number;
    itemIndex: number;
  } | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);

  // Success toast state
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  // Toggle group expand/collapse
  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((g) => {
      next[g.id] = true;
    });
    setExpandedGroups(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((g) => {
      next[g.id] = false;
    });
    setExpandedGroups(next);
  };

  // Group Drag Handlers
  const handleGroupDragStart = (index: number) => {
    setDraggedGroupIndex(index);
  };

  const handleGroupDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleGroupDrop = (dropIndex: number) => {
    if (draggedGroupIndex === null || draggedGroupIndex === dropIndex) {
      setDraggedGroupIndex(null);
      return;
    }
    const updated = [...groups];
    const [moved] = updated.splice(draggedGroupIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setGroups(updated);
    setDraggedGroupIndex(null);
  };

  // Item Drag Handlers (Within group or to another group)
  const handleItemDragStart = (
    e: React.DragEvent,
    groupIndex: number,
    itemIndex: number
  ) => {
    e.stopPropagation();
    setDraggedItem({ groupIndex, itemIndex });
  };

  const handleItemDragOver = (e: React.DragEvent, targetGroupIdx?: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof targetGroupIdx === "number") {
      setDragOverGroupIndex(targetGroupIdx);
    }
  };

  const handleItemDrop = (
    e: React.DragEvent,
    targetGroupIndex: number,
    targetItemIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupIndex(null);

    if (!draggedItem) return;

    const { groupIndex: sourceGroupIdx, itemIndex: sourceItemIdx } = draggedItem;
    if (sourceGroupIdx === targetGroupIndex && sourceItemIdx === targetItemIndex) {
      setDraggedItem(null);
      return;
    }

    const updated = JSON.parse(JSON.stringify(groups)) as SerializedNavGroup[];
    const [movedItem] = updated[sourceGroupIdx].items.splice(sourceItemIdx, 1);

    if (typeof targetItemIndex === "number") {
      updated[targetGroupIndex].items.splice(targetItemIndex, 0, movedItem);
    } else {
      updated[targetGroupIndex].items.push(movedItem);
    }

    setGroups(updated);
    setDraggedItem(null);
  };

  // Move Group Up/Down
  const moveGroup = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;
    const updated = [...groups];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setGroups(updated);
  };

  // Move Item Up/Down within group
  const moveItem = (
    groupIdx: number,
    itemIdx: number,
    direction: "up" | "down"
  ) => {
    const updated = JSON.parse(JSON.stringify(groups)) as SerializedNavGroup[];
    const items = updated[groupIdx].items;
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const [moved] = items.splice(itemIdx, 1);
    items.splice(targetIdx, 0, moved);
    setGroups(updated);
  };

  // Move Item to another group via selector
  const handleMoveItemToGroup = (
    sourceGroupIdx: number,
    itemIdx: number,
    targetGroupId: string
  ) => {
    const targetGroupIdx = groups.findIndex((g) => g.id === targetGroupId);
    if (targetGroupIdx === -1 || targetGroupIdx === sourceGroupIdx) return;

    const updated = JSON.parse(JSON.stringify(groups)) as SerializedNavGroup[];
    const [movedItem] = updated[sourceGroupIdx].items.splice(itemIdx, 1);
    updated[targetGroupIdx].items.push(movedItem);
    setGroups(updated);
  };

  // Toggle Item Visibility (Hide / Show)
  const toggleItemVisibility = (groupIdx: number, itemIdx: number) => {
    const updated = JSON.parse(JSON.stringify(groups)) as SerializedNavGroup[];
    const current = updated[groupIdx].items[itemIdx];
    current.hidden = !current.hidden;
    setGroups(updated);
  };

  // Toggle Group Visibility
  const toggleGroupVisibility = (groupIdx: number) => {
    const updated = JSON.parse(JSON.stringify(groups)) as SerializedNavGroup[];
    updated[groupIdx].hidden = !updated[groupIdx].hidden;
    setGroups(updated);
  };

  // Start Editing Group Title
  const startEditingGroup = (group: SerializedNavGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupTitle(group.title);
  };

  // Save Edited Group Title
  const saveGroupTitle = (groupId: string) => {
    if (!editingGroupTitle.trim()) {
      setEditingGroupId(null);
      return;
    }
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, title: editingGroupTitle.trim() } : g))
    );
    setEditingGroupId(null);
  };

  // Delete Group (allowed if empty or custom)
  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    if (group.items.length > 0) {
      if (
        !confirm(
          `'${group.title}' গ্রুপে ${group.items.length} টি মেনু রয়েছে। গ্রুপটি মুছে ফেললে এর ভেতরে থাকা মেনুগুলো অন্য একটি গ্রুপে স্থানান্তরিত না হওয়া পর্যন্ত সাইডবারে দেখা যাবে না। আপনি কি নিশ্চিত?`
        )
      ) {
        return;
      }
    }

    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  // Add a new custom group
  const handleCreateGroup = () => {
    if (!newGroupTitle.trim()) return;
    const newGroupId = "custom_" + Date.now();
    const newGroup: SerializedNavGroup = {
      id: newGroupId,
      title: newGroupTitle.trim(),
      iconName: newGroupIcon,
      items: [],
    };
    setGroups((prev) => [...prev, newGroup]);
    setExpandedGroups((prev) => ({ ...prev, [newGroupId]: true }));
    setNewGroupTitle("");
    setShowAddGroup(false);
  };

  // Save changes
  const handleSave = () => {
    saveCustomNavGroups(groups);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  // Reset to default
  const handleReset = () => {
    if (confirm("আপনি কি নিশ্চিত যে মেনুগুলো আগের মূল ডিফল্ট রূপে ফিরিয়ে নিতে চান?")) {
      resetCustomNavGroups();
      setGroups(JSON.parse(JSON.stringify(INITIAL_NAV_GROUPS)));
      onClose();
    }
  };

  // Filter groups & items based on search and visibility
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return groups
      .map((g, gIdx) => {
        let items = g.items;

        if (filterVisibility === "visible") {
          items = items.filter((it) => !it.hidden);
        } else if (filterVisibility === "hidden") {
          items = items.filter((it) => it.hidden);
        }

        if (q) {
          items = items.filter(
            (it) =>
              it.name.toLowerCase().includes(q) ||
              g.title.toLowerCase().includes(q) ||
              it.keywords?.some((k) => k.toLowerCase().includes(q))
          );
        }

        return {
          group: g,
          groupIdx: gIdx,
          items,
          matchesGroupTitle: q ? g.title.toLowerCase().includes(q) : false,
        };
      })
      .filter((entry) => {
        if (!searchQuery && filterVisibility === "all") return true;
        return entry.items.length > 0 || entry.matchesGroupTitle;
      });
  }, [groups, searchQuery, filterVisibility]);

  const totalItemsCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.items.length, 0);
  }, [groups]);

  const visibleItemsCount = useMemo(() => {
    return groups.reduce(
      (acc, g) => acc + g.items.filter((it) => !it.hidden).length,
      0
    );
  }, [groups]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <span>সাইডবার মেনু কাস্টমাইজেশন</span>
                <span className="hidden sm:inline-flex text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                  ড্র্যাগ-অ্যান্ড-ড্রপ ও রিঅর্ডার
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                মেনু টেনে টেনে আগে-পিছে নিন, ক্যাটাগরি বদলান অথবা প্রয়োজনমতো মেনু প্রদর্শন বা লুকান
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle: Organize vs Preview */}
            <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("organize")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === "organize"
                    ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                মেনু সাজান
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                লাইভ প্রিভিউ
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Quick Actions */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="মেনু বা সাব-মেনু খুঁজুন..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAddGroup(!showAddGroup)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ নতুন গ্রুপ যোগ করুন</span>
            </button>

            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="সকল গ্রুপ একসাথে খুলুন"
            >
              সব খুলুন
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="সকল গ্রুপ সংকুচিত করুন"
            >
              সংকুচিত
            </button>
          </div>
        </div>

        {/* Add Group Inline Form */}
        {showAddGroup && (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center gap-2.5 animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <select
                value={newGroupIcon}
                onChange={(e) => setNewGroupIcon(e.target.value)}
                className="py-2 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {AVAILABLE_GROUP_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="নতুন গ্রুপের নাম লিখুন (যেমন: জরুরি শর্টকাট)"
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={!newGroupTitle.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                গ্রুপ তৈরি করুন
              </button>
              <button
                type="button"
                onClick={() => setShowAddGroup(false)}
                className="p-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Area: Organize View or Live Preview */}
        {activeTab === "preview" ? (
          /* Live Sidebar Preview Mode */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900 text-slate-100 overscroll-contain">
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-xs text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>লাইভ প্রিভিউ:</strong> আপনি পরিবর্তন সংরক্ষণ করলে সাইডবার হুবহু নিচের মতো প্রদর্শিত হবে।
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                {groups
                  .filter((g) => !g.hidden)
                  .map((group) => {
                    const GroupIcon = getIconComponent(group.iconName, FolderOpen);
                    const visibleItems = group.items.filter((it) => !it.hidden);

                    return (
                      <div key={group.id} className="space-y-1">
                        <div className="flex items-center justify-between px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-lg">
                          <span className="flex items-center gap-2">
                            <GroupIcon className="w-4 h-4 text-emerald-400" />
                            <span>{group.title}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {visibleItems.length}
                          </span>
                        </div>

                        <div className="pl-6 space-y-0.5">
                          {visibleItems.map((item) => {
                            const ItemIcon = getIconComponent(item.iconName);
                            return (
                              <div
                                key={item.id || item.href}
                                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <ItemIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{item.name}</span>
                                </div>
                                {item.badge && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 shrink-0 ml-2">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          /* Organize & Drag-and-Drop View */
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-3.5 overscroll-contain bg-slate-100/50 dark:bg-slate-950/40">
            {filteredGroups.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold">কোনো মেনু বা গ্রুপ খুঁজে পাওয়া যায়নি</p>
                <p className="text-xs text-slate-500">অন্য শব্দ দিয়ে অনুসন্ধান করুন অথবা ফিল্টার পরিবর্তন করুন</p>
              </div>
            ) : (
              filteredGroups.map(({ group, groupIdx, items }) => {
                const GroupIcon = getIconComponent(group.iconName, FolderOpen);
                const isExpanded = expandedGroups[group.id] ?? true;
                const isCustomGroup = group.id.startsWith("custom_");
                const isDragOver = dragOverGroupIndex === groupIdx;

                return (
                  <div
                    key={group.id}
                    draggable
                    onDragStart={() => handleGroupDragStart(groupIdx)}
                    onDragOver={(e) => handleGroupDragOver(e, groupIdx)}
                    onDrop={() => handleGroupDrop(groupIdx)}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      draggedGroupIndex === groupIdx
                        ? "opacity-30 border-dashed border-emerald-500 bg-emerald-50/20"
                        : group.hidden
                        ? "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                        : isDragOver
                        ? "bg-emerald-50/50 dark:bg-emerald-950/40 border-2 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                        : "bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {/* Group Header Banner */}
                    <div
                      onDragOver={(e) => handleItemDragOver(e, groupIdx)}
                      onDrop={(e) => handleItemDrop(e, groupIdx)}
                      className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer select-none bg-slate-50/90 dark:bg-slate-800 border-b border-slate-200/60 dark:border-slate-700/60"
                      onClick={() => toggleGroupExpand(group.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Drag Handle */}
                        <div
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
                          title="টেনে পুরো গ্রুপ আগে-পিছে নিন"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Group Icon */}
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                          <GroupIcon className="w-4 h-4" />
                        </div>

                        {/* Editable Group Title */}
                        {editingGroupId === group.id ? (
                          <div
                            className="flex items-center gap-1.5 flex-1 max-w-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingGroupTitle}
                              onChange={(e) => setEditingGroupTitle(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveGroupTitle(group.id)}
                              autoFocus
                              className="w-full px-2 py-1 text-xs sm:text-sm font-bold bg-white dark:bg-slate-900 border border-emerald-500 rounded-lg focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => saveGroupTitle(group.id)}
                              className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {group.title}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingGroup(group);
                              }}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                              title="নাম পরিবর্তন করুন"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Count Badge */}
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                          {group.items.length} টি মেনু
                        </span>

                        {group.hidden && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold shrink-0">
                            লুকানো
                          </span>
                        )}
                      </div>

                      {/* Header Actions */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 1-Click Reorder Up / Down */}
                        <button
                          type="button"
                          disabled={groupIdx === 0}
                          onClick={() => moveGroup(groupIdx, "up")}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-30 disabled:pointer-events-none"
                          title="গ্রুপ উপরে নিন"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={groupIdx === groups.length - 1}
                          onClick={() => moveGroup(groupIdx, "down")}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-30 disabled:pointer-events-none"
                          title="গ্রুপ নিচে নিন"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Hide / Show Group Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleGroupVisibility(groupIdx)}
                          className={`p-1.5 rounded-lg transition ${
                            group.hidden
                              ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                          }`}
                          title={group.hidden ? "গ্রুপ প্রদর্শন করুন" : "গ্রুপ সাইডবার থেকে লুকান"}
                        >
                          {group.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        {/* Delete Custom Group */}
                        {isCustomGroup && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="কাস্টম গ্রুপ মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Expand/Collapse Chevron */}
                        <div
                          className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          onClick={() => toggleGroupExpand(group.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sub-Items List (Drop Target Area) */}
                    {isExpanded && (
                      <div
                        onDragOver={(e) => handleItemDragOver(e, groupIdx)}
                        onDrop={(e) => handleItemDrop(e, groupIdx)}
                        className="p-2.5 sm:p-3 space-y-2 min-h-[60px] bg-slate-50/40 dark:bg-slate-900/50"
                      >
                        {items.length === 0 ? (
                          <div className="py-6 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400 bg-white dark:bg-slate-900/40">
                            {group.items.length === 0
                              ? "এই গ্রুপে কোনো মেনু নেই। অন্য গ্রুপ থেকে টেনে এখানে ছাড়ুন।"
                              : "কোনো মেনু ফিল্টারের সাথে মেলেনি।"}
                          </div>
                        ) : (
                          items.map((item) => {
                            const actualItemIdx = group.items.findIndex(
                              (it) => it.id === item.id || it.href === item.href
                            );
                            const ItemIcon = getIconComponent(item.iconName);
                            const isDraggingThis =
                              draggedItem?.groupIndex === groupIdx &&
                              draggedItem?.itemIndex === actualItemIdx;

                            return (
                              <div
                                key={item.id || item.href}
                                draggable
                                onDragStart={(e) =>
                                  handleItemDragStart(e, groupIdx, actualItemIdx)
                                }
                                onDragOver={(e) => handleItemDragOver(e, groupIdx)}
                                onDrop={(e) =>
                                  handleItemDrop(e, groupIdx, actualItemIdx)
                                }
                                className={`p-2 sm:p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                                  isDraggingThis
                                    ? "opacity-25 border-dashed border-emerald-500 bg-emerald-50/30"
                                    : item.hidden
                                    ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60"
                                    : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-2xs hover:shadow-sm"
                                }`}
                              >
                                {/* Left Section: Drag Handle, Icon, Name */}
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div
                                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                    title="টেনে মেনু সাজান"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>

                                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 border border-slate-200/50 dark:border-slate-600/50">
                                    <ItemIcon className="w-3.5 h-3.5" />
                                  </div>

                                  <span
                                    className={`text-xs sm:text-sm font-semibold truncate ${
                                      item.hidden ? "line-through text-slate-400" : "text-slate-900 dark:text-slate-100"
                                    }`}
                                  >
                                    {item.name}
                                  </span>

                                  {item.badge && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800 shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>

                                {/* Right Section: 1-Click Move, Visibility, Group Selector */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Item Move Up / Down */}
                                  <button
                                    type="button"
                                    disabled={actualItemIdx === 0}
                                    onClick={() => moveItem(groupIdx, actualItemIdx, "up")}
                                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition"
                                    title="উপরে নিন"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actualItemIdx === group.items.length - 1}
                                    onClick={() => moveItem(groupIdx, actualItemIdx, "down")}
                                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 disabled:pointer-events-none transition"
                                    title="নিচে নিন"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Item Visibility Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => toggleItemVisibility(groupIdx, actualItemIdx)}
                                    className={`p-1 rounded transition ${
                                      item.hidden
                                        ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    }`}
                                    title={item.hidden ? "মেনু প্রদর্শন করুন" : "মেনু সাইডবার থেকে লুকান"}
                                  >
                                    {item.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* Move to another group selector */}
                                  <div className="flex items-center gap-1 shrink-0 ml-1">
                                    <select
                                      value={group.id}
                                      onChange={(e) =>
                                        handleMoveItemToGroup(
                                          groupIdx,
                                          actualItemIdx,
                                          e.target.value
                                        )
                                      }
                                      className="text-[11px] font-medium py-1 px-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                      title="গ্রুপ বদলান"
                                    >
                                      {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                          {g.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>মূল ডিফল্ট মেনুতে ফেরত যান</span>
            </button>

            <span className="hidden md:inline-block text-[11px] text-slate-400">
              প্রদর্শিত: <strong>{visibleItemsCount}</strong> / মোট: <strong>{totalItemsCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95"
            >
              {savedToast ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white animate-in zoom-in" />
                  <span>সংরক্ষিত হয়েছে!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
