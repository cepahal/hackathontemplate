export function BarChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const maximum = Math.max(1, ...data.map((item) => Math.max(0, item.value)));
  return (
    <figure
      aria-label={title}
      className="rounded-xl border border-border bg-white p-5"
    >
      <figcaption className="mb-5 text-sm font-semibold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No measurements yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((item) => (
            <li
              key={item.label}
              className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3 text-xs"
            >
              <span>{item.label}</span>
              <div
                className="h-3 overflow-hidden rounded-full bg-secondary"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${(Math.max(0, item.value) / maximum) * 100}%`,
                  }}
                />
              </div>
              <span className="text-right tabular-nums">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
