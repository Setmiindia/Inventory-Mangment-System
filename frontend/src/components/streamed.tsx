import { Suspense } from "react";

// Wraps a page that reads the session / database so it streams inside <Suspense>.
// Why: with Cache Components a page may not read request data outside <Suspense> (dev shows an "uncached data" error and a
// navigation cannot be instant). Usage:  export default streamed(async function MyPage(props) { ... })
export function streamed<P extends object>(
  Content: (props: P) => Promise<React.ReactNode>,
  fallback: React.ReactNode = <main className="p-4 text-sm text-muted">Loading...</main>,
) {
  return function Streamed(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Content {...props} />
      </Suspense>
    );
  };
}
