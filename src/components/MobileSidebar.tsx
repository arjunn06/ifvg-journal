import { 
  LayoutDashboard, 
  PlusCircle, 
  Calendar, 
  BookOpen,
  StickyNote,
  Building2,
  Target,
  TrendingUp,
  X
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger 
} from '@/components/ui/sheet';
import { UserProfileManager } from '@/components/UserProfileManager';
import { useSidebar } from '@/components/ui/sidebar';
import { useEffect } from 'react';

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
  { title: 'Notes', url: '/notes', icon: StickyNote },
];

interface MobileSidebarProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileSidebar({ children, open, onOpenChange }: MobileSidebarProps) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const currentPath = location.pathname;

  const getNavCls = (isActive: boolean) =>
    isActive ? 
      "bg-primary text-primary-foreground font-medium shadow-sm w-full justify-start rounded-md" : 
      "text-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full justify-start rounded-md";

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(false);
    }
    setOpenMobile?.(false);
  }, [location.pathname, onOpenChange, setOpenMobile]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground rounded-lg p-2">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-left">IFVG Journal</SheetTitle>
                  <p className="text-xs text-muted-foreground">Trading Journal</p>
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 p-4 space-y-6 overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Trading
              </h3>
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <Button
                    key={item.title}
                    variant="ghost"
                    asChild
                    className={getNavCls(currentPath === item.url)}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4 mr-3" />
                      {item.title}
                    </NavLink>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                System
              </h3>
              <div className="space-y-1">
                {systemItems.map((item) => (
                  <Button
                    key={item.title}
                    variant="ghost"
                    asChild
                    className={getNavCls(currentPath === item.url)}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4 mr-3" />
                      {item.title}
                    </NavLink>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t">
            <UserProfileManager collapsed={false} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}