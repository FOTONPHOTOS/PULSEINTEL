import React from "react";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  className?: string;
}

export const Table: React.FC<TableProps> = ({
  className = "",
  ...props
}) => {
  return (
    <table
      className={`min-w-full w-full border-collapse text-left ${className}`}
      {...props}
    />
  );
};

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  className = "",
  ...props
}) => {
  return <thead className={`border-b ${className}`} {...props} />;
};

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({
  className = "",
  ...props
}) => {
  return <tbody className={className} {...props} />;
};

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({
  className = "",
  ...props
}) => {
  return <tr className={`border-b transition-colors ${className}`} {...props} />;
};

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({
  className = "",
  ...props
}) => {
  return <th className={`px-4 py-3 text-sm font-medium text-gray-500 ${className}`} {...props} />;
};

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({
  className = "",
  ...props
}) => {
  return <td className={`px-4 py-3 ${className}`} {...props} />;
}; 