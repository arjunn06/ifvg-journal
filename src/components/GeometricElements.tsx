import React from 'react';

export const GeometricElements = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-30">
        <div className="relative w-full h-full">
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-gradient-to-br from-primary/20 to-muted/40 rotate-12 transform-gpu animate-pulse-gentle">
            <div className="absolute inset-2 bg-gradient-to-tl from-primary/10 to-transparent rounded-sm" />
          </div>
          <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-gradient-to-br from-muted/40 to-primary/20 -rotate-12 transform-gpu animate-bounce-gentle">
            <div className="absolute inset-1 bg-gradient-to-tl from-muted/30 to-transparent rounded-sm" />
          </div>
          <div className="absolute top-3/4 right-1/2 w-12 h-12 bg-gradient-to-br from-primary/30 to-muted/40 rotate-45 transform-gpu">
            <div className="absolute inset-1 bg-gradient-to-tl from-primary/15 to-transparent rounded-sm" />
          </div>
          <div className="absolute top-1/3 right-1/2 w-6 h-6 bg-primary/40 rounded-full animate-bounce-gentle" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-2/3 right-1/4 w-4 h-4 bg-muted/60 rotate-45 animate-pulse-gentle" style={{ animationDelay: '1s' }} />
        </div>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.03),transparent_50%)]" />
    </div>
  );
};
