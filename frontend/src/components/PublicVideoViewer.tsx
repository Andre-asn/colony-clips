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

  useEffect(() => {
    loadVideo()
  }, [token])

  // Update meta tags for Discord embedding
  useEffect(() => {
    if (!video) return

    // Use the signed URL that's already generated for the video
    const videoUrl = video.signedURL || getPublicUrl(video.storage_path)
    const thumbnailUrl = video.thumbnail_path ? getPublicUrl(video.thumbnail_path) : ''
    const pageTitle = `${video.filename} - Colony Clips`
    const description = `Video shared on Colony Clips by ${user?.user_metadata?.full_name || 'Anonymous User'}`

    // Update document title
    document.title = pageTitle

    // Helper function to update or create meta tags
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('property', property)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }

    const updateMetaName = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }

    // Open Graph meta tags (for Discord, Facebook, etc.)
    updateMetaTag('og:title', pageTitle)
    updateMetaTag('og:description', description)
    updateMetaTag('og:image', thumbnailUrl)
    updateMetaTag('og:video', videoUrl)
    updateMetaTag('og:video:type', 'video/mp4')
    updateMetaTag('og:video:width', '1280')
    updateMetaTag('og:video:height', '720')
    updateMetaTag('og:type', 'video.other')
    updateMetaTag('og:site_name', 'Colony Clips')
    updateMetaTag('og:url', window.location.href)

    // Twitter Card meta tags
    updateMetaName('twitter:card', 'player')
    updateMetaName('twitter:title', pageTitle)
    updateMetaName('twitter:description', description)
    updateMetaName('twitter:image', thumbnailUrl)
    updateMetaName('twitter:player', videoUrl)
    updateMetaName('twitter:player:width', '1280')
    updateMetaName('twitter:player:height', '720')

    // Additional meta tags for better Discord support
    updateMetaName('description', description)
    updateMetaTag('og:image:width', '1280')
    updateMetaTag('og:image:height', '720')
    updateMetaTag('og:image:type', 'image/jpeg')
    
    // Discord-specific meta tags
    updateMetaTag('og:video:secure_url', videoUrl)
    updateMetaTag('og:video:url', videoUrl)
    updateMetaName('twitter:player:stream', videoUrl)
    
    // Debug logging for Discord embedding
    console.log('Discord Embed Debug:')
    console.log('- Video URL:', videoUrl)
    console.log('- Thumbnail URL:', thumbnailUrl)
    console.log('- Page Title:', pageTitle)
    console.log('- Description:', description)
    
    // Ensure video URL is absolute
    if (videoUrl && !videoUrl.startsWith('http')) {
      console.warn('Video URL is not absolute:', videoUrl)
    }

  }, [video, user])

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


      // Get video signed URL from R2 (7 days expiration for Discord embedding)
      let videoUrl: string
      try {
        videoUrl = await getSignedUrlForFile(videoData.storage_path, 604800) // 7 days
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