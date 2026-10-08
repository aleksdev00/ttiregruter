import {PrivateSiteShell} from '@/src/features/PrivateSiteShell';
import type { Metadata } from 'next';
import { DemoProvider } from '@/src/features/provider';
import './globals.css';
export const metadata: Metadata = { title: 'TTI Recruiter — PRIVATE performance test', description: 'TTI recruiter conversation and application workflow.' };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="en"><body><PrivateSiteShell>{children}</PrivateSiteShell></body></html>; }
