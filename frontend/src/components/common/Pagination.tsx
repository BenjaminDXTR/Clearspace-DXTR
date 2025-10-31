// src/components/common/Pagination.tsx
import { useCallback } from "react";
import { config } from "../../config";
import "./Pagination.css";

interface PaginationProps {
  page: number;
  maxPage: number;
  onPageChange: (page: number) => void;
  debug?: boolean;
}

export default function Pagination({
  page,
  maxPage,
  onPageChange,
  debug = config.debug || config.environment === "development",
}: PaginationProps) {
  const dlog = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[Pagination]", ...args);
      }
    },
    [debug]
  );

  const totalPages = Math.max(1, maxPage);

  const goToFirst = useCallback(() => {
    if (page > 1) {
      dlog(`Aller au début`);
      onPageChange(1);
    }
  }, [page, onPageChange, dlog]);

  const goToLast = useCallback(() => {
    if (page < totalPages) {
      dlog(`Aller à la fin`);
      onPageChange(totalPages);
    }
  }, [page, totalPages, onPageChange, dlog]);

  const onPrevious = useCallback(() => {
    if (page > 1) {
      const newPage = page - 1;
      dlog(`Page précédente : ${newPage}`);
      onPageChange(newPage);
    }
  }, [page, onPageChange, dlog]);

  const onNext = useCallback(() => {
    if (page < totalPages) {
      const newPage = page + 1;
      dlog(`Page suivante : ${newPage}`);
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
        onClick={goToFirst}
        disabled={page <= 1}
        aria-disabled={page <= 1}
        aria-label="Début"
        className="btn-large"
      >
        Début
      </button>

      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        aria-disabled={page <= 1}
        aria-label="Page précédente"
        className="btn-medium"
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
        className="btn-medium"
      >
        Suivant ▶
      </button>

      <button
        type="button"
        onClick={goToLast}
        disabled={page >= totalPages}
        aria-disabled={page >= totalPages}
        aria-label="Fin"
        className="btn-large"
      >
        Fin
      </button>
    </nav>
  );
}
