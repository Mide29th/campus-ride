import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="fixed top-3 left-3 z-50 flex items-center justify-center w-7 h-7 rounded-full bg-white/80 backdrop-blur shadow border border-gray-200/60 text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
      aria-label="Go back"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </button>
  );
}
