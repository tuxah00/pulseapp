export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-gray-200" />
        <div className="mt-2 h-4 w-32 rounded bg-gray-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="flex-1">
              <div className="h-3 w-16 rounded bg-gray-100 mb-2" />
              <div className="h-6 w-12 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="h-5 w-40 rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
