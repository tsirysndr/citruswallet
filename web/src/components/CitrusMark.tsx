export function CitrusMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
    <circle cx="24" cy="24" r="4" fill="currentColor" />
    {Array.from({ length: 8 }, (_, i) => <path key={i} d="M24 10V16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" transform={`rotate(${i * 45} 24 24)`} />)}
  </svg>;
}
