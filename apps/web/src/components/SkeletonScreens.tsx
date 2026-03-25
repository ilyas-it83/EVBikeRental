function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
  );
}

export function MapSkeleton() {
  return (
    <div className="relative h-full w-full bg-gray-100">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
        <SkeletonBlock className="h-12 flex-1 rounded-xl" />
        <SkeletonBlock className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  );
}

export function RideHistorySkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <SkeletonBlock className="mb-6 h-8 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-48" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-4 w-12" />
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <SkeletonBlock className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <SkeletonBlock className="h-4 w-24" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <SkeletonBlock className="mb-6 h-8 w-48" />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 shadow-sm">
            <SkeletonBlock className="mb-2 h-3 w-20" />
            <SkeletonBlock className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <SkeletonBlock className="mb-4 h-5 w-32" />
          <SkeletonBlock className="h-64 w-full" />
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <SkeletonBlock className="mb-4 h-5 w-32" />
          <SkeletonBlock className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
