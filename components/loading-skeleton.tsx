export function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-bold text-xl text-navy-700">
            Break Bread <span className="text-amber-600">Business Group</span>
          </h1>
          <p className="text-gray-600 mt-2 text-sm">MCA Deal Matching Platform</p>
        </div>

        <div className="animate-pulse space-y-4 bg-white p-6 rounded-lg shadow-md">
          <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          <div className="space-y-2 mt-6">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded mt-4"></div>
        </div>
      </div>
    </div>
  )
}
