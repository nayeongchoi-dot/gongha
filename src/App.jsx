import { useState, useEffect, useRef } from 'react';
import { getShared, setShared, subscribeShared } from './firebase';
import {
  Calendar, BookOpen, Users, Home, ChevronRight, Plus, Heart,
  MessageCircle, Clock, MapPin, Bell, Search, ArrowLeft, MoreHorizontal,
  Sparkles, Wallet, Mic, Square, FileText, Loader2, X, CheckCircle2, Circle,
  Radio, Zap, ChevronDown, Edit2, Trash2, Pencil
} from 'lucide-react';

// ─── DATA ────────────────────────────────────────────────────────────
const members = [
  { id: 1, name: '김민정', initial: '김', clinic: '필스톡스의원', color: '#8AA5BA', bio: '' },
  { id: 7, name: '박신혜', initial: '박', clinic: '미호의원', color: '#C9A8A0', bio: '' },
  { id: 2, name: '박일권', initial: '박', clinic: '더올림의원', color: '#A89576', bio: '' },
  { id: 3, name: '유동욱', initial: '유', clinic: '핀다의원', color: '#DBB38B', bio: '' },
  { id: 4, name: '장진혁', initial: '장', clinic: '미라인의원', color: '#C4BD90', bio: '' },
  { id: 5, name: '정수희', initial: '정', clinic: '수희의원', color: '#CBD0C9', bio: '' },
  { id: 6, name: '최나영', initial: '최', clinic: '새나의원', color: '#7A8590', bio: '' },
];

// 멤버 id로 안전하게 찾기 (배열 인덱스 의존 X)
function findMember(id) {
  return members.find(m => m.id === id) || members[0];
}

const categories = ['전체', '시술 노하우', '케이스 공유', '논문·학회', '자유'];

// ─── DESIGN TOKENS ──────────────────────────────────────────────────
const C = {
  bg: '#EFE9DD', paper: '#FAF6EB', ink: '#2D3540', inkSoft: '#6E7682',
  line: '#D8CFBC', accent: '#4A6580', accentSoft: '#8AA5BA', green: '#6E7355',
  red: '#2D3540',
};

const KIND_COLORS = {
  meeting: '#C9D4DD',     // soft blue
  seminar: '#CFD5C0',     // soft sage
  conference: '#E0CFB0',  // soft sand
};
const KIND_LABELS = {
  meeting: '모임',
  seminar: '세미나',
  conference: '학회',
};

function formatTimeAgo(t) {
  if (!t) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 7) {
    const date = new Date(t);
    return `${date.getMonth()+1}월 ${date.getDate()}일`;
  }
  if (d > 0) return `${d}일 전`;
  if (h > 0) return `${h}시간 전`;
  if (m > 0) return `${m}분 전`;
  return '방금';
}

// 이미지를 리사이즈 + JPEG 압축해서 base64 data URL로 반환
async function compressImage(file, maxDim = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── DATE/TIME HELPERS ──────────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  // ISO 형식 (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d.getTime())) return d;
  }
  // 한국어 '4월 29일' 또는 '4월 29일 수요일'
  const m = s.match(/(\d+)월\s*(\d+)일/);
  if (m) {
    const year = new Date().getFullYear();
    return new Date(year, parseInt(m[1])-1, parseInt(m[2]));
  }
  return null;
}

function formatKoreanDate(s) {
  if (!s) return '';
  const d = parseDate(s);
  if (!d) return s;
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}

function getKoreanWeekday(s) {
  const d = parseDate(s);
  if (!d) return '';
  return ['일','월','화','수','목','금','토'][d.getDay()] + '요일';
}

function formatShortDate(s) {
  if (!s) return '';
  const d = parseDate(s);
  if (!d) return s.slice(0, 5);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function formatKoreanTime(s) {
  if (!s) return '';
  // ISO 'HH:MM'
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1]), mm = parseInt(m[2]);
    const period = h < 12 ? '오전' : '오후';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    if (mm === 0) return `${period} ${hour12}시`;
    return `${period} ${hour12}시 ${mm}분`;
  }
  return s; // 옛 한국어 형식 그대로
}

