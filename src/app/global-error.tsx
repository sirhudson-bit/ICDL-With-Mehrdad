"use client";

/**
 * Last-resort boundary for failures in the root layout itself.
 *
 * Must render its own <html>/<body> because it replaces the root layout, so it
 * deliberately avoids importing application components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "Vazirmatn Variable, Vazirmatn, system-ui, sans-serif",
          background: "#f7f7fa",
          color: "#22243a",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "34rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            مشکلی در بارگذاری برنامه پیش آمده است
          </h1>
          <p style={{ lineHeight: 1.9, opacity: 0.75, fontSize: "0.9375rem" }}>
            لطفاً صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت، چند لحظه بعد تلاش کنید.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.7rem 1.4rem",
              borderRadius: "0.85rem",
              border: "none",
              background: "#4f46e5",
              color: "white",
              fontSize: "0.9375rem",
              cursor: "pointer",
            }}
          >
            تلاش دوباره
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1rem", fontSize: "0.6875rem", opacity: 0.5 }} dir="ltr">
              {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
