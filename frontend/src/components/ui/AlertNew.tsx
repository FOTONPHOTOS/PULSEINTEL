import React from "react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "default" | "destructive";
}

export const Alert: React.FC<AlertProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const variantClasses = {
    default: "bg-background text-foreground",
    destructive: "bg-red-500/15 text-red-500 border-red-500/50"
  };

  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border p-4 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

export const AlertTitle: React.FC<AlertTitleProps> = ({
  className = "",
  ...props
}) => {
  return (
    <h5
      className={`mb-1 font-medium leading-none tracking-tight ${className}`}
      {...props}
    />
  );
};

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
}

export const AlertDescription: React.FC<AlertDescriptionProps> = ({
  className = "",
  ...props
}) => {
  return (
    <div
      className={`text-sm ${className}`}
      {...props}
    />
  );
}; 