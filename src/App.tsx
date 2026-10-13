import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Cloud, CloudOff, Flower2,
  Gamepad2, Heart, ImagePlus, ListChecks, LockKeyhole, Mail, Music2, Pause, Play,
  Plus, RotateCcw, Settings2, Shuffle, SkipBack, SkipForward, Sparkles, Volume2,
  VolumeX, X,
} from 'lucide-react'
import {
  useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent,
} from 'react'
import type { User } from 'firebase/auth'
import {
  firebaseConfigured, removeSharedRecord, saveSharedRecord,
  signIn, signOutUser, watchAuth, watchCollection,
} from './firebase'

type Page = 'home' | 'memories' | 'letters' | 'date' | 'games' | 'bucket' | 'monthsary'
type Memory = { id: string; title: string; date: string; caption: string; photo: string }
type Letter = { id: string; title: string; type: string; message: string; locked?: boolean }
type BucketItem = { id: string; text: string; done: boolean }
type Song = { id: string; title: string; url: string; bundled: true; cover?: string }
type QuizQuestion = { question: string; options: string[]; answer: number }
type Settings = {
  you: string; sweetheart: string; anniversary: string; welcome: string; monthsaryPhoto: string;
  monthMessages: string[]; finalLetter: string; dateIdeas: string[]; dateQuestions: string[]
}

