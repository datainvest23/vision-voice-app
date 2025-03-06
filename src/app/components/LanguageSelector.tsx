'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage, Language } from '../context/LanguageContext';
import ReactCountryFlag from 'react-country-flag';

// Language options with country codes for flags
const languageOptions = [
  { code: 'en', countryCode: 'GB', name: 'English' },
  { code: 'de', countryCode: 'DE', name: 'Deutsch' },
  { code: 'es', countryCode: 'ES', name: 'Español' },
  { code: 'fr', countryCode: 'FR', name: 'Français' }
];

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the current language option
  const currentLanguage = languageOptions.find(option => option.code === language) || languageOptions[0];

  // Handle language selection
  const handleLanguageSelect = (code: Language) => {
    setLanguage(code);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Common flag styles for consistency
  const flagStyle = {
    width: '1.5em',
    height: '1em',
    borderRadius: '2px',
    objectFit: 'cover' as const
  };

  return (
    <div className="language-selector-container" ref={dropdownRef}>
      <button 
        className="language-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="flag-icon mr-2">
          <ReactCountryFlag 
            countryCode={currentLanguage.countryCode} 
            svg 
            style={flagStyle}
            title={currentLanguage.countryCode}
            aria-label={`Flag of ${currentLanguage.name}`}
          />
        </span>
        <span className="language-name">{currentLanguage.name}</span>
        <svg 
          className={`h-4 w-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="language-dropdown">
          <ul className="language-options">
            {languageOptions.map((option) => (
              <li 
                key={option.code}
                className={`language-option ${option.code === language ? 'selected' : ''}`}
                onClick={() => handleLanguageSelect(option.code as Language)}
              >
                <span className="flag-icon mr-2">
                  <ReactCountryFlag 
                    countryCode={option.countryCode} 
                    svg 
                    style={flagStyle}
                    title={option.countryCode}
                    aria-label={`Flag of ${option.name}`}
                  />
                </span>
                <span className="language-name">{option.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 