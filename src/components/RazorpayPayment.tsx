// Temporary stub — will be replaced by Lovable Stripe checkout in a follow-up step.
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  amount?: number;
  planName?: string;
  planId?: string;
  onSuccess?: () => void;
  children?: ReactNode;
  className?: string;
}

export function RazorpayPayment({ children, className }: Props) {
  return (
    <Button
      className={className}
      onClick={() =>
        toast.info("Checkout is being upgraded to Stripe. It will be live shortly.")
      }
    >
      {children ?? "Upgrade"}
    </Button>
  );
}

export default RazorpayPayment;
