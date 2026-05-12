import { useState, useRef, useEffect } from "react";

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите опцию",
  className = "",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    options.find((opt) => opt.value === value) || null,
  );
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    setSelectedOption(option);
    onChange(option.value);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`custom-select-wrapper ${className}`} ref={dropdownRef}>
      <div
        className={`custom-select-trigger ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={toggleDropdown}
      >
        <span className="custom-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="custom-select-arrow">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d="M6 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className={`custom-select-dropdown ${isOpen ? "open" : ""}`}>
        <div className="custom-select-dropdown-content">
          <div className="custom-select-options">
            {options.map((option, index) => (
              <div
                key={option.value}
                className={`custom-select-option ${selectedOption?.value === option.value ? "selected" : ""}`}
                onClick={() => handleSelect(option)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="custom-select-option-text">
                  {option.label}
                </span>
                {selectedOption?.value === option.value && (
                  <span className="custom-select-option-check">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
