import { useState, useRef, useEffect } from 'react';
import { Plus, Link as LinkIcon, Edit3, X } from 'lucide-react';

interface FloatingActionButtonProps {
  onManualClick: () => void;
  onLinkSubmit: (link: string) => void;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}

export function FloatingActionButton({ onManualClick, onLinkSubmit, isOpen, onToggle }: FloatingActionButtonProps) {
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
      onToggle(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-row-reverse items-center">
      {showLinkInput ? (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 mr-4 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Add by Link</h3>
            <button 
              onClick={() => setShowLinkInput(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
            >
              Analyze Link
            </button>
          </form>
        </div>
      ) : (
        <>
          <button
            onClick={() => onToggle(!isOpen)}
            className={`w-14 h-14 bg-blue-600 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 z-10 ${isOpen ? 'rotate-45' : ''} hover:bg-blue-700 hover:scale-110 active:scale-95`}
          >
            <Plus className="w-8 h-8" />
          </button>

          <div className={`flex flex-row-reverse items-center gap-3 mr-4 transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
            <button
              onClick={() => {
                onManualClick();
                onToggle(false);
              }}
              className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 group whitespace-nowrap"
            >
              <div className="bg-blue-100 p-1.5 rounded-full group-hover:bg-blue-200 transition-colors">
                <Edit3 className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">Add manually</span>
            </button>

            <button
              onClick={() => {
                setShowLinkInput(true);
                onToggle(false);
              }}
              className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 group whitespace-nowrap"
            >
              <div className="bg-blue-100 p-1.5 rounded-full group-hover:bg-blue-200 transition-colors">
                <LinkIcon className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">By link</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
