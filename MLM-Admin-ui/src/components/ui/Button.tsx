import React from 'react'

export type ButtonVariant = 
  | 'primary'      // Blue - for primary actions
  | 'success'      // Green - for add/create actions
  | 'secondary'    // Grey - for secondary actions
  | 'outline'      // White with border - for export/print
  | 'danger'       // Red - for delete actions
  | 'warning'      // Yellow - for warning actions

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark border-primary hover:border-primary-dark',
  success: 'bg-[#28a745] text-white hover:bg-[#1e7e34] border-[#28a745] hover:border-[#1e7e34]',
  secondary: 'bg-[#6c757d] text-white hover:bg-[#5a6268] border-[#6c757d] hover:border-[#5a6268]',
  outline: 'bg-white text-[#333] hover:bg-[#f9f9f9] border-[#ccc] hover:border-[#aaa]',
  danger: 'bg-[#dc3545] text-white hover:bg-[#c82333] border-[#dc3545] hover:border-[#c82333]',
  warning: 'bg-[#ffc107] text-[#333] hover:bg-[#e0a800] border-[#ffc107] hover:border-[#e0a800]',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
}

export function Button({ 
  variant = 'outline', 
  size = 'md',
  className = '',
  children,
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantClass = variantStyles[variant]
  const sizeClass = sizeStyles[size]
  
  // Focus ring color based on variant
  const focusRingColor = 
    variant === 'primary' ? 'focus:ring-primary' :
    variant === 'success' ? 'focus:ring-[#28a745]' :
    variant === 'secondary' ? 'focus:ring-[#6c757d]' :
    variant === 'danger' ? 'focus:ring-[#dc3545]' :
    variant === 'warning' ? 'focus:ring-[#ffc107]' :
    'focus:ring-[#ccc]'

  return (
    <button
      className={`${baseStyles} ${variantClass} ${sizeClass} ${focusRingColor} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button

