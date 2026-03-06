import { useState, useRef, useEffect } from 'react';
import { Plus, Link as LinkIcon, Edit3, X } from 'lucide-react';

interface FloatingActionButtonProps {
  onManualClick: () => void;
  onLinkSubmit: (link: string) => void;
}

export function FloatingActionButton({ onManualClick, onLinkSubmit }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [link, setLink] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showLinkInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showLinkInput]);

  const handleSubmitLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (link.trim()) {
      onLinkSubmit(link);
      setLink('');
      setShowLinkInput(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {showLinkInput ? (
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 w-80 mb-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Add by Link</h3>
            <button 
              onClick={() => setShowLinkInput(false)}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmitLink} className="space-y-3">
            <input
              ref={inputRef}
              type="url"
              placeholder="Paste job post URL..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              Analyze Link
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className={`flex flex-col items-end gap-3 mb-4 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
            <button
              onClick={() => {
                setShowLinkInput(true);
                setIsOpen(false);
              }}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition active:scale-95 group"
            >
              <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">By link</span>
              <div className="bg-blue-100 p-1.5 rounded-full group-hover:bg-blue-200 transition">
                <LinkIcon className="w-4 h-4 text-blue-600" />
              </div>
            </button>
            <button
              onClick={() => {
                onManualClick();
                setIsOpen(false);
              }}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition active:scale-95 group"
            >
              <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">Add manually</span>
              <div className="bg-blue-100 p-1.5 rounded-full group-hover:bg-blue-200 transition">
                <Edit3 className="w-4 h-4 text-blue-600" />
              </div>
            </button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-14 h-14 bg-blue-600 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 ${isOpen ? 'rotate-45' : ''} hover:bg-blue-700 hover:scale-110 active:scale-95`}
          >
            <Plus className="w-8 h-8" />
          </button>
        </>
      )}
    </div>
  );
}
