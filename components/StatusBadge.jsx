import { STATUS_LABELS } from "../lib/supabase";

const STATUS_STYLES = {
  pending: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  changes_requested: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200",
  approved: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  rejected: "border-red-300/30 bg-red-300/10 text-red-200",
  sent_to_distributor: "border-sky-300/30 bg-sky-300/10 text-sky-200",
};

const StatusBadge = ({ status }) => {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
};

export default StatusBadge;
