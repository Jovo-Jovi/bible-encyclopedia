export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <ul className="panel mt-6 divide-y divide-line overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="px-4 py-4">
          <span className="bone h-4" style={{ width: `${68 - (index % 3) * 12}%` }} />
          <span className="bone mt-2 h-3 w-24" />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonText() {
  return (
    <div className="mt-8 space-y-3" aria-hidden="true">
      <span className="bone h-4 w-full" />
      <span className="bone h-4 w-11/12" />
      <span className="bone h-4 w-4/5" />
      <span className="bone mt-6 h-4 w-full" />
      <span className="bone h-4 w-10/12" />
      <span className="bone h-4 w-2/3" />
    </div>
  );
}
