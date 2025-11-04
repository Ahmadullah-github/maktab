import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { useLanguageCtx } from "@/i18n/provider"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants> & {
      rtlAware?: boolean;
    }
>(({ className, rtlAware = true, ...props }, ref) => {
  const { isRTL } = useLanguageCtx();
  
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        labelVariants(),
        rtlAware && isRTL && "text-right",
        className
      )}
      {...props}
    />
  );
})
Label.displayName = LabelPrimitive.Root.displayName

export { Label }