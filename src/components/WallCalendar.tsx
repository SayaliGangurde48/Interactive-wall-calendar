import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, Pencil, Trash2, Sun, Moon, Calendar, Sparkles } from "lucide-react";
import {
  getCalendarDays,
  isInRange,
  isRangeStart,
  isRangeEnd,
  isRangeSingle,
  isToday,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
  getHoliday,
  MONTH_IMAGES,
} from "@/lib/calendarUtils";

interface Note {
  id: string;
  startDate: string;
  endDate: string;
  text: string;
  createdAt: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {}
      return resolved;
    });
  }, [key]);

  return [value, setStoredValue] as const;
}

/* Tilt card — follows cursor for 3D parallax effect */
function TiltCard({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 30 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    rotateY.set(dx * 3);
    rotateX.set(-dy * 3);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: springX, rotateY: springY, transformStyle: "preserve-3d", ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* Animated day cell */
const dayVariants = {
  hidden: { opacity: 0, scale: 0.6, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.018,
      type: "spring" as const,
      stiffness: 380,
      damping: 22,
    },
  }),
  exit: (i: number) => ({
    opacity: 0,
    scale: 0.7,
    y: -4,
    transition: { delay: i * 0.008, duration: 0.12 },
  }),
};

/* Grid container stagger */
const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.015 } },
  exit: {},
};

/* Page flip variants for the whole calendar panel */
const flipVariants = {
  enterNext: { rotateX: -90, opacity: 0, transformOrigin: "top center" },
  enterPrev: { rotateX: 90, opacity: 0, transformOrigin: "top center" },
  center: {
    rotateX: 0,
    opacity: 1,
    transformOrigin: "top center",
    transition: { type: "spring" as const, stiffness: 280, damping: 28 },
  },
  exitNext: { rotateX: 90, opacity: 0, transformOrigin: "top center", transition: { duration: 0.22 } },
  exitPrev: { rotateX: -90, opacity: 0, transformOrigin: "top center", transition: { duration: 0.22 } },
};

