'use client'

import { forwardRef, useImperativeHandle } from 'react'
import { motion } from 'framer-motion'
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const variantStyles = {
  default: 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-main dark:text-white',
  success: 'bg-surface-light dark:bg-surface-dark border-green-600/60 dark:border-green-400/60 text-text-main dark:text-white',
  error: 'bg-surface-light dark:bg-surface-dark border-red-600/60 dark:border-red-400/60 text-text-main dark:text-white',
  warning: 'bg-surface-light dark:bg-surface-dark border-amber-600/70 dark:border-amber-400/70 text-text-main dark:text-white',
}

const titleColor = {
  default: 'text-text-main dark:text-white',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
}

const iconColor = {
  default: 'text-text-secondary dark:text-gray-300',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
}

const variantIcons = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
}

const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 50, scale: 0.95 },
}

export function showToast({
  title,
  message,
  variant = 'default',
  duration = 4000,
  position = 'bottom-center',
  actions,
  onDismiss,
  highlightTitle,
}) {
  const Icon = variantIcons[variant] || Info

  return sonnerToast.custom(
    (toastId) => (
      <motion.div
        variants={toastAnimation}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          'flex items-center justify-between w-full max-w-md p-4 rounded-xl border shadow-xl backdrop-blur-sm',
          variantStyles[variant] || variantStyles.default
        )}
      >
        <div className="flex items-start gap-2">
          <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconColor[variant] || iconColor.default)} />
          <div className="space-y-1">
            {title && (
              <h3
                className={cn(
                  'text-sm font-semibold leading-none',
                  titleColor[variant] || titleColor.default,
                  highlightTitle && titleColor.success
                )}
              >
                {title}
              </h3>
            )}
            <p className="text-sm text-text-secondary dark:text-gray-200 leading-snug">{message}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions?.label && (
            <Button
              variant={actions.variant || 'outline'}
              size="sm"
              onClick={() => {
                actions.onClick()
                sonnerToast.dismiss(toastId)
              }}
              className={cn(
                'cursor-pointer',
                variant === 'success'
                  ? 'text-green-600 border-green-600 hover:bg-green-600/10 dark:hover:bg-green-400/20'
                  : variant === 'error'
                    ? 'text-destructive border-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20'
                    : variant === 'warning'
                      ? 'text-amber-600 border-amber-600 hover:bg-amber-600/10 dark:hover:bg-amber-400/20'
                      : 'text-text-main dark:text-white border-border-light dark:border-border-dark hover:bg-black/5 dark:hover:bg-white/10'
              )}
            >
              {actions.label}
            </Button>
          )}

          <button
            onClick={() => {
              sonnerToast.dismiss(toastId)
              onDismiss?.()
            }}
            className="rounded-full p-1.5 hover:bg-black/10 dark:hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4 text-text-secondary dark:text-gray-300" />
          </button>
        </div>
      </motion.div>
    ),
    { duration, position }
  )
}

export const notify = {
  info: (message, options = {}) => showToast({ message, variant: 'default', ...options }),
  success: (message, options = {}) => showToast({ message, variant: 'success', ...options }),
  error: (message, options = {}) => showToast({ message, variant: 'error', ...options }),
  warning: (message, options = {}) => showToast({ message, variant: 'warning', ...options }),
}

export const Toaster = forwardRef(function Toaster({ defaultPosition = 'bottom-center' }, ref) {
  useImperativeHandle(ref, () => ({
    show(props) {
      showToast({ ...props, position: props.position || defaultPosition })
    },
  }))

  return (
    <SonnerToaster
      position={defaultPosition}
      toastOptions={{ unstyled: true, className: 'flex justify-center px-4' }}
    />
  )
})
