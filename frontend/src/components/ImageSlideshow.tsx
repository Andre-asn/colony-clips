import { useState, useEffect } from 'react'

interface ImageSlideshowProps {
  images: string[]
  className?: string
  duration?: number
  delay?: number
}

export function ImageSlideshow({ images, className = '', duration = 5000, delay = 0 }: ImageSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (images.length <= 1) return

    const startSlideshow = () => {
      const interval = setInterval(() => {
        setIsVisible(false)
        
        setTimeout(() => {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length)
          setIsVisible(true)
        }, 500) // Half of transition duration for smooth fade
      }, duration)

      return interval
    }

    // Start slideshow after delay
    const timeout = setTimeout(() => {
      const interval = startSlideshow()
      return () => clearInterval(interval)
    }, delay)

    return () => {
      clearTimeout(timeout)
    }
  }, [images.length, duration, delay])

  if (images.length === 0) return null

  return (
    <div className={`relative ${className}`}>
      <img
        src={images[currentIndex]}
        alt={`Slide ${currentIndex + 1}`}
        className={`w-full h-full object-contain rounded-lg transition-opacity duration-1000 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
