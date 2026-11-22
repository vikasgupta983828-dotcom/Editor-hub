import React, { useEffect, useRef, useState } from 'react';
import { FileText, Paperclip, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import { formatRelativeDate } from '../lib/stats';
import { uploadMediaFile } from '../lib/upload';
import { ChatMessage } from '../types/marketplace';
import { AvatarImage, SafeImage } from './SafeImage';

export const MessagesView: React.FC = () => {
  const {
    firebaseUser,
    language,
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    onlineUserIds,
    typingByConversation,
    subscribeConversationMessages,
    sendChatMessage,
    sendTypingSignal,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftText, setDraftText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'video' | 'file';
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation =
    conversations.find((c) => c.id === selectedConversationId) || conversations[0] || null;

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    const unsub = subscribeConversationMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [activeConversation, subscribeConversationMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!firebaseUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 font-display">{t(language, 'navMessages')}</h2>
        <p className="text-sm text-slate-600">
          Sign in to chat with editors and clients in real time, share editing samples, and transfer project files.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
        >
          {t(language, 'signIn')}
        </button>
      </div>
    );
  }

  const getOtherParticipant = (conv: NonNullable<typeof activeConversation>) => {
    const isMeA = conv.participantA === firebaseUser.uid;
    return {
      uid: isMeA ? conv.participantB : conv.participantA,
      name: isMeA ? conv.participantBName : conv.participantAName,
      avatar: isMeA ? conv.participantBAvatar : conv.participantAAvatar,
    };
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadMediaFile(file);
      setPendingAttachment({
        url: data.url,
        name: data.originalName,
        type: data.mediaCategory,
      });
      showToast('File attached and ready to send.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      input.value = '';
      setUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation) return;
    if (!draftText.trim() && !pendingAttachment) return;
    setSending(true);
    const other = getOtherParticipant(activeConversation);
    try {
      await sendChatMessage(activeConversation, draftText, pendingAttachment || undefined);
      setDraftText('');
      setPendingAttachment(null);
      sendTypingSignal(activeConversation.id, other.uid, false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px] max-h-[780px] shadow-sm">
        {/* Left Conversations List */}
        <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 font-display">{t(language, 'navMessages')}</h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {conversations.length} threads
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No conversations yet. Visit Explore Editors and click Message to start discussing project requirements.
              </div>
            ) : (
              conversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const isSelected = activeConversation?.id === conv.id;
                const isOnline = onlineUserIds.has(other.uid);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                      isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <AvatarImage
                      src={other.avatar}
                      alt={other.name}
                      fallbackInitial={other.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                      fallbackClassName="w-10 h-10 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-semibold shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{other.name}</span>
                        <span className={`text-[11px] shrink-0 ${isOnline ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                          {isOnline ? t(language, 'onlineStatus') : t(language, 'offlineStatus')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessage}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Chat Pane */}
        <div className="md:col-span-8 flex flex-col bg-slate-50/70">
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500">
              Select a conversation to view message history and share project files.
            </div>
          ) : (
            (() => {
              const other = getOtherParticipant(activeConversation);
              const isOnline = onlineUserIds.has(other.uid);
              const isTyping = typingByConversation[activeConversation.id] === other.uid;

              return (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{other.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {isTyping ? (
                          <span className="text-violet-600 font-medium">{t(language, 'typingStatus')}</span>
                        ) : (
                          <span>
                            {isOnline ? t(language, 'onlineStatus') : t(language, 'offlineStatus')}
                            {activeConversation.projectTitle ? ` · ${activeConversation.projectTitle}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Message History */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.map((msg) => {
                      const isMine = msg.senderId === firebaseUser.uid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm space-y-2 ${
                              isMine
                                ? 'bg-violet-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-900'
                            }`}
                          >
                            {msg.attachmentType === 'image' && msg.attachmentUrl && (
                              <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block">
                                <SafeImage
                                  src={msg.attachmentUrl}
                                  alt={msg.attachmentName || 'Shared image'}
                                  fallbackTitle={msg.attachmentName || 'Image unavailable'}
                                  className="max-h-60 rounded-lg object-cover"
                                  fallbackClassName="w-56 h-36 rounded-lg bg-slate-100 text-slate-500 flex flex-col items-center justify-center gap-1.5 p-3 text-center"
                                />
                              </a>
                            )}
                            {msg.attachmentType === 'video' && msg.attachmentUrl && (
                              <video
                                src={msg.attachmentUrl}
                                controls
                                playsInline
                                className="max-h-64 w-full rounded-lg bg-black"
                              />
                            )}
                            {msg.attachmentType === 'file' && msg.attachmentUrl && (
                              <a
                                href={msg.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2 p-2.5 rounded-lg text-xs underline ${
                                  isMine ? 'bg-violet-700/60 hover:bg-violet-700' : 'bg-slate-100 hover:bg-slate-200'
                                }`}
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate">{msg.attachmentName || 'Download Project File'}</span>
                              </a>
                            )}
                            {msg.text && <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                          </div>
                          <span className="text-[11px] text-slate-400 mt-1 px-1">
                            {msg.senderName} · {formatRelativeDate(msg.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Composer */}
                  <form onSubmit={handleSend} className="p-4 border-t border-slate-200 bg-white space-y-2">
                    {pendingAttachment && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                        <span className="truncate">Attached: {pendingAttachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachment(null)}
                          className="text-slate-500 hover:text-slate-900 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <label
                        title={t(language, 'attachFile')}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 cursor-pointer transition-colors shrink-0"
                      >
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*,video/*,.pdf,.zip"
                          onChange={handleFileAttach}
                          className="hidden"
                        />
                      </label>

                      <input
                        type="text"
                        maxLength={2000}
                        value={draftText}
                        onChange={(e) => {
                          setDraftText(e.target.value);
                          sendTypingSignal(activeConversation.id, other.uid, e.target.value.length > 0);
                        }}
                        placeholder={uploading ? 'Uploading attachment...' : 'Write a message or share project requirements...'}
                        className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-violet-600"
                      />

                      <button
                        type="submit"
                        disabled={sending || uploading}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">{t(language, 'sendMessage')}</span>
                      </button>
                    </div>
                  </form>
                </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
