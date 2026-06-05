-- Mark arjunn0606@gmail.com as premium user with 10 years subscription
INSERT INTO subscribers (email, subscription_tier, subscribed, subscription_end)
VALUES (
  'arjunn0606@gmail.com',
  'professional', 
  true, 
  now() + interval '10 years'
)
ON CONFLICT (email) 
DO UPDATE SET 
  subscription_tier = 'professional',
  subscribed = true,
  subscription_end = now() + interval '10 years',
  updated_at = now();