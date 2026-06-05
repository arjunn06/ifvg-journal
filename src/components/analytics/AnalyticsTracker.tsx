import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function AnalyticsTracker() {
  const { user } = useAuth();

  useEffect(() => {
    const trackEvent = async (eventType: string, eventData?: any) => {
      try {
        await supabase.from('app_analytics').insert({
          event_type: eventType,
          event_data: eventData,
          user_id: user?.id || null,
          session_id: sessionStorage.getItem('session_id') || null,
          ip_address: null, // Will be populated by server if needed
          user_agent: navigator.userAgent
        });
      } catch (error) {
        console.error('Analytics tracking error:', error);
      }
    };

    // Track page view
    trackEvent('page_view', {
      url: window.location.pathname,
      timestamp: new Date().toISOString()
    });

    // Track errors
    const handleError = (event: ErrorEvent) => {
      trackEvent('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    };

    // Track unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      trackEvent('error', {
        type: 'unhandled_promise_rejection',
        reason: event.reason
      });
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Generate or get session ID
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', crypto.randomUUID());
    }

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user]);

  return null;
}