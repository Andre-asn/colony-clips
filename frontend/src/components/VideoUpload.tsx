import { useState, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function VideoUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      processVideo(file)
    } else {
      alert('Please select a video file')
    }
  }

  const processVideo = async (file: File) => {
    if (!user) return

    setUploading(true)
    setProgress('Loading video processor...')
    setProgressPercent(5)

    try {
      // Create FFmpeg instance
      const ffmpeg = new FFmpeg()
      
      // Set up progress listener
      ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100)
        setProgressPercent(Math.min(percent, 70)) // Cap at 70% for compression
      })
      
      // Load FFmpeg
      await ffmpeg.load()
      setProgressPercent(10)

      setProgress('Compressing video...')
      setProgressPercent(15)
      
      // Write input file to FFmpeg filesystem
      const inputFileName = 'input.' + file.name.split('.').pop()
      const outputFileName = 'output.mp4'
      const thumbnailFileName = 'thumbnail.jpg'
      
      await ffmpeg.writeFile(inputFileName, new Uint8Array(await file.arrayBuffer()))
      setProgressPercent(20)

      // Compress video for Discord compatibility (under 25MB target)
      await ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-crf', '28',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputFileName
      ])
      setProgressPercent(70)

      // Generate thumbnail from first frame
      await ffmpeg.exec([
        '-i', inputFileName,
        '-vframes', '1',
        '-f', 'image2',
        '-vf', 'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
        thumbnailFileName
      ])
      setProgressPercent(80)

      setProgress('Uploading files...')
      setProgressPercent(85)

      // Read processed files
      const compressedVideo = await ffmpeg.readFile(outputFileName)
      const thumbnail = await ffmpeg.readFile(thumbnailFileName)

      // Upload to Supabase Storage
      const videoFileName = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}.mp4`
      const thumbnailFileName_final = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}_thumb.jpg`
      
      const videoPath = `${user.id}/${videoFileName}`
      const thumbnailPath = `${user.id}/${thumbnailFileName_final}`

      // Upload compressed video
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoPath, compressedVideo, {
          contentType: 'video/mp4'
        })

      if (videoError) throw videoError
      setProgressPercent(90)

      // Upload thumbnail
      const { error: thumbError } = await supabase.storage
        .from('videos')
        .upload(thumbnailPath, thumbnail, {
          contentType: 'image/jpeg'
        })

      if (thumbError) throw thumbError
      setProgressPercent(95)

      setProgress('Saving metadata...')

      // Generate share token
      const shareToken = crypto.randomUUID()

      // Save to database
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          filename: file.name,
          storage_path: videoPath,
          thumbnail_path: thumbnailPath,
          original_size: file.size,
          compressed_size: compressedVideo.length,
          share_token: shareToken
        })

      if (dbError) throw dbError

      setProgress('Upload complete!')
      setProgressPercent(100)
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
      console.error('Upload failed:', error)
      setProgress('Upload failed. Please try again.')
      setProgressPercent(0)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
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
    <div className="max-w-md mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-gray-600 hover:border-gray-500'
        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
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
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-300 mb-2">Drop your video here or click to browse</p>
            <p className="text-gray-500 text-sm">MP4, MOV, AVI, etc.</p>
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
    </div>
  )
}