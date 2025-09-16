import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Video {
  id: string
  user_id: string
  filename: string
  storage_path: string
  original_size: number
  compressed_size: number
  share_token?: string
  created_at: string
}

export interface InviteCode {
  id: string
  code: string
  used_by_user_id?: string | null
  created_at: string
}