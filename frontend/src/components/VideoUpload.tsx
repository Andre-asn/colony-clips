import { useState, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { supabase } from '../lib/supabase'
import { uploadFile } from '../lib/cloudflare'
import { useAuth } from '../hooks/useAuth'
import { useToast } from './Toast'

export function VideoUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      // Check file size - recommend max 200MB for safe compression under 50MB
      const maxSize = 200 * 1024 * 1024 // 200MB in bytes
      if (file.size > maxSize) {
        showToast(`File too large! Maximum recommended size is 200MB. Your file is ${Math.round(file.size / 1024 / 1024)}MB. Please compress your video first or choose a smaller file.`, 'error', 5000)
        return
      }
      
      setCancelled(false) // Reset cancelled state for new upload
      processVideo(file)
    } else {
      showToast('Please select a video file', 'error')
    }
  }

  const cancelUpload = async () => {
    if (cancelling) return // Prevent multiple cancel clicks
    
    setCancelling(true)
    setCancelled(true)
    setProgress('Cancelling upload...')
    setProgressPercent(0)
    
    // Clean up FFmpeg instance
    if (ffmpegRef.current) {
      try {
        await ffmpegRef.current.terminate()
      } catch (e) {
        // Ignore termination errors
      }
      ffmpegRef.current = null
    }
    
    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Reset all states completely
    setUploading(false)
    setCancelling(false)
    setCancelled(false)
    setProgress('')
    setProgressPercent(0)
  }

  const processVideo = async (file: File) => {
    if (!user) return

    // Clean up any existing FFmpeg instance first
    if (ffmpegRef.current) {
      try {
        await ffmpegRef.current.terminate()
      } catch (e) {
        // Ignore termination errors
      }
      ffmpegRef.current = null
    }

    setUploading(true)
    setCancelled(false)
    setCancelling(false)
    setProgress('Loading video processor...')
    setProgressPercent(5)

    try {
      // Create FFmpeg instance
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      
      // Set up progress listener for video compression (0-60%)
      ffmpeg.on('progress', ({ progress }) => {
        if (cancelled || cancelling) return
        const percent = Math.round(progress * 60) // Video compression gets 0-60%
        setProgressPercent(20 + percent) // Start from 20%, go to 80%
      })
      
      // Load FFmpeg
      await ffmpeg.load()
      if (cancelled || cancelling) return
      setProgressPercent(10)

      setProgress('Compressing video...')
      setProgressPercent(15)
      
      // Write input file to FFmpeg filesystem
      const inputFileName = 'input.' + file.name.split('.').pop()
      const outputFileName = 'output.mp4'
      const thumbnailFileName = 'thumbnail.jpg'
      
      await ffmpeg.writeFile(inputFileName, new Uint8Array(await file.arrayBuffer()))
      if (cancelled || cancelling) return
      setProgressPercent(20)

      // Compress video for Discord compatibility (under 25MB target) - optimized for speed
      await ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-crf', '30', // Slightly higher CRF for faster encoding
        '-preset', 'ultrafast', // Fastest preset
        '-tune', 'fastdecode', // Optimize for fast decoding
        '-c:a', 'aac',
        '-b:a', '96k', // Lower audio bitrate for smaller files
        '-movflags', '+faststart',
        '-threads', '0', // Use all available CPU threads
        outputFileName
      ])
      if (cancelled || cancelling) return
      setProgressPercent(80)

      setProgress('Generating thumbnail...')
      setProgressPercent(82)

      // Generate thumbnail from compressed video (much faster than original)
      await ffmpeg.exec([
        '-i', outputFileName, // Use compressed video instead of original
        '-ss', '0', // Seek to start immediately
        '-vframes', '1', // Only extract 1 frame
        '-f', 'image2',
        '-vf', 'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
        '-q:v', '5', // Lower quality for speed
        '-threads', '0', // Use all available CPU threads
        '-y', // Overwrite output file
        thumbnailFileName
      ])
      if (cancelled || cancelling) return
      setProgressPercent(85)

      setProgress('Reading files...')
      setProgressPercent(87)

      // Read processed files
      let compressedVideo = await ffmpeg.readFile(outputFileName)
      const thumbnail = await ffmpeg.readFile(thumbnailFileName)
      if (cancelled || cancelling) return
      
      // Check if original file is smaller and under 50MB limit
      const supabaseMaxSize = 50 * 1024 * 1024 // 50MB Supabase limit
      const originalFileSize = file.size
      
      if (originalFileSize < compressedVideo.length && originalFileSize <= supabaseMaxSize) {
        setProgress('Original file is smaller, using original...')
        setProgressPercent(88)
        
        // Use original file instead of compressed version
        compressedVideo = new Uint8Array(await file.arrayBuffer())
      } else {
        // Check if compressed video is still too large (>45MB to be safe)
        const maxCompressedSize = 45 * 1024 * 1024 // 45MB
        if (compressedVideo.length > maxCompressedSize) {
          setProgress('File still too large, applying extra compression...')
          setProgressPercent(87)
          
          // Re-compress with more aggressive settings
          await ffmpeg.exec([
            '-i', outputFileName,
            '-c:v', 'libx264',
            '-crf', '35', // Higher CRF for more compression
            '-preset', 'ultrafast',
            '-tune', 'fastdecode',
            '-c:a', 'aac',
            '-b:a', '64k', // Lower audio bitrate
            '-movflags', '+faststart',
            '-threads', '0',
            '-y', // Overwrite
            'output2.mp4'
          ])
          
          const recompressedVideo = await ffmpeg.readFile('output2.mp4')
          if (recompressedVideo.length <= maxCompressedSize) {
            // Use the more compressed version
            compressedVideo = recompressedVideo
          }
          // If still too large, proceed anyway and let Supabase handle the error
        }
      }
      
      setProgressPercent(90)

      // Upload to Cloudflare R2
      const videoFileName = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}.mp4`
      const thumbnailFileName_final = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}_thumb.jpg`
      
      const videoPath = `${user.id}/${videoFileName}`
      const thumbnailPath = `${user.id}/${thumbnailFileName_final}`

      setProgress('Uploading video to Cloudflare R2...')
      // Upload video to R2
      const videoArray = new Uint8Array(compressedVideo as unknown as ArrayBuffer)
      await uploadFile(videoPath, videoArray, 'video/mp4')
      if (cancelled || cancelling) return
      setProgressPercent(92)

      setProgress('Uploading thumbnail to R2...')
      // Upload thumbnail to R2
      const thumbnailArray = new Uint8Array(thumbnail as unknown as ArrayBuffer)
      await uploadFile(thumbnailPath, thumbnailArray, 'image/jpeg')
      if (cancelled || cancelling) return
      setProgressPercent(95)

      setProgress('Saving metadata...')

      // Generate share token
      const shareToken = crypto.randomUUID()

      // Save to database with user info
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          filename: file.name,
          storage_path: videoPath,
          thumbnail_path: thumbnailPath,
          original_size: file.size,
          compressed_size: compressedVideo.length,
          share_token: shareToken,
          user_name: user.user_metadata?.full_name || 'Anonymous User',
          user_avatar_url: user.user_metadata?.avatar_url || null
        })

      if (dbError) throw dbError
      if (cancelled || cancelling) return

      setProgress('Upload complete!')
      setProgressPercent(100)
      showToast('Video uploaded successfully!', 'success')
      onUploadComplete()
      
      // Clean up FFmpeg filesystem
      try {
        await ffmpeg.deleteFile('input.' + file.name.split('.').pop())
        await ffmpeg.deleteFile('output.mp4')
        await ffmpeg.deleteFile('thumbnail.jpg')
      } catch (e) {
        // Ignore cleanup errors
      }
      
    } catch (error) {
      if (!cancelled && !cancelling) {
        console.error('Upload failed:', error)
        setProgress('Upload failed. Please try again.')
        setProgressPercent(0)
        showToast('Upload failed. Please try again.', 'error', 5000)
      }
    } finally {
      setUploading(false)
      setCancelling(false)
      ffmpegRef.current = null
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file && !uploading && !cancelling) {
      setCancelled(false) // Reset cancelled state for new upload
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors min-h-[300px] flex flex-col justify-center ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-gray-600 hover:border-gray-500'
        } ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!uploading && !cancelling) {
            setCancelled(false) // Reset cancelled state when clicking upload area
            fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
          className="hidden"
          disabled={uploading}
        />
        
        {!uploading ? (
          <>
            <div className="text-gray-400 mb-6">
              <svg className="mx-auto h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-300 mb-3 text-lg">Drop video here or click to browse</p>
            <p className="text-gray-500 text-sm mb-2">MP4, MOV, AVI, etc.</p>
            <p className="text-gray-400 text-sm">Max file size: 200MB</p>
          </>
        ) : (
          <div className="text-gray-300">
            <div className="mb-4">
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div 
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>{progress}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {uploading && (
        <div className="mt-4">
          <button
            onClick={cancelUpload}
            disabled={cancelling}
            className={`w-full px-4 py-2 text-white text-sm rounded transition-colors ${
              cancelling 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-red-600 hover:bg-red-700 cursor-pointer'
            }`}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Upload'}
          </button>
        </div>
      )}
    </div>
  )
}