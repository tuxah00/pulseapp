import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  }
  return _client
}

export const ASSISTANT_MODEL = 'gpt-4o-mini'
export const ASSISTANT_MAX_TOKENS = 2048
