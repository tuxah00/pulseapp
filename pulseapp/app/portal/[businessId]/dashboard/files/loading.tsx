export default function PortalFilesLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-pulse">
      <div className="h-8 w-40 rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="h-10 w-52 rounded-xl bg-gray-100 dark:bg-gray-800/60" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
        ))}
      </div>
    </div>
  )
}
