import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Video {
  id: string
  filename: string
  storage_path: string
  thumbnail_path: string
  share_token: string
  created_at: string
  original_size: number
  compressed_size: number
}

export function VideoGrid({ refreshTrigger, onVideosLoaded }: { refreshTrigger: number, onVideosLoaded?: (hasVideos: boolean) => void }) {
  const { user } = useAuth()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [thumbnailUrlsById, setThumbnailUrlsById] = useState<Record<string, string>>({})
  const isFetchingRef = useRef(false)

  useEffect(() => {
    // Only run when user id changes or refresh is triggered
    loadVideos()
  }, [refreshTrigger, user?.id])

  const loadVideos = async () => {
    console.log('loadVideos called, user:', user)
    
    if (!user) {
      console.log('No user found, exiting loadVideos')
      setLoading(false)
      return
    }
  
    console.log('Starting video query for user ID:', user.id)
  
    try {
      if (isFetchingRef.current) {
        console.log('Fetch already in progress, skipping')
        return
      }
      isFetchingRef.current = true
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
  
      console.log('Query result:', { data, error, dataLength: data?.length })
  
      if (error) {
        console.error('Database error:', error)
        throw error
      }
      
      setVideos(data || [])
      
      // Notify parent component about video count
      if (onVideosLoaded) {
        console.log('Calling onVideosLoaded with:', (data || []).length > 0)
        onVideosLoaded((data || []).length > 0)
      }
    } catch (error) {
      console.error('Failed to load videos:', error)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    const fetchThumbnailUrls = async () => {
      if (!videos || videos.length === 0) return
      try {
        const entries = await Promise.all(
          videos.map(async (v) => {
            const key = (v.thumbnail_path || '').trim()
            if (!key) return [v.id, ''] as const
            const { data, error } = await supabase.storage
              .from('videos')
              .createSignedUrl(key, 3600)
            if (error) {
              console.error('Signed URL error for key:', key, error)
              return [v.id, ''] as const
            }
            return [v.id, data.signedUrl] as const
          })
        )
        const map: Record<string, string> = {}
        for (const [id, url] of entries) map[id] = url
        setThumbnailUrlsById(map)
      } catch (e) {
        console.error('Failed fetching thumbnail URLs', e)
      }
    }
    fetchThumbnailUrls()
  }, [videos])

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/watch/${shareToken}`
    navigator.clipboard.writeText(shareUrl)
    // You could add a toast notification here
    alert('Share link copied to clipboard!')
  }

  const deleteVideo = async (video: Video) => {
    if (!confirm('Are you sure you want to delete this video?')) return

    try {
      // Delete from storage
      await supabase.storage.from('videos').remove([video.storage_path, video.thumbnail_path])
      
      // Delete from database
      await supabase.from('videos').delete().eq('id', video.id)
      
      // Refresh the list
      loadVideos()
    } catch (error) {
      console.error('Failed to delete video:', error)
      alert('Failed to delete video')
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400">Loading videos...</div>
  }

  if (videos.length === 0) {
    return <div className="text-center text-gray-400">No videos uploaded yet</div>
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {videos.map((video) => (
        <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="aspect-square bg-gray-700 relative">
            {thumbnailUrlsById[video.id] ? (
              <img
                src={thumbnailUrlsById[video.id]}
                alt={video.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-700" />
            )}
          </div>
          <div className="p-3">
            <h3 className="text-white font-medium truncate mb-2 text-sm">{video.filename}</h3>
            <div className="text-xs text-gray-400 mb-2">
              <p>Size: {Math.round(video.compressed_size / 1024 / 1024 * 100) / 100}MB</p>
              <p>Uploaded: {new Date(video.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => copyShareLink(video.share_token)}
                className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition-colors cursor-pointer"
              >
                Share
              </button>
              <button
                onClick={() => deleteVideo(video)}
                className="flex-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}