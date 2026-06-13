import { useEffect, useRef, useState } from "react";

function SelectMenu({ value, options, onChange, placeholder = "Select", className = "" }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className={`select-menu ${className}`} ref={menuRef}>
      <button
        type="button"
        className={`select-menu-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <span className="select-menu-arrow" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="select-menu-list" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`select-menu-option ${option.value === value ? "selected" : ""}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectMenu;
