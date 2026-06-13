import { useEffect, useMemo, useRef, useState } from "react";

function pad(value) {
  return String(value).padStart(2, "0");
}

function toInputValue(date, hour, minute) {
  return `${date}T${pad(hour)}:${pad(minute)}`;
}

function formatDisplay(value) {
  if (!value) return "Select expiry date and time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Select expiry date and time";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function DateTimePicker({ value, onChange }) {
  const pickerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const initialDate = value ? value.slice(0, 10) : now.toISOString().slice(0, 10);
  const initialHour = value ? Number(value.slice(11, 13)) : now.getHours();
  const initialMinute = value ? Number(value.slice(14, 16)) : 0;

  const [date, setDate] = useState(initialDate);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(() => [0, 15, 30, 45], []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applySelection = () => {
    onChange(toInputValue(date, hour, minute));
    setOpen(false);
  };

  return (
    <div className="date-time-picker" ref={pickerRef}>
      <button
        type="button"
        className={`date-time-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{formatDisplay(value)}</span>
        <span className="date-time-icon" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="date-time-panel">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>

          <div className="date-time-row">
            <label>
              Hour
              <div className="date-time-options">
                {hours.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={item === hour ? "selected" : ""}
                    onClick={() => setHour(item)}
                  >
                    {pad(item)}
                  </button>
                ))}
              </div>
            </label>

            <label>
              Minute
              <div className="date-time-options compact">
                {minutes.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={item === minute ? "selected" : ""}
                    onClick={() => setMinute(item)}
                  >
                    {pad(item)}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="date-time-actions">
            <button type="button" className="date-time-clear" onClick={() => onChange("")}>
              Clear
            </button>
            <button type="button" className="date-time-apply" onClick={applySelection}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateTimePicker;
