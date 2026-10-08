'use client';
import {usePathname} from 'next/navigation';
import {DemoProvider} from './provider';
import {PrivatePerformanceBar} from './PrivatePerformanceBar';
export function PrivateSiteShell({children}:{children:React.ReactNode}){const path=usePathname();if(path==='/login')return children;return <><PrivatePerformanceBar/><DemoProvider>{children}</DemoProvider></>;}
