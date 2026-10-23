import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button, Select } from "../ui";

type Range = { from: string; until: string };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromKey = (value: string) => new Date(`${value}T12:00:00`);
const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const shiftMonth = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const pretty = (value: string) => fromKey(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function presets(): { label: string; range: Range }[] {
  const now = new Date();
  const today = dateKey(now);
  const lastDays = (days: number) => { const start = new Date(now); start.setDate(start.getDate() - days + 1); return { from: dateKey(start), until: today }; };
  return [
    { label: "All time", range: { from: "", until: "" } },
    { label: "Last 7 days", range: lastDays(7) },
    { label: "Last 30 days", range: lastDays(30) },
    { label: "Last 90 days", range: lastDays(90) },
    { label: "This month", range: { from: dateKey(monthStart(now)), until: today } },
    { label: "Last month", range: { from: dateKey(shiftMonth(now, -1)), until: dateKey(new Date(now.getFullYear(), now.getMonth(), 0)) } },
    { label: "This year", range: { from: `${now.getFullYear()}-01-01`, until: today } },
    { label: "Last year", range: { from: `${now.getFullYear() - 1}-01-01`, until: `${now.getFullYear() - 1}-12-31` } },
  ];
}

export function DateRangePicker({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [hover, setHover] = useState("");
  const [focusDate, setFocusDate] = useState("");
  const choices = presets();
  const selectedPreset = choices.find(item => item.range.from === value.from && item.range.until === value.until)?.label;
  const summary = selectedPreset ?? (value.from && value.until ? `${pretty(value.from)} – ${pretty(value.until)}` : "All time");
  useEffect(() => {
    if (focusDate) dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, month]);

  const open = () => {
    setDraft(value); setHover("");
    setMonth(monthStart(value.from ? fromKey(value.from) : new Date()));
    dialog.current?.showModal();
  };
  const choose = (day: string) => {
    setHover("");
    setDraft(current => !current.from || current.until ? { from: day, until: "" } : day < current.from ? { from: day, until: current.from } : { from: current.from, until: day });
  };
  const rangeEnd = draft.until || hover;
  const low = draft.from && rangeEnd ? [draft.from, rangeEnd].sort()[0] : draft.from;
  const high = draft.from && rangeEnd ? [draft.from, rangeEnd].sort()[1] : "";

  return <>
    <button type="button" className={`activity-filter ${value.from ? "is-active" : ""}`} onClick={open} aria-haspopup="dialog"><CalendarDays size={16} />{summary}</button>
    <dialog ref={dialog} className="date-dialog date-range-dialog" aria-labelledby="date-range-title" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="date-dialog-inner">
        <header className="date-range-header"><h2 id="date-range-title">Date range</h2><button type="button" className="date-icon-button" onClick={() => dialog.current?.close()} aria-label="Close date picker"><X size={20} /></button></header>
        <Select className="date-preset-select" aria-label="Date range preset" value={choices.find(item => item.range.from === draft.from && item.range.until === draft.until)?.label ?? "custom"} onChange={event => { const item = choices.find(item => item.label === event.target.value); if (item) { setDraft(item.range); setHover(""); if (item.range.from) setMonth(monthStart(fromKey(item.range.from))); } }}><option value="custom" disabled>Custom dates</option>{choices.map(item => <option key={item.label} value={item.label}>{item.label}</option>)}</Select>
        <div className="date-presets">{choices.map(item => <button type="button" key={item.label} aria-pressed={draft.from === item.range.from && draft.until === item.range.until} onClick={() => { setDraft(item.range); setHover(""); if (item.range.from) setMonth(monthStart(fromKey(item.range.from))); }}>{item.label}</button>)}</div>
        <div className="date-month-navigation"><button type="button" className="date-icon-button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={19} /></button><p className="text-xs text-ink-muted">Select a start and end date</p><button type="button" className="date-icon-button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={19} /></button></div>
        <div className="date-calendars">{[0, 1].map(index => {
          const current = shiftMonth(month, index);
          const days = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
          const start = (current.getDay() + 6) % 7;
          return <section key={index} className={index ? "date-second-month" : ""} aria-label={current.toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
            <h3 className="date-month-title">{current.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
            <div className="date-grid">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(day => <span key={day} className="date-weekday">{day}</span>)}{Array.from({ length: start }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: days }, (_, i) => {
              const day = dateKey(new Date(current.getFullYear(), current.getMonth(), i + 1));
              const edge = day === draft.from || day === draft.until;
              return <button type="button" key={day} data-date={day} className={`date-day ${edge ? "date-selected" : low && high && day >= low && day <= high ? "date-in-range" : ""}`} aria-label={pretty(day)} aria-pressed={edge} aria-current={day === dateKey(new Date()) ? "date" : undefined} onClick={() => choose(day)} onMouseEnter={() => { if (draft.from && !draft.until) setHover(day); }} onKeyDown={event => {
                const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                if (!step) return;
                event.preventDefault();
                const next = fromKey(day); next.setDate(next.getDate() + step);
                if (next.getMonth() !== current.getMonth()) setMonth(monthStart(next));
                setFocusDate(dateKey(next));
              }}>{i + 1}</button>;
            })}</div>
          </section>;
        })}</div>
        <footer className="date-range-footer"><p role="status" className="text-xs text-ink-muted">{draft.from ? `${pretty(draft.from)} → ${draft.until ? pretty(draft.until) : "Choose end date"}` : "All dates"}</p><div className="flex gap-2"><Button variant="subtle" onClick={() => dialog.current?.close()}>Cancel</Button><Button disabled={Boolean(draft.from && !draft.until)} onClick={() => { onChange(draft); dialog.current?.close(); }}>Apply dates</Button></div></footer>
      </div>
    </dialog>
  </>;
}
