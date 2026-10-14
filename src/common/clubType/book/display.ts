import type { WorkDisplay } from "../types";
import { asBook } from "@/common/workDisplay";

export const bookDisplay: WorkDisplay = {
  subtitle: (data) => {
    const book = asBook(data);
    return book?.firstPublishYear !== undefined ? String(book.firstPublishYear) : undefined;
  },
  metaLine: (data) => {
    const book = asBook(data);
    if (book === undefined) return undefined;
    const parts: string[] = [];
    if (book.authors.length > 0) parts.push(book.authors.join(", "));
    if (book.numberOfPages !== undefined && book.numberOfPages > 0) {
      parts.push(`${book.numberOfPages} pages`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  },
  overview: (data) => asBook(data)?.description,
};
