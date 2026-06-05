
import { 
  LayoutDashboard, 
  PlusCircle, 
  Calendar, 
  Settings,
  BookOpen,
  StickyNote,
  Building2,
  Target,
  TrendingUp,
  LogOut,
  Crown,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { UserProfileManager } from '@/components/UserProfileManager';
import { useSubscription } from '@/hooks/useSubscription';
import { LogoMark } from '@/components/LogoMark';

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'New Trade', url: '/trades/new', icon: PlusCircle },
  { title: 'Trade History', url: '/trades', icon: TrendingUp },
  { title: 'PNL Calendar', url: '/calendar', icon: Calendar },
];

const systemItems = [
  { title: 'Trading Accounts', url: '/accounts', icon: Building2 },
  { title: 'Strategies', url: '/strategies', icon: Target },
  { title: 'Confluence', url: '/confluence', icon: BookOpen },
  { title: 'Transactions', url: '/transactions', icon: Receipt },
  { title: 'Notes', url: '/notes', icon: StickyNote },
  { title: 'Upgrade', url: '/upgrade', icon: Crown },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const { isPremium } = useSubscription();

  const isActive = (path: string) => currentPath === path;
  const getNavCls = (isActive: boolean) =>
    isActive ? 
      "bg-primary text-primary-foreground font-medium shadow-sm w-full justify-start rounded-md transition-all duration-200 scale-[1.02]" : 
      "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 w-full justify-start rounded-md hover:scale-[1.02] hover:shadow-sm";


  return (
    <Sidebar 
      className="hidden lg:flex"
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="p-6 border-b border-sidebar-border transition-all duration-300">
        {!collapsed && (
          <div className="flex items-center gap-3 animate-fade-in">
            <LogoMark className="h-9 w-9 hover:scale-110 transition-transform duration-200" />
            <div>
              <span className="font-display text-lg text-sidebar-foreground tracking-tight">
                IFVG<span className="text-primary">Journal</span>
              </span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">Trade with patience</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="bg-primary text-primary-foreground rounded-lg h-9 w-9 mx-auto flex items-center justify-center shadow-[0_0_20px_hsl(var(--brand-red)/0.45)] hover:scale-110 transition-all duration-200 animate-fade-in">
            <span className="font-display text-base leading-none">i</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 transition-colors duration-200">
            Trading
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-1">
              {menuItems.map((item, index) => (
                <div key={item.title} className="stagger-fade" style={{ animationDelay: `${index * 0.1}s` }}>
                  <Button
                    variant="ghost"
                    asChild
                    className={getNavCls(currentPath === item.url)}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      {!collapsed && <span className="ml-3 transition-opacity duration-200">{item.title}</span>}
                    </NavLink>
                  </Button>
                </div>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 transition-colors duration-200">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-1">
              {systemItems.map((item) => {
                // Hide upgrade button for premium users
                if (item.title === 'Upgrade' && isPremium) {
                  return null;
                }
                
                return (
                  <Button
                    key={item.title}
                    variant="ghost"
                    asChild
                    className={getNavCls(currentPath === item.url)}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </Button>
                );
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <UserProfileManager collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}
