
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { AppContextType, ChatMessage, GroundingSource } from '../types';
import { sendMessageInChatStream, startChat, extractSources, generateTextWithSearch } from '../services/geminiService';
import { Chat, GenerateContentResponse, Part, Content } from "@google/genai";
import Button from './shared/Button';
import Input from './shared/Input';
import LoadingSpinner from './shared/LoadingSpinner';
import { Send, X, Maximize2, Minimize2, Trash2, Bot, Search, ChevronDown, ChevronUp, Move, CornerDownRight, Paperclip } from 'lucide-react';
import { CHATBOT_SYSTEM_INSTRUCTION, RAW_COLOR_VALUES } from '../constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Element } from 'hast';

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  isMaximized: boolean; // Prop from App.tsx for true fullscreen
  onToggleMaximize: () => void; // Prop from App.tsx
}

interface CustomCodeProps {
  node: Element;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 600;
const HEADER_HEIGHT_APPROX = 56; // For collapsed state
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;
const CHAT_HISTORY_KEY = 'chatbotHistory';
const MAX_HISTORY_MESSAGES = 50;

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, isMaximized, onToggleMaximize }) => {
  const { theme, processedData, apiKey, reduceMotion } = useContext(AppContext) as AppContextType;
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  
  const [isUiMinimized, setIsUiMinimized] = useState(false); 

  const [position, setPosition] = useState({ x: window.innerWidth - DEFAULT_WIDTH - 30, y: window.innerHeight - DEFAULT_HEIGHT - 30 });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatWindowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [reduceMotion]);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const loadChatHistory = () => {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    const initialSystemMessage: ChatMessage = { 
        id: 'initial', 
        role: 'system', 
        text: "Hello! I'm MasYunAI.. How can I assist you today? Silahkan kamu bisa bertanya apa saja!", 
        timestamp: new Date() 
    };

    if (savedHistory) {
      try {
        const parsedHistory: ChatMessage[] = JSON.parse(savedHistory).map((msg: ChatMessage) => ({
          ...msg,
          timestamp: new Date(msg.timestamp) // Ensure timestamp is a Date object
        }));
        if (parsedHistory.length > 0) {
            setMessages(parsedHistory);
        } else {
            setMessages([initialSystemMessage]);
        }
      } catch (error) {
        console.error("Failed to parse chat history from localStorage:", error);
        setMessages([initialSystemMessage]);
      }
    } else {
      setMessages([initialSystemMessage]);
    }
  };
  
  const saveChatHistory = (currentMessages: ChatMessage[]) => {
    // Keep only the last MAX_HISTORY_MESSAGES, excluding system messages from this limit if desired
    const messagesToSave = currentMessages.slice(-MAX_HISTORY_MESSAGES);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messagesToSave));
  };

  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);


  const initializeChat = useCallback(() => {
    if (apiKey) {
      const newChatInstance = startChat(CHATBOT_SYSTEM_INSTRUCTION);
      setChat(newChatInstance);
      loadChatHistory(); // Load history on init
    }
  }, [apiKey]); // Removed loadChatHistory from deps, it's called within

  useEffect(() => {
    initializeChat();
  }, [apiKey, initializeChat]);

  useEffect(() => {
    if (isMaximized) {
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setIsUiMinimized(false); 
    } else {
      setSize({ width: DEFAULT_WIDTH, height: isUiMinimized ? HEADER_HEIGHT_APPROX : DEFAULT_HEIGHT });
      setPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, window.innerWidth - (size.width || DEFAULT_WIDTH))),
        y: Math.max(0, Math.min(prev.y, window.innerHeight - (size.height || DEFAULT_HEIGHT)))
      }));
    }
  }, [isMaximized, isUiMinimized]);

   useEffect(() => {
    if (!isMaximized) { 
        setSize(prevSize => ({
            ...prevSize,
            height: isUiMinimized ? HEADER_HEIGHT_APPROX : (prevSize.height < MIN_HEIGHT && prevSize.height !== HEADER_HEIGHT_APPROX ? DEFAULT_HEIGHT : prevSize.height)
        }));
    }
  }, [isUiMinimized, isMaximized]);

  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMaximized || (e.target as HTMLElement).closest('button')) return; 
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    e.preventDefault(); 
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMaximized) return;
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        let newX = e.clientX - dragStart.x;
        let newY = e.clientY - dragStart.y;
        newX = Math.max(0, Math.min(newX, window.innerWidth - size.width));
        newY = Math.max(0, Math.min(newY, window.innerHeight - size.height));
        setPosition({ x: newX, y: newY });
      }
      if (isResizing) {
        const newWidth = Math.max(MIN_WIDTH, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(isUiMinimized ? HEADER_HEIGHT_APPROX : MIN_HEIGHT, resizeStart.height + (e.clientY - resizeStart.y));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, isResizing, resizeStart, size.width, size.height, isUiMinimized]);


  const handleClearChat = () => {
    initializeChat(); // This will load the initial system message
    localStorage.removeItem(CHAT_HISTORY_KEY); // Clear from localStorage
    setInputValue('');
    setAttachedFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(false);
  };

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Only image files can be attached to chat messages for now.');
        setAttachedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setAttachedFile(file);
    } else {
      setAttachedFile(null);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = useCallback(async () => {
    if ((!inputValue.trim() && !attachedFile) || !chat) return;

    const userMessageText = inputValue;
    const userMessageId = Date.now().toString();
    
    let displayText = userMessageText;
    if (attachedFile) {
      displayText += `\n📎 [Attached: ${attachedFile.name}]`;
    }
    const userInputMessage: ChatMessage = { id: userMessageId, role: 'user', text: displayText, timestamp: new Date() };
    setMessages(prev => [...prev, userInputMessage]);
    
    setInputValue('');
    const currentFile = attachedFile; 
    setAttachedFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";

    setIsLoading(true);

    let promptTextForAI = userMessageText;
    if (processedData && !currentFile) {
      let dataContextString = `\n\n--- Current Data Context ---\n`;
      dataContextString += `File: ${processedData.fileName}\n`;
      if (processedData.sheetName) {
        dataContextString += `Sheet: ${processedData.sheetName}\n`;
      }
      if (processedData.headers && processedData.headers.length > 0) {
        dataContextString += `Headers: ${processedData.headers.join(', ')}\n`;
      }
      dataContextString += `Number of rows: ${processedData.data.length}\n`;

      if (processedData.data.length > 0) {
        const sampleData = processedData.data.slice(0, Math.min(3, processedData.data.length));
        try {
          dataContextString += `First few rows (sample):\n${JSON.stringify(sampleData, null, 2)}\n`;
        } catch (e) {
          dataContextString += `First few rows (sample): Unable to stringify sample.\n`;
        }
      }
      dataContextString += `--- End Data Context ---\n`;
      promptTextForAI += dataContextString;
    }
    
    try {
      const messageParts: Part[] = [{ text: promptTextForAI }];

      if (currentFile) { 
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(currentFile);
        });
        messageParts.push({
          inlineData: {
            mimeType: currentFile.type || 'application/octet-stream', 
            data: base64Data,
          },
        });
      }
      
      const effectiveUseGoogleSearch = useGoogleSearch && !currentFile; 

      if (effectiveUseGoogleSearch) {
        const response: GenerateContentResponse = await generateTextWithSearch(promptTextForAI);
        const sources = extractSources(response);
        const aiResponseMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response.text,
          timestamp: new Date(),
          sources: sources,
        };
        setMessages(prev => [...prev, aiResponseMessage]);
      } else {
        const stream = await chat.sendMessageStream({ message: messageParts }); 
        let fullText = "";
        let currentMessageId = (Date.now() + 1).toString();
        let accumulatedSources: GroundingSource[] = []; 
        
        setMessages(prev => [...prev, { id: currentMessageId, role: 'model', text: "Thinking...", timestamp: new Date() }]);

        for await (const chunk of stream) {
          fullText += chunk.text;
          const chunkSources = extractSources(chunk); 
          if (chunkSources.length > 0) {
            accumulatedSources.push(...chunkSources);
            accumulatedSources = Array.from(new Set(accumulatedSources.map(s => s.uri)))
                                    .map(uri => accumulatedSources.find(s => s.uri === uri)!);
          }
          
          setMessages(prev => prev.map(msg => 
            msg.id === currentMessageId ? { ...msg, text: fullText + (chunk.text ? "..." : ""), sources: [...accumulatedSources] } : msg
          ));
        }
         setMessages(prev => prev.map(msg => 
            msg.id === currentMessageId ? { ...msg, text: fullText, sources: [...accumulatedSources] } : msg
          ));
      }
    } catch (error: any) {
      console.error("Chatbot error:", error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        text: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, attachedFile, chat, processedData, useGoogleSearch, apiKey]);

  if (!isOpen) return null;

  const darkUiColorForHeader = RAW_COLOR_VALUES[theme.darkBg] || '#0A0F1E'; 
  const headerGradient = `bg-gradient-to-r from-${theme.accent1} via-${theme.accent2} to-${theme.accent3}`;
  
  const chatWindowStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '1rem',
    overflow: 'hidden',
    boxShadow: `0 10px 25px -5px ${RAW_COLOR_VALUES[theme.accent1]}40, 0 8px 10px -6px ${RAW_COLOR_VALUES[theme.accent1]}20`,
    border: `2px solid ${RAW_COLOR_VALUES[theme.accent1]}80`,
    transition: (isMaximized && !reduceMotion) ? 'width 0.3s ease, height 0.3s ease, left 0.3s ease, top 0.3s ease' : 'none',
    zIndex: 110,
  };

  return (
    <div ref={chatWindowRef} style={chatWindowStyle} className={`${theme.cardBg}`}>
      <div
        className={`${headerGradient} p-3 select-none flex items-center justify-between ${!isMaximized ? 'cursor-move' : ''} relative z-10`}
        style={{ height: `${HEADER_HEIGHT_APPROX}px`, color: darkUiColorForHeader }}
        onMouseDown={handleDragMouseDown}
        onDoubleClick={onToggleMaximize} 
      >
        <div className="flex items-center space-x-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-black/20`}>
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 id="chatbot-title" className="font-semibold text-md">MasYunAI</h3>
          </div>
        </div>
        <div className="flex items-center space-x-0.5">
          <Button
            variant="ghost"
            size="sm" 
            onClick={handleClearChat}
            title="Clear Chat"
            aria-label="Clear chat history"
            className="p-2 hover:bg-black/10" style={{ color: darkUiColorForHeader }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm" 
            onClick={onToggleMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore chatbot window" : "Maximize chatbot window"}
            className="p-2 hover:bg-black/10" style={{ color: darkUiColorForHeader }}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm" 
            onClick={() => setIsUiMinimized(!isUiMinimized)} 
            title={isUiMinimized ? "Expand chat" : "Collapse chat"}
            aria-label={isUiMinimized ? "Expand chat content" : "Collapse chat content"}
            className="p-2 hover:bg-black/10" style={{ color: darkUiColorForHeader }}
          >
            {isUiMinimized ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm" 
            onClick={onClose}
            title="Close chatbot"
            aria-label="Close chatbot"
            className="p-2 hover:bg-black/10" style={{ color: darkUiColorForHeader }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {!isUiMinimized && (
        <>
          <div 
            className={`flex-grow p-4 space-y-3 overflow-y-auto futuristic-scrollbar bg-${theme.darkGray}/30 backdrop-blur-sm`}
            role="log"
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`
                    max-w-[85%] p-3 rounded-xl shadow-md text-sm break-words
                    ${msg.role === 'user' ? `bg-gradient-to-br from-${theme.accent1} to-${theme.accent2} text-white rounded-br-none` : ''}
                    ${msg.role === 'model' ? `${theme.cardBg} ${theme.textColor} rounded-bl-none border ${theme.borderColor} max-h-[350px] overflow-y-auto futuristic-scrollbar` : 'overflow-hidden'}
                    ${msg.role === 'system' ? `bg-transparent border border-dashed ${theme.borderColor} ${theme.textColor} opacity-80 w-full text-center italic py-2 overflow-hidden` : ''}
                  `}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className={`text-${theme.accent3} hover:underline`} />,
                    p: ({node, ...props}) => <p {...props} className="mb-1 last:mb-0" />,
                    ul: ({node, ...props}) => <ul {...props} className="list-disc list-inside ml-4 my-1" />,
                    ol: ({node, ...props}) => <ol {...props} className="list-decimal list-inside ml-4 my-1" />,
                    code: ({ node, inline, className, children, ...rest }: CustomCodeProps) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                             <pre className={`p-2 my-1 bg-${theme.darkBg} rounded-md overflow-x-auto futuristic-scrollbar text-xs ${theme.textColor} `}><code className={className} {...rest}>{children}</code></pre>
                        ) : (
                            <code className={`px-1 py-0.5 bg-${theme.mediumGray} rounded text-xs ${className || ''}`} {...rest}>{children}</code>
                        );
                    }
                  }}>
                    {msg.text}
                  </ReactMarkdown>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className={`mt-2 pt-2 border-t border-${theme.mediumGray}/50`}>
                      <p className={`text-xs font-semibold opacity-70 mb-1 ${theme.textColor}`}>Sources:</p>
                      <ul className="space-y-1">
                        {msg.sources.map((source, index) => (
                          <li key={index} className="text-xs opacity-90">
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className={`hover:underline text-${theme.accent4}`}>
                              {source.title || source.uri}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                   <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/70 text-right' : `${theme.textColor} opacity-50 text-left`}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length -1]?.role !== 'model' && (
                <div className="flex justify-start">
                    <div className={`${theme.cardBg} ${theme.textColor} p-3 rounded-xl shadow-md text-sm rounded-bl-none border ${theme.borderColor}`}>
                        <LoadingSpinner size="sm" />
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={`p-3 bg-${theme.darkBg}/80 border-t border-${theme.accent1}/30`}>
            {attachedFile && (
              <div className={`mb-2 p-1.5 bg-${theme.mediumGray}/30 rounded text-xs flex justify-between items-center`}>
                <span className="truncate">📎 {attachedFile.name}</span>
                <Button variant="ghost" size="sm" onClick={handleRemoveAttachment} className="!p-0.5 !text-red-400 hover:!text-red-500">
                  <X size={12} />
                </Button>
              </div>
            )}
            <div className="flex space-x-2 items-center">
              <input type="file" ref={fileInputRef} onChange={handleFileAttach} accept="image/*" style={{ display: 'none' }} />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                variant="ghost"
                size="sm"
                className={`p-2.5 aspect-square hover:bg-${theme.mediumGray}/50`}
                title="Attach image"
                aria-label="Attach image"
              >
                <Paperclip className={`h-5 w-5 text-${theme.accent3}`} />
              </Button>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isLoading ? "AI is responding..." : "Ask me anything..."}
                className={`flex-grow`}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                disabled={isLoading}
                aria-label="Chat message input"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || (!inputValue.trim() && !attachedFile)}
                className={`bg-gradient-to-r from-${theme.accent3} to-${theme.accent4} text-white hover:shadow-neon-glow-${theme.accent3} p-2.5 aspect-square`}
                style={{color: darkUiColorForHeader}}
                aria-label="Send message"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
             <div className="mt-2 flex items-center justify-end">
                <label htmlFor="useGoogleSearch" className="flex items-center cursor-pointer text-xs mr-1">
                    <input
                        type="checkbox"
                        id="useGoogleSearch"
                        checked={useGoogleSearch && !attachedFile} 
                        onChange={(e) => setUseGoogleSearch(e.target.checked)}
                        className={`form-checkbox h-3.5 w-3.5 rounded border focus:ring-offset-0 focus:ring-2`}
                        style={{
                           backgroundColor: RAW_COLOR_VALUES[theme.darkGray],
                           borderColor: RAW_COLOR_VALUES[theme.mediumGray],
                           color: RAW_COLOR_VALUES[theme.accent1],
                           accentColor: RAW_COLOR_VALUES[theme.accent1]
                        }}
                        disabled={isLoading || !!attachedFile} 
                    />
                    <Search size={12} className={`mr-1 text-${theme.accent3} ${!!attachedFile ? 'opacity-50': ''}`} /> 
                    <span className={`${theme.textColor} opacity-80 ${!!attachedFile ? 'opacity-50': ''}`}>Use Google Search</span>
                </label>
            </div>
          </div>
        </>
      )}

      {!isMaximized && !isUiMinimized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeMouseDown}
          title="Resize chat"
        >
            <CornerDownRight size={16} className={`text-${theme.accent1} transform rotate-90`} />
        </div>
      )}
    </div>
  );
};

export default Chatbot;
