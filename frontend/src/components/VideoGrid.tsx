import { useState, useEffect } from 'react'
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

  useEffect(() => {
    loadVideos()
  }, [refreshTrigger])

  const loadVideos = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVideos(data || [])
      
      // Notify parent component about video count
      if (onVideosLoaded) {
        onVideosLoaded((data || []).length > 0)
      }
    } catch (error) {
      console.error('Failed to load videos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getThumbnailUrl = (thumbnailPath: string) => {
    const { data } = supabase.storage
      .from('videos')
      .getPublicUrl(thumbnailPath)
    return data.publicUrl
  }

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="aspect-video bg-gray-700 relative">
            <img
              src={getThumbnailUrl(video.thumbnail_path)}
              alt={video.filename}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-4">
            <h3 className="text-white font-medium truncate mb-2">{video.filename}</h3>
            <div className="text-sm text-gray-400 mb-3">
              <p>Size: {Math.round(video.compressed_size / 1024 / 1024 * 100) / 100}MB</p>
              <p>Uploaded: {new Date(video.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyShareLink(video.share_token)}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors"
              >
                Share
              </button>
              <button
                onClick={() => deleteVideo(video)}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
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