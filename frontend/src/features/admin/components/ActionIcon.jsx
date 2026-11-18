const paths = {
  view: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  edit: "m13.5 6.5 4 4M4 20l3.5-.75L19 7.75a2.12 2.12 0 0 0-3-3L4.5 16.25 4 20Z",
  delete: "M4 7h16m-10 4v5m4-5v5M9 7V5h6v2m-9 0 1 14h10l1-14",
};

export default function ActionIcon({ type, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[type]} />
      </svg>
      <span>{label}</span>
    </span>
  );
}
