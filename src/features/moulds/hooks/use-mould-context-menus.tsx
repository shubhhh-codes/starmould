"use client";

import type { ProjectMenuState, SubplateMenuState } from "../model/types";
import React, { useState } from "react";
import { useLongPress } from "@/lib/hooks/use-long-press";
import type { ScanProject, Subplate } from "@/lib/supabase/types";

export function useMouldContextMenus() {

  const [contextMenu, setContextMenu] = useState<ProjectMenuState>({
    x: 0,
    y: 0,
    isOpen: false,
    project: null,
  });

  const [subplateContextMenu, setSubplateContextMenu] = useState<SubplateMenuState>({
    x: 0,
    y: 0,
    isOpen: false,
    subplate: null,
    project: null,
  });

  const handleSubplateContextMenu = (e: React.MouseEvent, sp: Subplate, project?: ScanProject | null) => {
    e.preventDefault();
    e.stopPropagation();
    setSubplateContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      subplate: sp,
      project,
    });
  };

  const handleRowContextMenu = (e: React.MouseEvent, project: ScanProject) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      project,
    });
  };

  const handleLongPress = React.useCallback((project: ScanProject, pos: { x: number; y: number; }) => {
    setContextMenu({
      x: pos.x,
      y: pos.y,
      isOpen: true,
      project,
    });
  }, []);

  const longPress = useLongPress<ScanProject>(handleLongPress, {
    threshold: 500,
    vibrate: 50,
  });
  return {
    contextMenu,
    setContextMenu,
    handleRowContextMenu,
    longPress,
    handleSubplateContextMenu,
    subplateContextMenu,
    setSubplateContextMenu,
  };
}
