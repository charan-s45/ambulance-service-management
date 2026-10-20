// Same labels and colours as the prototype's statusToBadge().
const BADGES = {
  new: { className: "badge new", label: "New" },
  pending: { className: "badge new", label: "Pending" },
  enroute: { className: "badge enroute", label: "En route" },
  arrived: { className: "badge arrived", label: "Arrived" },
  completed: { className: "badge complete", label: "Completed" },
};

export default function StatusBadge({ status }) {
  const badge = BADGES[status] || { className: "badge", label: status || "" };
  return <span className={badge.className}>{badge.label}</span>;
}
