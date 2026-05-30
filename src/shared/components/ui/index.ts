/**
 * UI PRIMITIVES — Barrel Export
 *
 * 5-component primitive library:
 * - Button — 11 variants, 7 sizes, loading state, asChild support
 * - Card — 7 variants, 4 sizes, 4 hover effects, sub-components
 * - Input — 5 variants, 4 sizes, error state, label/icon/helper support
 * - Badge — 9 variants, 3 sizes, dot indicator, removable option
 * - Modal — 5 sizes, backdrop blur, ESC/overlay close, sub-components
 */

export { Button, buttonVariants } from "./Button";
export type { ButtonProps } from "./Button";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
} from "./Card";
export type { CardProps } from "./Card";

export { Input, inputVariants } from "./Input";
export type { InputProps } from "./Input";

export { Badge, badgeVariants } from "./Badge";
export type { BadgeProps } from "./Badge";

export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  modalVariants,
} from "./Modal";
export type { ModalProps } from "./Modal";

// Re-export existing UI primitives
export { ToastProvider, ToastContainer, useToast } from "./Toast";
export type { Toast } from "./Toast";

export { Progress } from "./progress";

export { CountUpText } from "./CountUpText";
export type { CountUpTextProps } from "./CountUpText";
