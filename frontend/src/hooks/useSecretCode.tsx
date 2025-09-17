import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'colony_secret_validated'

export function useSecretCode() {
  const [hasValidSecret, setHasValidSecret] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setHasValidSecret(stored === 'true')
    setLoading(false)
  }, [])

  const validateSecret = async (inputCode: string): Promise<boolean> => {
    try {
      console.log('Validating secret code:', inputCode)
      
      // First, let's try a simple query to see if the table is accessible
      const { data, error } = await supabase
        .from('invite_codes')
        .select('code, used_by_user_id')
        .eq('code', inputCode.toLowerCase())
        .is('used_by_user_id', null)

      console.log('Query result:', { data, error })

      if (error) {
        console.error('Supabase error:', error)
        return false
      }

      // Check if we found a valid unused code
      if (!data || data.length === 0) {
        console.log('No valid codes found')
        return false
      }

      console.log('Valid code found!')
      // Valid code found
      localStorage.setItem(STORAGE_KEY, 'true')
      setHasValidSecret(true)
      return true
    } catch (error) {
      console.error('Error validating secret:', error)
      return false
    }
  }

  const clearSecret = () => {
    localStorage.removeItem(STORAGE_KEY)
    setHasValidSecret(false)
  }

  return {
    hasValidSecret,
    loading,
    validateSecret,
    clearSecret
  }
}