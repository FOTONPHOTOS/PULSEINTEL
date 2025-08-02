import React, { useState } from "react";

interface TooltipProps {
  children: React.ReactNode;
  delayDuration?: number;
  className?: string;
}

interface TooltipContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  content: React.ReactNode;
  setContent: React.Dispatch<React.SetStateAction<React.ReactNode>>;
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined);

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<React.ReactNode>(null);

  return (
    <TooltipContext.Provider value={{ open, setOpen, content, setContent }}>
      <div className={`relative inline-block ${className}`}>
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

interface TooltipTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({
  children,
  className = "",
  asChild = false,
}) => {
  const context = React.useContext(TooltipContext);

  if (!context) {
    throw new Error("TooltipTrigger must be used within a Tooltip");
  }

  const { setOpen } = context;

  const childProps = {
    className: `inline-block ${className}`,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, childProps);
  }

  return <div {...childProps}>{children}</div>;
};

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export const TooltipContent: React.FC<TooltipContentProps> = ({
  children,
  className = "",
  side = "top",
  align = "center",
}) => {
  const context = React.useContext(TooltipContext);

  if (!context) {
    throw new Error("TooltipContent must be used within a Tooltip");
  }

  const { open, setContent } = context;

  React.useEffect(() => {
    setContent(children);
  }, [children, setContent]);

  if (!open) return null;

  const getPositionClasses = () => {
    const positions = {
      top: {
        start: "bottom-full left-0 mb-1",
        center: "bottom-full left-1/2 -translate-x-1/2 mb-1",
        end: "bottom-full right-0 mb-1",
      },
      right: {
        start: "left-full top-0 ml-1",
        center: "left-full top-1/2 -translate-y-1/2 ml-1",
        end: "left-full bottom-0 ml-1",
      },
      bottom: {
        start: "top-full left-0 mt-1",
        center: "top-full left-1/2 -translate-x-1/2 mt-1",
        end: "top-full right-0 mt-1",
      },
      left: {
        start: "right-full top-0 mr-1",
        center: "right-full top-1/2 -translate-y-1/2 mr-1",
        end: "right-full bottom-0 mr-1",
      },
    };

    return positions[side][align];
  };

  return (
    <div
      className={`absolute z-50 max-w-xs rounded-md bg-gray-800 px-3 py-1.5 text-xs text-white animate-fade-in ${getPositionClasses()} ${className}`}
      role="tooltip"
    >
      {children}
    </div>
  );
};

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};

export * from './tooltip'; 