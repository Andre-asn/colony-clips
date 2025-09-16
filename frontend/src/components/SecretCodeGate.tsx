import { useState } from 'react'
import { useSecretCode } from '../hooks/useSecretCode'

export function SecretCodeGate({ children }: { children: React.ReactNode }) {
  const { hasValidSecret, loading, validateSecret } = useSecretCode()
  const [inputCode, setInputCode] = useState('')
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2c2f33] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (hasValidSecret) {
    return <>{children}</>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidating(true)
    setError('')

    try {
      const isValid = await validateSecret(inputCode)
      if (!isValid) {
        setError('Invalid secret code')
        setInputCode('')
      }
    } catch (error) {
      setError('Failed to validate code. Please try again.')
      console.error('Validation error:', error)
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#2c2f33] flex items-center justify-center p-4">
      <div className="bg-[#36393f] rounded-lg p-8 w-full max-w-md border border-[#202225]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Colony Clips</h1>
          <p className="text-[#8e9297]">Enter the secret code to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Secret code"
              className="w-full px-4 py-3 bg-[#40444b] border border-[#202225] rounded-lg text-white placeholder-[#8e9297] focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]"
              autoFocus
              disabled={validating}
            />
          </div>
          
          {error && (
            <div className="text-[#ed4245] text-sm">{error}</div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            disabled={!inputCode.trim() || validating}
          >
            {validating ? 'Validating...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}