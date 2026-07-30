import { Helmet } from "react-helmet-async";

/**
 * Per-page document title. Mirrors the old Next Metadata template
 * "%s · PES Smart Attendance". Render near the top of a page component:
 *   <PageTitle title="Student Dashboard" />
 */
export function PageTitle({ title }: { title?: string }) {
  return (
    <Helmet>
      <title>{title ? `${title} · PES Smart Attendance` : "PES Smart Attendance"}</title>
    </Helmet>
  );
}
