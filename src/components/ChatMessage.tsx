import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Message, ZenThemeConfig, ArtifactItem } from "../types";
import { CodeBlock } from "./CodeBlock";
import { ArtifactCard } from "./ArtifactCard";
import { extractArtifactMeta } from "../utils/artifactParser";
import { ClaudeQuestionSheet, QuestionData } from "./ClaudeQuestionSheet";
import { 
  Copy, 
  Check, 
  RotateCcw, 
  Edit3, 
  ThumbsUp, 
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Globe,
  ExternalLink,
  X,
  Lightbulb
} from "lucide-react";
import { zenAudio } from "../utils/zenAudio";
import { motion } from "motion/react";
import { getFileIcon } from "./SkeletonLoader";

interface ChatMessageProps {
  message: Message;
  theme?: ZenThemeConfig;
  onSendToChat?: (prompt: string) => void;
  onSendToScratchpad?: (code: string, lang: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (content: string, messageId?: string) => void;
  onOpenArtifact?: (artifact: ArtifactItem) => void;
}

// Lightweight Inline Thought Process Accordion (No Bottom Sheet / No Modal)
const ThoughtProcessModal: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open while streaming, but allow user to toggle
  useEffect(() => {
    if (isStreaming && !isOpen) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  if (!content || !content.trim()) return null;

  return (
    <div className="mb-4 w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 text-[14px] text-zinc-400 hover:text-zinc-200 transition-colors select-none cursor-pointer py-1.5"
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <span className="font-thai font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          กระบวนการคิด
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 pl-6 pr-4 py-2 border-l-2 border-zinc-700/50">
          <div className="text-[14.5px] leading-relaxed text-zinc-400 font-thai opacity-90 prose prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to extract <thinking> tags and question data (Claude style)
export interface ParsedMessageData {
  thinking: string;
  main: string;
  questionData: QuestionData | null;
}

export const extractThinkingMainAndQuestion = (content: string): ParsedMessageData => {
  let thinking = "";
  let main = content || "";

  // 1. Extract <thinking> tags
  if (main.includes("<thinking>")) {
    const parts = main.split("<thinking>");
    const afterThinking = parts[1] || "";
    if (afterThinking.includes("</thinking>")) {
      const thinkingParts = afterThinking.split("</thinking>");
      thinking = thinkingParts[0].trim();
      main = (parts[0] + thinkingParts.slice(1).join("</thinking>")).trim();
    } else {
      // Still streaming inside thinking tag
      thinking = afterThinking.trim();
      main = parts[0].trim();
    }
  }

  let questionData: QuestionData | null = null;

  // 2. Extract explicit <question title="..."> <option>...</option> </question>
  const questionTagRegex = /<question(?:\s+title=(?:["']([^"']*)["']|([^>\s]+)))?\s*>([\s\S]*?)<\/question>/i;
  const qMatch = questionTagRegex.exec(main);
  if (qMatch) {
    const title = (qMatch[1] || qMatch[2] || "").trim() || "เลือกขั้นตอนถัดไป";
    const inner = qMatch[3];
    const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
    const options: string[] = [];
    let optMatch;
    while ((optMatch = optionRegex.exec(inner)) !== null) {
      const text = optMatch[1].trim();
      if (text) options.push(text);
    }
    if (options.length > 0) {
      questionData = { title, options };
      main = main.replace(questionTagRegex, "").trim();
    }
  } else if (main.includes("<question")) {
    // If stream is in progress or unclosed question tag, hide it from visible markdown until closed
    const qIdx = main.indexOf("<question");
    main = main.slice(0, qIdx).trim();
  }

  return { thinking, main, questionData };
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  theme,
  onSendToChat,
  onSendToScratchpad,
  onRegenerate,
  onEditAndResend,
  onOpenArtifact,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [liked, setLiked] = useState<boolean | null>(null);

  const isAssistant = message.role === "assistant";
  
  // Extract content early to determine if we are waiting for the main response
  const { thinking, main, questionData } = isAssistant 
    ? extractThinkingMainAndQuestion(message.content)
    : { thinking: "", main: message.content, questionData: null };

  const isWaitingForMain = isAssistant && (!main || main.trim() === "");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    zenAudio.playCopyChime();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEditAndResend) {
      onEditAndResend(editContent.trim(), message.id);
      setIsEditing(false);
    }
  };

  // 1. Assistant Message
  if (isAssistant) {
    return (
      <motion.div
        id={`msg-${message.id}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex w-full justify-start items-start my-5 group"
      >
        <div className="flex-1 max-w-3xl min-w-0">
          {/* Thought Process Modal Trigger if CoT present */}
          {thinking && <ThoughtProcessModal content={thinking} isStreaming={isWaitingForMain} />}

          {/* Thinking State */}
          {isWaitingForMain ? (
            <div className="text-[15.5px] text-[#424242] font-medium py-1 animate-pulse font-sans tracking-wide">
              Thinking...
            </div>
          ) : (
            <div className="text-[16px] leading-[1.8] text-zinc-900 font-normal">
              <ReactMarkdown
                components={{
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");

                    if (match) {
                      const lines = codeString.split("\n");
                      const isOver15Lines = lines.length > 15;

                      // If over 15 lines, render as Claude-style Artifact Card with live view capability
                      if (isOver15Lines && onOpenArtifact) {
                        const artifactMeta = extractArtifactMeta(codeString, match[1]);
                        const artifact: ArtifactItem = {
                          id: `artifact-${message.id}-${artifactMeta.filename}`,
                          messageId: message.id,
                          title: artifactMeta.title,
                          filename: artifactMeta.filename,
                          language: match[1],
                          extension: artifactMeta.extension,
                          category: artifactMeta.category,
                          subtitle: artifactMeta.subtitle,
                          content: codeString,
                          lineCount: lines.length,
                          isStreaming: message.isStreaming,
                        };

                        return (
                          <ArtifactCard
                            artifact={artifact}
                            onOpen={onOpenArtifact}
                            isStreaming={message.isStreaming}
                            theme={theme}
                          />
                        );
                      }

                      return (
                        <CodeBlock
                          language={match[1]}
                          value={codeString}
                          onSendToChat={onSendToChat}
                          onSendToScratchpad={onSendToScratchpad}
                        />
                      );
                    }

                    return (
                      <code
                        className="bg-[#1e1f20] px-2 py-0.5 rounded-md text-[13.5px] font-mono text-[#8ab4f8] border border-[#333537]"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="font-thai mb-4 leading-[1.8] last:mb-0 text-zinc-100 font-normal text-[15.5px] sm:text-[16px]">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="font-thai list-disc pl-5 mb-4 space-y-2 text-zinc-100 text-[15.5px] sm:text-[16px]">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="font-thai list-decimal pl-5 mb-4 space-y-2 text-zinc-100 text-[15.5px] sm:text-[16px]">{children}</ol>;
                  },
                  li({ children }) {
                    return (
                      <li className="font-thai leading-[1.8] text-zinc-100">
                        {children}
                      </li>
                    );
                  },
                  a({ href, children }: any) {
                    if (href?.startsWith("#prompt=")) {
                      return null;
                    }
                    if (href === "#send" && onSendToChat) {
                      const promptText = typeof children === "string" ? children : String(children);
                      return (
                        <button
                          type="button"
                          onClick={() => onSendToChat(promptText)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 my-1 rounded-full bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 transition-all text-sm font-medium cursor-pointer active:scale-95"
                        >
                          <span>{children}</span>
                          <span className="text-xs text-blue-400">↵</span>
                        </button>
                      );
                    }
                    // Validate href against javascript:, data:, and malicious protocol handlers
                    const isSafeLink = typeof href === "string" && /^(https?:\/\/|mailto:|\/|#)/i.test(href) && !href.toLowerCase().startsWith("data:");
                    if (!isSafeLink) {
                      return <span className="text-zinc-400 font-mono text-sm">{children}</span>;
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-500/40 font-medium"
                      >
                        {children}
                      </a>
                    );
                  },
                  img({ src, alt }: any) {
                    const isSafeImg = typeof src === "string" && /^(https?:\/\/|data:image\/(png|jpeg|jpg|webp|gif);base64,)/i.test(src) && !src.toLowerCase().startsWith("data:image/svg");
                    if (!isSafeImg) return null;
                    return (
                      <img
                        src={src}
                        alt={alt || "Image"}
                        loading="lazy"
                        className="rounded-2xl max-w-full my-3 border border-[#1e2638] shadow-xs"
                        referrerPolicy="no-referrer"
                      />
                    );
                  },
                  h1({ children }) {
                    return <h1 className="font-prompt text-[24px] sm:text-[26px] font-bold text-white mt-6 mb-3 tracking-tight">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="font-prompt text-[20px] sm:text-[21px] font-bold text-white mt-5 mb-2.5 tracking-tight">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="font-prompt text-[17px] sm:text-[18px] font-semibold text-white mt-4 mb-2 tracking-tight">{children}</h3>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="font-thai border-l-4 border-blue-500 pl-4 my-3 italic text-zinc-200 bg-[#0c1017] py-2.5 rounded-r-xl border-y border-r border-[#1e2638]">
                        {children}
                      </blockquote>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-4 rounded-xl border border-[#1e2638] bg-[#0c1017] shadow-2xs">
                        <table className="min-w-full divide-y divide-[#1e2638] text-sm">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="px-4 py-2.5 bg-[#141926] font-semibold text-white text-left border-b border-[#1e2638]">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="px-4 py-2.5 border-t border-[#1e2638] text-zinc-200">
                        {children}
                      </td>
                    );
                  },
                }}
              >
                {main}
              </ReactMarkdown>
            </div>
          )}

          {/* Follow-up Choice Chips */}
          {!isWaitingForMain && !message.isStreaming && questionData && questionData.options && questionData.options.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-[#1e2638] flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-zinc-300 font-thai flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-xs bg-blue-500"></span>
                <span>{questionData.title || "เลือกขั้นตอนถัดไป:"}</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {questionData.options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => onSendToChat && onSendToChat(opt)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#0f131d] hover:bg-blue-600/20 border border-[#1e2638] hover:border-blue-500/50 text-xs sm:text-[13.5px] text-zinc-200 hover:text-white transition-all cursor-pointer active:scale-95 text-left font-thai group shadow-2xs"
                  >
                    <span className="w-4 h-4 rounded-xs bg-blue-950/80 group-hover:bg-blue-600 text-[10px] flex items-center justify-center text-blue-300 group-hover:text-white font-mono shrink-0 transition-colors">
                      {optIdx + 1}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Google Search Grounding Sources */}
          {message.searchSources && message.searchSources.length > 0 && (
            <div className="mt-3.5 p-3.5 bg-[#0c1017] border border-[#1e2638] rounded space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-200 font-semibold">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Google Search Sources ({message.searchSources.length})</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {message.searchSources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#111520] hover:bg-[#182030] border border-[#1e2638] hover:border-blue-500/50 text-[11.5px] text-zinc-200 hover:text-white transition-colors shadow-2xs"
                  >
                    <span className="truncate max-w-[180px]">{src.title || src.url}</span>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Assistant Actions Bar */}
          {!isWaitingForMain && message.content && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1.5 mt-3 pt-1 text-zinc-400 text-xs"
            >
              {/* Copy */}
              <button
                onClick={handleCopy}
                title="คัดลอกข้อความ"
                className="p-1.5 rounded border border-transparent hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Thumbs Up */}
              <button
                onClick={() => {
                  setLiked(liked === true ? null : true);
                  zenAudio.playSoftClick();
                }}
                title="คำตอบมีประโยชน์"
                className={`p-1.5 rounded border border-transparent transition-colors cursor-pointer ${
                  liked === true ? "text-blue-400 bg-blue-500/20 border-blue-500/40" : "hover:text-blue-400 hover:bg-blue-500/10"
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>

              {/* Thumbs Down */}
              <button
                onClick={() => {
                  setLiked(liked === false ? null : false);
                  zenAudio.playSoftClick();
                }}
                title="คำตอบยังไม่ดีพอ"
                className={`p-1.5 rounded border border-transparent transition-colors cursor-pointer ${
                  liked === false ? "text-red-400 bg-red-950/40 border-red-800/50" : "hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>

              {/* Regenerate */}
              {onRegenerate && !message.isStreaming && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  title="สร้างคำตอบใหม่"
                  className="p-1.5 rounded border border-transparent hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  // 2. User Message: Balanced Rectangular Bubble (Black, White, Blue - สี่เหลี่ยม)
  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex w-full justify-end items-start my-4 group"
    >
      <div className="flex flex-col items-end max-w-xl">
        {/* Attached Files */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5 justify-end">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2.5 px-3 py-2 bg-[#131824] border border-[#1e2638] rounded shadow-2xs text-xs text-white"
              >
                {att.isImage && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-8 h-8 rounded-sm object-cover border border-[#1e2638]"
                  />
                ) : (
                  <div className="p-1.5 rounded-sm bg-blue-950/60 border border-blue-800/40 text-blue-400">
                    {getFileIcon(att.extension, att.type)}
                  </div>
                )}
                <div className="max-w-[150px] truncate text-left">
                  <p className="font-medium truncate text-white" title={att.name}>
                    {att.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {formatFileSize(att.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Rectangular Bubble or Edit Box Container */}
        {isEditing ? (
          <div className="w-full max-w-lg bg-[#0f131d] border border-[#1e2638] rounded-md p-4 shadow-2xl text-white">
            <div className="flex items-start justify-between gap-2 mb-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                autoFocus
                className="font-thai w-full bg-transparent text-[15px] sm:text-[16px] text-white focus:outline-none resize-none leading-relaxed placeholder:text-zinc-500"
              />
              <div className="p-1.5 rounded bg-[#141926] text-blue-400 shrink-0">
                <Edit3 className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="font-inter px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer rounded"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="font-inter px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded transition-all cursor-pointer shadow-md shadow-blue-500/30 active:scale-95"
              >
                บันทึก & ส่งใหม่
              </button>
            </div>
          </div>
        ) : (
          <div className="relative group/bubble flex items-center justify-end w-fit">
            <div className="w-fit max-w-full px-5 py-2.5 bg-[#282a2c] text-[#e3e3e3] rounded-[22px] text-[15px] sm:text-[15.5px] font-normal leading-relaxed transition-all shadow-md shadow-black/30 flex items-center gap-2 border border-white/5">
              <div className="font-thai text-[#e3e3e3] flex items-center justify-between gap-3 w-fit">
                <span className="whitespace-pre-wrap break-words">{message.content}</span>
                {onEditAndResend && (
                  <button
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(true);
                    }}
                    title="แก้ไขข้อความ"
                    className="opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-[#8ab4f8] cursor-pointer shrink-0 -mr-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Copy button below */}
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            title="คัดลอก"
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
