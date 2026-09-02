import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "default"
  | "outline"
  | "ghost"
  | "success"
  | "warning";

type ButtonSize =
  | "sm"
  | "default"
  | "lg"
  | "icon";

type ButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
  };

export function Button({
  children,
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  const variantStyles: Record<
    ButtonVariant,
    string
  > = {
    primary:
      "bg-gray-900 text-white hover:bg-black",

    default:
      "bg-gray-900 text-white hover:bg-black",

    secondary:
      "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",

    outline:
      "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",

    ghost:
      "bg-transparent text-gray-700 hover:bg-gray-100",

    danger:
      "bg-red-600 text-white hover:bg-red-700",

    success:
      "bg-green-600 text-white hover:bg-green-700",

    warning:
      "bg-amber-500 text-white hover:bg-amber-600",
  };

  const sizeStyles: Record<
    ButtonSize,
    string
  > = {
    sm:
      "h-8 px-3 text-xs",

    default:
      "h-10 px-4 py-2 text-sm",

    lg:
      "h-11 px-6 text-sm",

    icon:
      "h-10 w-10 p-0",
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </button>
  );
}
