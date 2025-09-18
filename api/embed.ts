import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = (req.query.token as string) || ''
    if (!token) {
      res.status(400).send('Missing token')
      return
    }

    // Fetch minimal public fields for OG tags
    // Use service role key to bypass RLS for public sharing
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : supabase
    
    const { data, error } = await supabaseAdmin
      .from('videos')
      .select('filename, thumbnail_path, storage_path, share_token, created_at')
      .eq('share_token', token)
      .maybeSingle()

    if (error || !data) {
      console.error('Error fetching video:', error)
      res.status(404).send('Not found')
      return
    }

    const siteUrl = process.env.PUBLIC_SITE_URL || 'https://colony-clips.vercel.app'
    const watchUrl = `${siteUrl}/watch/${token}`
    const title = `Colony Clips — ${data.filename}`
    const description = 'Shared with Colony Clips'

    // Thumbnail: if using R2 public URL pattern; otherwise you may generate a signed URL server-side
    const r2Endpoint = process.env.R2_ENDPOINT
    const r2Bucket = process.env.R2_BUCKET_NAME
    const imageUrl = data.thumbnail_path && r2Endpoint && r2Bucket
      ? `${r2Endpoint}/${r2Bucket}/${data.thumbnail_path}`
      : `${siteUrl}/og-default.png`

    // Simple HTML with Open Graph and Twitter tags so Discord unfurls
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta property="og:type" content="video.other" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${watchUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="Colony Clips" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta http-equiv="refresh" content="0; url=${watchUrl}" />
  </head>
  <body>
    <a href="${watchUrl}">Open video</a>
  </body>
</html>`)
  } catch (e) {
    res.status(500).send('Server error')
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


