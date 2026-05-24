import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type VentIssue, type VentComment, type IssueStatus } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function VentOverview() {
  const [posts, setPosts] = useState<VentIssue[] | null>(null);

  const load = useCallback(() => {
    api.ventIssues().then(setPosts).catch(() => setPosts([]));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="bg-black min-h-screen -mb-16 relative">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(900px 500px at 50% -10%, rgba(251,146,60,0.18) 0%, transparent 60%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">VENT</h1>
            <p className="text-sm text-ink-300">
              Civic posts from residents. Like, dislike, mark resolved, and comment.
            </p>
          </div>
          <Link to="/vent/post" className="vent-btn-primary text-sm">+ New post</Link>
        </header>

        {posts === null && <p className="text-sm text-ink-300">Loading feed…</p>}

        {posts && posts.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm text-ink-500">
              Nothing here yet — be the first to <Link to="/vent/post" className="text-saffron-700 font-semibold">vent</Link>.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {(posts ?? []).map((post) => (
            <FeedItem key={post.id} post={post} onAnyChange={load} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== One attached card: post body (left) | comments rail (right) =====
function FeedItem({ post, onAnyChange }: { post: VentIssue; onAnyChange: () => void }) {
  return (
    <article className="card overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_320px]">
        <div className="lg:border-r lg:border-ink-100">
          <PostBody post={post} onAnyChange={onAnyChange} />
        </div>
        <div className="border-t lg:border-t-0 lg:border-l-0 border-ink-100">
          <CommentsRail post={post} onAnyChange={onAnyChange} />
        </div>
      </div>
    </article>
  );
}

// ===== Post body (left side of the attached card) =====
function PostBody({ post, onAnyChange }: { post: VentIssue; onAnyChange: () => void }) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count ?? 0);
  const [dislikes, setDislikes] = useState(post.dislikes_count ?? 0);
  const [status, setStatus] = useState<IssueStatus>(((post.status as IssueStatus) ?? 'open') === 'resolved' ? 'resolved' : 'open');
  const [savingStatus, setSavingStatus] = useState(false);

  const initials = useMemo(
    () => post.reporter_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '··',
    [post.reporter_name],
  );

  async function toggleLike() {
    if (liked) {
      setLiked(false);
      setLikes((n) => Math.max(0, n - 1));
      try { const r = await api.unlikeIssue(post.id); setLikes(r.likes_count); setDislikes(r.dislikes_count); }
      catch { setLiked(true); setLikes((n) => n + 1); }
    } else {
      setLiked(true);
      setLikes((n) => n + 1);
      try { const r = await api.likeIssue(post.id); setLikes(r.likes_count); setDislikes(r.dislikes_count); }
      catch { setLiked(false); setLikes((n) => Math.max(0, n - 1)); }
    }
  }
  async function toggleDislike() {
    if (disliked) {
      setDisliked(false);
      setDislikes((n) => Math.max(0, n - 1));
      try { const r = await api.undislikeIssue(post.id); setLikes(r.likes_count); setDislikes(r.dislikes_count); }
      catch { setDisliked(true); setDislikes((n) => n + 1); }
    } else {
      setDisliked(true);
      setDislikes((n) => n + 1);
      try { const r = await api.dislikeIssue(post.id); setLikes(r.likes_count); setDislikes(r.dislikes_count); }
      catch { setDisliked(false); setDislikes((n) => Math.max(0, n - 1)); }
    }
  }
  async function toggleStatus() {
    const next: IssueStatus = status === 'resolved' ? 'open' : 'resolved';
    const prev = status;
    setStatus(next);
    setSavingStatus(true);
    try { await api.setIssueStatus(post.id, next); onAnyChange(); }
    catch { setStatus(prev); }
    finally { setSavingStatus(false); }
  }

  return (
    <>
      <header className="px-4 py-3 flex items-center gap-3 border-b border-ink-100">
        <div className="w-10 h-10 rounded-full bg-federation-800 text-white text-xs font-bold flex items-center justify-center">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">{post.reporter_name}</div>
          <div className="text-xs text-ink-500 truncate">
            {post.society_name} · {post.area}
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-ink-100 text-ink-700 capitalize">
          {post.category}
        </span>
      </header>

      {post.photo_path && (
        <a href={post.photo_path} target="_blank" rel="noreferrer" className="block bg-black/5">
          <img src={post.photo_path} alt={post.title} className="w-full max-h-[560px] object-contain bg-ink-50" />
        </a>
      )}

      <div className="px-4 pt-3 pb-2">
        <h3 className="text-base font-semibold text-ink-900">{post.title}</h3>
        <p className="text-sm text-ink-700 mt-1 whitespace-pre-line">{post.description}</p>

        {post.location && <p className="mt-2 text-xs text-ink-500">📍 {post.location}</p>}

        {(post.civic_tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.civic_tags!.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-azure-50 text-azure-700 border border-azure-200 px-2 py-0.5 text-[11px] font-semibold">
                #{t.replace(/\s+/g, '')}
              </span>
            ))}
          </div>
        )}

        {(post.instagram_handle || post.x_handle || post.facebook_handle) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.instagram_handle && <SocialTag platform="instagram" handle={post.instagram_handle} />}
            {post.x_handle && <SocialTag platform="x" handle={post.x_handle} />}
            {post.facebook_handle && <SocialTag platform="facebook" handle={post.facebook_handle} />}
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="px-4 py-3 border-t border-ink-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ToggleAction
            active={liked} onClick={toggleLike}
            iconActive="♥" iconInactive="♡"
            label="Like" count={likes}
            activeClass="bg-saffron-100 text-saffron-700 border-saffron-300"
          />
          <ToggleAction
            active={disliked} onClick={toggleDislike}
            iconActive="👎" iconInactive="👎🏻"
            label="Dislike" count={dislikes}
            activeClass="bg-ink-200 text-ink-900 border-ink-400"
          />
        </div>
        <StatusToggle status={status} onToggle={toggleStatus} disabled={savingStatus} />
      </div>

      <div className="px-4 py-2 border-t border-ink-100 bg-ink-50/40 text-[11px] text-ink-500">
        Created {absDateTime(post.created_at)} · {relativeTime(post.created_at)}
      </div>
    </>
  );
}

function ToggleAction({
  active, onClick, iconActive, iconInactive, label, count, activeClass,
}: {
  active: boolean; onClick: () => void;
  iconActive: string; iconInactive: string;
  label: string; count: number; activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? `Undo ${label.toLowerCase()}` : label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        active ? `${activeClass} font-bold` : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
      }`}
    >
      <span className="text-base leading-none">{active ? iconActive : iconInactive}</span>
      <span>{count}</span>
      {active && <span className="text-[10px] uppercase tracking-wider opacity-70">undo</span>}
    </button>
  );
}

function StatusToggle({
  status, onToggle, disabled,
}: { status: IssueStatus; onToggle: () => void; disabled: boolean }) {
  const resolved = status === 'resolved';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={resolved ? 'Mark as open' : 'Mark as resolved'}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        resolved ? 'bg-azure-100 border-azure-300 text-azure-800' : 'bg-saffron-50 border-saffron-300 text-saffron-800'
      }`}
    >
      <span className={`inline-block w-8 h-4 rounded-full relative transition ${resolved ? 'bg-azure-500' : 'bg-saffron-500'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${resolved ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="uppercase tracking-wider">{resolved ? 'Resolved' : 'Open'}</span>
    </button>
  );
}

// ===== Slim comments rail (right side of the attached card) =====
function CommentsRail({ post, onAnyChange }: { post: VentIssue; onAnyChange: () => void }) {
  const { user } = useAuth();
  const userSociety = user?.society?.name ?? user?.member?.society_name ?? '';
  const userName = user?.member?.full_name ?? 'Member';

  const [comments, setComments] = useState<VentComment[]>(post.comments ?? []);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const c = await api.commentOnIssue(post.id, {
        author_name: userName,
        body: text,
        society: userSociety || undefined,
      });
      setComments((arr) => [...arr, c]);
      setBody('');
      onAnyChange();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-ink-100">
        <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink-500">Comments</div>
        <div className="text-xs text-ink-500 mt-0.5">{comments.length} response{comments.length === 1 ? '' : 's'}</div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[420px]">
        {comments.length === 0 ? (
          <p className="text-xs text-ink-500 py-6 text-center">Be the first to comment.</p>
        ) : (
          <ul className="space-y-3">
            {[...comments].reverse().map((c) => (
              <li key={c.id} className="border-l-2 border-saffron-300 pl-3 py-0.5">
                <div className="text-xs font-bold text-ink-900 flex items-center gap-1">
                  <span aria-hidden>🏘</span>
                  <span className="truncate">{c.society || 'Federation member'}</span>
                </div>
                <p className="mt-1 text-sm text-ink-800 whitespace-pre-line">{c.body}</p>
                <div className="text-[10px] text-ink-500 mt-1">{relativeTime(c.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Slim comment input */}
      <form onSubmit={onSubmit} className="border-t border-ink-100 p-2 bg-ink-50/30">
        <div className="flex items-center gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            maxLength={500}
            className="input !py-1.5 text-sm flex-1"
            aria-label="Write a comment"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="vent-btn-primary !py-1.5 !px-3 text-xs"
          >
            {submitting ? '…' : 'Post'}
          </button>
        </div>
        {userSociety && (
          <p className="mt-1.5 text-[10px] text-ink-500 px-1">
            Posting as <span className="font-semibold text-ink-700">🏘 {userSociety}</span>
          </p>
        )}
      </form>
    </div>
  );
}

// ===== Helpers =====
function SocialTag({ platform, handle }: { platform: 'instagram' | 'x' | 'facebook'; handle: string }) {
  const clean = handle.replace(/^@/, '');
  const config = {
    instagram: { glyph: '📷', href: `https://instagram.com/${clean}`, cls: 'bg-saffron-50 text-saffron-800 border-saffron-200' },
    x: { glyph: '𝕏', href: `https://x.com/${clean}`, cls: 'bg-ink-100 text-ink-900 border-ink-300' },
    facebook: { glyph: 'f', href: `https://facebook.com/${clean}`, cls: 'bg-azure-50 text-azure-700 border-azure-200' },
  }[platform];
  return (
    <a
      href={config.href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold hover:underline ${config.cls}`}
    >
      <span aria-hidden>{config.glyph}</span>
      <span>@{clean}</span>
    </a>
  );
}

function relativeTime(iso: string): string {
  const t = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function absDateTime(iso: string) {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
