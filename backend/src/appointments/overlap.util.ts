export function rangesOverlapWithBuffer(
  candidateStart: Date,
  candidateEnd: Date,
  existingStart: Date,
  existingEnd: Date,
  bufferMin: number,
): boolean {
  const bufferMs = Math.max(0, bufferMin) * 60_000;
  return (
    candidateStart.getTime() < existingEnd.getTime() + bufferMs &&
    candidateEnd.getTime() > existingStart.getTime()
  );
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
