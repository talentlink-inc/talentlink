import { TableSkeleton } from "@/components/ui/TableSkeleton";

// Switching tabs keeps the section header (it's in the layout); only the
// tab's content shows a placeholder while it loads.
export default function SectionLoading() {
  return <TableSkeleton />;
}
