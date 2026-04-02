import { cn } from "@/lib/utils";
import { getSongById } from "@/song-bank";
import { getYouTubeBackgroundEmbedUrl } from "@/features/youtube";

export const MenuVideoBackground = ({ className }: { className?: string }) => {
  const song = getSongById("blinding-lights");
  const embedUrl = song ? getYouTubeBackgroundEmbedUrl(song.youtubeUrl) : null;

  if (!embedUrl) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <iframe
        src={embedUrl}
        title="Ambient music video background"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-screen w-[177.78vh] min-w-screen -translate-x-1/2 -translate-y-1/2 scale-125 border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/70 via-background/50 to-background/80"
        aria-hidden
      />
    </div>
  );
};
