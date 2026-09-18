const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'GoogleOther',
  'Applebot-Extended',
  'Bytespider',
  'Amazonbot',
  'Meta-ExternalAgent',
  'cohere-ai',
  'YouBot',
  'Kimi-Reader',
  'DuckAssistBot',
]

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  const lines: string[] = []

  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`)
    lines.push('Allow: /')
    lines.push('')
  }

  lines.push('User-agent: *')
  lines.push('Allow: /')
  lines.push('')
  lines.push(`Sitemap: ${siteUrl}/sitemap.xml`)

  return lines.join('\n')
})
