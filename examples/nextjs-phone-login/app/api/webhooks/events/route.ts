import { NextResponse } from 'next/server';
import { getEvents, clearEvents } from '@/lib/webhook-store';

export async function GET() {
  return NextResponse.json({ events: getEvents() });
}

export async function DELETE() {
  clearEvents();
  return NextResponse.json({ cleared: true });
}
