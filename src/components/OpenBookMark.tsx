/** Brand mark used in header/auth — open daybook */
export function OpenBookMark({ className = 'header-mark' }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg
        className="brand-book"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        focusable="false"
      >
        <path
          d="M10 3.2C7.6 2.2 4.4 1.8 1.8 2.4v12.2c2.6-.4 5.4.2 8.2 1.2 2.8-1 5.6-1.6 8.2-1.2V2.4C15.6 1.8 12.4 2.2 10 3.2Z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M10 3.2C7.6 2.2 4.4 1.8 1.8 2.4v12.2c2.6-.4 5.4.2 8.2 1.2 2.8-1 5.6-1.6 8.2-1.2V2.4C15.6 1.8 12.4 2.2 10 3.2Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M10 3.4v12.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}
