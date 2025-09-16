import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { SecretCodeGate } from './components/SecretCodeGate'
import { DiscordLogin } from './components/DiscordLogin'
import { VideoUpload } from './components/VideoUpload'
import { VideoGrid } from './components/VideoGrid'

function Dashboard({ onVideoUploaded, refreshTrigger, hasUploadedVideos, setHasUploadedVideos }: { 
  onVideoUploaded: () => void, 
  refreshTrigger: number,
  hasUploadedVideos: boolean,
  setHasUploadedVideos: (value: boolean) => void
}) {
    const { signOut, user } = useAuth()
  
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Colony Clips</h1>
            
            {/* User Profile Section */}
            <div className="flex items-center gap-4">
              {user?.user_metadata?.avatar_url && (
                <div className="relative group">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name || 'User'}
                    className="w-8 h-8 rounded-full cursor-pointer"
                  />
                  {/* Tooltip - positioned below instead of above */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    {user.user_metadata.full_name || user.email}
                    {/* Arrow pointing up */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-700"></div>
                  </div>
                </div>
              )}
              <button
                onClick={signOut}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        
        <main className="p-6">
          <div className="text-center py-8">
            <h2 className="text-xl mb-4">Welcome back!</h2>
            <p className="text-gray-400 mb-8">Upload and manage your video clips</p>
            
            {/* Video Upload Section */}
            <div className="mb-8">
              <VideoUpload onUploadComplete={onVideoUploaded} />
            </div>
            
            {/* Video Grid Section - Only show after first upload */}
            {hasUploadedVideos && (
              <div className="mt-12">
                <h3 className="text-lg font-semibold mb-6">Your Videos</h3>
                <VideoGrid refreshTrigger={refreshTrigger} onVideosLoaded={setHasUploadedVideos} />
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

function App() {
  const { isAuthenticated, loading } = useAuth()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [hasUploadedVideos, setHasUploadedVideos] = useState(false)

  const handleVideoUploaded = () => {
    // Video uploaded successfully - refresh video list and show grid
    setRefreshTrigger(prev => prev + 1)
    setHasUploadedVideos(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <SecretCodeGate>
      {isAuthenticated ? (
        <Dashboard 
          onVideoUploaded={handleVideoUploaded} 
          refreshTrigger={refreshTrigger}
          hasUploadedVideos={hasUploadedVideos}
          setHasUploadedVideos={setHasUploadedVideos}
        />
      ) : (
        <DiscordLogin />
      )}
    </SecretCodeGate>
  )
}

export default App