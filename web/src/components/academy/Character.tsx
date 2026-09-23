import Image from "next/image";
import { character } from "@/lib/characters";

// Round avatar for a guide or companion: the character's face crop when artwork exists, else the existing Tamil glyph.
export function CharacterAvatar({ id, size = 44, glyph, className = "" }: { id: string; size?: number; glyph: string; className?: string }) {
  const c = character(id);
  const style = { width: size, height: size };
  return c
    ? <span className={`avatar art ${className}`} style={style}><Image src={c.face} alt="" width={size} height={size} sizes={`${size}px`} /></span>
    : <span className={`avatar ${className}`} style={style} lang="ta">{glyph}</span>;
}
