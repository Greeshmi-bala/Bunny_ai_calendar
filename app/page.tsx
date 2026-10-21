"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Bell,
  Volume2,
  House,
  Plus,
  Sparkles,
  Target,
  X,
  ListTodo,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Smartphone,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Category = "planning" | "work" | "learning" | "personal";
type TaskPriority = "urgent" | "high" | "medium" | "low";
type Tab = "Home" | "Calendar" | "Tasks" | "AI" | "Settings";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type CalendarEvent = {
  id: string;
  dateKey: string;
  time: string; // HH:mm, 24-hour format
  title: string;
  description: string;
  category: Category;
  priority?: TaskPriority;
  completed: boolean;
  createdAt: number;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminderSound: "chime" | "voice" | "both";
  reminderTriggeredAt?: number;
};

const STORAGE_KEY = "bunny-ai-calendar:v1";

const categoryLabels: Record<Category, string> = {
  planning: "Planning",
  work: "Work",
  learning: "Learning",
  personal: "Personal",
};

const categoryDescriptions: Record<Category, string> = {
  planning: "Make space for your priorities",
  work: "Focused work session",
  learning: "A little progress adds up",
  personal: "Time for you",
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortEvents(items: CalendarEvent[]): CalendarEvent[] {
  return [...items].sort((a, b) => a.time.localeCompare(b.time));
}

function makeStarterEvents(todayKey: string): CalendarEvent[] {
  const now = Date.now();
  return [
    {
      id: "starter-planning",
      dateKey: todayKey,
      time: "09:00",
      title: "Morning planning",
      description: "Review your priorities",
      category: "planning",
      completed: false,
      createdAt: now,
      reminderEnabled: false,
      reminderMinutesBefore: 10,
      reminderSound: "both",
    },
    {
      id: "starter-work",
      dateKey: todayKey,
      time: "11:30",
      title: "Project development",
      description: "Focused work session",
      category: "work",
      completed: false,
      createdAt: now + 1,
      reminderEnabled: false,
      reminderMinutesBefore: 10,
      reminderSound: "both",
    },
    {
      id: "starter-learning",
      dateKey: todayKey,
      time: "16:00",
      title: "Learning time",
      description: "DSA practice",
      category: "learning",
      completed: false,
      createdAt: now + 2,
      reminderEnabled: false,
      reminderMinutesBefore: 10,
      reminderSound: "both",
    },
  ];
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HomePage() {
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Home");
  const [hydrated, setHydrated] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("10:00");
  const [eventCategory, setEventCategory] = useState<Category>("personal");
  const [eventPriority, setEventPriority] = useState<TaskPriority>("medium");
  const [eventDescription, setEventDescription] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(10);
  const [reminderSound, setReminderSound] = useState<"chime" | "voice" | "both">("both");
  const [soundReady, setSoundReady] = useState(false);
  const [reminderHistory, setReminderHistory] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi, lovely! 🐰 I'm Bunny, your planning companion. Tell me what's on your mind, and we'll figure out one gentle next step together.",
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState(10);
  const [defaultReminderSound, setDefaultReminderSound] = useState<"chime" | "voice" | "both">("both");
  const [dailyGreeting, setDailyGreeting] = useState(true);
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [soundStyle, setSoundStyle] = useState<"waterdrop" | "serene" | "chime">("waterdrop");
  const [taskRange, setTaskRange] = useState<"day" | "week" | "month" | "year">("week");
  const [currentMoment, setCurrentMoment] = useState<Date | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const selectedDate = selectedDateKey ? parseDateKey(selectedDateKey) : null;

  useEffect(() => { setCurrentMoment(new Date()); }, []);

  useEffect(() => {
    // Read storage only on the client. This avoids server/client date mismatches.
    try {
      const savedSettings = window.localStorage.getItem("bunny-ai-calendar:settings:v1");
      if (savedSettings) {
        const settings = JSON.parse(savedSettings) as Record<string, unknown>;
        if (typeof settings.darkMode === "boolean") setDarkMode(settings.darkMode);
        if (typeof settings.voiceEnabled === "boolean") setVoiceEnabled(settings.voiceEnabled);
        if (typeof settings.notificationsEnabled === "boolean") setNotificationsEnabled(settings.notificationsEnabled);
        if ([0, 5, 10, 15, 30].includes(Number(settings.defaultReminderMinutes))) setDefaultReminderMinutes(Number(settings.defaultReminderMinutes));
        if (["chime", "voice", "both"].includes(String(settings.defaultReminderSound))) setDefaultReminderSound(settings.defaultReminderSound as "chime" | "voice" | "both");
        if (typeof settings.dailyGreeting === "boolean") setDailyGreeting(settings.dailyGreeting);
        if (settings.voiceGender === "female" || settings.voiceGender === "male") setVoiceGender(settings.voiceGender);
        if (["waterdrop", "serene", "chime"].includes(String(settings.soundStyle))) setSoundStyle(settings.soundStyle as "waterdrop" | "serene" | "chime");
      }
    } catch { /* Keep defaults if settings cannot be read. */ }
    setSettingsLoaded(true);
    const today = dateKey(new Date());
    setSelectedDateKey(today);

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid: CalendarEvent[] = parsed
            .filter((item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.dateKey === "string" &&
              typeof item.time === "string" &&
              typeof item.title === "string" &&
              typeof item.completed === "boolean" &&
              ["planning", "work", "learning", "personal"].includes(item.category),
            )
            .map((item) => ({
              ...item,
              priority: ["urgent", "high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
              reminderEnabled: typeof item.reminderEnabled === "boolean" ? item.reminderEnabled : false,
              reminderMinutesBefore: Number.isFinite(item.reminderMinutesBefore) ? item.reminderMinutesBefore : 10,
              reminderSound: ["chime", "voice", "both"].includes(item.reminderSound) ? item.reminderSound : "both",
            })) as CalendarEvent[];
          setEvents(valid);
        } else {
          setEvents(makeStarterEvents(today));
        }
      } else {
        setEvents(makeStarterEvents(today));
      }
    } catch {
      // If storage is blocked or malformed, the app remains usable in memory.
      setEvents(makeStarterEvents(today));
      setMessage("Local storage could not be read. Changes may not persist in this browser.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem("bunny-ai-calendar:settings:v1", JSON.stringify({ darkMode, voiceEnabled, notificationsEnabled, defaultReminderMinutes, defaultReminderSound, dailyGreeting, voiceGender, soundStyle }));
    } catch { /* Preferences still work for this session. */ }
  }, [settingsLoaded, darkMode, voiceEnabled, notificationsEnabled, defaultReminderMinutes, defaultReminderSound, dailyGreeting, voiceGender, soundStyle]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      setMessage("Your browser storage is full or unavailable. Changes may not persist.");
    }
  }, [events, hydrated]);

  // Reminder audio is enabled by a user gesture because browsers block unsolicited audio.
  const playGentleChime = useCallback(() => {
    try {
      const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const context = new AudioContextConstructor();
      const now = context.currentTime;
      const notes = soundStyle === "waterdrop"
        ? [987.77, 1318.51, 1567.98]
        : soundStyle === "serene" ? [523.25, 659.25, 783.99] : [659.25, 783.99];
      notes.forEach((frequency, index) => {
        const startAt = now + index * (soundStyle === "serene" ? 0.22 : 0.13);
        const duration = soundStyle === "waterdrop" ? 0.32 : 0.48;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(soundStyle === "waterdrop" ? frequency * 1.12 : frequency, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(frequency, startAt + 0.09);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(soundStyle === "waterdrop" ? 0.075 : 0.09, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.02);
      });
      window.setTimeout(() => void context.close(), 1600);
    } catch {
      // Audio may be unavailable or blocked; the visual reminder still appears.
    }
  }, [soundStyle]);

  const speakReminder = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = voiceGender === "female" ? 0.92 : 0.96;
    utterance.pitch = voiceGender === "female" ? 1.12 : 0.88;
    utterance.volume = 1;
    // Available voices differ by browser and operating system. Choose a matching
    // installed voice when possible; pitch is a fallback, not a guarantee of gender.
    const voices = window.speechSynthesis.getVoices();
    const genderTerms = voiceGender === "female"
      ? /female|woman|zira|samantha|susan|karen|aria|jenny|google uk english female/i
      : /male|man|david|mark|guy|daniel|george|google uk english male/i;
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && genderTerms.test(voice.name))
      ?? voices.find((voice) => voice.lang.toLowerCase() === "en-in")
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
      ?? null;
    window.speechSynthesis.speak(utterance);
  }, [voiceGender]);

  function enableReminderSounds() {
    setSoundReady(true);
    playGentleChime();
    setMessage("Bunny sounds are ready. Keep the app open for in-app reminders. 🐰");
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  function testReminder() {
    if (!soundReady) {
      setMessage("Tap Enable sounds first so Bunny can play audio. 💗");
      return;
    }
    playGentleChime();
    window.setTimeout(() => speakReminder("Hello, lovely! This is your Bunny reminder sound test. You've got this!"), 420);
    setMessage("Testing Bunny's gentle reminder. 🐰");
  }

  // The in-app scheduler checks every 15 seconds while this page is open.
  useEffect(() => {
    if (!hydrated) return;
    const checkReminders = () => {
      const now = new Date();
      const dueEvents = events.filter((item) => {
        if (!item.reminderEnabled || item.completed || item.reminderTriggeredAt) return false;
        const [year, month, day] = item.dateKey.split("-").map(Number);
        const [hours, minutes] = item.time.split(":").map(Number);
        const taskAt = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
        const reminderAt = taskAt - item.reminderMinutesBefore * 60_000;
        return now.getTime() >= reminderAt && now.getTime() < taskAt + 60_000;
      });
      if (!dueEvents.length) return;
      const dueIds = new Set(dueEvents.map((item) => item.id));
      setEvents((current) => current.map((item) =>
        dueIds.has(item.id) ? { ...item, reminderTriggeredAt: Date.now() } : item
      ));
      for (const item of dueEvents) {
        const reminderText = `Hey, lovely! It's time for ${item.title}. ${item.description || "You've got this!"}`;
        setMessage(`🐰 Reminder: ${item.title} · ${formatTime(item.time)}`);
        setReminderHistory((current) => [item.id, ...current].slice(0, 10));
        if (soundReady && (item.reminderSound === "chime" || item.reminderSound === "both")) playGentleChime();
        if (soundReady && voiceEnabled && (item.reminderSound === "voice" || item.reminderSound === "both")) {
          window.setTimeout(() => speakReminder(reminderText), item.reminderSound === "both" ? 500 : 0);
        }
        if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
          try { new Notification(`Bunny reminder: ${item.title}`, { body: `${formatTime(item.time)} · ${item.description}`, tag: `bunny-${item.id}` }); } catch { /* In-app toast remains available. */ }
        }
      }
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 15_000);
    return () => window.clearInterval(timer);
  }, [events, hydrated, playGentleChime, soundReady, speakReminder, voiceEnabled]);

  const selectedEvents = useMemo(
    () => sortEvents(events.filter((item) => item.dateKey === selectedDateKey)),
    [events, selectedDateKey],
  );

  const completedCount = selectedEvents.filter((item) => item.completed).length;
  const progress = selectedEvents.length
    ? Math.round((completedCount / selectedEvents.length) * 100)
    : 0;

  const calendarMonth = selectedDate ?? new Date(2000, 0, 1);
  const monthTitle = calendarMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const monthDays = useMemo(() => {
    if (!selectedDateKey) return [];
    const selected = parseDateKey(selectedDateKey);
    const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [selectedDateKey]);

  function changeCalendarMonth(offset: number) {
    if (!selectedDateKey) return;
    const current = parseDateKey(selectedDateKey);
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + offset, 1, 12);
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0, 12).getDate();
    nextMonth.setDate(Math.min(current.getDate(), lastDay));
    setSelectedDateKey(dateKey(nextMonth));
  }

  // Toasts behave like compact mobile notifications and dismiss themselves.
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const changeDate = useCallback((days: number) => {
    setSelectedDateKey((current) => {
      if (!current) return dateKey(new Date());
      const next = parseDateKey(current);
      next.setDate(next.getDate() + days);
      return dateKey(next);
    });
  }, []);

  function openCreateEvent() {
    setEventTitle("");
    setEventTime("10:00");
    setEventCategory("personal");
    setEventPriority("medium");
    setEventDescription("");
    setReminderEnabled(true);
    setReminderMinutesBefore(defaultReminderMinutes);
    setReminderSound(defaultReminderSound);
    setMessage("");
    setShowEventForm(true);
  }

  function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = eventTitle.trim();

    if (!title) {
      setMessage("Please enter an event name.");
      return;
    }
    if (!selectedDateKey) {
      setMessage("Please wait for the calendar to finish loading.");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime)) {
      setMessage("Please select a valid time.");
      return;
    }

    const newEvent: CalendarEvent = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dateKey: selectedDateKey,
      time: eventTime,
      title,
      description: eventDescription.trim() || categoryDescriptions[eventCategory],
      category: eventCategory,
      priority: eventPriority,
      completed: false,
      createdAt: Date.now(),
      reminderEnabled,
      reminderMinutesBefore,
      reminderSound,
    };

    setEvents((current) => sortEvents([...current, newEvent]));
    setShowEventForm(false);
    setMessage(`“${title}” added to ${formatDate(parseDateKey(selectedDateKey))}.`);
  }

  function toggleCompleted(id: string) {
    setEvents((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  }

  function deleteEvent(id: string) {
    const target = events.find((item) => item.id === id);
    setEvents((current) => current.filter((item) => item.id !== id));
    setMessage(target ? `“${target.title}” deleted.` : "Event deleted.");
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setMessage("");
  }

  async function sendAiMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const prompt = aiPrompt.trim();

    if (!prompt) {
      setMessage("Write a little message for Bunny first. 💗");
      return;
    }

    if (aiLoading) return;

    const userMessage: ChatMessage = { role: "user", text: prompt };
    const conversation = [...aiMessages, userMessage];
    setAiMessages(conversation);
    setAiPrompt("");
    setAiLoading(true);

    const calendarContext = selectedEvents.length
      ? selectedEvents
          .map((item) => `- ${item.time} | ${item.title} | ${item.completed ? "completed" : "not completed"} | priority: ${item.priority ?? "medium"} | category: ${item.category} | ${item.description}`)
          .join("\\n")
      : "No events are currently scheduled for the selected day.";

    const history = conversation
      .slice(-12)
      .map((item) => `${item.role === "user" ? "User" : "Bunny"}: ${item.text}`)
      .join("\\n");

    const messageForBunny = [
      "Continue this conversation as Bunny, a warm and practical AI planning companion.",
      `Selected date: ${selectedDate ? formatDate(selectedDate) : selectedDateKey || "not loaded"}.`,
      "Events for the selected date:",
      calendarContext,
      "Recent conversation:",
      history,
      "Respond to the latest user message. For daily planning, give a realistic timeline with breaks and explain assumptions. Prioritize urgent/high-priority unfinished tasks first, then deadlines and effort. If duration or availability is unknown, ask or state a modest assumption. You may suggest tasks or time blocks, but do not claim to have added or changed calendar events.",
    ].join("\\n\\n");

    try {
      const response = await fetch("/api/bunny/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageForBunny }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const apiError =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Bunny couldn't answer just now. Please try again.";
        throw new Error(apiError);
      }

      const reply =
        typeof data === "object" &&
        data !== null &&
        "reply" in data &&
        typeof data.reply === "string"
          ? data.reply
          : "";

      if (!reply) throw new Error("Bunny sent an empty reply. Please try again.");

      setAiMessages((current) => [...current, { role: "assistant", text: reply }]);
    } catch (error: unknown) {
      const errorText =
        error instanceof Error
          ? error.message
          : "Bunny had a little hiccup. Please try again.";
      setAiMessages((current) => [
        ...current,
        { role: "assistant", text: `Oh, a tiny hiccup! ${errorText}` },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  function startApp() {
    setHasStarted(true);
  }

  const navItems = [
    { label: "Home" as const, icon: House },
    { label: "Calendar" as const, icon: CalendarDays },
    { label: "Tasks" as const, icon: ListTodo },
    { label: "AI" as const, icon: Sparkles },
    { label: "Settings" as const, icon: SettingsIcon },
  ];

  const visibleEvents = useMemo(() => {
    if (activeTab !== "Tasks") return selectedEvents;
    const anchor = selectedDate ?? new Date();
    let start = new Date(anchor);
    let end = new Date(anchor);
    if (taskRange === "week") {
      start.setDate(start.getDate() - start.getDay());
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (taskRange === "month") {
      start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
      end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
    } else if (taskRange === "year") {
      start = new Date(anchor.getFullYear(), 0, 1, 12);
      end = new Date(anchor.getFullYear(), 11, 31, 12);
    }
    const startKey = dateKey(start);
    const endKey = dateKey(end);
    const priorityRank: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return events
      .filter((item) => !item.completed && item.dateKey >= startKey && item.dateKey <= endKey)
      .sort((a, b) => (priorityRank[a.priority ?? "medium"] - priorityRank[b.priority ?? "medium"]) || a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time));
  }, [activeTab, selectedEvents, selectedDate, taskRange, events]);

  if (!hasStarted) {
    return (
      <main className="bunny-welcome-screen">
        <div className="bunny-welcome-orbit bunny-welcome-orbit--one" />
        <div className="bunny-welcome-orbit bunny-welcome-orbit--two" />
        <header className="bunny-welcome-brand">
          <span className="bunny-welcome-brand-icon"><CalendarDays size={21} /></span>
          <span><strong>Bunny AI Calendar</strong><small>Your tiny pocket of calm</small></span>
          <span className="bunny-welcome-sparkle"><Sparkles size={20} /></span>
        </header>
        <section className="bunny-welcome-content">
          <div className="bunny-welcome-bunny" aria-hidden="true">
            <span className="bunny-bunny-ear bunny-bunny-ear--left" />
            <span className="bunny-bunny-ear bunny-bunny-ear--right" />
            <span className="bunny-bunny-face">
              <span className="bunny-bunny-eye bunny-bunny-eye--left" />
              <span className="bunny-bunny-eye bunny-bunny-eye--right" />
              <span className="bunny-bunny-cheek bunny-bunny-cheek--left" />
              <span className="bunny-bunny-cheek bunny-bunny-cheek--right" />
              <span className="bunny-bunny-nose" />
            </span>
            <span className="bunny-bunny-flower">✿</span>
            <span className="bunny-bunny-star">✦</span>
          </div>
          <p className="bunny-welcome-eyebrow">A LITTLE NOTE FROM YOUR BUNNY</p>
          <h1>Hey, lovely.<br /><em>I’m Bunny.</em></h1>
          <p className="bunny-welcome-copy">Let’s make today feel lighter, one little step at a time.</p>
          <div className="bunny-quote-card">
            <span className="bunny-quote-mark">“</span>
            <p>“You don’t have to do everything today. Just begin with one thing that matters.”</p>
            <span className="bunny-quote-credit">TODAY’S LITTLE REMINDER</span>
            <div className="bunny-quote-doodle">✿ · ✦ · ✿</div>
          </div>
          <div className="bunny-welcome-promise"><span>♡</span><p>No pressure. No perfect days. Just progress that feels like you.</p></div>
          <button type="button" className="bunny-get-started" onClick={startApp}>Let’s get started <span>→</span></button>
          <p className="bunny-welcome-footnote">Your plans, your pace, your little wins.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`bunny-app ${darkMode ? "bunny-app--dark" : ""}`}>
      <header className="bunny-header bunny-container">
        <div className="bunny-brand">
          <div className="bunny-brand-icon"><CalendarDays size={24} /></div>
          <div>
            <p className="bunny-brand-title">Bunny AI Calendar</p>
            <p className="bunny-brand-subtitle">Your time, thoughtfully planned.</p>
          </div>
        </div>
        <button type="button" className="bunny-icon-button bunny-interactive" aria-label="Open Bunny AI" onClick={() => handleTabChange("AI")}>
          <Sparkles size={21} />
        </button>
      </header>



      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {activeTab === "Settings" ? (
            <section className="bunny-container bunny-section bunny-settings-page">
              <p className="bunny-eyebrow">MAKE BUNNY YOURS</p>
              <h1 className="bunny-greeting">Settings &amp; preferences<span> ⚙️</span></h1>
              <p className="bunny-description">A little space to make your planner feel just right for you.</p>

              <div className="bunny-settings-group">
                <p className="bunny-settings-group-title">APPEARANCE</p>
                <div className="bunny-settings-row">
                  <span className="bunny-settings-icon">{darkMode ? <Moon size={18} /> : <Sun size={18} />}</span>
                  <span className="bunny-settings-copy"><strong>Dark mode</strong><small>{darkMode ? "A softer, darker palette is active" : "Keep Bunny light and cozy"}</small></span>
                  <button type="button" className={`bunny-switch ${darkMode ? "is-on" : ""}`} role="switch" aria-checked={darkMode} aria-label="Toggle dark mode" onClick={() => setDarkMode(v => !v)}><span /></button>
                </div>
              </div>

              <div className="bunny-settings-group">
                <p className="bunny-settings-group-title">REMINDERS &amp; SOUND</p>
                <div className="bunny-settings-row">
                  <span className="bunny-settings-icon"><Bell size={18} /></span>
                  <span className="bunny-settings-copy"><strong>Browser notifications</strong><small>{typeof window !== "undefined" && "Notification" in window ? `Permission: ${Notification.permission}` : "Not supported in this browser"}</small></span>
                  <button type="button" className={`bunny-switch ${notificationsEnabled ? "is-on" : ""}`} role="switch" aria-checked={notificationsEnabled} aria-label="Toggle browser notifications" onClick={async () => {
                    if (notificationsEnabled) { setNotificationsEnabled(false); setMessage("Browser notifications switched off in Bunny settings."); return; }
                    if (!("Notification" in window)) { setMessage("This browser does not support notifications."); return; }
                    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
                    const allowed = permission === "granted";
                    setNotificationsEnabled(allowed);
                    setMessage(allowed ? "Browser notifications enabled. 🐰" : "Notifications were not allowed. You can change this in browser site settings.");
                  }}><span /></button>
                </div>
                <div className="bunny-settings-row">
                  <span className="bunny-settings-icon"><Volume2 size={18} /></span>
                  <span className="bunny-settings-copy"><strong>Reminder sounds</strong><small>{soundReady ? "Sounds enabled for this session" : "Tap to unlock audio in your browser"}</small></span>
                  <button type="button" className={`bunny-switch ${soundReady ? "is-on" : ""}`} role="switch" aria-checked={soundReady} aria-label="Enable reminder sounds" onClick={() => soundReady ? setSoundReady(false) : enableReminderSounds()}><span /></button>
                </div>
                <div className="bunny-settings-row">
                  <span className="bunny-settings-icon">🗣️</span>
                  <span className="bunny-settings-copy"><strong>Bunny voice</strong><small>Speak reminders out loud when supported</small></span>
                  <button type="button" className={`bunny-switch ${voiceEnabled ? "is-on" : ""}`} role="switch" aria-checked={voiceEnabled} aria-label="Toggle Bunny voice" onClick={() => setVoiceEnabled(v => !v)}><span /></button>
                </div>
                <label className="bunny-settings-select-row"><span><strong>Notification &amp; alarm sound</strong><small>Soft, app-only sound effects for Bunny reminders</small></span><select value={soundStyle} onChange={e => setSoundStyle(e.target.value as "waterdrop" | "serene" | "chime")}><option value="waterdrop">Water droplet</option><option value="serene">Serene bells</option><option value="chime">Gentle chime</option></select></label>
                <label className="bunny-settings-select-row"><span><strong>Voice style</strong><small>Choose the voice Bunny prefers when your device supports it</small></span><select value={voiceGender} onChange={e => setVoiceGender(e.target.value as "female" | "male")}><option value="female">Soft feminine voice</option><option value="male">Calm masculine voice</option></select></label>
                <label className="bunny-settings-select-row"><span><strong>Default reminder time</strong><small>How early Bunny should remind you</small></span><select value={defaultReminderMinutes} onChange={e => setDefaultReminderMinutes(Number(e.target.value))}><option value={0}>At event time</option><option value={5}>5 minutes before</option><option value={10}>10 minutes before</option><option value={15}>15 minutes before</option><option value={30}>30 minutes before</option></select></label>
                <label className="bunny-settings-select-row"><span><strong>Default reminder style</strong><small>Used for new events</small></span><select value={defaultReminderSound} onChange={e => setDefaultReminderSound(e.target.value as "chime" | "voice" | "both")}><option value="chime">Gentle chime</option><option value="voice">Bunny voice</option><option value="both">Chime + voice</option></select></label>
                <div className="bunny-settings-action-row"><button type="button" className="bunny-reminder-tool-button" onClick={enableReminderSounds}><Volume2 size={15} /> Enable sounds</button><button type="button" className="bunny-reminder-tool-button bunny-reminder-tool-button--soft" onClick={testReminder}>Test reminder</button></div>
                <p className="bunny-settings-note"><ShieldCheck size={15} /> Web reminders run while Bunny is open. Notifications may depend on browser and device permissions. Native Android reminders when the app is closed require the Android app integration phase.</p>
              </div>

              <div className="bunny-settings-group">
                <p className="bunny-settings-group-title">YOUR DAILY EXPERIENCE</p>
                <div className="bunny-settings-row">
                  <span className="bunny-settings-icon">🌷</span>
                  <span className="bunny-settings-copy"><strong>Daily encouragement</strong><small>Keep Bunny’s gentle motivational touches</small></span>
                  <button type="button" className={`bunny-switch ${dailyGreeting ? "is-on" : ""}`} role="switch" aria-checked={dailyGreeting} aria-label="Toggle daily encouragement" onClick={() => setDailyGreeting(v => !v)}><span /></button>
                </div>
                <div className="bunny-settings-info"><Smartphone size={17} /><span><strong>Designed for your phone</strong><small>Your events and preferences are saved on this device in this browser.</small></span></div>
              </div>

              <div className="bunny-settings-group">
                <p className="bunny-settings-group-title">DATA &amp; PRIVACY</p>
                <div className="bunny-settings-info"><ShieldCheck size={17} /><span><strong>Your calendar stays on this device</strong><small>Events and settings are stored locally. Bunny AI chat is sent to your configured server API for a response.</small></span></div>
                <button type="button" className="bunny-settings-reset" onClick={() => {
                  if (window.confirm("Reset Bunny preferences to their defaults? Your calendar events will not be deleted.")) {
                    setDarkMode(false); setVoiceEnabled(true); setNotificationsEnabled(false); setDefaultReminderMinutes(10); setDefaultReminderSound("both"); setDailyGreeting(true); setVoiceGender("female"); setSoundStyle("waterdrop"); setSoundReady(false); setMessage("Bunny preferences reset. Your events are safe.");
                  }
                }}><RotateCcw size={16} /> Reset preferences</button>
              </div>
            </section>
          ) : activeTab === "Calendar" ? (
            <section className="bunny-container bunny-calendar-page">
              <div className="bunny-calendar-intro">
                <span className="bunny-calendar-kicker">YOUR LITTLE PLANNER</span>
                <h1>Make room for<br /><em>what matters.</em></h1>
                <p>Pick a day, then give your plans a place to bloom.</p>
              </div>
              <section className="bunny-month-calendar bunny-month-calendar--full" aria-label="Monthly calendar">
                <div className="bunny-month-heading">
                  <div>
                    <p className="bunny-month-kicker">YOUR MONTH</p>
                    <h3>{monthTitle}</h3>
                  </div>
                  <div className="bunny-date-controls">
                    <button type="button" className="bunny-icon-button bunny-interactive" aria-label="Previous month" onClick={() => changeCalendarMonth(-1)}><ChevronLeft size={19} /></button>
                    <button type="button" className="bunny-icon-button bunny-interactive" aria-label="Next month" onClick={() => changeCalendarMonth(1)}><ChevronRight size={19} /></button>
                  </div>
                </div>
                <div className="bunny-month-grid bunny-month-grid--weekdays" aria-hidden="true">
                  {dayNames.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
                </div>
                <div className="bunny-month-grid">
                  {monthDays.map((day) => {
                    const key = dateKey(day);
                    const selected = key === selectedDateKey;
                    const inMonth = day.getMonth() === calendarMonth.getMonth();
                    const count = events.filter((item) => item.dateKey === key).length;
                    const isToday = key === dateKey(new Date());
                    return (
                      <button key={key} type="button" className={`bunny-month-day ${selected ? "bunny-month-day--selected" : ""} ${!inMonth ? "bunny-month-day--outside" : ""} ${isToday ? "bunny-month-day--today" : ""}`} aria-pressed={selected} aria-label={`${formatDate(day)}${count ? `, ${count} events` : ""}`} onClick={() => setSelectedDateKey(key)}>
                        <span>{day.getDate()}</span>
                        <i className={`bunny-month-dot ${count ? "bunny-month-dot--active" : ""}`} />
                      </button>
                    );
                  })}
                </div>
                <div className="bunny-calendar-hint"><span className="bunny-calendar-legend-dot" /> Dots show days with plans. Tap a date to see its schedule.</div>
              </section>
              <section className="bunny-calendar-selected-day">
                <div className="bunny-calendar-selected-heading">
                  <div>
                    <p className="bunny-month-kicker">YOUR SELECTED DAY</p>
                    <h2>{selectedDate ? formatDate(selectedDate) : "Loading your day"}</h2>
                    <p>{selectedEvents.length ? `${selectedEvents.length} planned ${selectedEvents.length === 1 ? "moment" : "moments"} · ${progress}% complete` : "A fresh page, ready for your plans."}</p>
                  </div>
                  <button type="button" className="bunny-add-button bunny-interactive" onClick={openCreateEvent}><Plus size={16} /> Add</button>
                </div>
                <div className="bunny-event-list">
                  <AnimatePresence mode="popLayout">
                    {selectedEvents.map((event) => (
                      <motion.article key={event.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }} className={`bunny-event-card ${event.completed ? "bunny-event-card--completed" : ""}`}>
                        <div className={`bunny-event-marker bunny-event-marker--${event.category}`} />
                        <div className="bunny-event-content">
                          <h3 className="bunny-event-title">{event.title}</h3>
                          <p className="bunny-event-description">{event.description}</p>
                          <div className="bunny-event-meta"><span className="bunny-event-time"><Clock3 size={13} /> {formatTime(event.time)}</span><span className="bunny-event-category">{categoryLabels[event.category]}</span><span className={`bunny-priority-badge bunny-priority-badge--${event.priority ?? "medium"}`}>{(event.priority ?? "medium").toUpperCase()}</span>{event.reminderEnabled && <span className="bunny-reminder-badge"><Bell size={11} /> Reminder on</span>}</div>
                        </div>
                        <button type="button" className={`bunny-completion-button ${event.completed ? "bunny-completion-button--completed" : ""}`} aria-label={event.completed ? `Mark ${event.title} as incomplete` : `Complete ${event.title}`} aria-pressed={event.completed} onClick={() => toggleCompleted(event.id)}>{event.completed ? <Check size={18} /> : <CheckCircle2 size={20} />}</button>
                        <button type="button" className="bunny-delete-button" aria-label={`Delete ${event.title}`} onClick={() => deleteEvent(event.id)}><X size={15} /></button>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                  {selectedEvents.length === 0 && (
                    <div className="bunny-calendar-empty">
                      <span className="bunny-calendar-empty-icon">☁️</span>
                      <h3>A little space to dream</h3>
                      <p>Add your first plan for this day. Tiny steps count, too.</p>
                      <button type="button" className="bunny-submit bunny-interactive" onClick={openCreateEvent}><Plus size={17} /> Plan this day</button>
                    </div>
                  )}
                </div>
              </section>
            </section>
          ) : activeTab === "AI" ? (
            <section className="bunny-container bunny-section bunny-ai-page">
              <p className="bunny-eyebrow">YOUR PLANNING COMPANION</p>
              <h1 className="bunny-greeting">A little help, a calmer day.</h1>
              <p className="bunny-description">Turn a busy mind into a realistic plan. Bunny can help you choose what matters, make time for it, and take the next small step.</p>
              <div className="bunny-ai-planning-tools" aria-label="Planning shortcuts">
                <button type="button" onClick={() => setAiPrompt("Build a realistic plan for my day using my scheduled events and unfinished tasks. Include breaks and tell me the first step.")} disabled={aiLoading}>
                  <span className="bunny-ai-tool-icon">☀</span><strong>Plan my day</strong><small>Make a balanced schedule</small>
                </button>
                <button type="button" onClick={() => setAiPrompt("Prioritize my unfinished tasks using urgency, importance, deadlines, and realistic effort. Tell me what to do first and why.")} disabled={aiLoading}>
                  <span className="bunny-ai-tool-icon">✦</span><strong>Prioritize tasks</strong><small>Find the best next step</small>
                </button>
                <button type="button" onClick={() => setAiPrompt("Break my biggest current goal into small, achievable tasks with suggested time blocks.")} disabled={aiLoading}>
                  <span className="bunny-ai-tool-icon">↗</span><strong>Break it down</strong><small>Turn a goal into steps</small>
                </button>
              </div>

              <section className="bunny-ai-card bunny-ai-card--panel" aria-label="Chat with Bunny">
                <div className="bunny-ai-top">
                  <div className="bunny-ai-icon"><Sparkles size={23} /></div>
                  <span className="bunny-ai-label">BUNNY AI · GEMINI</span>
                </div>
                <h2 className="bunny-ai-title">What’s on your mind?</h2>
                <p className="bunny-ai-description">Bunny can help you prioritize, plan study time, break down projects, and find a realistic next step.</p>

                <div
                  className="bunny-chat-messages"
                  aria-live="polite"
                  aria-label="Conversation with Bunny"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    margin: "20px 0",
                    maxHeight: 420,
                    overflowY: "auto",
                    padding: 4,
                  }}
                >
                  {aiMessages.map((chatMessage, index) => (
                    <motion.div
                      key={`${index}-${chatMessage.role}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        alignSelf: chatMessage.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "92%",
                        padding: "12px 15px",
                        borderRadius: chatMessage.role === "user" ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                        background: chatMessage.role === "user" ? "var(--cocoa-taupe, #7A6258)" : "var(--milk, #FBF7F4)",
                        color: chatMessage.role === "user" ? "#fff" : "var(--espresso-brown, #3B2F2A)",
                        border: chatMessage.role === "assistant" ? "1px solid var(--blush-oat, #E8D8CE)" : "1px solid transparent",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        lineHeight: 1.6,
                        fontSize: 14,
                      }}
                    >
                      {chatMessage.text}
                    </motion.div>
                  ))}
                  {aiLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bunny-motivation-card"
                      role="status"
                      style={{ padding: "12px 15px", alignSelf: "flex-start" }}
                    >
                      <span>🐰 Bunny is thinking…</span>
                    </motion.div>
                  )}
                </div>

                <form onSubmit={sendAiMessage}>
                  <label className="bunny-field-label bunny-ai-input-label" htmlFor="ai-prompt">Message Bunny</label>
                  <textarea
                    id="ai-prompt"
                    className="bunny-input bunny-ai-textarea"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Help me plan study, exercise, and my project today…"
                    rows={3}
                    maxLength={2000}
                    disabled={aiLoading}
                  />
                  <button
                    type="submit"
                    className="bunny-ai-action bunny-interactive"
                    disabled={aiLoading || !aiPrompt.trim()}
                    style={{ opacity: aiLoading || !aiPrompt.trim() ? 0.65 : 1 }}
                  >
                    <Sparkles size={17} /> {aiLoading ? "Bunny is thinking…" : "Send to Bunny"}
                  </button>
                </form>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {[
                    "Help me plan my day",
                    "Break my project into small steps",
                    "How can I stop procrastinating?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="bunny-add-button bunny-interactive"
                      disabled={aiLoading}
                      onClick={() => setAiPrompt(suggestion)}
                      style={{ fontSize: 12 }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </section>

              <div className="bunny-motivation-card bunny-ai-note">
                <strong>Small steps count. 💗</strong>
                <p>Bunny uses your selected day’s scheduled events as context. Suggestions are not saved automatically; review them first, then add or update events yourself. Tasks support priority labels, and the Tasks tab groups urgent items first.</p>
              </div>
            </section>
          ) : (
            <>
              <section className="bunny-container bunny-greeting-section">
                <p className="bunny-eyebrow">{activeTab === "Tasks" ? "ONE STEP AT A TIME" : "YOUR PERSONAL SPACE"}</p>
                <h1 className="bunny-greeting">{activeTab === "Tasks" ? <>Keep your<br />promises small.</> : <>Make today<br />meaningful.</>}</h1>
                <p className="bunny-description">{activeTab === "Tasks" ? "Your unfinished plans, without the pressure." : "A little structure can make room for a lot."}</p>
              </section>

              {activeTab === "Home" && (
                <section className="bunny-container bunny-home-hero-wrap">
                  <div className="bunny-home-hero">
                    <div className="bunny-home-hero-copy">
                      <span className="bunny-home-pill"><Sparkles size={12} /> YOUR GENTLE DAILY SPACE</span>
                      <p className="bunny-home-date">{currentMoment ? currentMoment.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "A fresh start, any day"}</p>
                      <h2>{!currentMoment ? "Welcome back" : currentMoment.getHours() < 12 ? "Good morning" : currentMoment.getHours() < 17 ? "Good afternoon" : "Good evening"}, lovely<span> ✨</span></h2>
                      <p className="bunny-home-hero-description">Make space for what matters. One thoughtful step at a time.</p>
                      <button type="button" className="bunny-home-primary-action" onClick={() => handleTabChange("AI")}><Sparkles size={16} /> Plan my day with Bunny <span>→</span></button>
                    </div>
                    <div className="bunny-home-bunny-art" aria-hidden="true"><span className="bunny-home-orbit" /><span className="bunny-home-bunny-face">🐰</span><span className="bunny-home-star bunny-home-star--one">✦</span><span className="bunny-home-star bunny-home-star--two">✧</span></div>
                  </div>
                  <div className="bunny-home-quick-actions">
                    <button type="button" onClick={openCreateEvent}><span>＋</span><strong>New task</strong><small>Make a little plan</small></button>
                    <button type="button" onClick={() => handleTabChange("Calendar")}><span>▦</span><strong>My calendar</strong><small>See your month</small></button>
                    <button type="button" onClick={() => handleTabChange("AI")}><span>✧</span><strong>Ask Bunny</strong><small>Find your next step</small></button>
                  </div>
                </section>
              )}

              <section className="bunny-container bunny-section">
                <div className="bunny-section-heading">
                  <div>
                    <h2 className="bunny-section-title">{activeTab === "Tasks" ? "Your open tasks" : "Your schedule"}</h2>
                    <p className="bunny-section-subtitle">{selectedDate ? formatDate(selectedDate) : "Loading your date..."}</p>
                  </div>
                  <div className="bunny-date-controls">
                    <button type="button" className="bunny-icon-button bunny-interactive" aria-label="Previous day" onClick={() => changeDate(-1)}><ChevronLeft size={21} /></button>
                    <button type="button" className="bunny-icon-button bunny-interactive" aria-label="Next day" onClick={() => changeDate(1)}><ChevronRight size={21} /></button>
                  </div>
                </div>



                {activeTab === "Tasks" && (
                  <div className="bunny-task-range" role="group" aria-label="Filter tasks by time period">
                    {[{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }, { key: "year", label: "Year" }].map((range) => (
                      <button key={range.key} type="button" className={taskRange === range.key ? "is-active" : ""} aria-pressed={taskRange === range.key} onClick={() => setTaskRange(range.key as "day" | "week" | "month" | "year")}>{range.label}</button>
                    ))}
                  </div>
                )}

                <div className="bunny-summary-grid">
                  <article className="bunny-summary-card">
                    <div className="bunny-summary-top"><div className="bunny-summary-icon"><CalendarDays size={20} /></div></div>
                    <p className="bunny-summary-label">Total events</p>
                    <p className="bunny-summary-value">{selectedEvents.length}</p>
                    <p className="bunny-summary-caption">On this day</p>
                  </article>
                  <article className="bunny-summary-card bunny-summary-card--soft">
                    <div className="bunny-summary-top"><div className="bunny-summary-icon"><Target size={20} /></div></div>
                    <p className="bunny-summary-label">Daily progress</p>
                    <p className="bunny-summary-value">{progress}%</p>
                    <p className="bunny-summary-caption">{completedCount} of {selectedEvents.length} completed</p>
                    <div className="bunny-progress-track" role="progressbar" aria-label="Daily progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                      <motion.div className="bunny-progress-fill" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
                    </div>
                  </article>
                </div>
              </section>

              <section className="bunny-container bunny-section bunny-events-section">
                <div className="bunny-section-heading">
                  <div>
                    <h2 className="bunny-section-title">{activeTab === "Tasks" ? "Ready when you are" : "Upcoming events"}</h2>
                    <p className="bunny-section-subtitle">{activeTab === "Tasks" ? "Check one off when you finish." : "Your day, at a glance"}</p>
                  </div>
                  <button type="button" className="bunny-add-button bunny-interactive" onClick={openCreateEvent}><Plus size={17} /> Add</button>
                </div>

                <div className="bunny-event-list">
                  <AnimatePresence mode="popLayout">
                    {visibleEvents.map((event) => (
                      <motion.article
                        key={event.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -18, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className={`bunny-event-card ${event.completed ? "bunny-event-card--completed" : ""}`}
                      >
                        <div className={`bunny-event-marker bunny-event-marker--${event.category}`} />
                        <div className="bunny-event-content">
                          <h3 className="bunny-event-title">{event.title}</h3>
                          <p className="bunny-event-description">{event.description}</p>
                          <div className="bunny-event-meta">
                            <span className="bunny-event-time"><Clock3 size={13} /> {formatTime(event.time)}</span>
                            <span className="bunny-event-category">{categoryLabels[event.category]}</span><span className={`bunny-priority-badge bunny-priority-badge--${event.priority ?? "medium"}`}>{(event.priority ?? "medium").toUpperCase()}</span>
                            {event.completed && <span className="bunny-completed-label">Completed</span>}
                            {event.reminderEnabled && <span className="bunny-reminder-badge"><Bell size={11} /> Reminder on</span>}
                          </div>
                        </div>
                        <button type="button" className={`bunny-completion-button ${event.completed ? "bunny-completion-button--completed" : ""}`} aria-label={event.completed ? `Mark ${event.title} as incomplete` : `Complete ${event.title}`} aria-pressed={event.completed} onClick={() => toggleCompleted(event.id)}>
                          {event.completed ? <Check size={18} /> : <CheckCircle2 size={20} />}
                        </button>
                        <button type="button" className="bunny-delete-button" aria-label={`Delete ${event.title}`} onClick={() => deleteEvent(event.id)}><X size={15} /></button>
                      </motion.article>
                    ))}
                  </AnimatePresence>

                  {visibleEvents.length === 0 && (
                    <motion.div className="bunny-empty-state" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <CalendarDays size={30} style={{ color: "var(--cocoa-taupe)", margin: "0 auto" }} />
                      <h3>{activeTab === "Tasks" ? "You're all caught up" : "Nothing planned yet"}</h3>
                      <p>{activeTab === "Tasks" ? "Enjoy the breathing room, or add your next small step." : "Add an event to start organizing this day."}</p>
                      <button type="button" className="bunny-add-button" onClick={openCreateEvent}><Plus size={16} /> Add an event</button>
                    </motion.div>
                  )}
                </div>
              </section>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {message && (
          <motion.section className="bunny-container bunny-toast-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <div className="bunny-message" role="status">
              <span>{message}</span>
              <button type="button" className="bunny-dismiss" onClick={() => setMessage("")} aria-label="Dismiss message"><X size={15} /></button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <nav className="bunny-bottom-nav" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.label;
          return (
            <button key={item.label} type="button" className={`bunny-nav-item ${active ? "bunny-nav-item--active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => handleTabChange(item.label)}>
              <span className="bunny-nav-icon"><Icon size={21} strokeWidth={active ? 2.4 : 1.8} /></span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {showEventForm && (
          <motion.div className="bunny-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEventForm(false); }}>
            <motion.section className="bunny-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
              <div className="bunny-dialog-handle" />
              <div className="bunny-dialog-header">
                <div>
                  <p className="bunny-eyebrow">YOUR SCHEDULE</p>
                  <h2 id="event-dialog-title" className="bunny-dialog-title">Create an event</h2>
                  <p className="bunny-section-subtitle">{selectedDate ? formatDate(selectedDate) : "Selected day"}</p>
                </div>
                <button type="button" className="bunny-icon-button" aria-label="Close event form" onClick={() => setShowEventForm(false)}><X size={21} /></button>
              </div>
              <form className="bunny-form" onSubmit={addEvent}>
                <div>
                  <label htmlFor="event-title" className="bunny-field-label">Event name</label>
                  <input id="event-title" className="bunny-input" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. Study for DSA" maxLength={100} autoFocus required />
                </div>
                <div>
                  <label htmlFor="event-description" className="bunny-field-label">Note (optional)</label>
                  <input id="event-description" className="bunny-input" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="What would make this useful?" maxLength={180} />
                </div>
                <div className="bunny-form-row">
                  <div>
                    <label htmlFor="event-time" className="bunny-field-label">Start time</label>
                    <input id="event-time" className="bunny-input" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="event-category" className="bunny-field-label">Category</label>
                    <select id="event-category" className="bunny-input" value={eventCategory} onChange={(e) => setEventCategory(e.target.value as Category)}>
                      {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="event-priority" className="bunny-field-label">Task priority</label>
                  <select id="event-priority" className="bunny-input" value={eventPriority} onChange={(e) => setEventPriority(e.target.value as TaskPriority)}>
                    <option value="urgent">Urgent — needs attention soon</option>
                    <option value="high">High — important</option>
                    <option value="medium">Medium — normal priority</option>
                    <option value="low">Low — when time allows</option>
                  </select>
                </div>
                <section className="bunny-reminder-form-card">
                  <label className="bunny-reminder-toggle">
                    <span><strong><Bell size={15} /> Remind me</strong><small>Get a gentle nudge before this task.</small></span>
                    <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
                  </label>
                  {reminderEnabled && (
                    <>
                      <div>
                        <label htmlFor="reminder-before" className="bunny-field-label">Remind me</label>
                        <select id="reminder-before" className="bunny-input" value={reminderMinutesBefore} onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}>
                          <option value={0}>At task time</option>
                          <option value={5}>5 minutes before</option>
                          <option value={10}>10 minutes before</option>
                          <option value={15}>15 minutes before</option>
                          <option value={30}>30 minutes before</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="reminder-sound" className="bunny-field-label">Reminder style</label>
                        <select id="reminder-sound" className="bunny-input" value={reminderSound} onChange={(e) => setReminderSound(e.target.value as "chime" | "voice" | "both")}>
                          <option value="chime">Gentle chime</option>
                          <option value="voice">Bunny voice</option>
                          <option value="both">Chime + Bunny voice</option>
                        </select>
                      </div>
                      {!soundReady && <p className="bunny-reminder-hint">Tip: tap “Enable sounds” on the main screen to allow audio. Browser rules may prevent sound until you interact with the app.</p>}
                    </>
                  )}
                </section>
                <button type="submit" className="bunny-submit bunny-interactive"><Check size={19} /> Add to schedule</button>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
