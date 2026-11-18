export default function DeleteIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 7h16m-10 4v5m4-5v5M9 7V5h6v2m-9 0 1 14h10l1-14" />
    </svg>
  );
}
