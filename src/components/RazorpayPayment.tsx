// Temporary stub — will be replaced by Lovable Stripe checkout in a follow-up step.
import { ReactNode } from "react";
import { toast } from "sonner";

interface Props {
  amount?: number;
  plan?: string;
  planName?: string;
  planId?: string;
  onSuccess?: () => void | Promise<void>;
  onError?: (error: any) => void;
  children?: ReactNode;
  className?: string;
}

export function RazorpayPayment({ children, className = "" }: Props) {
  return (
    <button
      type="button"
      className={`j-btn primary ${className}`}
      onClick={() =>
        toast.info("Checkout is being upgraded to Stripe. It will be live shortly.")
      }
    >
      {children ?? "Upgrade"}
    </button>
  );
}

export default RazorpayPayment;
