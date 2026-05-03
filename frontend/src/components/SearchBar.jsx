import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import './component-css/SearchBar.css';

export default function SearchBar({ onSearch }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsExpanded(false);
      handleClear();
    }
  };

  return (
    <div data-testid="search-bar">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="sb-toggle-btn glass-panel"
          data-testid="search-toggle-btn"
        >
          <Search style={{ width: '1rem', height: '1rem' }} />
        </button>
      ) : (
        <motion.form
          initial={{ width: 40 }}
          animate={{ width: 280 }}
          onSubmit={handleSearch}
          className="sb-form glass-panel"
        >
          <Search className="sb-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="Search events, countries..."
            className="sb-input"
            autoFocus
            data-testid="search-input"
          />
          {query && (
            <button type="button" onClick={handleClear} className="sb-clear-btn" data-testid="search-clear-btn">
              <X style={{ width: '0.875rem', height: '0.875rem' }} />
            </button>
          )}
          <button
            type="button"
            onClick={() => { setIsExpanded(false); handleClear(); }}
            className="sb-esc-btn"
            data-testid="search-close-btn"
          >
            ESC
          </button>
        </motion.form>
      )}
    </div>
  );
}
