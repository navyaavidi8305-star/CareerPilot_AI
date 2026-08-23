import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus, MessageSquare, Search, Archive, Trash2, Sparkles, Bot, User, StopCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { getChats, createChat, sendMessage, deleteChat, archiveChat, searchChats } from '../services/chat';
import { Chat, ChatMessage } from '../types';
import { formatDate, formatTime, cn } from '../lib/utils';
import api from '../services/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const subjects = [
  { label: 'Career Guidance', icon: '🎯' },
  { label: 'Resume Tips', icon: '📄' },
  { label: 'Interview Prep', icon: '🎤' },
  { label: 'Skill Dev', icon: '🧠' },
  { label: 'Job Search', icon: '💼' },
  { label: 'Salary Talk', icon: '💰' },
];

function getConfidence(msg: ChatMessage): number | null {
  if (typeof msg.confidence === 'number') return msg.confidence;
  if (!msg.metadata) return null;
  try {
    const meta = JSON.parse(msg.metadata);
    return typeof meta.confidence === 'number' ? meta.confidence : null;
  } catch {
    return null;
  }
}

function ConfidenceBadge({ value }: { value: number }) {
  const config = value >= 80
    ? { color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'High accuracy' }
    : value >= 50
      ? { color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', label: 'Verify details' }
      : { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Low reliability' };
  return (
    <span
      title={`AI self-audit score: ${value}/100. ${config.label}.`}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${config.color}`}
    >
      <ShieldCheck className="w-3 h-3" /> {value}% {config.label}
    </span>
  );
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchChats = useCallback(async () => {
    try {
      const data = await getChats();
      setChats(data);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleNewChat = async () => {
    try {
      const chat = await createChat({ title: 'New Chat' });
      setChats(prev => [chat, ...prev]);
      setActiveChat(chat);
      setMessages(chat.messages || []);
    } catch {
      toast.error('Failed to create chat');
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    abortRef.current?.abort();
    setSending(false);
    setStreamingContent('');
    setActiveChat(chat);
    setMessages(chat.messages || []);
  };

  const handleSend = useCallback(async (prompt?: string) => {
    const msg = prompt || input;
    if (!msg.trim() || !activeChat) return;

    setSending(true);
    setStreamingContent('');
    const userMsg = msg;
    if (!prompt) setInput('');

    const userMessage: ChatMessage = {
      id: 'temp-' + Date.now(),
      chatId: activeChat.id,
      role: 'USER',
      content: userMsg,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    const token = localStorage.getItem('token');
    let fullResponse = '';

    try {
      const response = await fetch(`/api/chat/${activeChat.id}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: userMsg }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'token') {
                fullResponse += data.token;
                setStreamingContent(fullResponse);
              } else if (data.type === 'done') {
                const aiMsg: ChatMessage = data.message;
                setMessages(prev => [...prev, aiMsg]);
                setStreamingContent('');
                fetchChats();
              } else if (data.type === 'error') {
                toast.error('Stream error');
                setStreamingContent('');
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (fullResponse) {
          try {
            const result = await sendMessage(activeChat.id, userMsg);
            setMessages(prev => prev.filter(m => m.id !== userMessage.id));
            setMessages(prev => [...prev, result.userMessage, result.aiMessage]);
          } catch { /* ignore */ }
        }
      } else {
        try {
          const result = await sendMessage(activeChat.id, userMsg);
          setMessages(prev => prev.filter(m => m.id !== userMessage.id));
          setMessages(prev => [...prev, result.userMessage, result.aiMessage]);
        } catch {
          toast.error('Failed to send message');
        }
      }
      setStreamingContent('');
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [activeChat, input, fetchChats]);

  const handleStop = () => {
    abortRef.current?.abort();
    setSending(false);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteChat(id);
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChat?.id === id) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveChat(id);
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChat?.id === id) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch {
      toast.error('Failed to archive chat');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { fetchChats(); return; }
    try {
      const results = await searchChats(searchQuery);
      setChats(results);
    } catch { console.error('Search failed'); }
  };

  const handleRename = async (chatId: string) => {
    try {
      await api.put(`/chat/${chatId}`, { title: editTitle });
      fetchChats();
      setEditingTitle(null);
    } catch { toast.error('Failed to rename'); }
  };

  const getCategoryColor = (cat?: string) => {
    const colors: Record<string, string> = {
      CAREER: 'bg-blue-500/10 text-blue-400',
      PLACEMENT: 'bg-green-500/10 text-green-400',
      INTERVIEW: 'bg-purple-500/10 text-purple-400',
      RESUME: 'bg-orange-500/10 text-orange-400',
      LEARNING: 'bg-pink-500/10 text-pink-400',
    };
    return colors[cat || ''] || 'bg-secondary text-muted-foreground';
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-4 lg:-m-6">
      <div className="w-72 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <Button onClick={handleNewChat} className="w-full gap-2" size="sm">
            <Plus className="w-4 h-4" /> New Chat
          </Button>
          <div className="flex gap-1">
            <Input
              placeholder="Search chats..."
              className="h-8 text-xs"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSearch}>
              <Search className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground text-sm">No chats yet</div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                className={cn(
                  'p-2 rounded-lg cursor-pointer text-sm hover:bg-secondary/50 transition-colors group',
                  activeChat?.id === chat.id ? 'bg-primary/10 border border-primary/20' : ''
                )}
                onClick={() => handleSelectChat(chat)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                    {editingTitle === chat.id ? (
                      <input
                        className="flex-1 bg-transparent border-b border-primary text-xs outline-none"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => handleRename(chat.id)}
                        onKeyDown={e => e.key === 'Enter' && handleRename(chat.id)}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="truncate flex-1"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(chat.id); setEditTitle(chat.title || ''); }}
                      >
                        {chat.title || 'Untitled'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); handleArchive(chat.id); }} className="p-1 hover:bg-secondary rounded"><Archive className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(chat.id); }} className="p-1 hover:bg-destructive/20 rounded text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-[10px] px-1.5 py-0 ${getCategoryColor(chat.category)}`}>
                    {chat.category || 'GENERAL'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            <div className="p-3 border-b border-border flex items-center gap-3 bg-card/50 backdrop-blur-sm">
              <Bot className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activeChat.title}</p>
                <p className="text-xs text-muted-foreground">{messages.length} messages</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'AI' ? '' : 'flex-row-reverse')}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    msg.role === 'AI' ? 'bg-primary/20' : 'bg-secondary'
                  )}>
                    {msg.role === 'AI' ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl p-3 text-sm',
                    msg.role === 'AI'
                      ? 'bg-secondary/50 border border-border rounded-bl-sm'
                      : 'bg-primary/20 border border-primary/20 rounded-br-sm'
                  )}>
                    <div className="prose prose-sm prose-invert max-w-none break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[10px] text-muted-foreground opacity-60">{formatTime(msg.createdAt)}</p>
                      {msg.role === 'AI' && (() => {
                        const conf = getConfidence(msg);
                        return conf !== null ? <ConfidenceBadge value={conf} /> : null;
                      })()}
                    </div>
                  </div>
                </div>
              ))}

              {streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-secondary/50 border border-border rounded-2xl rounded-bl-sm p-3 text-sm max-w-[80%]">
                    <div className="prose prose-sm prose-invert max-w-none break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                    <span className="inline-block w-2 h-2 bg-primary/60 rounded-full animate-pulse ml-0.5" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border bg-card/50 backdrop-blur-sm">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    placeholder="Ask CareerPilot AI anything..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[200px]"
                    rows={1}
                    style={{ height: 'auto' }}
                    onInput={e => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
                    }}
                  />
                </div>
                {sending ? (
                  <Button size="icon" variant="destructive" onClick={handleStop} className="shrink-0 rounded-xl h-11 w-11">
                    <StopCircle className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button size="icon" onClick={() => handleSend()} disabled={!input.trim()} className="shrink-0 rounded-xl h-11 w-11">
                    <Send className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-lg w-full">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-purple-500/30 mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">CareerPilot AI</h2>
              <p className="text-muted-foreground mb-8">Your intelligent career assistant. Ask me anything.</p>
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {subjects.map((item) => (
                  <button
                    key={item.label}
                    onClick={async () => {
                      await handleNewChat();
                      const prompts: Record<string, string> = {
                        'Career Guidance': 'Help me explore career paths that match my skills and interests',
                        'Resume Tips': 'How can I make my resume stand out to recruiters?',
                        'Interview Prep': 'I have an interview coming up. Help me prepare.',
                        'Skill Dev': 'What skills should I learn to advance my career?',
                        'Job Search': 'What is the best strategy for finding a job?',
                        'Salary Talk': 'How do I negotiate my salary effectively?',
                      };
                      setTimeout(() => handleSend(prompts[item.label]), 600);
                    }}
                    className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-8">AI responses are generated in real-time. Verify important information independently.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
