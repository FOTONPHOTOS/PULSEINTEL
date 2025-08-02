import React from "react";

interface SeparatorProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export const Separator: React.FC<SeparatorProps> = ({
  className = "",
  orientation = "horizontal",
  decorative = true,
  ...props
}) => {
  const ariaProps = decorative
    ? { role: "none" }
    : { role: "separator", "aria-orientation": orientation };

  return (
    <div
      className={`shrink-0 bg-gray-200 dark:bg-gray-800 ${
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px"
      } ${className}`}
      {...ariaProps}
      {...props}
    />
  );
}; 