import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileHeader } from '@/components/MobileHeader';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SearchCommand } from '@/components/SearchCommand';
import { ThemeToggle } from '@/components/ThemeToggle';
interface DashboardLayoutProps {
  children: ReactNode;
}
export function DashboardLayout({
  children
}: DashboardLayoutProps) {
  return <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        {/* Enhanced header for desktop */}
        <div className="hidden lg:block fixed top-0 right-0 left-64 z-40">
          
        </div>
        
        {/* Mobile header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50">
          <MobileHeader />
        </div>
        
        <main className="flex-1 transition-all duration-300 ease-in-out lg:ml-64 lg:pt-16 pt-16 p-2 sm:p-4 md:p-6 lg:p-8 xl:p-10">
          <div className="animate-fade-in max-w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>;
}