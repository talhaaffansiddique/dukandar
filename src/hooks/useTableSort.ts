import React, { useState, useMemo } from 'react';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * A custom React hook for sorting any array of object records by column keys.
 * Handles strings, numbers, booleans, nested paths, and date timestamps automatically.
 *
 * How to use:
 * 1. Import hook: `import { useTableSort } from '../hooks/useTableSort';`
 * 2. Invoke inside component:
 *    `const { sortedData, requestSort, sortConfig } = useTableSort(myList, { key: 'date', direction: 'desc' });`
 * 3. Add to table headers:
 *    `<th onClick={() => requestSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
 *       Product Name {renderSortIcon('name', sortConfig)}
 *     </th>`
 */
export function useTableSort<T>(items: T[], defaultSort: SortConfig = { key: '', direction: 'asc' }) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSort);

  // Helper to extract nested properties if needed (e.g. 'product.name')
  const getFieldValue = (obj: any, path: string): any => {
    if (!path) return '';
    return path.split('.').reduce((acc, part) => {
      if (acc === undefined || acc === null) return acc;
      return acc[part];
    }, obj);
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return items;

    const sorted = [...items];
    sorted.sort((a, b) => {
      let aVal = getFieldValue(a, sortConfig.key);
      let bVal = getFieldValue(b, sortConfig.key);

      // Handle undefined / null
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      // If comparing strings, do case-insensitive comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Default numeric / comparison sorting
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { sortedData, requestSort, sortConfig };
}

/**
 * Renders a small visual indicator arrow showing sorting direction.
 */
export function renderSortIcon(columnKey: string, sortConfig: SortConfig) {
  if (sortConfig.key !== columnKey) {
    return React.createElement('span', { style: { opacity: 0.25, marginLeft: '4px', fontSize: '0.75rem' } }, '↕');
  }
  return sortConfig.direction === 'asc' 
    ? React.createElement('span', { style: { color: 'var(--primary)', marginLeft: '4px', fontSize: '0.75rem' } }, '▲')
    : React.createElement('span', { style: { color: 'var(--primary)', marginLeft: '4px', fontSize: '0.75rem' } }, '▼');
}
