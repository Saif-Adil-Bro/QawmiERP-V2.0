"use client";

import React, { useState } from "react";
import {
  X,
  GripVertical,
  Plus,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ArrowRight,
  Trash2,
  FolderPlus,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  INITIAL_NAV_GROUPS,
  SerializedNavGroup,
  SerializedNavItem,
} from "./defaultNavData";
import { getIconComponent } from "./iconRegistry";
import { useAppMode } from "./ModeContext";

interface AdvancedMenuCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (customNavGroups || INITIAL_NAV_GROUPS).forEach((g: SerializedNavGroup) => {
      initial[g.id] = true;
    });
    return initial;
  });

  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);

  // Drag states
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    groupIndex: number;
    itemIndex: number;
  } | null>(null);

  if (!isOpen) return null;

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
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

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleItemDrop = (
    e: React.DragEvent,
    targetGroupIndex: number,
    targetItemIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

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
      // Append to the group
      updated[targetGroupIndex].items.push(movedItem);
    }

    setGroups(updated);
    setDraggedItem(null);
  };

  // Manual move to another group via selector
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

  // Add a new custom group
  const handleCreateGroup = () => {
    if (!newGroupTitle.trim()) return;
    const newGroupId = "custom_" + Date.now();
    const newGroup: SerializedNavGroup = {
      id: newGroupId,
      title: newGroupTitle.trim(),
      iconName: "FolderOpen",
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
    onClose();
  };

  // Reset to default
  const handleReset = () => {
    if (confirm("আপনি কি নিশ্চিত যে মেনুগুলো আগের মূল রূপে ফিরিয়ে নিতে চান?")) {
      resetCustomNavGroups();
      setGroups(JSON.parse(JSON.stringify(INITIAL_NAV_GROUPS)));
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                অ্যাডভান্সড মেনু সাজান ও ড্র্যাগ-অ্যান্ড-ড্রপ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                টেনে টেনে মেনু আগে-পিছে নিন অথবা একটিকে অন্যটির অধীনে সাব-মেনু বানান
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddGroup(!showAddGroup)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ নতুন মেনু গ্রুপ তৈরি করুন</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>টিপস: যেকোনো মেনুকে মাউস দিয়ে টেনে অন্য গ্রুপে ছেড়ে দিন</span>
          </div>
        </div>

        {/* Add Group Form */}
        {showAddGroup && (
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-150 shrink-0">
            <input
              type="text"
              placeholder="নতুন গ্রুপের নাম (যেমন: আমার পছন্দসই মেনু)"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleCreateGroup}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              তৈরি করুন
            </button>
            <button
              type="button"
              onClick={() => setShowAddGroup(false)}
              className="p-2 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Drag & Drop Canvas (Tree of Groups & Items) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 overscroll-contain">
          {groups.map((group, groupIdx) => {
            const GroupIcon = getIconComponent(group.iconName, FolderOpen);
            const isExpanded = expandedGroups[group.id] ?? true;

            return (
              <div
                key={group.id}
                draggable
                onDragStart={() => handleGroupDragStart(groupIdx)}
                onDragOver={(e) => handleGroupDragOver(e, groupIdx)}
                onDrop={() => handleGroupDrop(groupIdx)}
                className={`rounded-2xl border transition-all ${
                  draggedGroupIndex === groupIdx
                    ? "opacity-40 border-dashed border-emerald-500 bg-emerald-50/20"
                    : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Group Header Banner */}
                <div
                  onDragOver={handleItemDragOver}
                  onDrop={(e) => handleItemDrop(e, groupIdx)}
                  className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none bg-slate-100/70 dark:bg-slate-800/80 rounded-t-2xl"
                  onClick={() => toggleGroupExpand(group.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md"
                      title="টেনে পুরো গ্রুপ সরান"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <GroupIcon className="w-4 h-4" />
                    </div>

                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {group.title}
                    </span>

                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                      {group.items.length} টি মেনু
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Sub-Items List (Drop Target Area) */}
                {isExpanded && (
                  <div
                    onDragOver={handleItemDragOver}
                    onDrop={(e) => handleItemDrop(e, groupIdx)}
                    className="p-2.5 sm:p-3 space-y-2 min-h-[50px] bg-white dark:bg-slate-900/60 rounded-b-2xl"
                  >
                    {group.items.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
                        এই গ্রুপে কোনো মেনু নেই। অন্য গ্রুপ থেকে টেনে এখানে ছাড়ুন।
                      </div>
                    ) : (
                      group.items.map((item, itemIdx) => {
                        const ItemIcon = getIconComponent(item.iconName);

                        return (
                          <div
                            key={item.id || item.href}
                            draggable
                            onDragStart={(e) =>
                              handleItemDragStart(e, groupIdx, itemIdx)
                            }
                            onDragOver={handleItemDragOver}
                            onDrop={(e) =>
                              handleItemDrop(e, groupIdx, itemIdx)
                            }
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                              draggedItem?.groupIndex === groupIdx &&
                              draggedItem?.itemIndex === itemIdx
                                ? "opacity-30 border-dashed border-emerald-500 bg-emerald-50/20"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded-md"
                                title="টেনে এক জায়গা থেকে আরেক জায়গায় নিন"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                                <ItemIcon className="w-3.5 h-3.5" />
                              </div>

                              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {item.name}
                              </span>

                              {item.badge && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>

                            {/* Move to another group selector */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <label className="text-[10px] text-slate-400 hidden sm:inline">
                                গ্রুপ বদলান:
                              </label>
                              <select
                                value={group.id}
                                onChange={(e) =>
                                  handleMoveItemToGroup(
                                    groupIdx,
                                    itemIdx,
                                    e.target.value
                                  )
                                }
                                className="text-[11px] py-1 px-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden"
                              >
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>মূল ডিফল্ট মেনুতে ফেরত যান</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>সংরক্ষণ করুন</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