const defaultSettings: Settings = {
  you: 'your name', sweetheart: 'your sweetheart', anniversary: '',
  welcome: 'A tiny home for all the little things that make us, us.',
  monthsaryPhoto: '',
  monthMessages: ['Every day with you is my favorite little adventure.', 'Thank you for being my safe place.', 'Here is to all the memories still waiting for us.'],
  finalLetter: 'Thank you for making this little world ours. I love you, always. ♡',
  dateIdeas: ['Make a blanket fort', 'Cook a new recipe together', 'Have a sunset walk', 'Pick a movie neither of us has seen', 'Make a tiny playlist for each other', 'Have a living-room picnic'],
  dateQuestions: ['What is one tiny thing that always makes your day better?', 'Which place should we explore together?', 'What is a song that feels like us?', 'What would our perfect slow Sunday look like?'],
}
const starterLetters: Letter[] = [
  { id: 'miss-you', title: 'open when you miss me', type: 'open when', message: 'A little reminder: you are loved, even from far away. ♡' },
  { id: 'compliment', title: 'a tiny reminder', type: 'sweet note', message: 'You make ordinary days feel a little more golden.' },
  { id: 'monthsary', title: 'happy monthsary, love', type: 'monthsary', message: 'Happy monthsary! I am so glad we get to make our own little world together. Add your own words here ♡' },
]
const compliments = ['You make the world feel softer.', 'Your smile is my favorite little plot twist.', 'I am so lucky to be on your team.', 'You are lovely in all the quiet, ordinary ways too.', 'You make even a regular day feel special.']
const movieIdeas = ['A cozy comedy', 'A nostalgic favorite', 'A gentle animated movie', 'A mystery to solve together', 'A movie picked by a coin toss']
const snacks = ['Popcorn & strawberry milk', 'Fruit and something chocolatey', 'The coziest cookies', 'Chips, dip, and a shared blanket', 'Your favorite little treats']
const quizDefaults: QuizQuestion[] = [
  { question: 'What is my favorite kind of date?', options: ['A cozy night in', 'A big surprise trip', 'A very early hike'], answer: 0 },
  { question: 'What makes me smile the fastest?', options: ['A sweet note', 'Doing the laundry', 'A meeting invite'], answer: 0 },
  { question: 'What should we do more often?', options: ['Make little memories', 'Answer emails', 'Worry about tomorrow'], answer: 0 },
]
const matchFaces = ['♡', '🌷', '🎀', '⭐', '🍓', '🧸']
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(`us-exe-${key}`)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}
const saveStored = (key: string, value: unknown) => {
  try {
    localStorage.setItem(`us-exe-${key}`, JSON.stringify(value))
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : 'Browser storage is unavailable.'
    window.dispatchEvent(new CustomEvent('us-exe-storage-error', { detail }))
  }
}
const pages: Array<{ id: Page; label: string; icon: typeof Heart }> = [
  { id: 'home', label: 'our home', icon: Heart },
  { id: 'memories', label: 'memories', icon: ImagePlus },
  { id: 'letters', label: 'love notes', icon: Mail },
  { id: 'date', label: 'date night', icon: Sparkles },
  { id: 'games', label: 'little games', icon: Gamepad2 },
  { id: 'bucket', label: 'our list', icon: ListChecks },
  { id: 'monthsary', label: 'monthsary', icon: Flower2 },
]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [settings, setSettings] = useState<Settings>(() => firebaseConfigured
    ? defaultSettings
    : { ...defaultSettings, ...readStored<Partial<Settings>>('settings', {}) })
  const [memories, setMemories] = useState<Memory[]>(() => firebaseConfigured ? [] : readStored('memories', []))
  const [letters, setLetters] = useState<Letter[]>(() => firebaseConfigured ? [] : readStored('letters', starterLetters))
  const [bucket, setBucket] = useState<BucketItem[]>(() => firebaseConfigured ? [] : readStored('bucket', []))
  const [user, setUser] = useState<User | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [compliment, setCompliment] = useState('')
  const [secret, setSecret] = useState('')
  const [letterOpen, setLetterOpen] = useState<Letter | null>(null)
  const [photoOpen, setPhotoOpen] = useState<Memory | null>(null)
  const [quiz, setQuiz] = useState<QuizQuestion[]>(() => firebaseConfigured ? quizDefaults : readStored('quiz', quizDefaults))
  const [muted, setMuted] = useState(() => readStored('muted', false))
  const [bundledSongs, setBundledSongs] = useState<Song[]>([])
  const [currentSong, setCurrentSong] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.72)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [dateWheel, setDateWheel] = useState('')
  const [dateIdeaDraft, setDateIdeaDraft] = useState('')
  const [dateQuestionIndex, setDateQuestionIndex] = useState(0)
  const [dateQuestionDraft, setDateQuestionDraft] = useState('')
  const [bucketInput, setBucketInput] = useState('')
  const [memoryDraft, setMemoryDraft] = useState<Memory | null>(null)
  const [letterDraft, setLetterDraft] = useState<Letter | null>(null)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [elapsedDays, setElapsedDays] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const gameRef = useRef<HTMLDivElement>(null)

  const allSongs = bundledSongs
  const activeSong = allSongs[currentSong] ?? null
  const today = new Date()
  const isAnniversaryToday = Boolean(settings.anniversary && settings.anniversary.slice(5) ===
    `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)

  useEffect(() => { if (!firebaseConfigured) saveStored('settings', settings) }, [settings])
  useEffect(() => { if (!firebaseConfigured) saveStored('memories', memories) }, [memories])
  useEffect(() => { if (!firebaseConfigured) saveStored('letters', letters) }, [letters])
  useEffect(() => { if (!firebaseConfigured) saveStored('bucket', bucket) }, [bucket])
  useEffect(() => { if (!firebaseConfigured) saveStored('quiz', quiz) }, [quiz])
  useEffect(() => { saveStored('muted', muted) }, [muted])
  useEffect(() => {
    let cancelled = false
    const manifestUrl = new URL(`${import.meta.env.BASE_URL}audio/playlist.json`, document.baseURI)
    void fetch(manifestUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Audio playlist returned HTTP ${response.status}.`)
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null || !('songs' in data) || !Array.isArray(data.songs)) {
        throw new Error('public/audio/playlist.json must contain a songs array.')
      }
      const songs = data.songs.map((entry: unknown, index: number): Song => {
        if (typeof entry !== 'object' || entry === null || !('file' in entry) ||
          typeof entry.file !== 'string' || !/^[\w .()'-]+\.mp3$/i.test(entry.file)) {
          throw new Error(`Song ${index + 1} needs an MP3 filename without folder paths.`)
        }
        const title = 'title' in entry && typeof entry.title === 'string'
          ? entry.title
          : entry.file.replace(/\.mp3$/i, '')
        return {
          id: `bundled-${entry.file}`,
          title,
          url: new URL(`${import.meta.env.BASE_URL}audio/${encodeURIComponent(entry.file)}`, document.baseURI).href,
          bundled: true,
        }
      })
      if (!cancelled) setBundledSongs(songs)
    }).catch((reason: unknown) => {
      if (!cancelled) {
        const detail = reason instanceof Error ? reason.message : 'Unable to load the audio playlist.'
        setError(`Could not load public/audio/playlist.json: ${detail}`)
      }
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const reportStorageError = (event: Event) => setError((event as CustomEvent<string>).detail)
    window.addEventListener('us-exe-storage-error', reportStorageError)
    window.addEventListener('us-exe-firebase-error', reportStorageError)
    return () => {
      window.removeEventListener('us-exe-storage-error', reportStorageError)
      window.removeEventListener('us-exe-firebase-error', reportStorageError)
    }
  }, [])
  useEffect(() => watchAuth(setUser), [])
  useEffect(() => {
    if (!user) {
      if (firebaseConfigured) {
        setSettings(defaultSettings)
        setMemories([])
        setLetters([])
        setBucket([])
      }
      return
    }
    const onError = (reason: Error) => setError(`Cloud sync failed: ${reason.message}`)
    const sync = <T extends { id: string }>(
      name: string,
      localItems: T[],
      update: (items: T[]) => void,
    ) => {
      let firstSnapshot = true
      return watchCollection(name, (records) => {
        const remoteItems = records as T[]
        if (firstSnapshot) {
          const remoteIds = new Set(remoteItems.map((item) => item.id))
          const localOnly = localItems.filter((item) => !remoteIds.has(item.id))
          if (localOnly.length) {
            void Promise.all(localOnly.map(({ id, ...data }) =>
              saveSharedRecord(name, id, data as Record<string, unknown>),
            )).catch(onError)
          }
          if (!localItems.length || remoteItems.length) update([...remoteItems, ...localOnly])
        } else update(remoteItems)
        firstSnapshot = false
      }, onError)
    }
    const unsubs = [
      sync('memories', memories, setMemories),
      sync('letters', letters, setLetters),
      sync('bucket', bucket, setBucket),
      watchCollection('settings', (items) => {
        const profile = items.find((item) => item.id === 'profile')
        if (profile) setSettings({ ...defaultSettings, ...profile } as Settings)
        else void saveSharedRecord('settings', 'profile', settings as unknown as Record<string, unknown>).catch(onError)
      }, onError),
    ]
    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [user])
  useEffect(() => {
    if (!settings.anniversary) { setElapsedDays(null); return }
    const update = () => {
      const start = new Date(`${settings.anniversary}T00:00:00`)
      setElapsedDays(Number.isNaN(start.getTime()) ? null : Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000)))
    }
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [settings.anniversary])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    if (isPlaying && activeSong) void audio.play().catch(() => {
      setIsPlaying(false)
      setError('This song could not play. Please check the file or try another track.')
    })
    else audio.pause()
  }, [isPlaying, activeSong, volume])
  useEffect(() => {
    if (currentSong >= allSongs.length && allSongs.length) setCurrentSong(0)
  }, [allSongs.length, currentSong])

  const cloudSave = useCallback(async (collectionName: string, id: string, data: Record<string, unknown>) => {
    if (!user) return
    try {
      await saveSharedRecord(collectionName, id, data)
      setNotice('Saved and syncing between your two accounts ♡')
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'Unknown sync error'
      setError(`Firestore could not save this change: ${detail}. It is only visible in this session until sync succeeds.`)
    }
  }, [user])
  const cloudDelete = useCallback(async (collectionName: string, id: string) => {
    if (!user) return
    try {
      await removeSharedRecord(collectionName, id)
      setNotice('Removed from your shared scrapbook.')
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'Unknown sync error'
      setError(`Firestore could not remove this item: ${detail}. It may reappear when shared data refreshes.`)
    }
  }, [user])
  const updateSettings = (next: Settings) => {
    setSettings(next)
    void cloudSave('settings', 'profile', next as unknown as Record<string, unknown>)
  }
  const unlockGameLetter = () => {
    const existing = letters.find((letter) => letter.id === 'game-letter')
    const secretLetter = existing ?? {
      id: 'game-letter',
      title: 'a tiny letter you unlocked',
      type: 'secret letter',
      message: 'I am so glad I get to play through life with you. You are my favorite teammate. ♡',
    }
    if (!existing) {
      setLetters((old) => [secretLetter, ...old])
      void cloudSave('letters', secretLetter.id, secretLetter)
    }
    setLetterOpen(secretLetter)
  }
  const navigate = (target: Page) => {
    setPage(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const showCompliment = () => setCompliment(compliments[Math.floor(Math.random() * compliments.length)])
  const playSound = useCallback((frequency = 660) => {
    if (muted) return
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.08, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.16)
    oscillator.onended = () => void context.close()
  }, [muted])
  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await signIn(loginEmail, loginPassword)
      setLoginOpen(false)
      setLoginPassword('')
      setNotice('Welcome to your shared little world ♡')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.')
    } finally {
      setSaving(false)
    }
  }
  const addDateQuestion = (event: FormEvent) => {
    event.preventDefault()
    if (!dateQuestionDraft.trim()) return
    const dateQuestions = [...settings.dateQuestions, dateQuestionDraft.trim()]
    updateSettings({ ...settings, dateQuestions })
    setDateQuestionIndex(dateQuestions.length - 1)
    setDateQuestionDraft('')
    setNotice('Your question is in the date-night jar for this visit ♡')
  }
  const addDateIdea = (event: FormEvent) => {
    event.preventDefault()
    if (!dateIdeaDraft.trim()) return
    updateSettings({ ...settings, dateIdeas: [...settings.dateIdeas, dateIdeaDraft.trim()] })
    setDateIdeaDraft('')
    setDateWheel('Your idea is in the wheel! Spin again ♡')
    setNotice('Your date idea is in the wheel for this visit ♡')
  }
  const handleSignOut = async () => {
    try { await signOutUser(); setNotice('Signed out safely. Sign in again to open your shared scrapbook.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign out.') }
  }
  const saveMemory = (event: FormEvent) => {
    event.preventDefault()
    if (!memoryDraft) return
    const item = memoryDraft
    setMemories((old) => [item, ...old.filter((entry) => entry.id !== item.id)])
    void cloudSave('memories', item.id, item)
    setMemoryDraft(null)
  }
  const saveLetter = (event: FormEvent) => {
    event.preventDefault()
    if (!letterDraft) return
    setLetters((old) => [letterDraft, ...old.filter((entry) => entry.id !== letterDraft.id)])
    void cloudSave('letters', letterDraft.id, letterDraft)
    setLetterDraft(null)
  }
  const addBucketItem = (event: FormEvent) => {
    event.preventDefault()
    if (!bucketInput.trim()) return
    const item = { id: uid(), text: bucketInput.trim(), done: false }
    setBucket((old) => [item, ...old])
    setBucketInput('')
    void cloudSave('bucket', item.id, item)
  }
  const changeTrack = (direction: number) => {
    if (!allSongs.length) return
    const next = shuffle ? Math.floor(Math.random() * allSongs.length) : (currentSong + direction + allSongs.length) % allSongs.length
    setCurrentSong(next)
    setIsPlaying(true)
  }
  const nav = <nav className="nav-links" aria-label="Main navigation">
    {pages.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
      <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
    </button>)}
  </nav>

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => navigate('home')} aria-label="Go home"><span className="brand-flower">✿</span> us, in little things <span className="brand-heart">♡</span></button>
      <div className="topbar-right">
        {firebaseConfigured ? <span className={`sync-label ${user ? 'connected' : ''}`}><span className="sync-dot" />{user ? 'our shared scrapbook' : 'private scrapbook'}</span> :
          <span className="sync-label"><CloudOff size={14} /> only on this device</span>}
        {user ? <button className="button button-quiet sign-button" onClick={() => void handleSignOut()}><LockKeyhole size={15} /> sign out</button> :
          <button className="button button-quiet sign-button" onClick={() => firebaseConfigured ? setLoginOpen(true) : setError('Add Firebase values to .env.local using the README setup guide before signing in.')}><LockKeyhole size={15} /> {firebaseConfigured ? 'sign in' : 'sharing setup'}</button>}
      </div>
    </header>
    <div className="nav-wrap">{nav}</div>
    <main className="main-content">
      {(error || notice) && <div className={`toast ${error ? 'toast-error' : ''}`} role="status">
        {error || notice}<button aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }}><X size={16} /></button>
      </div>}
      {!firebaseConfigured && <div className="setup-note"><Cloud size={16} /> Your scrapbook works on this device now. To share private memories between devices, add Firebase settings using the README setup guide.</div>}
      {firebaseConfigured && !user ? <div className="auth-required paper-card"><span>♡</span><h2>our little world is just for us</h2><p>Sign in with one of your two verified accounts to open the private scrapbook.</p><button className="button button-primary" onClick={() => setLoginOpen(true)}><LockKeyhole size={15} /> sign in to our scrapbook</button></div> : <>
      {page === 'home' && <section className="page-section home-page">
        <div className="hero-card paper-card">
          <span className="hero-sprig sprig-left">✿</span><span className="hero-sprig sprig-right">✿</span>
          <span className="eyebrow">a little place for our big feelings</span>
          <h1>our little<br /><em>world</em> <span className="title-heart">♡</span></h1>
          <div className="names-line">{settings.you} <span>and</span> {settings.sweetheart}</div>
          <p className="hero-message">{settings.welcome}</p>
          <div className="hero-actions"><button className="button button-primary" onClick={() => navigate('memories')}>wander through our memories <ArrowRight size={16} /></button>
            <button className="button button-soft" onClick={() => setSecret('A little squeeze from me to you. Close your eyes and imagine a hug. ♡')}>open me <Heart size={15} fill="currentColor" /></button>
          </div>
          <div className="counter-card"><span className="counter-heart">♡</span><div><b>{elapsedDays === null ? 'our time together' : `${elapsedDays.toLocaleString()} little days`}</b><small>{elapsedDays === null ? 'add your anniversary date in our settings' : 'and counting, always'}</small></div>
            <button onClick={() => setProfileOpen(true)} aria-label="Edit names and anniversary"><Settings2 size={17} /></button>
          </div>
          <div className="hero-photo polaroid"><div className="photo-area" style={settings.monthsaryPhoto ? { backgroundImage: `url("${settings.monthsaryPhoto}")` } : undefined}>{!settings.monthsaryPhoto && <><span>♡</span><small>your favorite photo goes here</small></>}</div><span className="polaroid-caption">my favorite view ♡</span></div>
        </div>
        <div className="home-below">
          <div className="welcome-note paper-card"><div className="tape" /><span className="tiny-label">a note from your little corner</span><p>“No matter how far away the stars are, this little corner is ours.”</p><button className="text-link" onClick={() => navigate('letters')}>leave a love note <ArrowRight size={14} /></button></div>
          <div className="quick-links">
            <button onClick={() => navigate('date')}><span>🍓</span><b>plan a tiny date</b><small>pick something sweet</small></button>
            <button onClick={() => navigate('games')}><span>🎀</span><b>play together</b><small>little games, big smiles</small></button>
            <button onClick={() => navigate('bucket')}><span>🌷</span><b>dream a little</b><small>add to our someday list</small></button>
          </div>
        </div>
        {isAnniversaryToday && <button className="anniversary-message" onClick={() => setSecret('It is our special day! Thank you for choosing our little world, again and again. ♡')}>♡ today is our anniversary — open a little surprise ♡</button>}
        <div className="little-heart-row"><span>♡</span><span>✿</span><button onClick={showCompliment} aria-label="Find a hidden compliment">♡</button><span>✧</span><span>♡</span></div>
      </section>}

      {page === 'memories' && <section className="page-section">
        <PageHeading eyebrow="the good old little moments" title="our memories" text="A scrapbook page for the moments we never want to misplace." />
        <div className="section-toolbar"><span className="privacy-pill">{user ? <><Cloud size={14} /> shared between your accounts</> : <><CloudOff size={14} /> saved on this device</>}</span>
          <button className="button button-primary" onClick={() => setMemoryDraft({ id: uid(), title: '', date: '', caption: '', photo: '' })}><Plus size={16} /> add a memory</button></div>
        {memories.length ? <div className="memory-grid">{memories.map((memory, index) => <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="polaroid memory-card" key={memory.id}>
          <button className="photo-area memory-photo" aria-label={`Open ${memory.title || 'memory'}`} onClick={() => setPhotoOpen(memory)} style={memory.photo ? { backgroundImage: `url("${memory.photo}")` } : undefined}>{!memory.photo && <><span>✿</span><small>our photo here</small></>}</button>
          <div className="memory-meta"><span className="date-label">{memory.date || 'our little moment'}</span><h3>{memory.title || 'untitled memory'}</h3><p>{memory.caption || 'Add a few words about this day.'}</p></div>
          <div className="card-tools"><button onClick={() => setMemoryDraft(memory)}>edit</button><button onClick={() => { setMemories((old) => old.filter((item) => item.id !== memory.id)); void cloudDelete('memories', memory.id) }}>remove</button></div>
        </motion.article>)}</div> : <EmptyState icon="📷" title="The page is waiting for your memories" text="Add your own photo, title, date, and little caption. Nothing here is a made-up memory." />}
        <p className="helper-line">Add photos using image URLs. The image host controls who can access those photos; use links you are comfortable sharing.</p>
      </section>}

      {page === 'letters' && <section className="page-section">
        <PageHeading eyebrow="little words, folded with love" title="love notes" text="Tap an envelope to open it. Add your own words whenever your heart feels full." />
        <div className="section-toolbar"><span className="privacy-pill">{user ? <><Cloud size={14} /> shared letters</> : <><CloudOff size={14} /> this device only</>}</span><button className="button button-primary" onClick={() => setLetterDraft({ id: uid(), title: '', type: 'love letter', message: '' })}><Plus size={16} /> write a letter</button></div>
        <div className="letter-grid">{letters.map((letter) => <motion.button whileHover={{ y: -4, rotate: -1 }} className="envelope-card" key={letter.id} onClick={() => setLetterOpen(letter)}>
          <span className="envelope-type">{letter.type}</span><span className="envelope-flap">♡</span><b>{letter.title}</b><small>tap to open · with love</small></motion.button>)}
          <button className="envelope-card envelope-compliment" onClick={showCompliment}><span className="envelope-type">a little surprise</span><span className="envelope-flap">✧</span><b>pick me up?</b><small>pull out a random compliment</small></button></div>
        {letters.length > 0 && <div className="manage-list">{letters.map((letter) => <div key={letter.id}><span>{letter.title}</span><button onClick={() => setLetterDraft(letter)}>edit</button><button onClick={() => { setLetters((old) => old.filter((item) => item.id !== letter.id)); void cloudDelete('letters', letter.id) }}>remove</button></div>)}</div>}
      </section>}

      {page === 'date' && <section className="page-section">
        <PageHeading eyebrow="just you, me, and a little imagination" title="let's have a date ♡" text="Spin for a plan, pick a snack, and ask each other something new." />
        <div className="date-grid">
          <div className="date-card paper-card wheel-card"><span className="card-kicker">the little date wheel</span><div className="wheel" key={dateWheel}><span>♡</span></div><p className="result-text">{dateWheel || 'What shall we do together?'}</p><button className="button button-primary" onClick={() => { const pick = settings.dateIdeas[Math.floor(Math.random() * settings.dateIdeas.length)]; setDateWheel(pick); playSound(720) }}>spin for an idea <RotateCcw size={15} /></button></div>
          <PickerCard emoji="🎬" title="movie night" items={movieIdeas} />
          <PickerCard emoji="🍓" title="snack o'clock" items={snacks} />
          <div className="date-card paper-card question-card"><span className="card-kicker">a question for us</span><span className="big-emoji">💌</span><p>{settings.dateQuestions[dateQuestionIndex % settings.dateQuestions.length]}</p><button className="button button-soft" onClick={() => setDateQuestionIndex(Math.floor(Math.random() * settings.dateQuestions.length))}>another question <ArrowRight size={15} /></button></div>
          <div className="date-card compliment-card"><span className="card-kicker">a very important announcement</span><p>{compliment || 'You are my favorite person to do absolutely nothing with.'}</p><button className="button button-white" onClick={showCompliment}><Heart size={14} /> give me a compliment</button></div>
        </div>
        <div className="customize-row"><form onSubmit={addDateIdea}><label>add a date idea <input value={dateIdeaDraft} onChange={(event) => setDateIdeaDraft(event.target.value)} placeholder="e.g. make pancakes at midnight" /></label><button className="button button-soft"><Plus size={14} /> add</button></form>
          <form onSubmit={addDateQuestion}><label>add a question <input value={dateQuestionDraft} onChange={(event) => setDateQuestionDraft(event.target.value)} placeholder="e.g. where should we wander next?" /></label><button className="button button-soft"><Plus size={14} /> add</button></form>
          <p>Custom date ideas and questions stay in this browser session.</p></div>
      </section>}

      {page === 'games' && <Games quiz={quiz} setQuiz={setQuiz} muted={muted} setMuted={setMuted} playSound={playSound} unlockLetter={unlockGameLetter} gameRef={gameRef} />}

      {page === 'bucket' && <section className="page-section">
        <PageHeading eyebrow="all the things we will do, someday" title="our bucket list" text="A shared list for the little plans and the big, brave dreams." />
        <div className="bucket-card paper-card">
          <div className="bucket-top"><span className="tiny-label">{user ? 'shared between your accounts' : 'saved on this device only'}</span><div className="progress-label">{bucket.filter((item) => item.done).length} of {bucket.length} little dreams done ♡</div><div className="progress-track"><span style={{ width: `${bucket.length ? bucket.filter((item) => item.done).length / bucket.length * 100 : 0}%` }} /></div></div>
          <form className="add-row" onSubmit={addBucketItem}><input value={bucketInput} onChange={(event) => setBucketInput(event.target.value)} placeholder="something we want to do together..." aria-label="New bucket list idea" /><button className="button button-primary"><Plus size={16} /> add it</button></form>
          {bucket.length ? <div className="bucket-list">{bucket.map((item) => <div className={`bucket-item ${item.done ? 'is-done' : ''}`} key={item.id}>
            <button className="check-circle" aria-label={item.done ? 'Mark as unfinished' : 'Mark as completed'} onClick={() => { const changed = { ...item, done: !item.done }; setBucket((old) => old.map((entry) => entry.id === item.id ? changed : entry)); void cloudSave('bucket', item.id, changed); if (changed.done) playSound(880) }}>{item.done && <Check size={14} />}</button>
            <span>{item.text}</span><button className="item-edit" onClick={() => { const text = window.prompt('Edit your little plan', item.text); if (text?.trim()) { const changed = { ...item, text: text.trim() }; setBucket((old) => old.map((entry) => entry.id === item.id ? changed : entry)); void cloudSave('bucket', item.id, changed) } }}>edit</button>
            <button className="item-delete" aria-label="Remove idea" onClick={() => { setBucket((old) => old.filter((entry) => entry.id !== item.id)); void cloudDelete('bucket', item.id) }}><X size={15} /></button></div>)}</div> : <EmptyState icon="🌱" title="A little room for your someday plans" text="Add the things you want to do, places to visit, or snacks to try together." />}
        </div>
      </section>}

      {page === 'monthsary' && <Monthsary settings={settings} updateSettings={updateSettings} />
      }
      </>}
    </main>
    <footer className="footer-note">made of little things & lots of love <span>♡</span></footer>

    {(!firebaseConfigured || user) && <div className="music-player" aria-label="Music player">
      <audio ref={audioRef} src={activeSong?.url} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onEnded={() => {
        if (repeat) { if (audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play() } }
        else if (currentSong < allSongs.length - 1 || shuffle) changeTrack(1)
        else setIsPlaying(false)
      }} />
      <div className="player-song"><span className="album-art">{activeSong?.cover ? <img src={activeSong.cover} alt="" /> : <span>{activeSong ? '♫' : '♡'}</span>}</span><span className="song-label"><b>{activeSong?.title ?? 'our little soundtrack'}</b><small>{activeSong ? 'website audio folder' : 'add songs in public/audio'}</small></span></div>
      <div className="player-center"><div className="player-controls"><button aria-label="Previous track" onClick={() => changeTrack(-1)} disabled={!allSongs.length}><SkipBack size={17} fill="currentColor" /></button><button className="play-button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={() => setIsPlaying((old) => !old)} disabled={!activeSong}>{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><button aria-label="Next track" onClick={() => changeTrack(1)} disabled={!allSongs.length}><SkipForward size={17} fill="currentColor" /></button></div>
        <div className="timeline"><span>{formatTime(progress)}</span><input type="range" min="0" max={duration || 1} value={Math.min(progress, duration || 1)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value) }} aria-label="Song position" /><span>{formatTime(duration)}</span></div></div>
      <div className="player-options"><button aria-label="Shuffle playlist" className={shuffle ? 'option-on' : ''} onClick={() => setShuffle((old) => !old)}><Shuffle size={16} /></button><button aria-label="Repeat song" className={repeat ? 'option-on' : ''} onClick={() => setRepeat((old) => !old)}><RotateCcw size={15} /></button><button aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'} onClick={() => setMuted((old) => !old)}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><input className="volume-slider" type="range" min="0" max="1" step=".01" value={volume} aria-label="Volume" onChange={(event) => setVolume(Number(event.target.value))} /></div>
      <button className="playlist-toggle" onClick={() => setPlaylistOpen((old) => !old)} aria-label="Show playlist"><ChevronDown size={16} /></button>
      {playlistOpen && <div className="playlist-popover"><div className="playlist-title">our playlist <button onClick={() => setPlaylistOpen(false)}><X size={15} /></button></div>{allSongs.length ? allSongs.map((song, index) => <div className={`playlist-row ${index === currentSong ? 'selected' : ''}`} key={song.id}><button onClick={() => { setCurrentSong(index); setIsPlaying(true); setPlaylistOpen(false) }}><Music2 size={14} />{song.title}<small>site folder</small></button></div>) : <p className="playlist-empty">Your playlist is waiting for the songs you love ♡</p>}
        <small className="music-privacy">Add MP3s to public/audio and list them in playlist.json. Music bundled with the site is public, so only include songs you have permission to share.</small></div>}
    </div>}

    <AnimatePresence>{secret && <Modal title="a little something for you" close={() => setSecret('')}><div className="secret-message"><span>💌</span><p>{secret}</p><Heart size={19} fill="currentColor" /></div></Modal>}</AnimatePresence>
    <AnimatePresence>{compliment && <Modal title="one tiny truth" close={() => setCompliment('')}><div className="secret-message"><span>🌷</span><p>{compliment}</p><button className="button button-soft" onClick={showCompliment}>one more ♡</button></div></Modal>}</AnimatePresence>
    <AnimatePresence>{letterOpen && <Modal title={letterOpen.title} close={() => setLetterOpen(null)}><div className="letter-paper"><span className="handwritten">my dearest,</span><p>{letterOpen.message}</p><span className="handwritten signature">always yours ♡</span></div></Modal>}</AnimatePresence>
    <AnimatePresence>{photoOpen && <Modal title={photoOpen.title || 'one of our little moments'} close={() => setPhotoOpen(null)}><div className="photo-viewer">{photoOpen.photo ? <img src={photoOpen.photo} alt={photoOpen.title} /> : <span>♡</span>}<p>{photoOpen.caption}</p><small>{photoOpen.date}</small></div></Modal>}</AnimatePresence>
    <AnimatePresence>{memoryDraft && <Modal title={memoryDraft.title ? 'edit this memory' : 'add a little memory'} close={() => setMemoryDraft(null)}><form className="edit-form" onSubmit={saveMemory}>
      <label>title<input required value={memoryDraft.title} onChange={(event) => setMemoryDraft({ ...memoryDraft, title: event.target.value })} placeholder="a day we want to remember" /></label>
      <label>date<input type="date" value={memoryDraft.date} onChange={(event) => setMemoryDraft({ ...memoryDraft, date: event.target.value })} /></label>
      <label>photo link<input value={memoryDraft.photo} onChange={(event) => setMemoryDraft({ ...memoryDraft, photo: event.target.value })} placeholder="https://... (optional)" /></label>
      <label>a little caption<textarea value={memoryDraft.caption} onChange={(event) => setMemoryDraft({ ...memoryDraft, caption: event.target.value })} placeholder="Your own words, just for the two of you." rows={3} /></label>
      <button className="button button-primary">save this memory ♡</button></form></Modal>}</AnimatePresence>
    <AnimatePresence>{letterDraft && <Modal title={letterDraft.title ? 'edit a love note' : 'write a little love note'} close={() => setLetterDraft(null)}><form className="edit-form" onSubmit={saveLetter}>
      <label>envelope title<input required value={letterDraft.title} onChange={(event) => setLetterDraft({ ...letterDraft, title: event.target.value })} placeholder="open when you need a smile" /></label>
      <label>kind of note<select value={letterDraft.type} onChange={(event) => setLetterDraft({ ...letterDraft, type: event.target.value })}><option>love letter</option><option>open when</option><option>monthsary</option><option>sweet note</option><option>secret letter</option></select></label>
      <label>your letter<textarea required rows={6} value={letterDraft.message} onChange={(event) => setLetterDraft({ ...letterDraft, message: event.target.value })} placeholder="Write something only you could say..." /></label><button className="button button-primary">fold it with love ♡</button></form></Modal>}</AnimatePresence>
    <AnimatePresence>{loginOpen && <Modal title="just for our two hearts" close={() => setLoginOpen(false)}><form className="edit-form" onSubmit={(event) => void handleLogin(event)}>
      <p className="login-explainer">Sign in with an account you created in Firebase Authentication. There is no public sign-up form; only the two configured email accounts can access shared content.</p>
      <label>email<input type="email" autoComplete="username" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} /></label><label>password<input type="password" autoComplete="current-password" required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label><button className="button button-primary" disabled={saving}>{saving ? 'opening your scrapbook...' : 'sign in ♡'}</button></form></Modal>}</AnimatePresence>
    <AnimatePresence>{profileOpen && <Modal title="our little details" close={() => setProfileOpen(false)}><form className="edit-form" onSubmit={(event) => { event.preventDefault(); updateSettings(settings); setProfileOpen(false) }}>
      <label>your name or nickname<input value={settings.you} onChange={(event) => setSettings({ ...settings, you: event.target.value })} /></label><label>their name or nickname<input value={settings.sweetheart} onChange={(event) => setSettings({ ...settings, sweetheart: event.target.value })} /></label>
      <label>your anniversary<input type="date" value={settings.anniversary} onChange={(event) => setSettings({ ...settings, anniversary: event.target.value })} /></label><label>welcome note<textarea rows={3} value={settings.welcome} onChange={(event) => setSettings({ ...settings, welcome: event.target.value })} /></label>
      <label>monthsary letter<textarea rows={4} value={settings.finalLetter} onChange={(event) => setSettings({ ...settings, finalLetter: event.target.value })} /></label>
      <label>favorite photo URL<input value={settings.monthsaryPhoto} onChange={(event) => setSettings({ ...settings, monthsaryPhoto: event.target.value })} placeholder="https://... (or add a photo on the monthsary page)" /></label><button className="button button-primary">save our details ♡</button></form></Modal>}</AnimatePresence>
  </div>
}

function PageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p><span className="heading-flower">✿</span></div>
}
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>
}
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
    <motion.div className="modal-card" role="dialog" aria-modal="true" aria-label={title} initial={{ y: 20, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: .98 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" aria-label="Close" onClick={close}><X size={18} /></button><span className="eyebrow">♡ just between us ♡</span><h3>{title}</h3>{children}</motion.div></motion.div>
}
function PickerCard({ emoji, title, items }: { emoji: string; title: string; items: string[] }) {
  const [pick, setPick] = useState('')
  return <div className="date-card paper-card picker-card"><span className="card-kicker">{title}</span><span className="big-emoji">{emoji}</span><p>{pick || 'Let the universe pick this one.'}</p><button className="button button-soft" onClick={() => setPick(items[Math.floor(Math.random() * items.length)])}>pick for us <Sparkles size={14} /></button></div>
}
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

function Games({ quiz, setQuiz, muted, setMuted, playSound, unlockLetter, gameRef }: {
  quiz: QuizQuestion[]; setQuiz: React.Dispatch<React.SetStateAction<QuizQuestion[]>>;
  muted: boolean; setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  playSound: (frequency?: number) => void; unlockLetter: () => void; gameRef: React.RefObject<HTMLDivElement | null>
}) {
  const [selectedGame, setSelectedGame] = useState<'quiz' | 'match' | 'catch'>('quiz')
  const [qIndex, setQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<number | null>(null)
  const [matchCards, setMatchCards] = useState(() => shuffleArray([...matchFaces.slice(0, 6), ...matchFaces.slice(0, 6)]))
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [matchSeconds, setMatchSeconds] = useState(0)
  const [matchRunning, setMatchRunning] = useState(false)
  const [catchRunning, setCatchRunning] = useState(false)
  const [catchPaused, setCatchPaused] = useState(false)
  const [catchSeconds, setCatchSeconds] = useState(30)
  const [catchScore, setCatchScore] = useState(0)
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number; speed: number }>>([])
  const [basket, setBasket] = useState(50)
  const [questionDraft, setQuestionDraft] = useState('')
  const [questionOptions, setQuestionOptions] = useState(['', '', ''])
  const [correctOption, setCorrectOption] = useState(0)
  const [feedback, setFeedback] = useState('')
  const heartId = useRef(0)
  const heartsRef = useRef(hearts)
  const basketRef = useRef(basket)
  const catchScoreRef = useRef(catchScore)
  heartsRef.current = hearts
  basketRef.current = basket
  catchScoreRef.current = catchScore
  const correctQuiz = qIndex >= quiz.length
  const wonMatch = matched.length === matchCards.length

  useEffect(() => {
    if (!matchRunning || wonMatch) return
    const interval = window.setInterval(() => setMatchSeconds((old) => old + 1), 1000)
    return () => window.clearInterval(interval)
  }, [matchRunning, wonMatch])
  useEffect(() => {
    if (!catchRunning || catchPaused || catchSeconds <= 0) return
    const interval = window.setInterval(() => {
      const moved = heartsRef.current.map((heart) => ({ ...heart, y: heart.y + heart.speed }))
      const caught = moved.filter((heart) => heart.y >= 84 && Math.abs(heart.x - basketRef.current) < 9)
      const remaining = moved.filter((heart) => heart.y < 100 && !caught.includes(heart))
      if (caught.length) {
        setCatchScore((score) => score + caught.length)
        playSound(760)
      }
      if (remaining.length < 1 + Math.floor(catchScoreRef.current / 5) && Math.random() < 0.72) {
        remaining.push({ id: ++heartId.current, x: 5 + Math.random() * 90, y: -8, speed: 2.6 + catchScoreRef.current / 12 + Math.random() * 1.4 })
      }
      heartsRef.current = remaining
      setHearts(remaining)
    }, 160)
    return () => window.clearInterval(interval)
  }, [catchRunning, catchPaused, catchSeconds, playSound])
  useEffect(() => {
    if (!catchRunning || catchPaused || catchSeconds <= 0) return
    const interval = window.setInterval(() => setCatchSeconds((time) => Math.max(0, time - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [catchRunning, catchPaused, catchSeconds])
  useEffect(() => { if (catchSeconds === 0) setCatchRunning(false) }, [catchSeconds])
  useEffect(() => {
    if (!catchRunning || catchPaused) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setBasket((old) => Math.max(5, old - 5))
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setBasket((old) => Math.min(95, old + 5))
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [catchRunning, catchPaused])

  const answer = (index: number) => {
    if (answered !== null || correctQuiz) return
    const right = index === quiz[qIndex].answer
    setAnswered(index)
    if (right) { setScore((old) => old + 1); setFeedback('you know me so well! ♡'); playSound(820) }
    else { setFeedback('close! it is the little things that count ♡'); playSound(380) }
    window.setTimeout(() => { setQIndex((old) => old + 1); setAnswered(null); setFeedback('') }, 900)
  }
  const flipCard = (index: number) => {
    if (flipped.includes(index) || matched.includes(index) || flipped.length === 2) return
    setMatchRunning(true)
    playSound(540)
    const next = [...flipped, index]
    setFlipped(next)
    if (next.length === 2) {
      setMoves((old) => old + 1)
      if (matchCards[next[0]] === matchCards[next[1]]) {
        setMatched((old) => [...old, ...next])
        setFlipped([])
        playSound(880)
      } else window.setTimeout(() => setFlipped([]), 700)
    }
  }
  const restartMatch = () => { setMatchCards(shuffleArray([...matchFaces.slice(0, 6), ...matchFaces.slice(0, 6)])); setFlipped([]); setMatched([]); setMoves(0); setMatchSeconds(0); setMatchRunning(false) }
  const startCatch = () => { setCatchScore(0); setCatchSeconds(30); heartsRef.current = []; setHearts([]); setBasket(50); setCatchPaused(false); setCatchRunning(true) }
  const catchPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    setBasket(Math.max(3, Math.min(97, (event.clientX - box.left) / box.width * 100)))
  }
  const catchHeart = (id: number) => {
    const remaining = heartsRef.current.filter((item) => item.id !== id)
    heartsRef.current = remaining
    setHearts(remaining)
    setCatchScore((old) => old + 1)
    playSound(700 + Math.min(catchScore * 8, 240))
  }
  const addQuestion = (event: FormEvent) => {
    event.preventDefault()
    if (!questionDraft.trim() || questionOptions.some((option) => !option.trim())) {
      setFeedback('Add a question and all three answers first ♡')
      return
    }
    setQuiz((old) => [...old, { question: questionDraft.trim(), options: questionOptions.map((option) => option.trim()), answer: correctOption }])
    setQuestionDraft('')
    setQuestionOptions(['', '', ''])
    setCorrectOption(0)
    setFeedback('')
  }
  const newGame = (game: typeof selectedGame) => { setSelectedGame(game); setFeedback('') }

  return <section className="page-section games-page" ref={gameRef}>
    <PageHeading eyebrow="a little friendly competition" title="let's play ♡" text="Three tiny games, endless reasons to giggle. Sound effects can be muted anytime." />
    <div className="game-tabs">{[['quiz', 'how well do you know me?'], ['match', 'memory match'], ['catch', 'catch the hearts']].map(([id, label]) =>
      <button key={id} className={selectedGame === id ? 'selected' : ''} onClick={() => newGame(id as typeof selectedGame)}>{label}</button>)}
      <button className="sound-toggle" onClick={() => setMuted((old) => !old)}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{muted ? 'sound off' : 'sound on'}</button>
    </div>
    {selectedGame === 'quiz' && <div className="game-card paper-card quiz-game">
      <span className="card-kicker">game one · the little quiz</span><span className="game-emoji">💭</span>
      {correctQuiz ? <div className="game-result"><h3>{score === quiz.length ? 'you know me by heart!' : 'that was so sweet ♡'}</h3><p>You got {score} of {quiz.length} right. The best part is learning more about each other.</p><button className="button button-primary" onClick={() => { setQIndex(0); setScore(0); setAnswered(null) }}><RotateCcw size={15} /> play again</button></div> : <><p className="question-progress">question {qIndex + 1} of {quiz.length} · {score} little points</p><h3 className="quiz-question">{quiz[qIndex].question}</h3><div className="quiz-options">{quiz[qIndex].options.map((option, index) => <button key={option} className={answered === index ? (index === quiz[qIndex].answer ? 'answer-right' : 'answer-wrong') : ''} onClick={() => answer(index)} disabled={answered !== null}>{option}</button>)}</div><p className="answer-feedback">{feedback || 'choose your answer ♡'}</p></>}
      <form className="custom-question" onSubmit={addQuestion}>
        <label>write your own question<input value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="What would I pick for our next date?" /></label>
        <div className="quiz-custom-options">{questionOptions.map((option, index) => <label key={index}>answer {index + 1}<input value={option} onChange={(event) => setQuestionOptions((old) => old.map((entry, current) => current === index ? event.target.value : entry))} placeholder={`choice ${index + 1}`} /></label>)}</div>
        <label>which answer is right?<select value={correctOption} onChange={(event) => setCorrectOption(Number(event.target.value))}>{questionOptions.map((_, index) => <option value={index} key={index}>answer {index + 1}</option>)}</select></label>
        <button className="button button-soft"><Plus size={14} /> add my question</button>
      </form>
      <small>Your questions and answers are saved on this device. Starter questions can be edited in src/App.tsx.</small>
    </div>}
    {selectedGame === 'match' && <div className="game-card paper-card match-game">
      <span className="card-kicker">game two · find the matching little things</span><div className="match-score"><span><CircleHelp size={15} /> {moves} moves</span><span><Clock3 size={15} /> {formatTime(matchSeconds)}</span><button className="text-link" onClick={restartMatch}><RotateCcw size={14} /> start over</button></div>
      {wonMatch && <div className="win-banner">you found every pair! you make a lovely team ♡ <button onClick={unlockLetter}>open your hidden letter <Mail size={14} /></button></div>}
      <div className="match-board">{matchCards.map((face, index) => <button key={index} className={`match-tile ${flipped.includes(index) || matched.includes(index) ? 'revealed' : ''} ${matched.includes(index) ? 'matched' : ''}`} aria-label={flipped.includes(index) || matched.includes(index) ? face : 'Flip card'} onClick={() => flipCard(index)}>{flipped.includes(index) || matched.includes(index) ? face : '♡'}</button>)}</div>
      <small>Flip two cards at a time. Find all {matchCards.length / 2} pairs.</small>
    </div>}
    {selectedGame === 'catch' && <div className="game-card paper-card catch-game">
      <span className="card-kicker">game three · catch the hearts</span><div className="catch-hud"><span>♡ {catchScore}</span><span><Clock3 size={15} /> {catchSeconds}s</span><span>speed gets sweeter (and trickier!)</span></div>
      <div className={`catch-field ${catchRunning && !catchPaused ? 'playing' : ''}`} onPointerMove={catchPointer} onPointerDown={catchPointer}>
        {!catchRunning && catchSeconds === 30 && <div className="catch-intro"><span>♡</span><b>ready, little love?</b><small>Move the basket with ← →, A / D, or your finger.</small></div>}
        {catchPaused && <div className="catch-intro"><span>⏸</span><b>taking a tiny breather</b></div>}
        {!catchRunning && catchSeconds === 0 && <div className="catch-intro"><span>🌷</span><b>you caught {catchScore} hearts!</b><small>That was a very cute catch.</small></div>}
        {hearts.map((heart) => <button key={heart.id} className="falling-heart" style={{ left: `${heart.x}%`, top: `${heart.y}%` }} onPointerDown={(event) => { event.stopPropagation(); catchHeart(heart.id) }} aria-label="Catch heart">♡</button>)}
        <span className="basket" style={{ left: `${basket}%` }}>🧺</span>
      </div>
      <div className="catch-controls">{!catchRunning && catchSeconds === 30 ? <button className="button button-primary" onClick={startCatch}><Play size={15} fill="currentColor" /> start catching</button> : <>
        {catchRunning && <button className="button button-soft" onClick={() => setCatchPaused((old) => !old)}>{catchPaused ? <Play size={15} /> : <Pause size={15} />}{catchPaused ? 'resume' : 'pause'}</button>}
        <button className="button button-soft" onClick={startCatch}><RotateCcw size={15} /> restart</button>
      </>}</div>
    </div>}
  </section>
}
function shuffleArray<T,>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}
function Monthsary({ settings, updateSettings }: { settings: Settings; updateSettings: (settings: Settings) => void }) {
  const [step, setStep] = useState(-1)
  const [photo, setPhoto] = useState(settings.monthsaryPhoto)
  const [draft, setDraft] = useState(settings.monthMessages.join('\n'))
  const [editing, setEditing] = useState(false)
  const [opened, setOpened] = useState(false)
  const message = settings.monthMessages[step] ?? ''
  return <section className="page-section monthsary-page">
    <PageHeading eyebrow="our special little day" title="happy monthsary ♡" text="A tiny celebration of us, just as we are." />
    <div className="monthsary-card paper-card">
      <span className="floating-decoration float-one">♡</span><span className="floating-decoration float-two">✿</span><span className="floating-decoration float-three">♡</span>
      <div className="monthsary-photo polaroid"><div className="photo-area" style={photo ? { backgroundImage: `url("${photo}")` } : undefined}>{!photo && <><span>🌷</span><small>add a favorite photo</small></>}</div><span className="polaroid-caption">you & me, always</span></div>
      <span className="eyebrow">a little love, on our little day</span>
      <h3>happy monthsary,<br /><em>{settings.sweetheart}</em> ♡</h3>
      <p className="month-intro">{step < 0 ? 'I have a few little things to tell you...' : message}</p>
      {step >= settings.monthMessages.length && <div className="final-letter"><span className="handwritten">my favorite person,</span><p>{settings.welcome} {settings.finalLetter}</p><span className="handwritten signature">yours, {settings.you}</span></div>}
      <button className="button button-primary" onClick={() => { if (step < settings.monthMessages.length) setStep((old) => old + 1); else setOpened((old) => !old) }}>{step < settings.monthMessages.length ? 'tell me something sweet' : opened ? 'read it again ♡' : 'open your letter ♡'} <ArrowRight size={15} /></button>
      <div className={`month-envelope ${opened ? 'open' : ''}`} onClick={() => setOpened((old) => !old)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setOpened((old) => !old) }}><span>{opened ? '♡' : '✉'}</span><small>{opened ? 'a little love, just for you' : 'tap for one more little surprise'}</small></div>
      <button className="text-link replay-button" onClick={() => { setStep(-1); setOpened(false) }}><RotateCcw size={14} /> replay our little moment</button>
      <button className="text-link" onClick={() => setEditing((old) => !old)}><Settings2 size={14} /> edit the messages & photo</button>
      {editing && <div className="monthsary-edit"><label>favorite photo link<input value={photo} onChange={(event) => setPhoto(event.target.value)} placeholder="https://..." /></label><label>your three sweet messages, one per line<textarea rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} /></label><button className="button button-soft" onClick={() => { const monthMessages = draft.split('\n').map((line) => line.trim()).filter(Boolean); updateSettings({ ...settings, monthMessages: monthMessages.length ? monthMessages : defaultSettings.monthMessages, monthsaryPhoto: photo }); setEditing(false) }}>save my changes ♡</button></div>}
    </div>
  </section>
}

export default App
