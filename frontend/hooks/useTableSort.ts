import { useState, useCallback } from 'react';

export type TableSortState = { col: number; dir: 'asc' | 'desc' } | null;

/**
 * 表格排序状态与切换（从低到高 ⇄ 从高到低）
 * 用于持仓表、自选表等需排序列的表格，避免各页面重复写 cycle 逻辑
 */
export function useTableSort(): {
  sort: TableSortState;
  handleSort: (col: number) => void;
} {
  const [sort, setSort] = useState<TableSortState>(null);
  const handleSort = useCallback((col: number) => {
    setSort((prev) =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    );
  }, []);
  return { sort, handleSort };
}
