import React from 'react';
import { MessageCircle } from 'lucide-react';

// Same owner WhatsApp number used for subscription / support messages across the app.
const OWNER_WHATSAPP = '201025967471';
export const COMMUNITY_JOIN_MESSAGE = 'أريد أن أنضم للمجتمع';

export const communityJoinUrl = () =>
  `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(COMMUNITY_JOIN_MESSAGE)}`;

/** Free "join our community" button: opens WhatsApp to the owner with a ready message. */
export const CommunityJoinButton: React.FC<{ compact?: boolean; className?: string }> = ({ compact, className = '' }) => (
  <a
    href={communityJoinUrl()}
    target="_blank"
    rel="noopener noreferrer"
    dir="rtl"
    className={`flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow-lg shadow-emerald-950/40 ${
      compact ? 'py-2 px-3 text-xs' : 'py-3 px-4 text-sm'
    } ${className}`}
  >
    <MessageCircle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
    <span>انضم لمجتمعنا مجاناً 🤝</span>
  </a>
);
