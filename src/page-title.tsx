/**
 * Per-page document title. React 19 hoists a <title> rendered anywhere in the
 * component tree into <head>, so this replaces the old react-helmet-async
 * wrapper (which itself replaced the Next Metadata template). Render near the
 * top of a page component:
 *   <PageTitle title="Student Dashboard" />
 */
export function PageTitle({ title }: { title?: string }) {
  return <title>{title ? `${title} · PES Smart Attendance` : "PES Smart Attendance"}</title>;
}
