import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';
import './component-css/ChatBot.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

/**
 * ChatBot — AI-powered geopolitical intelligence assistant.
 * Calls /api/chat with multi-provider LLM failover (Groq → Gemini).
 */
export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to GeoPulse AI Intelligence. I can analyze geopolitical events, explain cause-effect relationships, and provide risk assessments. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/chat`, {
        message: userMessage,
        history: messages.slice(-10),
      }, { timeout: 30000 });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        provider: res.data.provider,
        model: res.data.model,
      }]);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ AI service error: ${errorMsg}. Please try again.`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Toggle FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="cb-fab"
            data-testid="chatbot-toggle-btn"
          >
            <MessageCircle style={{ width: '1.25rem', height: '1.25rem' }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="cb-panel glass-panel"
            data-testid="chatbot-panel"
          >
            {/* Header */}
            <div className="cb-header">
              <div className="cb-header-left">
                <Sparkles style={{ width: '1rem', height: '1rem', color: 'var(--cat-political)' }} />
                <span className="cb-header-title">Intel Assistant</span>
                <span className="cb-header-badge">AI</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="cb-close-btn"
                data-testid="chatbot-close-btn"
              >
                <X style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>

            {/* Messages */}
            <div className="cb-messages" data-testid="chatbot-messages">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={`cb-msg-row ${msg.role === 'user' ? 'cb-msg-row--user' : 'cb-msg-row--assistant'}`}
                >
                  <div
                    className={`cb-bubble ${msg.role === 'user' ? 'cb-bubble--user' : 'cb-bubble--assistant glass-light'}`}
                    data-testid={`chat-message-${idx}`}
                  >
                    <div className="cb-bubble-content">{msg.content}</div>
                    {msg.provider && (
                      <div className="cb-bubble-provider">via {msg.provider}</div>
                    )}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="cb-typing-row">
                  <div className="cb-typing-bubble glass-light">
                    <Loader2 style={{ width: '0.875rem', height: '0.875rem', color: 'var(--cat-political)' }} className="animate-spin" />
                    <span className="cb-typing-text">Analyzing...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="cb-footer">
              <div className="cb-input-row">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about global events..."
                  className="cb-input"
                  data-testid="chatbot-input"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="cb-send-btn"
                  data-testid="chatbot-send-btn"
                >
                  {loading ? <Loader2 style={{ width: '1rem', height: '1rem' }} className="animate-spin" /> : <Send style={{ width: '1rem', height: '1rem' }} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
