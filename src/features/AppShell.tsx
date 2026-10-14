'use client';
import {usePathname} from 'next/navigation';import {DemoProvider} from './provider';
export function AppShell({children}:{children:React.ReactNode}){const path=usePathname();return ['/login','/change-password','/reset-password','/logout'].includes(path)?children:<DemoProvider>{children}</DemoProvider>;}
