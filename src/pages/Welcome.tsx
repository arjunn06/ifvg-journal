import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { userPreferences } from '@/utils/secureStorage';
import { logger } from '@/lib/logger';

const Welcome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleComplete = async () => {
    if (!user) return;

    try {
      // Set secure storage immediately to prevent loops
      await userPreferences.setOnboardingComplete();
      
      // Mark onboarding as completed in database
      const { error } = await supabase
        .from('profiles')
        .update({ has_completed_onboarding: true })
        .eq('user_id', user.id);

      if (error) {
        logger.apiError('Welcome - updating onboarding status', error);
        toast({
          title: "Error",
          description: "Failed to save onboarding progress. Please try again.",
          variant: "destructive"
        });
        // Don't return here - still navigate since localStorage is set
      }

      navigate('/dashboard');
    } catch (error) {
      logger.apiError('Welcome - completing onboarding', error);
      toast({
        title: "Error", 
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
      // Still navigate since localStorage is already set
      navigate('/dashboard');
    }
  };

  return <WelcomeScreen onComplete={handleComplete} />;
};

export default Welcome;