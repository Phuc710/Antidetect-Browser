import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface ProfilesPaginationProps {
  readonly totalCount: number;
  readonly pageSize: number;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageSizeChange: (size: number) => void;
  readonly onPageChange: (page: number) => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 500];

export function ProfilesPagination({
  totalCount,
  pageSize,
  currentPage,
  totalPages,
  onPageSizeChange,
  onPageChange,
}: ProfilesPaginationProps): JSX.Element {
  const displayTotalPages = totalPages || 0;
  const displayCurrentPage = totalCount === 0 ? 0 : currentPage;
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <footer className="pfooter">
      {/* Left side: Total and custom page size select */}
      <div className="pfooter__left">
        <span className="pfooter__total">Total {totalCount}</span>
        
        <div className="pfooter__page-size-container" ref={dropdownRef}>
          <button
            type="button"
            className="pfooter__page-size-trigger"
            onClick={() => setIsOpen(!isOpen)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span>{pageSize}/page</span>
            <ChevronDown size={14} className={`pfooter__page-size-arrow ${isOpen ? 'pfooter__page-size-arrow--open' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="pfooter__page-size-dropdown" role="listbox">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === pageSize}
                  className={`pfooter__page-size-option ${option === pageSize ? 'pfooter__page-size-option--active' : ''}`}
                  onClick={() => {
                    onPageSizeChange(option);
                    setIsOpen(false);
                  }}
                >
                  {option}/page
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Jump input and chevron buttons */}
      <div className="pfooter__right">
        <div className="pfooter__pagination">
          <span className="pfooter__jump-label">Jump to Page</span>
          <input
            className="pfooter__jump-input"
            type="number"
            min={displayTotalPages === 0 ? 0 : 1}
            max={displayTotalPages}
            value={displayCurrentPage}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (displayTotalPages === 0) return;
              const v = Math.max(1, Math.min(displayTotalPages, val));
              if (v) onPageChange(v);
            }}
            aria-label="Jump to page"
          />
          <button
            type="button"
            className="pfooter__nav-btn"
            disabled={displayCurrentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="pfooter__nav-btn"
            disabled={displayTotalPages === 0 || currentPage >= displayTotalPages}
            onClick={() => onPageChange(Math.min(displayTotalPages, currentPage + 1))}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </footer>
  );
}
