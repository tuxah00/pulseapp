export default function PortalAppointmentsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-gray-200 dark:bg-gray-800" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
      ))}
    </div>
  )
}
