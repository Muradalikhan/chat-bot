"use client"
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Copy, Check } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const copyToClipboard = async (text: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCodeId(codeId)
      setTimeout(() => setCopiedCodeId(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Add streaming message placeholder
    const streamingMessageId = (Date.now() + 1).toString()
    const streamingMessage: Message = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }
    setMessages(prev => [...prev, streamingMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let accumulatedContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.content) {
                  accumulatedContent += data.content
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === streamingMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  )
                }

                if (data.done) {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === streamingMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  )
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev =>
        prev.map(msg =>
          msg.id === streamingMessageId
            ? { ...msg, content: 'Sorry, something went wrong. Please try again.', isStreaming: false }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessage = (content: string) => {
    // Split content into lines for processing
    const lines = content.split('\n')
    const formattedLines: React.ReactElement[] = []
    let codeBlockId = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for code blocks (```code```)
      if (line.trim().startsWith('```')) {
        const codeId = `code-${Date.now()}-${codeBlockId++}`
        let codeContent = ''
        let language = ''

        // Extract language if specified
        const langMatch = line.match(/```(\w+)?/)
        if (langMatch && langMatch[1]) {
          language = langMatch[1]
        }

        // Collect code content until closing ```
        i++
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeContent += lines[i] + '\n'
          i++
        }

        formattedLines.push(
          <div key={codeId} className="my-4">
            <div className="bg-slate-800 rounded-t-lg px-4 py-2 flex items-center justify-between">
              <span className="text-slate-300 text-sm font-mono">
                {language || 'code'}
              </span>
              <button
                onClick={() => copyToClipboard(codeContent.trim(), codeId)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {copiedCodeId === codeId ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-b-lg overflow-x-auto text-sm font-mono">
              <code>{codeContent.trim()}</code>
            </pre>
          </div>
        )
        continue
      }

      // Check for headers (# Header)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        const level = headerMatch[1].length
        const text = headerMatch[2]
        const className = level === 1 ? 'text-2xl font-bold text-slate-900' :
          level === 2 ? 'text-xl font-bold text-slate-800' :
            level === 3 ? 'text-lg font-semibold text-slate-700' :
              'text-base font-semibold text-slate-600'

        // Create header element based on level
        const headerElement = level === 1 ? (
          <h1 key={`header-${i}`} className={`${className} mt-4 mb-2`}>{text}</h1>
        ) : level === 2 ? (
          <h2 key={`header-${i}`} className={`${className} mt-4 mb-2`}>{text}</h2>
        ) : level === 3 ? (
          <h3 key={`header-${i}`} className={`${className} mt-4 mb-2`}>{text}</h3>
        ) : level === 4 ? (
          <h4 key={`header-${i}`} className={`${className} mt-4 mb-2`}>{text}</h4>
        ) : level === 5 ? (
          <h5 key={`header-${i}`} className={`${className} mt-4 mb-2`}>{text}</h5>
        ) : (
          <h6 key={`header-${i}`} className={`${className} mt-4 mb-2`}>{text}</h6>
        )

        formattedLines.push(headerElement)
        continue
      }

      // Check for inline code (`code`)
      if (line.includes('`')) {
        const parts = line.split(/(`[^`]+`)/)
        const formattedParts = parts.map((part, index) => {
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code key={index} className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">
                {part.slice(1, -1)}
              </code>
            )
          }
          return part
        })

        if (formattedParts.length > 1) {
          formattedLines.push(
            <span key={`inline-${i}`} className="inline">
              {formattedParts}
            </span>
          )
          continue
        }
      }

      // Check for bold text (**bold** or __bold__)
      if (line.includes('**') || line.includes('__')) {
        const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/)
        const formattedParts = parts.map((part, index) => {
          if ((part.startsWith('**') && part.endsWith('**')) ||
            (part.startsWith('__') && part.endsWith('__'))) {
            return (
              <strong key={index} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            )
          }
          return part
        })

        if (formattedParts.length > 1) {
          formattedLines.push(
            <span key={`bold-${i}`} className="inline">
              {formattedParts}
            </span>
          )
          continue
        }
      }

      // Regular text
      if (line.trim()) {
        formattedLines.push(
          <span key={`text-${i}`}>
            {line}
          </span>
        )
      } else {
        formattedLines.push(<br key={`br-${i}`} />)
      }
    }

    return formattedLines
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">AI Assistant</h1>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-200px)] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Bot className="w-12 h-12 mb-4 text-slate-300" />
                <h3 className="text-lg font-medium mb-2">How can I help you today?</h3>
                <p className="text-sm text-center max-w-md">
                  I'm here to assist you with any questions, tasks, or creative projects you might have.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 ml-3'
                        : 'bg-gradient-to-r from-slate-600 to-slate-700 mr-3'
                      }`}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl max-w-[95%] ${message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                      }`}>
                      <div className="text-sm leading-relaxed">
                        {formatMessage(message.content)}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-6">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="w-full resize-none h-fit border text-black border-slate-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32"
                  style={{ minHeight: '60px' }}
                />
                <div className="absolute right-3 bottom-3 text-xs text-slate-400">
                  Enter to send, Shift+Enter for new line
                </div>
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-blue-500 mb-2 to-blue-600 text-white p-3 rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
