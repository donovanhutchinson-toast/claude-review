export function CommentRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border-y px-3 py-2"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-sunken)' }}
    >
      <div className="flex max-w-3xl flex-col gap-2">{children}</div>
    </div>
  );
}
