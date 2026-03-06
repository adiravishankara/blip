import { useState, useMemo, useEffect } from 'react';
import { City, State, Country } from 'country-state-city';

interface CityAutocompleteProps {
  onSelect: (location: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({ onSelect, placeholder = "Start typing a city...", className }: CityAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; stateCode: string; countryCode: string; full: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Pre-load cities once (warning: memory intensive)
  // Optimization: use a subset or searchable index if performance is poor
  const allCities = useMemo(() => City.getAllCities(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length < 3) {
        setSuggestions([]);
        return;
      }

      const lowerQuery = query.toLowerCase();
      
      // Optimization: filter by prefix first, then results
      const matches = [];
      for (const city of allCities) {
        if (city.name.toLowerCase().includes(lowerQuery)) {
          matches.push(city);
          if (matches.length >= 8) break; // Early exit for performance
        }
      }

      const formatted = matches.map(city => {
        const state = State.getStateByCodeAndCountry(city.stateCode, city.countryCode);
        const country = Country.getCountryByCode(city.countryCode);
        const fullName = `${city.name}${state ? `, ${state.name}` : ''}, ${country?.name || city.countryCode}`;
        return {
          name: city.name,
          stateCode: city.stateCode,
          countryCode: city.countryCode,
          full: fullName
        };
      });

      setSuggestions(formatted);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query, allCities]);

  const [activeIndex, setActiveIndex] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        handleSelect(suggestions[activeIndex]);
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (s: { full: string }) => {
    setQuery(s.full);
    onSelect(s.full);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setShowSuggestions(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="px-3 py-1.5 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Suggested Cities</span>
            <span className="text-[10px] text-gray-400 font-medium">↑↓ to navigate</span>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => handleSelect(s)}
                className={`w-full text-left px-4 py-3 text-sm transition-all flex flex-col gap-0.5 ${
                  i === activeIndex ? 'bg-blue-50 border-l-4 border-blue-600 pl-3' : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${i === activeIndex ? 'text-blue-900' : 'text-gray-900'}`}>
                    {s.name}
                  </span>
                  {i === activeIndex && <span className="text-[10px] font-bold text-blue-500">ENTER</span>}
                </div>
                <span className={`text-xs ${i === activeIndex ? 'text-blue-600/70' : 'text-gray-500'}`}>
                  {s.full}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
