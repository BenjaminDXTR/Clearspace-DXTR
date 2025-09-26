import { useCallback } from "react";
import { config } from "../../config";
import "./Pagination.css";

interface PaginationProps {
  /** Page courante (commence à 1) */
  page: number;
  /** Nombre total de pages (>= 1) */
  maxPage: number;
  /** Callback appelé lors du changement de page */
  onPageChange: (page: number) => void;
  /** Active les logs debug (par défaut : en dev) */
  debug?: boolean;
}

export default function Pagination({
  page,
  maxPage,
  onPageChange,
  debug = config.debug || config.environment === "development",
}: PaginationProps) {
  // Memoized logging function for conditional debug logging
  const dlog = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[Pagination]", ...args);
      }
    },
    [debug]
  );

  // Ensure total pages cannot be less than 1
  const totalPages = Math.max(1, maxPage);

  // Handler to go to previous page if available
  const onPrevious = useCallback(() => {
    if (page > 1) {
      const newPage = page - 1;
      dlog(`Navigating to previous page: ${newPage}`);
      onPageChange(newPage);
    }
  }, [page, onPageChange, dlog]);

  // Handler to go to next page if available
  const onNext = useCallback(() => {
    if (page < totalPages) {
      const newPage = page + 1;
      dlog(`Navigating to next page: ${newPage}`);
      onPageChange(newPage);
    }
  }, [page, totalPages, onPageChange, dlog]);

  return (
    <nav
      className="pagination"
      role="navigation"
      aria-label="Navigation par pagination"
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        aria-disabled={page <= 1}
        aria-label="Page précédente"
      >
        ◀ Précédent
      </button>

      <span
        className="pagination__info"
        aria-live="polite"
        aria-atomic="true"
      >
        Page {page} / {totalPages}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-disabled={page >= totalPages}
        aria-label="Page suivante"
      >
        Suivant ▶
      </button>
    </nav>
  );
}
