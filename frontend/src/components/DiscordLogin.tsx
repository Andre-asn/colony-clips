import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ImageSlideshow } from './ImageSlideshow'

export function DiscordLogin() {
  const { signInWithDiscord } = useAuth()
  const [loading, setLoading] = useState(false)

  // Define image paths
  const leftImages = [
    '/left/IMG_5619.PNG',
    '/left/IMG_8483.jpg'
  ]
  
  const rightImages = [
    '/right/442DA714-BDDB-455E-B88F-981EE661DD4B.jpg',
    '/right/makar chad.png'
  ]

  const handleDiscordLogin = async () => {
    try {
      setLoading(true)
      await signInWithDiscord()
    } catch (error) {
      console.error('Login failed:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#2f3136] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}></div>
      </div>
      
      {/* Left slideshow - centered between login box and left edge */}
      <div className="absolute left-1/4 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[36rem] z-10">
        <ImageSlideshow 
          images={leftImages} 
          className="w-full h-full"
          duration={5000}
          delay={0}
        />
      </div>
      
      {/* Right slideshow - centered between login box and right edge */}
      <div className="absolute right-1/4 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-[32rem] h-[36rem] z-10">
        <ImageSlideshow 
          images={rightImages} 
          className="w-full h-full"
          duration={5000}
          delay={2500}
        />
      </div>
      
      {/* Main modal */}
      <div className="relative z-20 bg-[#36393f] rounded-lg p-8 w-full max-w-md shadow-2xl border border-[#202225]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Colony Clips</h1>
          <p className="text-[#8e9297]">Sign in to upload and manage your clips</p>
        </div>
        
        <button
          onClick={handleDiscordLogin}
          disabled={loading}
          className="w-full py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <img 
            src="/discord-outline-svgrepo-com.svg" 
            alt="Discord" 
            className="w-6 h-6 filter brightness-0 invert"
          />
          {loading ? 'Signing in...' : 'Continue with Discord'}
        </button>
      </div>
    </div>
  )
}