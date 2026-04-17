export default function PortalDashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-32 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      {/* Card skeleton */}
      <div className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
      {/* Tiles skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
        ))}
      </div>
    </div>
  )
}
