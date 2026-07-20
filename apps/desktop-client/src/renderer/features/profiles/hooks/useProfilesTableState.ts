import { useState, useCallback } from 'react';
import type { TabType, SortKey, SortDir } from '../types.js';

export interface ProfilesTableState {
  searchTerm: string;
  activeTab: TabType;
  sortKey: SortKey;
  sortDir: SortDir;
  currentPage: number;
  pageSize: number;
}

export function useProfilesTableState() {
  const [searchTerm, setSearchTermState] = useState('');
  const [activeTab, setActiveTabState] = useState<TabType>('all');
  const [sortKey, setSortKey] = useState<SortKey>('serial');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
    setCurrentPage(1);
  }, []);

  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback((col: SortKey) => {
    setSortKey((prevKey) => {
      if (col === prevKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir('asc');
      }
      return col;
    });
    setCurrentPage(1);
  }, []);

  return {
    searchTerm,
    activeTab,
    sortKey,
    sortDir,
    currentPage,
    pageSize,
    setSearchTerm,
    setActiveTab,
    setSortKey,
    setSortDir,
    setCurrentPage,
    setPageSize,
    handleSort,
  };
}
