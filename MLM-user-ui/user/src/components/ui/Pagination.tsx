"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  showItemsPerPage?: boolean;
  className?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50],
  showItemsPerPage = true,
  className = "",
}: PaginationProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      className={`flex flex-wrap justify-between items-center pt-5 border-t border-[var(--border)] gap-4 ${className}`}
    >
      {showItemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-body)]">
          <span>Show</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1); // Reset to first page when changing items per page
            }}
            className="px-2 py-1.5 border border-[var(--border)] rounded-md text-sm bg-[var(--card-bg)] text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          >
            {itemsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span>entries</span>
        </div>
      )}

      <div className="text-sm text-[var(--text-body)]">
        Showing{" "}
        <span className="font-semibold text-[var(--text-strong)]">
          {startIndex + 1}
        </span>{" "}
        to{" "}
        <span className="font-semibold text-[var(--text-strong)]">
          {endIndex}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-[var(--text-strong)]">
          {totalItems}
        </span>{" "}
        records
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="min-w-[44px] min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((pageNum, index) => {
            if (pageNum === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-[var(--text-muted)]"
                >
                  ...
                </span>
              );
            }

            const page = pageNum as number;
            return (
              <Button
                key={page}
                variant={currentPage === page ? "primary" : "outline"}
                size="sm"
                className="min-w-[36px] min-h-[44px]"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="min-w-[44px] min-h-[44px]"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
