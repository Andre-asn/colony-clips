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
      // Check against the invite_codes table
      const { data, error } = await supabase
        .from('invite_codes')
        .select('code')
        .eq('code', inputCode.toLowerCase())
        .is('used_by_user_id', null)
        .single()

      if (error || !data) {
        return false
      }

      // Valid code found
      localStorage.setItem(STORAGE_KEY, 'true')
      setHasValidSecret(true)
      return true
    } catch (error) {
      console.error('Error validating secret:', error)
      return false
    }
  }

  return {
    hasValidSecret,
    loading,
    validateSecret
  }
}