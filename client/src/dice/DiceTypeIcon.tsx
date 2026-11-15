/** Silhuetas dos poliedros, com facetas legíveis mesmo nos seletores pequenos. */
export function DiceTypeIcon({ sides }: { sides: number }) {
  const desenho = sides === 4
    ? { contorno: 'M20 3 37 35H3Z', facetas: 'M20 3V25L3 35M20 25 37 35' }
    : sides === 6
      ? { contorno: 'M20 3 36 11V29L20 37 4 29V11Z', facetas: 'M4 11 20 19 36 11M20 19V37' }
      : sides === 8
        ? { contorno: 'M20 2 37 20 20 38 3 20Z', facetas: 'M20 2 29 25 11 25ZM3 20 11 25 20 38 29 25 37 20' }
        : sides === 12
          ? { contorno: 'M12 3H28L38 16 32 33 20 38 8 33 2 16Z', facetas: 'M20 10 30 17 26 29H14L10 17ZM12 3 20 10 28 3M38 16 30 17M32 33 26 29M20 38 20 29M8 33 14 29M2 16 10 17' }
          : sides === 20
            ? { contorno: 'M20 2 36 11V29L20 38 4 29V11Z', facetas: 'M20 2 29 25H11ZM4 11 11 25 4 29M36 11 29 25 36 29M11 25 20 38 29 25' }
            : { contorno: 'M20 2 36 15 31 30 20 38 9 30 4 15Z', facetas: 'M20 2 12 22 20 38 28 22ZM4 15 12 22M36 15 28 22' };
  return (
    <svg className="dice-type-icon" viewBox="0 0 40 40" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d={desenho.contorno} fill="currentColor" fillOpacity="0.08" />
      <path d={desenho.facetas} opacity="0.6" />
      {sides === 100 ? <path d="M25 3 39 15 35 29" opacity="0.7" /> : null}
    </svg>
  );
}
