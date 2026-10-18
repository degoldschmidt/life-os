export default function Loading() {
  return (
    <div className="grid gap-[14px] md:grid-cols-[240px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading">
      <div className="h-[260px] rounded-tile bg-ink opacity-90" />
      <div className="flex flex-col gap-[14px]">
        <div className="h-[140px] rounded-tile bg-tile" />
        <div className="h-[200px] rounded-tile bg-tile" />
      </div>
    </div>
  );
}
