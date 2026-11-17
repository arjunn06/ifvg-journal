// The journal is not sold on its own: it comes with the Blue Pill, the IFVG trading course.
// One place for the details the landing page, the no-access screen and the membership page all quote.
// Source of truth for the offer itself: https://blueprint.ifvg.in/bluepill

export const BLUEPILL = {
  url: 'https://blueprint.ifvg.in/bluepill',
  name: 'The Blue Pill',
  tagline: 'Premium education doesn’t mean premium price.',
  price: '₹499',
  per: 'a month + taxes',
  billing: 'Billed monthly through Razorpay. Cancel anytime, no lock-in.',
  /** What a member gets besides the journal, in the order the course page lists it. */
  includes: [
    'Every Red Pill class recording, uncut: nine modules from your first candle to prop firm ready execution',
    'Live NY trading streams, including high impact news events',
    'Trade alerts and the Discord, with your Blue Pill role',
    'One private call a month, booked from your member panel',
  ],
} as const;

export const SUPPORT_EMAIL = 'support@ifvg.in';
