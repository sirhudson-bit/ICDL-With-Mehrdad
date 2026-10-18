/**
 * Print layout.
 *
 * Deliberately almost empty. Printable documents live in this route group so
 * they render *outside* the site chrome entirely — no header, footer, sidebar,
 * tab bar or assistant. Previously the print pages shared the site layout and
 * relied on `no-print` classes to hide the interface around them, which meant a
 * single missed class or a z-index/pagination quirk ended up in the PDF. Now
 * there is nothing to hide.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-document bg-white text-neutral-900">{children}</div>;
}
