import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { SecretCodeGate } from './components/SecretCodeGate'
import { DiscordLogin } from './components/DiscordLogin'
import { VideoUpload } from './components/VideoUpload'
import { VideoGrid } from './components/VideoGrid'
import { ToastProvider } from './components/Toast'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function Dashboard({ onVideoUploaded, refreshTrigger, hasUploadedVideos, setHasUploadedVideos }: { 
  onVideoUploaded: () => void, 
  refreshTrigger: number,
  hasUploadedVideos: boolean,
  setHasUploadedVideos: (value: boolean) => void
}) {
    const { signOut, user } = useAuth()
  
  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}></div>
      </div>
      
      <header className="bg-gray-800 px-6 py-4 relative z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Colony Clips</h1>
            
            {/* User Profile Section */}
            <div className="flex items-center gap-4">
              {user?.user_metadata?.avatar_url && (
                <div className="relative group">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name || 'User'}
                    className="w-8 h-8 rounded-full"
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
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Welcome!</h2>
              <p className="text-gray-400 text-lg">Upload and manage your video clips</p>
            </div>
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Upload Section */}
              <div className="lg:col-span-1">
                <div className="sticky top-6">
                  <h3 className="text-xl font-semibold mb-4 text-white">Upload New Video</h3>
                  <VideoUpload onUploadComplete={onVideoUploaded} />
                </div>
              </div>
              
              {/* Right Column - Videos Grid */}
              <div className="lg:col-span-2">
                {hasUploadedVideos ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-semibold text-white">Your Videos</h3>
                      <div className="text-sm text-gray-400">
                        {refreshTrigger > 0 && 'Recently updated'}
                      </div>
                    </div>
                    <VideoGrid refreshTrigger={refreshTrigger} onVideosLoaded={setHasUploadedVideos} />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="bg-gray-800 rounded-lg p-12">
                      <div className="text-gray-400 mb-4">
                        <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className="text-xl font-medium text-white mb-2">No videos yet</h4>
                      <p className="text-gray-400 mb-6">Upload your first video to get started</p>
                      <div className="text-sm text-gray-500">
                        Drag and drop a video file or click the upload area
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  function App() {
    const { isAuthenticated, loading, user } = useAuth()
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [hasUploadedVideos, setHasUploadedVideos] = useState(false)
  
    // Check if user has existing videos when they log in
    useEffect(() => {
      const checkExistingVideos = async () => {
        if (!user) return
        
        try {
          const { data, error } = await supabase
            .from('videos')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
  
          if (!error && data && data.length > 0) {
            setHasUploadedVideos(true)
          }
        } catch (error) {
          console.error('Error checking existing videos:', error)
        }
      }
  
      if (isAuthenticated && user) {
        checkExistingVideos()
      }
    }, [isAuthenticated, user])
  
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
    <ToastProvider>
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
    </ToastProvider>
  )
}

export default App