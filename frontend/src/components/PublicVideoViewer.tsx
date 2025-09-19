// src/components/PublicVideoViewer.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSignedUrlForFile, getPublicUrl } from '../lib/cloudflare'

interface Video {
  id: string
  filename: string
  storage_path: string
  thumbnail_path: string
  share_token: string
  created_at: string
  original_size: number
  compressed_size: number
  user_id: string
  user_name?: string
  user_avatar_url?: string
  signedURL?: string
  duration?: number
  views?: number
}

interface User {
  id: string
  user_metadata: {
    full_name?: string
    avatar_url?: string
    email?: string
  }
}

export function PublicVideoViewer() {
  const { token } = useParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewTracked, setViewTracked] = useState(false)

  useEffect(() => {
    loadVideo()
  }, [token])

  // Function to increment view count
  const incrementViews = async (videoId: string) => {
    if (viewTracked) return // Prevent multiple increments
    
    try {
      // Get current view count
      const { data: currentVideo } = await supabase
        .from('videos')
        .select('views')
        .eq('id', videoId)
        .single()
      
      if (currentVideo) {
        const { error } = await supabase
          .from('videos')
          .update({ views: (currentVideo.views || 0) + 1 })
          .eq('id', videoId)
        
        if (!error) {
          setViewTracked(true)
          console.log('View count incremented for video:', videoId)
        }
      }
    } catch (error) {
      console.error('Error incrementing views:', error)
    }
  }

  const loadVideo = async () => {
    try {
      if (!token) {
        setError('Invalid video link')
        return
      }

      console.log('Looking for video with token:', token)

      // First, let's test if we can query the table at all
      const { data: testData, error: testError } = await supabase
        .from('videos')
        .select('id, share_token')
        .limit(1)
      
      console.log('Test query result:', { testData, testError })

      // Try a different query approach
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('share_token', token)
        .maybeSingle()

      console.log('Query result:', { videoData, videoError })

      if (videoError) {
        console.error('Supabase error:', videoError)
        setError('Video not found')
        return
      }

      if (!videoData) {
        setError('Video not found')
        return
      }


      // Get video signed URL from R2
      let videoUrl: string
      try {
        videoUrl = await getSignedUrlForFile(videoData.storage_path, 3600)
      } catch (error) {
        console.error('R2 signed URL error:', error)
        // Fallback to public URL if bucket is public
        videoUrl = getPublicUrl(videoData.storage_path)
      }

      // Use stored user data from the video record
      setUser({
        id: videoData.user_id,
        user_metadata: {
          full_name: videoData.user_name || 'Anonymous User',
          avatar_url: videoData.user_avatar_url || undefined,
          email: undefined
        }
      })

      setVideo({ ...videoData, signedURL: videoUrl })
      
      // Track view when video loads
      incrementViews(videoData.id)
    } catch (err) {
      console.error('Error loading video:', err)
      setError('Failed to load video')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <div>Loading video...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️</div>
          <div className="text-xl">{error}</div>
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-xl mb-4">📹</div>
          <div className="text-xl">Video not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 px-6 py-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h1 
            className="text-2xl font-bold cursor-pointer hover:text-indigo-400 transition-colors"
            onClick={() => window.location.href = '/'}
          >
            Colony Clips
          </h1>
          <div className="text-gray-400">Shared Video</div>
        </div>
      </header>

      {/* Main Content - Full Height */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Player - Left Side */}
        <div className="flex-1 p-6">
            <video
              className="w-full h-full object-contain rounded-lg"
              controls
              poster={video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : undefined}
              src={video.signedURL}
            />
        </div>

        {/* Video Info - Right Side */}
        <div className="w-96 bg-gray-800 p-6 flex-shrink-0 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-6 text-white truncate" title={video.filename}>
            {video.filename}
          </h2>
          
          {/* Video Stats */}
          <div className="mb-6">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {video.duration && (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                </div>
              )}
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                {video.views || 0} views
              </div>
            </div>
          </div>

          {/* Uploader Info */}
          <div className="mb-6">
            <div className="flex items-center gap-3 group">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name || 'User'}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                  <span className="text-gray-300 text-lg">
                    {(user?.user_metadata?.full_name || user?.user_metadata?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="text-white font-medium group-hover:text-indigo-400 transition-colors">
                  {user?.user_metadata?.full_name || 'Anonymous User'}
                </div>
                <div className="text-gray-400 text-sm">
                  {new Date(video.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}