import { useEffect, useState } from 'react';
import { Check, Play, RotateCcw, Sparkles, Volume2, X } from 'lucide-react';
import type { CeremonyConfig } from '../types/ceremony';
import { DEFAULT_YOUTUBE_URL, extractYouTubeVideoId } from '../utils/gestureEngine';

interface StageSettingsModalProps {
  open: boolean;
  config: CeremonyConfig;
  onClose: () => void;
  onSave: (next: CeremonyConfig) => void;
  onTestApplause: () => void;
  onJumpToVideo: () => void;
  onJumpToOutro: () => void;
}

export function StageSettingsModal({
  open,
  config,
  onClose,
  onSave,
  onTestApplause,
  onJumpToVideo,
  onJumpToOutro,
}: StageSettingsModalProps) {
  const [draft, setDraft] = useState<CeremonyConfig>(config);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setUrlError(null);
    }
  }, [open, config]);

  if (!open) return null;

  const parsedId = extractYouTubeVideoId(draft.youtubeUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.eventTitle.trim()) {
      return;
    }
    if (!extractYouTubeVideoId(draft.youtubeUrl)) {
      setUrlError('Sila masukkan pautan YouTube yang sah (contoh: https://youtu.be/ItXTuf-SHaA).');
      return;
    }
    onSave({
      ...draft,
      eventTitle: draft.eventTitle.trim(),
      eventSubtitle: draft.eventSubtitle.trim(),
      vipName: draft.vipName.trim(),
      vipTitle: draft.vipTitle.trim(),
      eventDate: draft.eventDate.trim(),
      youtubeUrl: draft.youtubeUrl.trim(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-settings-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-[#070E21] border-l border-slate-800 px-6 py-6 flex flex-col justify-between shadow-2xl">
        <div>
          <div className="flex items-center justify-between pb-5 border-b border-slate-800">
            <div>
              <h2
                id="stage-settings-title"
                className="font-display text-xl font-semibold text-white"
              >
                Tetapan Pentas & Majlis
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Sesuaikan maklumat perasmian dan pautan video pelancaran.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup tetapan"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form id="stage-settings-form" onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="cfg-event-title"
                className="block text-sm font-medium text-slate-200 mb-1.5"
              >
                Tajuk Majlis
              </label>
              <input
                id="cfg-event-title"
                type="text"
                required
                value={draft.eventTitle}
                onChange={(e) => setDraft({ ...draft, eventTitle: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cfg-event-subtitle"
                className="block text-sm font-medium text-slate-200 mb-1.5"
              >
                Tema / Penerangan Ringkas
              </label>
              <textarea
                id="cfg-event-subtitle"
                rows={2}
                value={draft.eventSubtitle}
                onChange={(e) => setDraft({ ...draft, eventSubtitle: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cfg-vip-name"
                  className="block text-sm font-medium text-slate-200 mb-1.5"
                >
                  Nama Perasmi
                </label>
                <input
                  id="cfg-vip-name"
                  type="text"
                  value={draft.vipName}
                  onChange={(e) => setDraft({ ...draft, vipName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="cfg-vip-title"
                  className="block text-sm font-medium text-slate-200 mb-1.5"
                >
                  Jawatan Perasmi
                </label>
                <input
                  id="cfg-vip-title"
                  type="text"
                  value={draft.vipTitle}
                  onChange={(e) => setDraft({ ...draft, vipTitle: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="cfg-event-date"
                className="block text-sm font-medium text-slate-200 mb-1.5"
              >
                Tarikh & Lokasi
              </label>
              <input
                id="cfg-event-date"
                type="text"
                value={draft.eventDate}
                onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="cfg-youtube-url"
                  className="block text-sm font-medium text-slate-200"
                >
                  Pautan Video Perasmian (YouTube)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ ...draft, youtubeUrl: DEFAULT_YOUTUBE_URL });
                    setUrlError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Asal</span>
                </button>
              </div>
              <input
                id="cfg-youtube-url"
                type="url"
                required
                value={draft.youtubeUrl}
                onChange={(e) => {
                  setDraft({ ...draft, youtubeUrl: e.target.value });
                  setUrlError(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white font-mono focus:border-amber-400 focus:outline-none"
              />
              {urlError ? (
                <p className="text-xs text-rose-400 mt-1.5">{urlError}</p>
              ) : parsedId ? (
                <p className="text-xs text-slate-400 mt-1.5">
                  ID Video disahkan:{' '}
                  <span className="font-mono text-amber-300">{parsedId}</span>
                </p>
              ) : null}
            </div>
          </form>

          {/* Operator Soundcheck & Rehearsal Shortcuts */}
          <div className="mt-7 pt-5 border-t border-slate-800 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">
              Kawalan Raptai & Ujian Teknikal
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={onTestApplause}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900/70 text-sm text-slate-200 hover:border-amber-400/50 hover:text-amber-200 transition-colors"
              >
                <Volume2 className="h-4 w-4 text-amber-300" />
                <span>Uji Bunyi Tepukan Meriah</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onJumpToVideo();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-900/70 text-xs font-medium text-slate-200 hover:border-amber-400/50 hover:text-amber-200 transition-colors whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 text-amber-300" />
                  <span>Pratonton Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onJumpToOutro();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-900/70 text-xs font-medium text-slate-200 hover:border-amber-400/50 hover:text-amber-200 transition-colors whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>Pratonton Outro</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="stage-settings-form"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-400 text-[#040814] text-sm font-semibold hover:bg-amber-300 transition-colors"
          >
            <Check className="h-4 w-4" />
            <span>Simpan Tetapan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
