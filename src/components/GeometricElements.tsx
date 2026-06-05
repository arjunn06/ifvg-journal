import React from 'react';

export const GeometricElements = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main geometric shape */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 opacity-30">
        <div className="relative w-full h-full">
          {/* Large cube */}
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-gradient-to-br from-brand-blue/20 to-purple-500/20 rotate-12 transform-gpu animate-pulse-gentle">
            <div className="absolute inset-2 bg-gradient-to-tl from-brand-blue/10 to-transparent rounded-sm" />
          </div>
          
          {/* Medium cube */}
          <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-brand-blue/20 -rotate-12 transform-gpu animate-bounce-gentle">
            <div className="absolute inset-1 bg-gradient-to-tl from-purple-500/10 to-transparent rounded-sm" />
          </div>
          
          {/* Small cube */}
          <div className="absolute top-3/4 right-1/2 w-12 h-12 bg-gradient-to-br from-brand-blue/30 to-purple-600/30 rotate-45 transform-gpu">
            <div className="absolute inset-1 bg-gradient-to-tl from-brand-blue/15 to-transparent rounded-sm" />
          </div>
          
          {/* Floating elements */}
          <div className="absolute top-1/3 right-1/2 w-6 h-6 bg-brand-blue/40 rounded-full animate-bounce-gentle" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-2/3 right-1/4 w-4 h-4 bg-purple-500/40 rotate-45 animate-pulse-gentle" style={{ animationDelay: '1s' }} />
        </div>
      </div>
      
      {/* Background grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, rgba(120,119,198,0.05) 0%, transparent 50%), 
                         radial-gradient(circle at 75% 75%, rgba(59,130,246,0.05) 0%, transparent 50%)`
      }} />
    </div>
  );
};