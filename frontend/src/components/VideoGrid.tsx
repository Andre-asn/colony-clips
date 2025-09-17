import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getSignedUrlForFile, getPublicUrl, deleteFile } from '../lib/cloudflare'
import { useAuth } from '../hooks/useAuth'
import { useToast } from './Toast'
import { ConfirmationModal } from './ConfirmationModal'

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
  const { showToast } = useToast()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [thumbnailUrlsById, setThumbnailUrlsById] = useState<Record<string, string>>({})
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; video: Video | null }>({ isOpen: false, video: null })
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
            
            try {
              // Try to get signed URL from R2
              const signedUrl = await getSignedUrlForFile(key, 3600)
              return [v.id, signedUrl] as const
            } catch (error) {
              console.error('R2 signed URL error for key:', key, error)
              // Fallback to public URL if bucket is public
              const publicUrl = getPublicUrl(key)
              return [v.id, publicUrl] as const
            }
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
    showToast('Share link copied to clipboard!', 'success')
  }

  const handleDeleteClick = (video: Video) => {
    setDeleteModal({ isOpen: true, video })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteModal.video) return

    try {
      // Delete from R2 storage
      await deleteFile(deleteModal.video.storage_path)
      await deleteFile(deleteModal.video.thumbnail_path)
      
      // Delete from database
      await supabase.from('videos').delete().eq('id', deleteModal.video.id)
      
      // Refresh the list
      loadVideos()
      showToast('Video deleted successfully', 'success')
    } catch (error) {
      console.error('Failed to delete video:', error)
      showToast('Failed to delete video', 'error')
    } finally {
      setDeleteModal({ isOpen: false, video: null })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, video: null })
  }

  if (loading) {
    return <div className="text-center text-gray-400">Loading videos...</div>
  }

  if (videos.length === 0) {
    return <div className="text-center text-gray-400">No videos uploaded yet</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {videos.map((video) => (
        <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors">
          <div className="aspect-video bg-gray-700 relative overflow-hidden">
            {thumbnailUrlsById[video.id] ? (
              <img
                src={thumbnailUrlsById[video.id]}
                alt={video.filename}
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center' }}
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <div className="text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <div className="text-xs">Loading...</div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-white font-medium truncate mb-3 text-sm" title={video.filename}>
              {video.filename}
            </h3>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
              <span>{Math.round(video.compressed_size / 1024 / 1024 * 100) / 100}MB</span>
              <span>{new Date(video.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyShareLink(video.share_token)}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded transition-colors cursor-pointer font-medium"
              >
                Share
              </button>
              <button
                onClick={() => handleDeleteClick(video)}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors cursor-pointer font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Video"
        message={`Are you sure you want to delete "${deleteModal.video?.filename}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}