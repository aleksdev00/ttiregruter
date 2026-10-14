import {AppShell} from '@/src/features/AppShell';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'TTI Recruiting', description: 'TTI recruiter conversation and application workflow.' };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="en"><body><AppShell>{children}</AppShell></body></html>; }
