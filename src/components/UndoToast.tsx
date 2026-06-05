import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Undo2 } from 'lucide-react';

interface UndoToastProps {
  onUndo: () => void;
  message: string;
  duration?: number;
}

export function useUndoToast() {
  const { toast, dismiss } = useToast();

  const showUndoToast = ({ onUndo, message, duration = 5000 }: UndoToastProps) => {
    const toastId = toast({
      title: message,
      description: "This action can be undone",
      duration,
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onUndo();
            dismiss();
          }}
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Undo
        </Button>
      ),
    });

    return toastId;
  };

  return { showUndoToast };
}