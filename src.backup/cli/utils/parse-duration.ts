export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([hms])?$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Use format like "30s", "1m", "90s"`
    );
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2] || 's';

  switch (unit) {
    case 's': {
      return value * 1000;
    }
    case 'm': {
      return value * 60 * 1000;
    }
    case 'h': {
      return value * 60 * 60 * 1000;
    }
    default: {
      throw new Error(`Unknown duration unit: ${unit}`);
    }
  }
}