export default function WallCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selectionPhase, setSelectionPhase] = useState<"none" | "start">("none");
  const [notes, setNotes] = useLocalStorage<Note[]>("wall-calendar-notes", []);
  const [noteText, setNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isDark, setIsDark] = useLocalStorage<boolean>("wall-calendar-dark", false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [justSelected, setJustSelected] = useState<string | null>(null);

  const monthImage = MONTH_IMAGES[currentMonth.getMonth()];
  const calendarDays = getCalendarDays(currentMonth);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    setImageLoaded(false);
  }, [currentMonth]);

  const goToPrevMonth = () => {
    setDirection(-1);
    setCurrentMonth((m) => subMonths(m, 1));
    setRangeStart(null);
    setRangeEnd(null);
    setSelectionPhase("none");
    setNoteText("");
    setEditingNoteId(null);
  };

  const goToNextMonth = () => {
    setDirection(1);
    setCurrentMonth((m) => addMonths(m, 1));
    setRangeStart(null);
    setRangeEnd(null);
    setSelectionPhase("none");
    setNoteText("");
    setEditingNoteId(null);
  };

  const handleDayClick = (date: Date) => {
    if (!isSameMonth(date, currentMonth)) return;
    const key = format(date, "yyyy-MM-dd");
    setJustSelected(key);
    setTimeout(() => setJustSelected(null), 600);

    if (selectionPhase === "none" || selectionPhase === "start") {
      if (selectionPhase === "start" && rangeStart) {
        // completing the range
        if (date < rangeStart) {
          setRangeEnd(rangeStart);
          setRangeStart(date);
        } else {
          setRangeEnd(date);
        }
        setSelectionPhase("none");
        setNoteText("");
        setEditingNoteId(null);
      } else {
        setRangeStart(date);
        setRangeEnd(null);
        setSelectionPhase("start");
      }
    }
  };

  const handleDayMouseEnter = (date: Date) => {
    if (selectionPhase === "start") setHoverDate(date);
  };
  const handleDayMouseLeave = () => setHoverDate(null);

  const effectiveEnd = selectionPhase === "start" && hoverDate ? hoverDate : rangeEnd;

  const getNotesForRange = (): Note[] => {
    if (!rangeStart) return [];
    const startStr = format(rangeStart, "yyyy-MM-dd");
    const endStr = effectiveEnd ? format(effectiveEnd, "yyyy-MM-dd") : startStr;
    return notes.filter((n) => n.startDate === startStr && n.endDate === endStr);
  };

  const saveNote = () => {
    if (!noteText.trim() || !rangeStart) return;
    const startStr = format(rangeStart, "yyyy-MM-dd");
    const endStr = effectiveEnd ? format(effectiveEnd, "yyyy-MM-dd") : startStr;
    if (editingNoteId) {
      setNotes((prev) =>
        prev.map((n) => (n.id === editingNoteId ? { ...n, text: noteText.trim() } : n))
      );
      setEditingNoteId(null);
    } else {
      setNotes((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          startDate: startStr,
          endDate: endStr,
          text: noteText.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setNoteText("");
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingNoteId === id) { setEditingNoteId(null); setNoteText(""); }
  };

  const startEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteText(note.text);
  };

  const currentNotes = getNotesForRange();

  const selectedLabel = (() => {
    if (!rangeStart) return null;
    if (!effectiveEnd || isSameDay(rangeStart, effectiveEnd))
      return format(rangeStart, "MMMM d, yyyy");
    const s = rangeStart <= effectiveEnd ? rangeStart : effectiveEnd;
    const e = rangeStart <= effectiveEnd ? effectiveEnd : rangeStart;
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  })();

  const ringPositions = [15, 27, 39, 51, 63, 75, 85];

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 transition-colors duration-700 ${
        isDark
          ? "bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900"
          : "bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100"
      }`}
      data-testid="calendar-container"
    >
      {/* Main calendar card with 3D tilt */}
      <TiltCard
        className="w-full max-w-5xl rounded-2xl overflow-hidden relative"
        style={{
          background: isDark
            ? "linear-gradient(145deg, #292018, #1e1610)"
            : "linear-gradient(145deg, #fdf8f0, #f5efe0)",
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 8px 32px rgba(60,35,15,0.18), 0 2px 8px rgba(60,35,15,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        {/* Binding rings */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-7 z-20 flex items-center px-4"
          initial={{ y: -28 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
          style={{
            background: isDark
              ? "linear-gradient(to bottom, #3a2a1a, #2a1e0e)"
              : "linear-gradient(to bottom, #c8a87a, #a07840)",
          }}
        >
          {ringPositions.map((pct, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${pct}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08 + i * 0.05, type: "spring", stiffness: 400, damping: 18 }}
            >
              <motion.div
                className="w-5 h-5 rounded-full"
                animate={{ rotateY: [0, 360] }}
                transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: "linear", delay: i * 0.3 }}
                style={{
                  background:
                    "linear-gradient(135deg, #d4a84b 0%, #8b6020 40%, #d4a84b 70%, #8b6020 100%)",
                  boxShadow: "inset 0 2px 3px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)",
                }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Two-panel body */}
        <div className="pt-7 flex flex-col lg:flex-row">
          {/* LEFT — hero image + notes */}
          <motion.div
            className="lg:w-2/5 flex flex-col relative"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Hero image */}
            <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentMonth.toISOString()}
                  src={monthImage.url}
                  alt={monthImage.alt}
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ opacity: 0, scale: 1.08, x: direction * 60 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.94, x: -direction * 60 }}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  onLoad={() => setImageLoaded(true)}
                  data-testid="hero-image"
                />
              </AnimatePresence>

              {!imageLoaded && (
                <motion.div
                  className="absolute inset-0 bg-stone-200 dark:bg-stone-700"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 40%, rgba(20,12,4,0.7) 100%)",
                }}
              />

              {/* Month label overlaid on image */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <motion.p
                  className="text-xs uppercase tracking-widest font-medium text-amber-200/80 mb-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {monthImage.theme}
                </motion.p>
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={format(currentMonth, "MMMM-yyyy")}
                    className="font-serif text-white leading-none"
                    style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
                    initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                    transition={{ duration: 0.38, ease: "easeOut" }}
                  >
                    {format(currentMonth, "MMMM")}
                    <motion.span
                      className="block text-amber-200 text-2xl font-light mt-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12, duration: 0.3 }}
                    >
                      {format(currentMonth, "yyyy")}
                    </motion.span>
                  </motion.h1>
                </AnimatePresence>
              </div>
            </div>

            {/* Notes area */}
            <div
              className="flex-1 p-5 calendar-paper-texture"
              style={{
                background: isDark ? "rgba(30, 22, 12, 0.95)" : "rgba(253, 248, 240, 0.97)",
                borderRight: isDark
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "1px solid rgba(160,120,60,0.2)",
              }}
            >
              <motion.div
                className="flex items-center gap-2 mb-3"
                animate={rangeStart ? { x: [0, -2, 2, 0] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Pencil size={14} className="text-primary" />
                <AnimatePresence mode="wait">
                  <motion.h3
                    key={selectedLabel ?? "empty"}
                    className="font-serif text-sm font-semibold text-foreground"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {selectedLabel ? `Notes for ${selectedLabel}` : "Select dates for notes"}
                  </motion.h3>
                </AnimatePresence>
              </motion.div>

              <AnimatePresence>
                {rangeStart && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-3">
                      <motion.textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Jot something down..."
                        className="font-handwritten w-full text-base resize-none border-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                        style={{
                          minHeight: "72px",
                          borderBottom: isDark
                            ? "1px dashed rgba(200,160,80,0.3)"
                            : "1px dashed rgba(160,120,60,0.35)",
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        data-testid="note-textarea"
                      />
                      <div className="flex gap-2 mt-2">
                        <motion.button
                          onClick={saveNote}
                          disabled={!noteText.trim()}
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.93 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                          data-testid="button-save-note"
                        >
                          {editingNoteId ? "Update Note" : "Add Note"}
                        </motion.button>
                        {editingNoteId && (
                          <motion.button
                            onClick={() => { setEditingNoteId(null); setNoteText(""); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.93 }}
                          >
                            Cancel
                          </motion.button>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {currentNotes.length > 0 && (
                        <motion.div
                          className="space-y-2 max-h-40 overflow-y-auto pr-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          {currentNotes.map((note, i) => (
                            <motion.div
                              key={note.id}
                              initial={{ opacity: 0, x: -12, scale: 0.96 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: 12, scale: 0.93 }}
                              transition={{ delay: i * 0.06, type: "spring", stiffness: 350, damping: 24 }}
                              className="group flex items-start gap-2 rounded-lg p-2.5"
                              style={{
                                background: isDark
                                  ? "rgba(255,255,255,0.04)"
                                  : "rgba(200,160,80,0.08)",
                              }}
                              data-testid={`note-item-${note.id}`}
                            >
                              <p className="font-handwritten flex-1 text-sm text-foreground leading-relaxed">
                                {note.text}
                              </p>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <motion.button
                                  onClick={() => startEditNote(note)}
                                  className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                                  whileTap={{ scale: 0.8 }}
                                  data-testid={`button-edit-note-${note.id}`}
                                >
                                  <Pencil size={11} />
                                </motion.button>
                                <motion.button
                                  onClick={() => deleteNote(note.id)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  whileTap={{ scale: 0.8, rotate: -10 }}
                                  data-testid={`button-delete-note-${note.id}`}
                                >
                                  <Trash2 size={11} />
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {!rangeStart && (
                <motion.p
                  className="font-handwritten text-sm text-muted-foreground italic leading-relaxed"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  Click a day to start selecting, then click again to end your range...
                </motion.p>
              )}
            </div>
          </motion.div>

          {/* RIGHT — grid */}
          <motion.div
            className="lg:w-3/5 flex flex-col"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.07 }}
            style={{
              background: isDark ? "rgba(26, 18, 10, 0.95)" : "rgba(252, 246, 234, 0.97)",
            }}
          >
            {/* Navigation bar */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{
                borderBottom: isDark
                  ? "1px solid rgba(255,255,255,0.07)"
                  : "1px solid rgba(160,120,60,0.2)",
              }}
            >
              <motion.button
                onClick={goToPrevMonth}
                className="flex items-center justify-center w-9 h-9 rounded-full text-foreground"
                whileHover={{ scale: 1.15, backgroundColor: "hsl(25 60% 40% / 0.12)" }}
                whileTap={{ scale: 0.85, x: -3 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                data-testid="button-prev-month"
              >
                <ChevronLeft size={18} />
              </motion.button>

              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 15, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
                >
                  <Calendar size={15} className="text-primary" />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={format(currentMonth, "MMMM-yyyy")}
                    className="font-serif text-lg font-semibold text-foreground"
                    initial={{ opacity: 0, y: direction > 0 ? -14 : 14, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: direction > 0 ? 14 : -14, filter: "blur(4px)" }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    {format(currentMonth, "MMMM yyyy")}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => setIsDark((d) => !d)}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-foreground"
                  whileHover={{ scale: 1.15, backgroundColor: "hsl(25 60% 40% / 0.12)" }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  data-testid="button-toggle-theme"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isDark ? "sun" : "moon"}
                      initial={{ rotate: -90, scale: 0, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: 90, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    </motion.div>
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  onClick={goToNextMonth}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-foreground"
                  whileHover={{ scale: 1.15, backgroundColor: "hsl(25 60% 40% / 0.12)" }}
                  whileTap={{ scale: 0.85, x: 3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  data-testid="button-next-month"
                >
                  <ChevronRight size={18} />
                </motion.button>
              </div>
            </div>

            {/* Instruction banner */}
            <div className="px-5 py-2">
              <AnimatePresence mode="wait">
                <motion.p
                  key={selectionPhase + String(!!rangeStart && !!rangeEnd)}
                  className="text-xs text-center text-muted-foreground"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                >
                  {selectionPhase === "start"
                    ? "Now click an end date to complete your selection"
                    : rangeStart && rangeEnd
                    ? `Selected: ${selectedLabel} — click any day to reset`
                    : "Click a day to begin selecting a date range"}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 px-3 pb-1">
              {WEEKDAYS.map((day, i) => (
                <motion.div
                  key={day}
                  className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground py-1"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                >
                  {day}
                </motion.div>
              ))}
            </div>

            {/* Day grid — flip transition */}
            <div style={{ perspective: "1200px" }}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={format(currentMonth, "yyyy-MM")}
                  className="grid grid-cols-7 px-3 pb-4 gap-y-0.5"
                  custom={direction}
                  variants={gridVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {calendarDays.map((date, idx) => {
                    const inMonth = isSameMonth(date, currentMonth);
                    const isStart = isRangeStart(date, rangeStart, effectiveEnd);
                    const isEnd = isRangeEnd(date, rangeStart, effectiveEnd);
                    const inRange = isInRange(date, rangeStart, effectiveEnd);
                    const isSingle = isRangeSingle(rangeStart, effectiveEnd);
                    const today = isToday(date);
                    const holiday = getHoliday(date);
                    const isSelected = isStart || isEnd || (isSingle && isStart);
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    const dateKey = format(date, "yyyy-MM-dd");
                    const wasJustSelected = justSelected === dateKey;

                    return (
                      <motion.div
                        key={dateKey}
                        className="relative flex flex-col items-center py-0.5"
                        variants={dayVariants}
                        custom={idx}
                      >
                        {/* Range strip */}
                        <AnimatePresence>
                          {inRange && !isStart && !isEnd && inMonth && (
                            <motion.div
                              key="strip"
                              className="absolute inset-y-0.5 left-0 right-0"
                              initial={{ scaleX: 0, opacity: 0 }}
                              animate={{ scaleX: 1, opacity: 1 }}
                              exit={{ scaleX: 0, opacity: 0 }}
                              style={{
                                transformOrigin: "left center",
                                background: isDark
                                  ? "rgba(180, 120, 50, 0.22)"
                                  : "rgba(160, 100, 30, 0.14)",
                              }}
                            />
                          )}
                          {isStart && !isSingle && inMonth && (
                            <motion.div
                              key="start-strip"
                              className="absolute inset-y-0.5 right-0"
                              initial={{ scaleX: 0, opacity: 0 }}
                              animate={{ scaleX: 1, opacity: 1 }}
                              exit={{ scaleX: 0, opacity: 0 }}
                              style={{
                                left: "50%",
                                transformOrigin: "left center",
                                background: isDark
                                  ? "rgba(180, 120, 50, 0.22)"
                                  : "rgba(160, 100, 30, 0.14)",
                              }}
                            />
                          )}
                          {isEnd && !isSingle && inMonth && (
                            <motion.div
                              key="end-strip"
                              className="absolute inset-y-0.5 left-0"
                              initial={{ scaleX: 0, opacity: 0 }}
                              animate={{ scaleX: 1, opacity: 1 }}
                              exit={{ scaleX: 0, opacity: 0 }}
                              style={{
                                right: "50%",
                                transformOrigin: "right center",
                                background: isDark
                                  ? "rgba(180, 120, 50, 0.22)"
                                  : "rgba(160, 100, 30, 0.14)",
                              }}
                            />
                          )}
                        </AnimatePresence>

                        {/* Ripple burst on click */}
                        <AnimatePresence>
                          {wasJustSelected && (
                            <motion.div
                              key="ripple"
                              className="absolute inset-0 rounded-full pointer-events-none z-20"
                              initial={{ scale: 0.5, opacity: 0.7 }}
                              animate={{ scale: 2.8, opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.55, ease: "easeOut" }}
                              style={{
                                background: isDark
                                  ? "radial-gradient(circle, rgba(210,150,60,0.5), transparent)"
                                  : "radial-gradient(circle, rgba(160,100,30,0.35), transparent)",
                              }}
                            />
                          )}
                        </AnimatePresence>

                        <motion.button
                          onClick={() => handleDayClick(date)}
                          onMouseEnter={() => handleDayMouseEnter(date)}
                          onMouseLeave={handleDayMouseLeave}
                          disabled={!inMonth}
                          className={`
                            relative z-10 flex flex-col items-center justify-center w-9 h-9 rounded-full text-sm
                            ${!inMonth ? "opacity-20 cursor-default" : "cursor-pointer"}
                            ${isSelected
                              ? "text-white shadow-md"
                              : today
                              ? "font-bold"
                              : isWeekend && inMonth
                              ? "text-accent"
                              : "text-foreground"
                            }
                          `}
                          style={
                            isSelected
                              ? { background: "linear-gradient(135deg, hsl(25 60% 42%), hsl(15 65% 52%))" }
                              : today && !isSelected
                              ? { boxShadow: "0 0 0 2px hsl(25 60% 40%)" }
                              : {}
                          }
                          whileHover={
                            inMonth && !isSelected
                              ? { scale: 1.22, backgroundColor: "hsl(25 60% 40% / 0.12)" }
                              : {}
                          }
                          whileTap={inMonth ? { scale: 0.78 } : {}}
                          animate={
                            isSelected
                              ? { scale: [1, 1.18, 1], transition: { duration: 0.35, ease: "easeOut" } }
                              : {}
                          }
                          transition={{ type: "spring", stiffness: 450, damping: 20 }}
                          data-testid={`day-${dateKey}`}
                        >
                          <span className="leading-none text-sm">{format(date, "d")}</span>

                          {holiday && inMonth && (
                            <motion.span
                              className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? "bg-white/70" : ""}`}
                              style={!isSelected ? { background: "hsl(15 65% 55%)" } : {}}
                              animate={{ scale: [1, 1.5, 1] }}
                              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                              title={holiday}
                            />
                          )}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer legend */}
            <motion.div
              className="px-5 py-3 mt-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                borderTop: isDark
                  ? "1px solid rgba(255,255,255,0.07)"
                  : "1px solid rgba(160,120,60,0.2)",
              }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <motion.span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: "hsl(15 65% 55%)" }}
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                  />
                  <span className="text-xs text-muted-foreground">Holiday</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: "linear-gradient(135deg, hsl(25 60% 42%), hsl(15 65% 52%))" }}
                  />
                  <span className="text-xs text-muted-foreground">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-4 h-2 rounded-sm"
                    style={{
                      background: isDark ? "rgba(180, 120, 50, 0.3)" : "rgba(160, 100, 30, 0.18)",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">In range</span>
                </div>
                <AnimatePresence>
                  {notes.length > 0 && (
                    <motion.span
                      className="ml-auto text-xs text-muted-foreground flex items-center gap-1"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <Sparkles size={10} className="text-primary" />
                      {notes.length} note{notes.length !== 1 ? "s" : ""} saved
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </TiltCard>

      {/* All Notes panel */}
      <AnimatePresence>
        {notes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="w-full max-w-5xl mt-6 rounded-xl p-5 overflow-hidden"
            style={{
              background: isDark ? "rgba(30, 22, 12, 0.85)" : "rgba(253, 248, 240, 0.9)",
              border: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(160,120,60,0.25)",
              backdropFilter: "blur(8px)",
            }}
            data-testid="all-notes-panel"
          >
            <motion.h3
              className="font-serif text-base font-semibold text-foreground mb-4 flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Sparkles size={14} className="text-primary" />
              All Notes
            </motion.h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence>
                {notes.map((note, i) => (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, scale: 0.88, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -10, transition: { duration: 0.2 } }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 24 }}
                    className="group relative rounded-lg p-3.5"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(200,160,80,0.08)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.07)"
                        : "1px solid rgba(160,120,60,0.18)",
                    }}
                    whileHover={{
                      y: -2,
                      boxShadow: isDark
                        ? "0 6px 20px rgba(0,0,0,0.3)"
                        : "0 6px 20px rgba(60,35,15,0.12)",
                    }}
                    data-testid={`all-note-${note.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span
                        className="text-xs font-medium"
                        style={{ color: isDark ? "hsl(25 55% 60%)" : "hsl(25 60% 40%)" }}
                      >
                        {note.startDate === note.endDate
                          ? note.startDate
                          : `${note.startDate} – ${note.endDate}`}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <motion.button
                          onClick={() => {
                            const d = new Date(note.startDate + "T12:00:00");
                            setCurrentMonth(d);
                            setRangeStart(new Date(note.startDate + "T12:00:00"));
                            setRangeEnd(new Date(note.endDate + "T12:00:00"));
                            setSelectionPhase("none");
                            startEditNote(note);
                          }}
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                          whileTap={{ scale: 0.8 }}
                          data-testid={`button-edit-all-note-${note.id}`}
                        >
                          <Pencil size={11} />
                        </motion.button>
                        <motion.button
                          onClick={() => deleteNote(note.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          whileTap={{ scale: 0.75, rotate: -15 }}
                          data-testid={`button-delete-all-note-${note.id}`}
                        >
                          <Trash2 size={11} />
                        </motion.button>
                      </div>
                    </div>
                    <p className="font-handwritten text-sm text-foreground leading-relaxed">
                      {note.text}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