function getDaysUntil(s) {
  const d = parseDate(s);
  if (!d) return null;
  const now = new Date();
  now.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const fontSerif = "'Noto Serif KR', 'Nanum Myeongjo', serif";
const fontSans = "'Pretendard', 'Noto Sans KR', system-ui, sans-serif";

// ─── PERSISTENT STORAGE (localStorage on each device) ──────────────
// Each device keeps its own copy of personal data. Shared data (posts,
// meeting, dues) will be replaced with Firebase in step 3.
const _memStore = new Map();
const _mkKey = (k, s) => `gongha_${s ? 's' : 'p'}__${k}`;

async function safeGet(key, shared = false) {
  const fk = _mkKey(key, shared);
  // 공유 데이터: Firebase에서 가져오기 (localStorage fallback 없음)
  if (shared) {
    const value = await getShared(key);
    return value;  // null이어도 그대로 반환 — localStorage로 떨어지지 않음
  }
  // 개인 데이터: localStorage 또는 메모리
  try {
    const raw = localStorage.getItem(fk);
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  return _memStore.has(fk) ? _memStore.get(fk) : null;
}

async function safeSet(key, value, shared = false) {
  const fk = _mkKey(key, shared);
  _memStore.set(fk, value);
  // 공유 데이터: Firebase에 저장 (반드시 동작)
  if (shared) {
    await setShared(key, value);
    return true;
  }
  // 개인 데이터: localStorage에 저장
  try { localStorage.setItem(fk, JSON.stringify(value)); } catch {}
  return true;
}

// ─── APP ────────────────────────────────────────────────────────────
export default function GonghaApp() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [pinMode, setPinMode] = useState('enter');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [openPost, setOpenPost] = useState(null);

  // Shared editable data
  const [posts, setPosts] = useState([]);
  const [meeting, setMeeting] = useState(null);
  const [duesBalance, setDuesBalance] = useState(0);
  const [editingPost, setEditingPost] = useState(null); // null | post | 'new'
  const [editingMeeting, setEditingMeeting] = useState(false);
  const [editingDues, setEditingDues] = useState(false);
  const [memberBios, setMemberBios] = useState({});
  const [memberPhones, setMemberPhones] = useState({});
  const [editingBio, setEditingBio] = useState(false);
  const [pastMeetingsList, setPastMeetingsList] = useState([]);
  const [lastSeenAt, setLastSeenAt] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [editingPastMeeting, setEditingPastMeeting] = useState(null);
  const [conferences, setConferences] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null); // null | 'new' | event object

  // Load shared data from storage on mount
  useEffect(() => {
    (async () => {
      const p = await safeGet('posts', true);
      if (Array.isArray(p)) setPosts(p);
      // meeting state는 더 이상 사용 안 함 (conferences로 통합)
      const d = await safeGet('dues', true);
      if (typeof d === 'number') setDuesBalance(d);
      const b = await safeGet('memberBios', true);
      if (b && typeof b === 'object') setMemberBios(b);
      const ls = await safeGet(`lastSeen-${pendingUser?.id || 'guest'}`, false);
      if (typeof ls === 'number') setLastSeenAt(ls);
      const ph = await safeGet('memberPhones', true);
      if (ph && typeof ph === 'object') setMemberPhones(ph);
      const cf = await safeGet('conferences', true);
      if (Array.isArray(cf)) setConferences(cf);

      const pml = await safeGet('pastMeetings', true);
      if (Array.isArray(pml)) setPastMeetingsList(pml);
    })();
  }, []);

  const filteredPosts = activeCategory === '전체'
    ? posts : posts.filter(p => p.category === activeCategory);


  // 인앱 알림: 마지막 본 시각 이후의 새 항목들
  const notifItems = (() => {
    const items = [];
    (posts || []).forEach(p => {
      const t = p.timestamp || p.id || 0;
      if (t > lastSeenAt) items.push({ kind: 'post', id: p.id, ...p, t });
    });
    (conferences || []).forEach(e => {
      const t = e.id || 0;
      if (typeof t === 'number' && t > lastSeenAt) items.push({ kind: 'event', ...e, t });
    });
    return items.sort((a, b) => b.t - a.t).slice(0, 10);
  })();

  const markAllSeen = async () => {
    const now = Date.now();
    setLastSeenAt(now);
    if (user) await safeSet(`lastSeen-${user.id}`, now, false);
    setShowNotifPanel(false);
  };

  const goTo = (s) => {
    setScreen(s); setOpenPost(null); setEditingPost(null); setEditingMeeting(false); setEditingDues(false); setEditingBio(false); setEditingEvent(null); setEditingPastMeeting(null);
  };

  // PIN flow
  const handlePickMember = async (m) => {
    setPendingUser(m);
    // PIN은 Firebase 전용 (localStorage fallback 안 함)
    const stored = await getShared(`pin-${m.id}`);
    setPinMode(stored ? 'enter' : 'set');
    setScreen('pin');
  };

  const handlePinSuccess = () => {
    setUser(pendingUser);
    setPendingUser(null);
    setScreen('home');
  };

  // Post CRUD
  const savePost = async (postData) => {
    const now = Date.now();
    let updated;
    if (postData.id) {
      updated = posts.map(p => p.id === postData.id ? { ...p, ...postData, editedAt: now } : p);
    } else {
      const newPost = {
        ...postData,
        id: now,
        t: now,
        author: user.name,
        authorId: user.id,
        comments: 0,
      };
      updated = [newPost, ...posts];
    }
    setPosts(updated);
    await safeSet('posts', updated, true);
    setEditingPost(null);
    setOpenPost(null);
    setScreen('board');
  };

  const deletePost = async (id) => {
    if (!window.confirm('이 글을 삭제하시겠어요?')) return;
    const updated = posts.filter(p => p.id !== id);
    setPosts(updated);
    await safeSet('posts', updated, true);
    setOpenPost(null);
  };

  const addComment = async (postId, text) => {
    if (!user || !text.trim()) return;
    const newComment = {
      authorId: user.id,
      text: text.trim(),
      t: Date.now(),
    };
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      const commentList = Array.isArray(p.commentList) ? p.commentList : [];
      const newList = [...commentList, newComment];
      return { ...p, commentList: newList, comments: newList.length };
    });
    setPosts(updated);
    const updatedPost = updated.find(p => p.id === postId);
    if (openPost && openPost.id === postId) setOpenPost(updatedPost);
    await safeSet('posts', updated, true);
  };

  const deleteComment = async (postId, commentT) => {
    if (!user) return;
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      const newList = (p.commentList || []).filter(c => c.t !== commentT);
      return { ...p, commentList: newList, comments: newList.length };
    });
    setPosts(updated);
    const updatedPost = updated.find(p => p.id === postId);
    if (openPost && openPost.id === postId) setOpenPost(updatedPost);
    await safeSet('posts', updated, true);
  };

  const saveMeeting = async (m) => {
    setMeeting(m);
    await safeSet('meeting', m, true);
    setEditingMeeting(false);
  };

  const deleteMeeting = async () => {
    if (!window.confirm('이 모임 일정을 삭제하시겠어요?')) return;
    setMeeting(null);
    await safeSet('meeting', null, true);
  };

  const addOrSetMeeting = async (m) => {
    const newMeeting = { ...m, no: (meeting?.no || 0) + 1 };
    setMeeting(newMeeting);
    await safeSet('meeting', newMeeting, true);
    setEditingEvent(null);
  };

  const saveDues = async (amount) => {
    setDuesBalance(amount);
    await safeSet('dues', amount, true);
    setEditingDues(false);
  };

  const saveMyInfo = async (memberId, newBio, newPhone) => {
    const updatedBios = { ...memberBios, [memberId]: newBio };
    const updatedPhones = { ...memberPhones, [memberId]: newPhone };
    setMemberBios(updatedBios);
    setMemberPhones(updatedPhones);
    await safeSet('memberBios', updatedBios, true);
    await safeSet('memberPhones', updatedPhones, true);
    setEditingBio(false);
  };

  const saveConference = async (eventData) => {
    let updated;
    if (eventData.id) {
      updated = conferences.map(e => e.id === eventData.id ? eventData : e);
    } else {
      updated = [...conferences, { ...eventData, id: Date.now() }];
    }
    setConferences(updated);
    await safeSet('conferences', updated, true);
    setEditingEvent(null);
  };

  const savePastMeeting = async (data) => {
    let updated;
    if (data.id) {
      updated = pastMeetingsList.map(m => m.id === data.id ? data : m);
    } else {
      updated = [...pastMeetingsList, { ...data, id: Date.now() }];
    }
    setPastMeetingsList(updated);
    await safeSet('pastMeetings', updated, true);
    setEditingPastMeeting(null);
  };

  const deletePastMeeting = async (id) => {
    if (!window.confirm('이 지난 모임 기록을 삭제할까요?')) return;
    const updated = pastMeetingsList.filter(m => m.id !== id);
    setPastMeetingsList(updated);
    await safeSet('pastMeetings', updated, true);
    setEditingPastMeeting(null);
  };

  const deleteConference = async (id) => {
    if (!window.confirm('이 일정을 삭제하시겠어요?')) return;
    const updated = conferences.filter(e => e.id !== id);
    setConferences(updated);
    await safeSet('conferences', updated, true);
    setEditingEvent(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-0 sm:p-6"
         style={{ background: '#0A0A0A', fontFamily: fontSans, color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;700;900&family=Pretendard:wght@300;400;500;600;700&display=swap');
        .frame { box-shadow: 0 30px 80px -20px rgba(0,0,0,0.5); }
        .grain { background-image: radial-gradient(rgba(0,0,0,0.025) 1px, transparent 1px); background-size: 3px 3px; }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-ring { animation: pulseRing 1.6s ease-out infinite; }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .pulse-dot { animation: pulseDot 1.2s ease-in-out infinite; }
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .scroll-area::-webkit-scrollbar { width: 0; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .shake { animation: shake 0.4s; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>

      <div className="w-full sm:max-w-md sm:rounded-3xl frame overflow-hidden relative grain"
           style={{ background: C.bg, height: '100vh', maxHeight: '900px', minHeight: '640px' }}>

        {screen === 'login' && (
          <LoginScreen onPick={handlePickMember} />
        )}

        {screen === 'pin' && pendingUser && (
          <PinScreen
            user={pendingUser}
            mode={pinMode}
            onSuccess={handlePinSuccess}
            onCancel={() => { setPendingUser(null); setScreen('login'); }}
          />
        )}

        {editingBio && user && (
          <EditMyInfoScreen
            user={user}
            currentBio={(memberBios && memberBios[user.id]) || ''}
            currentPhone={(memberPhones && memberPhones[user.id]) || ''}
            onSave={(bio, phone) => saveMyInfo(user.id, bio, phone)}
            onCancel={() => setEditingBio(false)}
          />
        )}

        {editingEvent && user && (
          <EditEventScreen
            event={editingEvent}
            onSave={saveConference}
            onDelete={editingEvent !== 'new' ? () => deleteConference(editingEvent.id) : null}
            onCancel={() => setEditingEvent(null)}
          />
        )}

        {editingPastMeeting && user && (
          <EditPastMeetingScreen
            record={editingPastMeeting}
            onSave={savePastMeeting}
            onDelete={editingPastMeeting !== 'new' ? () => deletePastMeeting(editingPastMeeting.id) : null}
            onCancel={() => setEditingPastMeeting(null)}
          />
        )}



        {editingDues && user && (
          <EditDuesScreen
            balance={duesBalance}
            onSave={saveDues}
            onCancel={() => setEditingDues(false)}
          />
        )}

        {screen === 'post-edit' && user  && !editingDues && !editingBio && !editingEvent && !editingPastMeeting && (
          <PostEditScreen
            post={editingPost}
            onSave={savePost}
            onCancel={() => { setEditingPost(null); setScreen('board'); }}
          />
        )}

        {showNotifPanel && user && (
          <NotifPanel
            items={notifItems}
            onClose={() => setShowNotifPanel(false)}
            onSeen={markAllSeen}
            onOpenPost={(p) => { setOpenPost(p); setShowNotifPanel(false); setScreen('board'); }}
            onOpenEvent={() => { setShowNotifPanel(false); setScreen('schedule'); }}
          />
        )}

        {screen !== 'login' && screen !== 'pin' && screen !== 'post-edit'  && !editingDues && !editingBio && !editingEvent && !editingPastMeeting && user && (
          <>
            <Header
              screen={screen} user={user} openPost={openPost}
              onBack={() => { setOpenPost(null); }}
              hasNotif={notifItems.length > 0}
              onNotifClick={() => setShowNotifPanel(true)}
            />

            <div className="scroll-area overflow-y-auto fade-in" key={screen + (openPost?.id || '') }
                 style={{ height: 'calc(100% - 140px)', paddingBottom: '24px' }}>
              {screen === 'home' && (
                <HomeScreen user={user} onNav={goTo}
                  conferences={conferences} posts={posts} duesBalance={duesBalance}
                  pastMeetingsList={pastMeetingsList}
                  setOpenPost={setOpenPost}
                  />
              )}
              {screen === 'schedule' && (
                <ScheduleScreen
                  duesBalance={duesBalance}
                  conferences={conferences}
                  pastMeetingsList={pastMeetingsList}
                  onEditDues={() => setEditingDues(true)}
                  onEditEvent={setEditingEvent}
                  onAddEvent={() => setEditingEvent('new')}
                  onEditPast={setEditingPastMeeting}
                  onAddPast={() => setEditingPastMeeting('new')}
                  onDeletePast={deletePastMeeting}
                  onDeleteConference={deleteConference} />
              )}
              {screen === 'board' && !openPost && (
                <BoardScreen posts={filteredPosts} activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory} setOpenPost={setOpenPost}
                  onCreate={() => { setEditingPost('new'); setScreen('post-edit'); }} />
              )}
              {screen === 'board' && openPost && (
                <PostDetail post={openPost} user={user}
                  onEdit={() => { setEditingPost(openPost); setScreen('post-edit'); }}
                  onDelete={() => deletePost(openPost.id)}
                  onAddComment={(text) => addComment(openPost.id, text)}
                  onDeleteComment={(t) => deleteComment(openPost.id, t)} />
              )}
              {screen === 'members' && (
                <MembersScreen
                  user={user}
                  memberBios={memberBios}
                  memberPhones={memberPhones}
                  onEditBio={() => setEditingBio(true)} />
              )}
            </div>

            <BottomNav screen={screen} setScreen={goTo} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── LOGIN ──────────────────────────────────────────────────────────
function LoginScreen({ onPick }) {
  return (
    <div className="h-full flex flex-col px-8 py-12 fade-in" style={{ background: C.bg }}>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-6" style={{ color: C.inkSoft, letterSpacing: '0.4em', fontSize: '11px', fontWeight: 500 }}>
          EST. 2025 · MEMBERS ONLY
        </div>

        <div className="text-center" style={{ fontFamily: fontSerif, fontSize: '88px', fontWeight: 700, color: C.ink, lineHeight: 1, letterSpacing: '-0.04em' }}>
          공하
        </div>
        <div className="mt-3 text-center" style={{ color: C.accent, fontFamily: fontSerif, fontSize: '13px', letterSpacing: '0.4em' }}>
          空 河
        </div>
        <div className="mt-6 text-center max-w-xs" style={{ color: C.inkSoft, fontSize: '12px', lineHeight: 1.7 }}>
          욕심 없이 흐르는 강처럼<br/>꾸준한 공부와 지혜를 나누는 모임<br/>
        </div>
      </div>
      <div className="pb-4">
        <div className="text-center mb-5" style={{ color: C.ink, fontSize: '13px', fontWeight: 500, letterSpacing: '0.1em' }}>
          누구로 들어오시나요?
        </div>
        <div className="grid grid-cols-3 gap-3">
          {members.map(m => (
            <button key={m.id} onClick={() => onPick(m)} className="flex flex-col items-center group">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-110 group-active:scale-95"
                style={{ background: m.color, fontFamily: fontSerif, color: C.ink, fontSize: '26px', fontWeight: 500 }}>
                {m.initial}
              </div>
              <div style={{ fontSize: '12px', color: C.ink, fontWeight: 500 }}>{m.name}</div>
              <div style={{ fontSize: '10px', color: C.inkSoft, marginTop: '1px' }}>{(m.specialty || m.clinic || '').split('·')[0]}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HEADER ─────────────────────────────────────────────────────────
function Header({ screen, user, onBack, openPost, hasNotif, onNotifClick }) {
  const isDetail = (screen === 'board' && openPost);

  return (
    <div className="px-6 pt-12 pb-8 flex items-center justify-between" style={{ background: C.bg }}>
      {isDetail ? (
        <button onClick={onBack} className="flex items-center gap-1" style={{ color: C.ink }}>
          <ArrowLeft size={18} /><span style={{ fontSize: '13px' }}>뒤로</span>
        </button>
      ) : (
        <div className="flex items-baseline gap-2.5">
          <div style={{ fontFamily: fontSerif, fontSize: '22px', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>공하</div>
          <div style={{ fontFamily: fontSerif, fontStyle: 'italic', fontSize: '11px', color: C.inkSoft, opacity: 0.7 }}>
            Less Hype. More Craft.
          </div>
        </div>
      )}

      {!isDetail && (
        <div className="flex items-center gap-3">
          <button onClick={onNotifClick} className="relative" style={{ color: C.inkSoft }}>
            <Bell size={16} />
            {hasNotif && (
              <span className="absolute -top-0.5 -right-0.5 rounded-full"
                    style={{ width: '7px', height: '7px', background: '#C9544D', border: `1.5px solid ${C.bg}` }} />
            )}
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
               style={{ background: user.color, color: C.ink, fontFamily: fontSerif, fontSize: '13px' }}>
            {user.initial}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HOME ───────────────────────────────────────────────────────────
function HomeScreen({ user, onNav, conferences, posts, duesBalance, pastMeetingsList, setOpenPost }) {
  // 다가오는 일정 찾기: 모든 종류(모임/세미나/학회) 중 가장 가까운 미래 일정
  const meeting = (() => {
    const upcoming = (conferences || [])
      .map(e => ({ ev: e, days: getDaysUntil(e.date) }))
      .filter(x => x.days !== null && x.days >= 0)
      .sort((a, b) => a.days - b.days);
    if (upcoming.length === 0) return null;
    const e = upcoming[0].ev;
    return {
      topic: e.name,
      date: e.date,
      endDate: e.endDate,
      time: e.time,
      location: e.location,
      kind: e.kind,
    };
  })();

  return (
    <div className="px-6">
      <div className="mb-6">
        <div style={{ fontSize: '13px', color: C.inkSoft }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: '22px', color: C.ink, marginTop: '4px', lineHeight: 1.4 }}>
          어서오세요, <span style={{ fontWeight: 700 }}>{user.name}</span> 원장님
        </div>
      </div>


      {meeting ? (() => {
        const days = getDaysUntil(meeting.date);
        const dispDate = formatKoreanDate(meeting.date) + (meeting.endDate ? ` – ${formatKoreanDate(meeting.endDate)}` : '');
        const wkday = !meeting.endDate ? getKoreanWeekday(meeting.date) : '';
        const heroLabel = meeting.kind === 'seminar' ? '다가오는 세미나'
          : meeting.kind === 'conference' ? '다가오는 학회'
          : '다가오는 모임';
        return (
        <div className="rounded-2xl p-6 mb-4 relative overflow-hidden" style={{ background: C.ink, color: C.paper }}>
          <div className="relative">
            <div style={{ fontSize: '11px', letterSpacing: '0.3em', opacity: 0.6 }}>{heroLabel}</div>
            <div className="flex items-baseline gap-2 mt-2">
              <div style={{ fontFamily: fontSerif, fontSize: '44px', fontWeight: 700, lineHeight: 1 }}>
                {days === null ? '' : days === 0 ? '오늘' : days > 0 ? `D−${days}` : `D+${-days}`}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.7 }}>{dispDate} {wkday}</div>
            </div>
            <div style={{ fontFamily: fontSerif, fontSize: '17px', marginTop: '16px', lineHeight: 1.5 }}>
              {meeting.topic}
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              {meeting.time && (
                <div className="flex items-center gap-1" style={{ fontSize: '12px', opacity: 0.85 }}>
                  <Clock size={12} /> {formatKoreanTime(meeting.time)}
                </div>
              )}
              {meeting.location && (
                <div className="flex items-center gap-1" style={{ fontSize: '12px', opacity: 0.85 }}>
                  <MapPin size={12} /> {meeting.location}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })() : (
        <div className="rounded-2xl p-8 mb-4 text-center" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
          <div style={{ fontSize: '13px', color: C.inkSoft, fontStyle: 'italic' }}>
            다가오는 일정이 없습니다
          </div>
          <div style={{ fontSize: '11px', color: C.inkSoft, marginTop: '6px', opacity: 0.7 }}>
            모임 탭에서 일정을 추가해보세요
          </div>
        </div>
      )}



      <div className="flex justify-between items-baseline mt-8 mb-3">
        <SectionLabel num="02" label="최근 게시글" inline />
        <button onClick={() => onNav('board')} className="flex items-center" style={{ fontSize: '11px', color: C.accent }}>
          전체보기 <ChevronRight size={12} />
        </button>
      </div>
      <div className="space-y-3 mb-6">
        {posts.slice(0, 3).map(post => (
          <button key={post.id} onClick={() => { onNav('board'); setOpenPost(post); }}
            className="w-full text-left rounded-xl p-4 flex gap-3"
            style={{ background: C.paper, border: `1px solid ${C.line}` }}>
           <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                 style={{ background: findMember(post.authorId).color, color: C.ink, fontFamily: fontSerif, fontSize: '14px' }}>
              {findMember(post.authorId).initial}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: '10px', color: C.accent, fontWeight: 600, letterSpacing: '0.05em' }}>{post.category}</div>
              <div className="truncate mt-0.5" style={{ fontSize: '13px', color: C.ink, fontWeight: 500 }}>{post.title}</div>
              <div className="flex items-center gap-3 mt-1.5" style={{ fontSize: '11px', color: C.inkSoft }}>
                <span>{post.author}</span><span>·</span><span>{formatTimeAgo(post.t || post.id)}</span>
                                <span className="flex items-center gap-0.5"><MessageCircle size={10} /> {post.comments}</span>
                {Array.isArray(post.images) && post.images.length > 0 && (
                  <span className="flex items-center gap-0.5" style={{ color: C.accent }}>
                    📷 {post.images.length}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8">


        <SectionLabel num="03" label="우리들의 기록" />


      </div>
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="모임 횟수" value={String((pastMeetingsList || []).length)} unit="회" />
        <StatCard label="공유된 글" value={String(posts.length)} unit="편" />
        <StatCard label="회비 잔액" value={String(Math.round(duesBalance / 10000))} unit="만" />
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
      <div className="flex items-baseline justify-center gap-0.5">
        <span style={{ fontFamily: fontSerif, fontSize: '26px', fontWeight: 700, color: C.ink }}>{value}</span>
        <span style={{ fontSize: '11px', color: C.inkSoft }}>{unit}</span>
      </div>
      <div className="mt-1" style={{ fontSize: '10px', color: C.inkSoft, letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function SectionLabel({ num, label, inline }) {
  return (
    <div className={`flex items-center gap-2 ${inline ? '' : 'mb-3'}`}>
      <span style={{ fontFamily: fontSerif, fontSize: '11px', color: C.accent, fontWeight: 600, letterSpacing: '0.1em' }}>{num}</span>
      <span style={{ fontSize: '11px', color: C.ink, fontWeight: 600, letterSpacing: '0.15em' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: C.line }} />
    </div>
  );
}

// ─── SEARCH ─────────────────────────────────────────────────────────
function Highlight({ text, q }) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(0,0,0,0.1)', color: C.ink, padding: '0 2px', borderRadius: '2px', fontWeight: 600 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── RECORD ─────────────────────────────────────────────────────────
function FeatureRow({ icon, title, desc }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
           style={{ background: C.bg, color: C.accent }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '13px', color: C.ink, fontWeight: 600 }}>{title}</div>
        <div className="mt-0.5" style={{ fontSize: '11px', color: C.inkSoft }}>{desc}</div>
      </div>
    </div>
  );
}

function ProcessStep({ label, done, active }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {done ? <CheckCircle2 size={14} style={{ color: C.green }} />
        : active ? <Loader2 size={14} className="spin" style={{ color: C.accent }} />
        : <Circle size={14} style={{ color: C.line }} />}
      <span style={{ fontSize: '12px', color: done || active ? C.ink : C.inkSoft, fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </div>
  );
}

function SummaryContent({ summary }) {
  return (
    <div className="slide-up">
      <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.15em' }}>
        제 {summary.no}차 모임 · {summary.date} · {summary.duration}
      </div>
      <div className="mt-2" style={{ fontFamily: fontSerif, fontSize: '26px', fontWeight: 700, color: C.ink, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
        {summary.title}
      </div>
      <div className="mt-3 rounded-xl p-4" style={{ background: C.ink, color: C.paper }}>
        <div style={{ fontSize: '11px', opacity: 0.6, letterSpacing: '0.15em', marginBottom: '6px' }}>TL;DR</div>
        <div style={{ fontFamily: fontSerif, fontSize: '14px', lineHeight: 1.7 }}>
          {summary.summary}
        </div>
      </div>

      {summary.keyPoints?.length > 0 && (
        <div className="mt-6">
          <SectionLabel num="◇" label="핵심 논의" />
          <div className="space-y-2">
            {summary.keyPoints.map((p, i) => (
              <div key={i} className="rounded-lg p-3 flex gap-3"
                   style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                <div className="flex-shrink-0" style={{ fontFamily: fontSerif, fontSize: '13px', color: C.accent, fontWeight: 700 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6 }}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.decisions?.length > 0 && (
        <div className="mt-6">
          <SectionLabel num="✓" label="결정사항" />
          <div className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${C.line}` }}>
            <div className="space-y-2.5">
              {summary.decisions.map((d, i) => (
                <div key={i} className="flex gap-2.5">
                  <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: C.green }} />
                  <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {summary.actionItems?.length > 0 && (
        <div className="mt-6">
          <SectionLabel num="→" label="할 일" />
          <div className="space-y-2">
            {summary.actionItems.map((a, i) => {
              const member = members.find(m => m.name === a.who);
              return (
                <div key={i} className="rounded-lg p-3 flex items-center gap-3"
                     style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                       style={{ background: member?.color || C.line, color: C.ink, fontFamily: fontSerif, fontSize: '13px' }}>
                    {member?.initial || a.who?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '11px', color: C.inkSoft, fontWeight: 500 }}>{a.who}</div>
                    <div style={{ fontSize: '13px', color: C.ink, marginTop: '1px', lineHeight: 1.5 }}>{a.what}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.nextTopics?.length > 0 && (
        <div className="mt-6">
          <SectionLabel num="↗" label="다음 모임 의제" />
          <div className="rounded-xl p-4 space-y-1.5" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            {summary.nextTopics.map((t, i) => (
              <div key={i} className="flex gap-2" style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6 }}>
                <span style={{ color: C.accent }}>·</span> {t}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="mt-6 rounded-xl" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between" style={{ fontSize: '12px', color: C.inkSoft }}>
          <span className="flex items-center gap-1.5"><FileText size={12} /> 원본 전사 보기</span>
          <ChevronDown size={14} />
        </summary>
        <div className="px-4 pb-4" style={{ fontSize: '12px', color: C.inkSoft, lineHeight: 1.7, fontFamily: fontSerif, whiteSpace: 'pre-wrap' }}>
          {summary.rawTranscript}
        </div>
      </details>
    </div>
  );
}

// ─── SCHEDULE ───────────────────────────────────────────────────────
function ScheduleScreen({ duesBalance, conferences, pastMeetingsList, onEditDues, onEditEvent, onAddEvent, onEditPast, onAddPast, onDeletePast, onDeleteConference }) {
  return (
    <div className="px-6">
      <div className="mb-6">
        <div style={{ fontFamily: fontSerif, fontSize: '28px', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
          모임 일정
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <SectionLabel num="↑" label="다가오는 일정" inline />
        <button onClick={onAddEvent}
          className="rounded-full px-2.5 py-1 flex items-center gap-1"
          style={{ background: C.ink, color: C.paper, fontSize: '10px', fontWeight: 500 }}>
          <Plus size={11} /> 일정 추가
        </button>
      </div>

      <div className="space-y-3 mb-8">

        {(!conferences || conferences.length === 0) && (
          <div className="rounded-xl p-8 text-center" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
            <div style={{ fontSize: '13px', color: C.inkSoft, fontStyle: 'italic' }}>
              다가오는 일정이 없습니다
            </div>
            <div style={{ fontSize: '11px', color: C.inkSoft, marginTop: '6px', opacity: 0.7 }}>
              우측 상단 "+ 일정 추가" 버튼으로 추가해보세요
            </div>
          </div>
        )}

        {[...(conferences || [])]
          .sort((a, b) => {
            const da = parseDate(a.date), db = parseDate(b.date);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return da.getTime() - db.getTime(); // 가까운 날짜가 위
          })
          .map(ev => {
          const days = getDaysUntil(ev.date);
          const wkday = getKoreanWeekday(ev.date);
          const dispDate = formatKoreanDate(ev.date) + (ev.endDate ? ` – ${formatKoreanDate(ev.endDate)}` : '');
          const bgColor = ev.kind === 'meeting' ? '#F0E7CE'
            : ev.kind === 'seminar' ? '#E5DABE'
            : '#DBD0B8';
          const labelText = ev.kind === 'meeting' ? 'MEETING'
            : ev.kind === 'seminar' ? 'SEMINAR'
            : 'CONFERENCE';
          return (
          <div key={ev.id} className="rounded-xl p-5 relative overflow-hidden"
               style={{ background: bgColor, border: `1px solid ${C.line}` }}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: C.accent, fontWeight: 600 }}>
                  {labelText}
                </div>
                <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
                  <div style={{ fontFamily: fontSerif, fontSize: '18px', fontWeight: 700, color: C.ink }}>
                    {dispDate}
                  </div>
                  {wkday && !ev.endDate && (
                    <div style={{ fontSize: '12px', color: C.inkSoft }}>({wkday.charAt(0)})</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                <button onClick={() => onEditEvent(ev)}
                  className="rounded-full px-2.5 py-1 flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.5)', color: C.inkSoft, fontSize: '10px' }}>
                  <Pencil size={10} /> 수정
                </button>
                <button onClick={() => onDeleteConference(ev.id)}
                  className="rounded-full px-2.5 py-1 flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.5)', color: C.inkSoft, fontSize: '10px' }}>
                  <Trash2 size={10} /> 삭제
                </button>
                {days !== null && (
                  <div className="rounded-full px-3 py-1" style={{ background: C.ink, color: C.paper, fontSize: '11px' }}>
                    {days === 0 ? '오늘' : days > 0 ? `D−${days}` : `D+${-days}`}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontSize: '14px', color: C.ink, marginTop: '12px', fontWeight: 500 }}>{ev.name}</div>
            <div className="flex items-center gap-3 mt-2 flex-wrap" style={{ fontSize: '12px', color: C.inkSoft }}>
              {ev.time && <span className="flex items-center gap-1"><Clock size={11} /> {formatKoreanTime(ev.time)}</span>}
              {ev.location && <span className="flex items-center gap-1"><MapPin size={11} /> {ev.location}</span>}
            </div>
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <SectionLabel num="₩" label="회비 현황" inline />
        <button onClick={onEditDues}
          className="rounded-full px-2.5 py-1 flex items-center gap-1"
          style={{ background: C.paper, border: `1px solid ${C.line}`, color: C.inkSoft, fontSize: '10px' }}>
          <Pencil size={10} /> 수정
        </button>
      </div>
      <div className="rounded-xl p-5 mb-8" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <div className="flex justify-between items-center">
          <div>
            <div style={{ fontSize: '11px', color: C.inkSoft }}>현재 잔액</div>
            <div style={{ fontFamily: fontSerif, fontSize: '26px', fontWeight: 700, color: C.ink, marginTop: '2px' }}>
              ₩ {(duesBalance || 0).toLocaleString('ko-KR')}
            </div>
          </div>
          <Wallet size={28} style={{ color: C.accent, opacity: 0.6 }} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <SectionLabel num="↓" label="지난 모임" inline />
        <button onClick={onAddPast}
          className="rounded-full px-2.5 py-1 flex items-center gap-1"
          style={{ background: C.ink, color: C.paper, fontSize: '10px', fontWeight: 500 }}>
          <Plus size={11} /> 추가
        </button>
      </div>
      <div className="space-y-2 mb-8">
        {(pastMeetingsList || []).length === 0 && (
          <div className="rounded-xl p-6 text-center" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
            <div style={{ fontSize: '12px', color: C.inkSoft, fontStyle: 'italic' }}>
              지난 모임 기록이 없어요
            </div>
          </div>
        )}
        {[...(pastMeetingsList || [])]
          .sort((a, b) => {
            const da = parseDate(a.date), db = parseDate(b.date);
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return db.getTime() - da.getTime();
          })
          .map((m, i) => (
          <div key={m.id || i}
            className="flex items-center gap-2 p-3 rounded-lg"
            style={{ background: C.paper }}>
            <button onClick={() => onEditPast(m)}
              className="flex-1 flex items-center gap-3 text-left min-w-0">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                   style={{ background: KIND_COLORS[m.kind || 'meeting'] || C.bg }}>
                <div style={{ fontFamily: fontSerif, fontSize: '12px', fontWeight: 700, color: C.ink }}>
                  {KIND_LABELS[m.kind || 'meeting'] || '모임'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: '13px', color: C.ink, fontWeight: 500 }}>
                  {m.topic}
                </div>
                <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: '11px', color: C.inkSoft }}>
                  <span>{formatKoreanDate(m.date)}</span>
                  {m.endDate && <span>– {formatKoreanDate(m.endDate)}</span>}
                </div>
              </div>
            </button>
            <button onClick={() => onEditPast(m)}
              className="p-1.5 flex-shrink-0"
              style={{ color: C.inkSoft }}>
              <Pencil size={13} />
            </button>
            <button onClick={() => onDeletePast(m.id)}
              className="p-1.5 flex-shrink-0"
              style={{ color: C.inkSoft }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BOARD ──────────────────────────────────────────────────────────
function BoardScreen({ posts, activeCategory, setActiveCategory, setOpenPost, onCreate }) {
  return (
    <div className="px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div style={{ fontFamily: fontSerif, fontSize: '28px', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
            게시판
          </div>
          <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px' }}>
            노하우, 케이스, 논문, 자유로운 이야기
          </div>
        </div>
        <button onClick={onCreate}
          className="rounded-full px-3.5 py-2 flex items-center gap-1.5 flex-shrink-0"
          style={{ background: C.ink, color: C.paper, fontSize: '12px', fontWeight: 500 }}>
          <Plus size={13} /> 글쓰기
        </button>
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const active = cat === activeCategory;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-full whitespace-nowrap"
              style={{
                background: active ? C.ink : 'transparent',
                color: active ? C.paper : C.inkSoft,
                border: `1px solid ${active ? C.ink : C.line}`,
                fontSize: '12px', fontWeight: 500, transition: 'all 0.2s',
              }}>
              {cat}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {posts.map(post => (
          <button key={post.id} onClick={() => setOpenPost(post)}
            className="w-full text-left rounded-xl p-5 block"
            style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: '10px', color: C.accent, fontWeight: 600, letterSpacing: '0.05em' }}>{post.category}</span>
              <span style={{ color: C.line }}>·</span>
              <span style={{ fontSize: '11px', color: C.inkSoft }}>{formatTimeAgo(post.t || post.id)}</span>
            </div>
            <div style={{ fontFamily: fontSerif, fontSize: '15px', fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>
              {post.title}
            </div>
            <div className="mt-1.5" style={{ fontSize: '12px', color: C.inkSoft, lineHeight: 1.5 }}>
              {post.preview}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: C.line }}>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                     style={{ background: findMember(post.authorId).color, color: C.ink, fontFamily: fontSerif, fontSize: '10px' }}>
                  {findMember(post.authorId).initial}
                </div>
                <span style={{ fontSize: '11px', color: C.ink, fontWeight: 500 }}>{post.author}</span>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: '11px', color: C.inkSoft }}>
                                <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {post.comments}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PostDetail({ post, user, onEdit, onDelete, onAddComment, onDeleteComment }) {
  const author = findMember(post.authorId);
  const isMine = user && post.authorId === user.id;
  const commentList = Array.isArray(post.commentList) ? post.commentList : [];

  const [draftComment, setDraftComment] = useState('');

  const submitComment = () => {
    if (!draftComment.trim()) return;
    onAddComment(draftComment);
    setDraftComment('');
  };

  return (
    <div className="px-6 pb-8">
      <div style={{ fontSize: '11px', color: C.accent, fontWeight: 600, letterSpacing: '0.1em' }}>{post.category}</div>
      <div style={{ fontFamily: fontSerif, fontSize: '24px', fontWeight: 700, color: C.ink, lineHeight: 1.35, marginTop: '8px' }}>
        {post.title}
      </div>
      <div className="flex items-center gap-3 mt-4 pb-4 border-b" style={{ borderColor: C.line }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center"
             style={{ background: author.color, color: C.ink, fontFamily: fontSerif, fontSize: '14px' }}>
          {author.initial}
        </div>
        <div className="flex-1">
          <div style={{ fontSize: '13px', color: C.ink, fontWeight: 600 }}>{author.name}</div>
          <div style={{ fontSize: '11px', color: C.inkSoft }}>{author.clinic || ''} {author.clinic && '·'} {formatTimeAgo(post.t || post.id)}</div>
        </div>
        {isMine && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: C.paper, border: `1px solid ${C.line}`, fontSize: '11px', color: C.ink }}>
              <Pencil size={11} /> 수정
            </button>
            <button onClick={onDelete}
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: C.paper, border: `1px solid ${C.line}`, fontSize: '11px', color: C.inkSoft }}>
              <Trash2 size={11} /> 삭제
            </button>
          </div>
        )}
      </div>
      <div className="mt-5" style={{ fontSize: '14px', color: C.ink, lineHeight: 1.8, fontFamily: fontSerif, whiteSpace: 'pre-wrap' }}>
        {post.preview}
      </div>

      {Array.isArray(post.images) && post.images.length > 0 && (
        <div className="mt-5 space-y-2">
          {post.images.map((img, i) => (
            <div key={i} className="rounded-lg overflow-hidden" style={{ background: C.paper }}>
              <img src={img} alt="" style={{ width: '100%', display: 'block' }} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t" style={{ borderColor: C.line }}>
        <div style={{ fontSize: '11px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '12px' }}>
          댓글 {commentList.length}
        </div>
        {commentList.length === 0 ? (
          <div className="rounded-lg p-4 text-center" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
            <div style={{ fontSize: '12px', color: C.inkSoft, fontStyle: 'italic' }}>
              아직 댓글이 없어요. 첫 댓글을 남겨보세요.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {commentList.map((c) => {
              const cAuthor = findMember(c.authorId || 1);
              const isMineC = user && c.authorId === user.id;
              const date = new Date(c.t || 0);
              const timeAgo = (() => {
                const diff = Date.now() - (c.t || 0);
                const m = Math.floor(diff / 60000);
                const h = Math.floor(diff / 3600000);
                const d = Math.floor(diff / 86400000);
                if (d > 0) return `${d}일 전`;
                if (h > 0) return `${h}시간 전`;
                if (m > 0) return `${m}분 전`;
                return '방금';
              })();
              return (
                <div key={c.t} className="rounded-lg p-3" style={{ background: C.paper }}>
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                         style={{ background: cAuthor.color, color: C.ink, fontFamily: fontSerif, fontSize: '11px' }}>
                      {cAuthor.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '12px', color: C.ink, fontWeight: 600 }}>{cAuthor.name}</span>
                        <span style={{ fontSize: '10px', color: C.inkSoft }}>{timeAgo}</span>
                        {isMineC && (
                          <button onClick={() => onDeleteComment(c.t)}
                            className="ml-auto" style={{ color: C.inkSoft }}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      <div className="mt-1" style={{ fontSize: '13px', color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {c.text}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 댓글 입력창 */}
        <div className="mt-4 flex gap-2">
          <input
            value={draftComment}
            onChange={e => setDraftComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
            placeholder="댓글을 입력하세요"
            className="flex-1 rounded-full px-4 py-2 outline-none"
            style={{
              background: C.paper, border: `1px solid ${C.line}`,
              fontSize: '13px', color: C.ink,
            }} />
          <button onClick={submitComment}
            disabled={!draftComment.trim()}
            className="rounded-full px-4 py-2"
            style={{
              background: draftComment.trim() ? C.ink : C.line,
              color: C.paper, fontSize: '12px', fontWeight: 600,
              opacity: draftComment.trim() ? 1 : 0.5,
            }}>
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MEMBERS ────────────────────────────────────────────────────────
function MembersScreen({ user, memberBios, memberPhones, onEditBio }) {
  return (
    <div className="px-6">
      <div className="mb-6">
        <div style={{ fontFamily: fontSerif, fontSize: '28px', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>
          동료 원장님들
        </div>
        <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px' }}>
          각자의 자리에서, 같은 방향을 바라보며.
        </div>
      </div>

      <div className="space-y-3">
        {members.map(m => {
          const isMe = user && user.id === m.id;
          const bio = (memberBios && memberBios[m.id]) || '';
          const phone = (memberPhones && memberPhones[m.id]) || '';
          const clinic = m.clinic || '';
          return (
            <div key={m.id} className="flex gap-4 p-4 rounded-xl"
                 style={{ background: C.paper, border: `1px solid ${C.line}` }}>
              <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center"
                   style={{ background: m.color, color: C.ink, fontFamily: fontSerif, fontSize: '22px', fontWeight: 500 }}>
                {m.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div style={{ fontFamily: fontSerif, fontSize: '17px', fontWeight: 700, color: C.ink }}>{m.name}</div>
                  <div style={{ fontSize: '11px', color: C.inkSoft }}>원장</div>
                  {clinic && (
                    <>
                      <div style={{ fontSize: '11px', color: C.inkSoft }}>·</div>
                      <div style={{ fontSize: '12px', color: C.ink, fontWeight: 500 }}>{clinic}</div>
                    </>
                  )}
                  {isMe && (
                    <button onClick={onEditBio}
                      className="ml-auto rounded-full px-2 py-0.5 flex items-center gap-1"
                      style={{ background: C.bg, color: C.inkSoft, fontSize: '10px' }}>
                      <Pencil size={9} /> 수정
                    </button>
                  )}
                </div>
                {phone && (
                  <div style={{ fontSize: '12px', color: C.inkSoft, marginTop: '4px', fontFamily: fontSans }}>
                    {phone}
                  </div>
                )}
                {bio ? (
                  <div className="mt-2" style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: fontSerif }}>
                    {bio}
                  </div>
                ) : (
                  <div className="mt-2" style={{ fontSize: '12px', color: C.inkSoft, fontStyle: 'italic', opacity: 0.6 }}>
                    {isMe ? '수정을 눌러 정보를 작성하세요' : '아직 자기소개가 없어요'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-5 rounded-xl text-center" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
        <div style={{ fontFamily: fontSerif, fontSize: '13px', color: C.inkSoft, fontStyle: 'italic', lineHeight: 1.7 }}>
          "욕심 없이 흐르는 강처럼<br/>꾸준한 공부와 지혜를 나누는 모임"
        </div>
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ─────────────────────────────────────────────────────
function BottomNav({ screen, setScreen }) {
  const tabs = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'schedule', label: '모임', icon: Calendar },
    { id: 'board', label: '게시판', icon: BookOpen },
    { id: 'members', label: '동료', icon: Users },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 px-6 pt-3 pb-6 flex justify-around"
         style={{ background: C.bg, borderTop: `1px solid ${C.line}` }}>
      {tabs.map(t => {
        const active = screen === t.id;
        const Icon = t.icon;
        return (
          <button key={t.id} onClick={() => setScreen(t.id)} className="flex flex-col items-center gap-1">
            <Icon size={20} style={{ color: active ? C.ink : C.inkSoft, strokeWidth: active ? 2 : 1.5 }} />
            <span style={{ fontSize: '10px', color: active ? C.ink : C.inkSoft, fontWeight: active ? 600 : 400 }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── PIN AUTH ───────────────────────────────────────────────────────
function PinScreen({ user, mode, onSuccess, onCancel }) {
  const [digits, setDigits] = useState('');
  const [stage, setStage] = useState(mode === 'set' ? 'first' : 'enter');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const labels = { first: '새 PIN을 만드세요', confirm: '한 번 더 입력', enter: 'PIN을 입력하세요' };
  const sublabels = {
    first: '나만 알고 있는 4자리 비밀번호 (어디서든 동일하게 사용)',
    confirm: '확인을 위해 동일하게 입력해주세요',
    enter: `${user.name} 원장님으로 들어가기`,
  };

  const triggerError = (msg, reset) => {
    setError(msg); setShake(true);
    setTimeout(() => {
      setDigits(''); setError(''); setShake(false);
      if (reset) reset();
    }, 700);
  };

  const handleDigit = async (d) => {
    if (digits.length >= 4 || error) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      setTimeout(async () => {
        if (stage === 'enter') {
          const stored = await getShared(`pin-${user.id}`);
          if (stored === next) onSuccess();
          else triggerError('PIN이 일치하지 않습니다');
        } else if (stage === 'first') {
          setFirstPin(next); setDigits(''); setStage('confirm');
        } else if (stage === 'confirm') {
          if (next === firstPin) {
            await setShared(`pin-${user.id}`, next);
            onSuccess();
          } else {
            triggerError('PIN이 일치하지 않아요. 처음부터 다시', () => {
              setFirstPin(''); setStage('first');
            });
          }
        }
      }, 200);
    }
  };

  const handleBack = () => { if (digits.length > 0 && !error) setDigits(digits.slice(0, -1)); };

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-6 pt-12 pb-2 flex items-center">
        <button onClick={onCancel} style={{ color: C.ink }}><ArrowLeft size={18} /></button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
             style={{ background: user.color, color: C.ink, fontFamily: fontSerif, fontSize: '32px', fontWeight: 500 }}>
          {user.initial}
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: '20px', fontWeight: 600, color: C.ink, textAlign: 'center' }}>
          {labels[stage]}
        </div>
        <div className="mt-1.5 text-center max-w-xs" style={{ fontSize: '12px', color: C.inkSoft, lineHeight: 1.6 }}>
          {sublabels[stage]}
        </div>

        <div className={`flex gap-3 mt-8 ${shake ? 'shake' : ''}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className="w-3.5 h-3.5 rounded-full"
                 style={{
                   background: i < digits.length ? C.ink : 'transparent',
                   border: `1.5px solid ${error ? '#A85040' : (i < digits.length ? C.ink : C.line)}`,
                   transition: 'all 0.15s'
                 }} />
          ))}
        </div>
        <div className="h-5 mt-3" style={{ fontSize: '11px', color: '#A85040', textAlign: 'center' }}>
          {error}
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="grid grid-cols-3 gap-2.5">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleDigit(String(n))}
              className="aspect-square rounded-full flex items-center justify-center"
              style={{ background: C.paper, border: `1px solid ${C.line}`, fontFamily: fontSerif, fontSize: '24px', color: C.ink }}>
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => handleDigit('0')}
            className="aspect-square rounded-full flex items-center justify-center"
            style={{ background: C.paper, border: `1px solid ${C.line}`, fontFamily: fontSerif, fontSize: '24px', color: C.ink }}>
            0
          </button>
          <button onClick={handleBack}
            className="aspect-square flex items-center justify-center"
            style={{ color: C.inkSoft, fontSize: '20px' }}>
            ←
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── POST EDITOR ────────────────────────────────────────────────────
function PostEditScreen({ post, onSave, onCancel }) {
  const isEdit = post && post !== 'new';
  const [category, setCategory] = useState(isEdit ? post.category : '시술 노하우');
  const [title, setTitle] = useState(isEdit ? post.title : '');
  const [preview, setPreview] = useState(isEdit ? post.preview : '');
  const [images, setImages] = useState(isEdit && Array.isArray(post.images) ? post.images : []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const canSave = title.trim() && preview.trim();
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...(isEdit ? { id: post.id } : {}),
      category, title: title.trim(), preview: preview.trim(),
      images,
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (images.length + files.length > 4) {
      alert('이미지는 최대 4장까지 첨부할 수 있어요.');
      return;
    }
    setUploading(true);
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f, 1000, 0.7)));
      setImages([...images, ...compressed]);
    } catch (err) {
      alert('이미지 처리 중 오류가 발생했어요.');
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={onCancel} style={{ color: C.ink, fontSize: '13px' }}>취소</button>
        <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.2em' }}>
          {isEdit ? '글 수정' : '새 글'}
        </div>
        <button onClick={handleSave} disabled={!canSave || uploading}
          style={{ color: canSave && !uploading ? C.ink : C.inkSoft, fontSize: '13px', fontWeight: 600, opacity: canSave && !uploading ? 1 : 0.5 }}>
          {isEdit ? '저장' : '게시'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-8">
        <div className="flex gap-1 mt-2 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {['시술 노하우', '케이스 공유', '논문·학회', '자유'].map(cat => {
            const active = cat === category;
            return (
              <button key={cat} onClick={() => setCategory(cat)}
                className="px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{
                  background: active ? C.ink : 'transparent',
                  color: active ? C.paper : C.inkSoft,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  fontSize: '12px', fontWeight: 500,
                }}>{cat}</button>
            );
          })}
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full bg-transparent outline-none mb-4"
          style={{
            fontFamily: fontSerif, fontSize: '20px', fontWeight: 600, color: C.ink,
            borderBottom: `1px solid ${C.line}`, paddingBottom: '12px',
          }} />

        <textarea value={preview} onChange={e => setPreview(e.target.value)}
          placeholder="내용을 작성하세요..."
          className="w-full bg-transparent outline-none resize-none"
          style={{
            fontSize: '14px', color: C.ink, lineHeight: 1.8, fontFamily: fontSerif,
            minHeight: '240px',
          }} />

        {/* 이미지 미리보기 */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {images.map((img, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1', background: C.paper }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                  style={{ width: '24px', height: '24px', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 이미지 첨부 버튼 */}
        <div className="mt-4">
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={handleFileChange}
            style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()}
            disabled={uploading || images.length >= 4}
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: 'transparent', border: `1px dashed ${C.line}`,
              color: uploading || images.length >= 4 ? C.inkSoft : C.ink,
              fontSize: '12px',
              opacity: images.length >= 4 ? 0.4 : 1,
            }}>
            {uploading ? (
              <><Loader2 size={13} className="animate-spin" /> 처리 중...</>
            ) : (
              <><Plus size={13} /> 사진 첨부 ({images.length}/4)</>
            )}
          </button>
          <div style={{ fontSize: '10px', color: C.inkSoft, marginTop: '6px' }}>
            이미지는 자동으로 압축되어 저장돼요.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MEETING EDITOR ─────────────────────────────────────────────────
function EditMeetingScreen({ meeting, onSave, onCancel }) {
  const [date, setDate] = useState(isoFromAny(meeting?.date) || '');
  const [time, setTime] = useState(meeting?.time && /^\d{1,2}:\d{2}$/.test(meeting.time) ? meeting.time : '');
  const [location, setLocation] = useState(meeting?.location || '');
  const [topic, setTopic] = useState(meeting?.topic || '');

  const days = getDaysUntil(date);
  const weekday = getKoreanWeekday(date);
  const canSave = date && topic.trim();

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={onCancel} style={{ color: C.ink, fontSize: '13px' }}>취소</button>
        <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.2em' }}>모임 일정 수정</div>
        <button onClick={() => canSave && onSave({
          ...(meeting || {}),
          date, time, location: location.trim(), topic: topic.trim(),
        })}
          disabled={!canSave}
          style={{ color: canSave ? C.ink : C.inkSoft, fontSize: '13px', fontWeight: 600, opacity: canSave ? 1 : 0.5 }}>
          저장
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-8">
        <div className="rounded-xl p-3.5 mb-5 flex items-start gap-2.5"
             style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Sparkles size={14} style={{ color: C.accent, marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: C.inkSoft, lineHeight: 1.6 }}>
            공하 멤버 모두 자유롭게 수정할 수 있어요. 변경 즉시 반영됩니다.
          </div>
        </div>

        <Field label="주제" value={topic} onChange={setTopic} placeholder="이번 모임 주제" />

        <div className="mb-4">
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
            날짜
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: '14px', color: C.ink, fontFamily: fontSerif,
              borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
            }} />
          {date && (
            <div className="flex items-center gap-3 mt-2" style={{ fontSize: '11px', color: C.inkSoft }}>
              <span>{weekday}</span>
              {days !== null && (
                <span style={{ color: C.accent, fontWeight: 600 }}>
                  {days === 0 ? '오늘' : days > 0 ? `D−${days}` : `D+${-days}`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
            시간
          </div>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: '14px', color: C.ink, fontFamily: fontSerif,
              borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
            }} />
          {time && (
            <div className="mt-2" style={{ fontSize: '11px', color: C.inkSoft }}>
              {formatKoreanTime(time)}
            </div>
          )}
        </div>

        <Field label="장소" value={location} onChange={setLocation} placeholder="예) 핀다의원" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type }) {
  return (
    <div className="mb-4">
      <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
        {label}
      </div>
      <input type={type || 'text'} value={value}
        onChange={e => onChange(type === 'number' ? e.target.value : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none"
        style={{
          fontSize: '14px', color: C.ink, fontFamily: fontSerif,
          borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
        }} />
    </div>
  );
}

// ─── DUES EDITOR ────────────────────────────────────────────────────
function EditDuesScreen({ balance, onSave, onCancel }) {
  const [amount, setAmount] = useState(balance);
  const display = (typeof amount === 'number' && !isNaN(amount)) ? amount.toLocaleString('ko-KR') : '0';

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={onCancel} style={{ color: C.ink, fontSize: '13px' }}>취소</button>
        <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.2em' }}>회비 잔액 수정</div>
        <button onClick={() => onSave(parseInt(amount) || 0)}
          style={{ color: C.ink, fontSize: '13px', fontWeight: 600 }}>저장</button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-8">
        <div className="rounded-xl p-3.5 mb-6 flex items-start gap-2.5"
             style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Sparkles size={14} style={{ color: C.accent, marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: C.inkSoft, lineHeight: 1.6 }}>
            공하 멤버 모두 자유롭게 수정할 수 있어요. 입출금 발생 시 잔액을 갱신해주세요.
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px' }}>
            현재 잔액 (원)
          </div>
          <input type="number" value={amount}
            onChange={e => setAmount(parseInt(e.target.value) || 0)}
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: '36px', color: C.ink, fontFamily: fontSerif, fontWeight: 700,
              borderBottom: `1.5px solid ${C.line}`, paddingBottom: '14px',
            }} />
          <div className="mt-3" style={{ fontSize: '14px', color: C.inkSoft, fontFamily: fontSerif }}>
            ₩ {display}
          </div>
        </div>

        <div className="mt-8" style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '12px' }}>
          빠른 조정
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '+ 6만원', d: 60000 },
            { label: '+ 60만원', d: 600000 },
            { label: '− 4만원', d: -40000 },
            { label: '− 48만원', d: -480000 },
          ].map(b => (
            <button key={b.label} onClick={() => setAmount((parseInt(amount) || 0) + b.d)}
              className="rounded-lg py-2.5"
              style={{ background: C.paper, border: `1px solid ${C.line}`, fontSize: '13px', color: C.ink }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MY INFO EDITOR ─────────────────────────────────────────────────
function EditMyInfoScreen({ user, currentBio, currentPhone, onSave, onCancel }) {
  const [bio, setBio] = useState(currentBio || '');
  const [phone, setPhone] = useState(currentPhone || '');

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={onCancel} style={{ color: C.ink, fontSize: '13px' }}>취소</button>
        <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.2em' }}>내 정보 수정</div>
        <button onClick={() => onSave(bio.trim(), phone.trim())}
          style={{ color: C.ink, fontSize: '13px', fontWeight: 600 }}>저장</button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
               style={{ background: user.color, color: C.ink, fontFamily: fontSerif, fontSize: '22px', fontWeight: 500 }}>
            {user.initial}
          </div>
          <div>
            <div style={{ fontFamily: fontSerif, fontSize: '18px', fontWeight: 700, color: C.ink }}>{user.name}</div>
            <div style={{ fontSize: '12px', color: C.inkSoft }}>원장 {user.clinic && `· ${user.clinic}`}</div>
          </div>
        </div>

        <div className="rounded-xl p-3.5 mb-5 flex items-start gap-2.5"
             style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Sparkles size={14} style={{ color: C.accent, marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: C.inkSoft, lineHeight: 1.6 }}>
            동료 원장님들에게 보여지는 정보예요. 본인만 수정할 수 있습니다.
          </div>
        </div>

        <div className="mb-5">
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px' }}>
            전화번호
          </div>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: '15px', color: C.ink,
              borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
            }} />
        </div>

        <div>
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px' }}>
            자기소개
          </div>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            placeholder="간단한 자기소개를 적어주세요"
            className="w-full bg-transparent outline-none resize-none"
            style={{
              fontSize: '14px', color: C.ink, lineHeight: 1.8, fontFamily: fontSerif,
              minHeight: '180px', borderBottom: `1px solid ${C.line}`, paddingBottom: '12px',
            }} />
        </div>
      </div>
    </div>
  );
}

// ─── EVENT EDITOR ───────────────────────────────────────────────────
function EditEventScreen({ event, onSave, onDelete, onCancel }) {
  const isNew = event === 'new';
  const [kind, setKind] = useState(isNew ? 'meeting' : (event.kind || 'conference'));
  const [name, setName] = useState(isNew ? '' : event.name || event.topic || '');
  const [date, setDate] = useState(isNew ? '' : (event.dateIso || isoFromAny(event.date) || ''));
  const [endDate, setEndDate] = useState(isNew ? '' : (event.endDate || ''));
  const [time, setTime] = useState(isNew ? '' : (event.time || ''));
  const [location, setLocation] = useState(isNew ? '' : event.location || '');

  const canSave = name.trim() && date.trim();

  const days = getDaysUntil(date);
  const weekday = getKoreanWeekday(date);

  const isMulti = (kind === 'conference');

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={onCancel} style={{ color: C.ink, fontSize: '13px' }}>취소</button>
        <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.2em' }}>
          {isNew ? '일정 추가' : '일정 수정'}
        </div>
        <button onClick={() => canSave && onSave({
          ...(isNew ? {} : { id: event.id }),
          kind,
          name: name.trim(),
          ...(kind === 'meeting' ? { topic: name.trim() } : {}),
          date: date,
          ...(isMulti && endDate ? { endDate } : {}),
          ...(kind === 'meeting' && time ? { time } : {}),
          location: location.trim(),
        })}
          disabled={!canSave}
          style={{ color: canSave ? C.ink : C.inkSoft, fontSize: '13px', fontWeight: 600, opacity: canSave ? 1 : 0.5 }}>
          저장
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-8">
        <div className="rounded-xl p-3.5 mb-5 flex items-start gap-2.5"
             style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Sparkles size={14} style={{ color: C.accent, marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: C.inkSoft, lineHeight: 1.6 }}>
            공하 멤버 모두 자유롭게 추가·수정할 수 있어요.
          </div>
        </div>

        {isNew && (
          <div className="mb-5">
            <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px' }}>
              종류
            </div>
            <div className="flex gap-2 flex-wrap">
              {[{v:'meeting',l:'모임'},{v:'seminar',l:'세미나'},{v:'conference',l:'학회'}].map(o => (
                <button key={o.v} onClick={() => setKind(o.v)}
                  className="px-4 py-1.5 rounded-full"
                  style={{
                    background: kind === o.v ? C.ink : 'transparent',
                    color: kind === o.v ? C.paper : C.inkSoft,
                    border: `1px solid ${kind === o.v ? C.ink : C.line}`,
                    fontSize: '12px', fontWeight: 500,
                  }}>{o.l}</button>
              ))}
            </div>
          </div>
        )}

        <Field label={kind === 'meeting' ? '주제' : '이름'} value={name} onChange={setName}
          placeholder={kind === 'meeting' ? '예) 트리필프로 세미나' : '예) KCD 춘계학술대회'} />

        <div className="mb-4">
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
            {isMulti ? '시작 날짜' : '날짜'}
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: '14px', color: C.ink, fontFamily: fontSerif,
              borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
            }} />
          {date && (
            <div className="flex items-center gap-3 mt-2" style={{ fontSize: '11px', color: C.inkSoft }}>
              <span>{weekday}</span>
              {days !== null && (
                <span style={{ color: C.accent, fontWeight: 600 }}>
                  {days === 0 ? '오늘' : days > 0 ? `D−${days}` : `D+${-days}`}
                </span>
              )}
            </div>
          )}
        </div>

        {isMulti && (
          <div className="mb-4">
            <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
              종료 날짜 (선택)
            </div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-transparent outline-none"
              style={{
                fontSize: '14px', color: C.ink, fontFamily: fontSerif,
                borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
              }} />
          </div>
        )}

        {(kind === 'meeting' || kind === 'seminar') && (
          <div className="mb-4">
            <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
              시간
            </div>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full bg-transparent outline-none"
              style={{
                fontSize: '14px', color: C.ink, fontFamily: fontSerif,
                borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
              }} />
            {time && (
              <div className="mt-2" style={{ fontSize: '11px', color: C.inkSoft }}>
                {formatKoreanTime(time)}
              </div>
            )}
          </div>
        )}

        <Field label="장소" value={location} onChange={setLocation} placeholder="예) 핀다의원" />

        {onDelete && (
          <button onClick={onDelete}
            className="mt-8 w-full rounded-lg py-3 flex items-center justify-center gap-1.5"
            style={{ background: 'transparent', color: C.inkSoft, border: `1px solid ${C.line}`, fontSize: '13px' }}>
            <Trash2 size={13} /> 일정 삭제
          </button>
        )}
      </div>
    </div>
  );
}

// ISO로 변환 가능하면 그렇게 하고, 아니면 빈 값 (옛 한국어 형식이면 빈 값)
function isoFromAny(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

// ─── PAST MEETING EDITOR (일정 추가와 동일 포맷, 시간 제외) ────────
function EditPastMeetingScreen({ record, onSave, onDelete, onCancel }) {
  const isNew = record === 'new';
  const [kind, setKind] = useState(isNew ? 'meeting' : (record.kind || 'meeting'));
  const [topic, setTopic] = useState(isNew ? '' : record.topic || '');
  const [date, setDate] = useState(isNew ? '' : (isoFromAny(record.date) || ''));
  const [endDate, setEndDate] = useState(isNew ? '' : (record.endDate || ''));
  const [location, setLocation] = useState(isNew ? '' : record.location || '');

  const canSave = topic.trim() && date.trim();
  const isMulti = (kind === 'conference');
  const weekday = getKoreanWeekday(date);

  return (
    <div className="h-full flex flex-col fade-in" style={{ background: C.bg }}>
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <button onClick={onCancel} style={{ color: C.ink, fontSize: '13px' }}>취소</button>
        <div style={{ fontSize: '11px', color: C.inkSoft, letterSpacing: '0.2em' }}>
          {isNew ? '지난 모임 추가' : '지난 모임 수정'}
        </div>
        <button onClick={() => canSave && onSave({
          ...(isNew ? {} : { id: record.id }),
          kind,
          topic: topic.trim(),
          date: date.trim(),
          ...(isMulti && endDate ? { endDate } : {}),
          location: location.trim(),
        })}
          disabled={!canSave}
          style={{ color: canSave ? C.ink : C.inkSoft, fontSize: '13px', fontWeight: 600, opacity: canSave ? 1 : 0.5 }}>
          저장
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-8">
        <div className="rounded-xl p-3.5 mb-5 flex items-start gap-2.5"
             style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Sparkles size={14} style={{ color: C.accent, marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: C.inkSoft, lineHeight: 1.6 }}>
            공하 멤버들이 함께 채워가요. 추가하면 자동으로 날짜순 정렬됩니다.
          </div>
        </div>

        <div className="mb-5">
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '8px' }}>
            종류
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{v:'meeting',l:'모임'},{v:'seminar',l:'세미나'},{v:'conference',l:'학회'}].map(o => (
              <button key={o.v} onClick={() => setKind(o.v)}
                className="px-4 py-1.5 rounded-full"
                style={{
                  background: kind === o.v ? C.ink : 'transparent',
                  color: kind === o.v ? C.paper : C.inkSoft,
                  border: `1px solid ${kind === o.v ? C.ink : C.line}`,
                  fontSize: '12px', fontWeight: 500,
                }}>{o.l}</button>
            ))}
          </div>
        </div>

        <Field label="주제" value={topic} onChange={setTopic}
          placeholder={kind === 'meeting' ? '예) 광안리 알콜모임' : '예) KCD 춘계학술대회'} />

        <div className="mb-4">
          <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
            {isMulti ? '시작 날짜' : '날짜'}
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: '14px', color: C.ink, fontFamily: fontSerif,
              borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
            }} />
          {date && (
            <div className="mt-2" style={{ fontSize: '11px', color: C.inkSoft }}>
              {weekday}
            </div>
          )}
        </div>

        {isMulti && (
          <div className="mb-4">
            <div style={{ fontSize: '10px', color: C.inkSoft, fontWeight: 600, letterSpacing: '0.1em', marginBottom: '6px' }}>
              종료 날짜 (선택)
            </div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-transparent outline-none"
              style={{
                fontSize: '14px', color: C.ink, fontFamily: fontSerif,
                borderBottom: `1px solid ${C.line}`, paddingBottom: '8px',
              }} />
          </div>
        )}

        <Field label="장소" value={location} onChange={setLocation} placeholder="예) 핀다의원" />

        {onDelete && (
          <button onClick={onDelete}
            className="mt-8 w-full rounded-lg py-3 flex items-center justify-center gap-1.5"
            style={{ background: 'transparent', color: C.inkSoft, border: `1px solid ${C.line}`, fontSize: '13px' }}>
            <Trash2 size={13} /> 삭제
          </button>
        )}
      </div>
    </div>
  );
}

// ─── NOTIFICATION PANEL ─────────────────────────────────────────────
function NotifPanel({ items, onClose, onSeen, onOpenPost, onOpenEvent }) {
  return (
    <div className="absolute inset-0 z-50 fade-in" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="absolute right-4 top-20 rounded-xl overflow-hidden"
        style={{
          background: C.paper, border: `1px solid ${C.line}`,
          width: '300px', maxHeight: '70%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
        }}>
        <div className="px-4 py-3 flex items-center justify-between"
             style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: fontSerif, fontSize: '14px', fontWeight: 700, color: C.ink }}>알림</div>
          {items.length > 0 && (
            <button onClick={onSeen} style={{ fontSize: '11px', color: C.inkSoft }}>
              모두 읽음
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {items.length === 0 ? (
            <div className="p-8 text-center" style={{ fontSize: '12px', color: C.inkSoft, fontStyle: 'italic' }}>
              새 알림이 없어요
            </div>
          ) : (
            items.map((it, i) => (
              <button key={i}
                onClick={() => it.kind === 'post' ? onOpenPost(it) : onOpenEvent()}
                className="w-full text-left p-3 flex items-start gap-2.5"
                style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                     style={{
                       background: it.kind === 'post' ? C.accentSoft :
                         it.kind === 'event' && it.kind === 'meeting' ? '#F0E7CE' :
                         '#DBD0B8',
                       color: C.ink,
                     }}>
                  {it.kind === 'post' ? <BookOpen size={12} /> : <Calendar size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: '10px', color: C.accent, fontWeight: 600, letterSpacing: '0.05em' }}>
                    {it.kind === 'post' ? '새 게시글' : '새 일정'}
                  </div>
                  <div className="truncate mt-0.5" style={{ fontSize: '12px', color: C.ink, fontWeight: 500 }}>
                    {it.title || it.name || it.topic}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}